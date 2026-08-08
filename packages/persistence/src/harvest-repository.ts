import {
  appError,
  harvestSchema,
  productBatchSchema,
  type DomainEvent,
  type Harvest,
  type ProductBatch,
} from '@champi/contracts';
import { err, ok, type Result } from '@champi/domain';
import type { ClientSession, Collection, Db } from 'mongodb';
import { withTransaction, type MongoConnection } from './client.js';

/**
 * Dépôt des récoltes et des produits finaux.
 *
 * C'est ici que se boucle la promesse « du spore à l'assiette » : le lien
 * produit → récoltes → unités est **pondéré** (proportions exactes, `q14_5`),
 * ce qui permet de remonter une barquette jusqu'aux blocs qui l'ont produite,
 * avec la part de chacun.
 *
 * Comme partout, une écriture métier et son événement partent dans la même
 * transaction.
 */

interface HarvestDocument extends Omit<Harvest, 'id'> {
  _id: string;
}

interface ProductDocument extends Omit<ProductBatch, 'id'> {
  _id: string;
}

interface EventDocument extends Omit<DomainEvent, 'id'> {
  _id: string;
}

function harvestToDomain(document: HarvestDocument): Harvest {
  const { _id, ...rest } = document;
  return harvestSchema.parse({ ...rest, id: _id });
}

function productToDomain(document: ProductDocument): ProductBatch {
  const { _id, ...rest } = document;
  return productBatchSchema.parse({ ...rest, id: _id });
}

export class HarvestRepository {
  private readonly harvests: Collection<HarvestDocument>;
  private readonly products: Collection<ProductDocument>;
  private readonly events: Collection<EventDocument>;

  constructor(private readonly connection: MongoConnection) {
    const db: Db = connection.db;
    this.harvests = db.collection<HarvestDocument>('harvests');
    this.products = db.collection<ProductDocument>('productBatches');
    this.events = db.collection<EventDocument>('events');
  }

  async ensureIndexes(): Promise<void> {
    await this.harvests.createIndexes([
      { key: { publicCode: 1 }, unique: true },
      // Un même flush ne se récolte qu'une fois par unité : sans cet index, une
      // double saisie gonflerait le rendement sans que rien ne le signale.
      { key: { unitId: 1, flushNumber: 1 }, unique: true },
      { key: { harvestedAt: 1 } },
    ]);
    await this.products.createIndexes([
      { key: { publicCode: 1 }, unique: true },
      { key: { 'origins.harvestId': 1 } },
      { key: { 'origins.unitId': 1 } },
    ]);
  }

  /** Enregistre une récolte et son événement, atomiquement. */
  async recordHarvest(harvest: Harvest, event: DomainEvent): Promise<Result<Harvest>> {
    try {
      await withTransaction(this.connection, async (session: ClientSession) => {
        const { id, ...rest } = harvest;
        await this.harvests.insertOne({ ...rest, _id: id }, { session });
        const { id: eventId, ...eventRest } = event;
        await this.events.insertOne({ ...eventRest, _id: eventId }, { session });
      });
      return ok(harvest);
    } catch (cause) {
      if (isDuplicateKey(cause)) {
        return err(
          appError(
            'CONFLICT',
            `Le flush ${String(harvest.flushNumber)} de cette unité a déjà été récolté.`,
            {
              hint: 'Une double saisie gonflerait le rendement. Corrige la récolte existante plutôt que d’en créer une seconde.',
              path: 'flushNumber',
            },
          ),
        );
      }
      throw cause;
    }
  }

  async findHarvest(id: string): Promise<Harvest | null> {
    const document = await this.harvests.findOne({ _id: id });
    return document === null ? null : harvestToDomain(document);
  }

  async findHarvestByIdOrPublicCode(reference: string): Promise<Harvest | null> {
    const document = await this.harvests.findOne({
      $or: [{ _id: reference }, { publicCode: reference }],
    });
    return document === null ? null : harvestToDomain(document);
  }

  /** Récoltes d'une unité, dans l'ordre des flushs. */
  async harvestsForUnit(unitId: string): Promise<Harvest[]> {
    const documents = await this.harvests.find({ unitId }).sort({ flushNumber: 1 }).toArray();
    return documents.map(harvestToDomain);
  }

  /** Enregistre un produit final et son événement. */
  async createProduct(product: ProductBatch, event: DomainEvent): Promise<Result<ProductBatch>> {
    try {
      await withTransaction(this.connection, async (session: ClientSession) => {
        const { id, ...rest } = product;
        await this.products.insertOne({ ...rest, _id: id }, { session });
        const { id: eventId, ...eventRest } = event;
        await this.events.insertOne({ ...eventRest, _id: eventId }, { session });
      });
      return ok(product);
    } catch (cause) {
      if (isDuplicateKey(cause)) {
        return err(
          appError('CONFLICT', `Le code produit « ${product.publicCode} » est déjà utilisé.`, {
            hint: 'Laisse le serveur générer le code plutôt que de le fixer.',
            path: 'publicCode',
          }),
        );
      }
      throw cause;
    }
  }

  async findProductByIdOrPublicCode(reference: string): Promise<ProductBatch | null> {
    const document = await this.products.findOne({
      $or: [{ _id: reference }, { publicCode: reference }],
    });
    return document === null ? null : productToDomain(document);
  }

  /**
   * Produits contenant une récolte donnée.
   *
   * C'est la traçabilité **descendante** : d'un bloc contaminé vers les
   * barquettes déjà parties. La question qu'un rappel sanitaire pose.
   */
  async productsFromUnit(unitId: string): Promise<ProductBatch[]> {
    const documents = await this.products
      .find({ 'origins.unitId': unitId })
      .sort({ producedAt: 1 })
      .toArray();
    return documents.map(productToDomain);
  }
}

function isDuplicateKey(cause: unknown): boolean {
  return typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === 11000;
}
