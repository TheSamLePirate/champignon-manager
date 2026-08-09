import {
  appError,
  cultureUnitSchema,
  domainEventSchema,
  unitPhotoAddedEventSchema,
  type CultureUnit,
  type DomainEvent,
} from '@champi/contracts';
import { err, ok, type Result } from '@champi/domain';
import type { Collection, ClientSession, Db } from 'mongodb';
import { withTransaction, type MongoConnection } from './client.js';

/**
 * Dépôt des unités de culture.
 *
 * Deux invariants tenus ici, et nulle part ailleurs :
 *
 * 1. **Toute mutation d'état écrit son événement, dans la même transaction.**
 *    C'est ce qui rend vraie la promesse « reconstructible depuis les
 *    événements » que le cadrage affirmait sans mécanisme
 *    (`claude-critics.md` P2-3).
 * 2. **Verrou optimiste systématique.** Une écriture concurrente échoue en
 *    `CONFLICT` au lieu d'écraser silencieusement (docs/08 §2.1).
 *
 * Ce module ne contient **aucune règle métier** : il traduit entre documents
 * Mongo et objets du domaine, rien de plus (docs/22 §2.2).
 */

interface UnitDocument extends Omit<CultureUnit, 'id'> {
  _id: string;
}

interface EventDocument extends Omit<DomainEvent, 'id'> {
  _id: string;
}

function toDomain(document: UnitDocument): CultureUnit {
  const { _id, ...rest } = document;
  return cultureUnitSchema.parse({ ...rest, id: _id });
}

function toDocument(unit: CultureUnit): UnitDocument {
  const { id, ...rest } = unit;
  return { ...rest, _id: id };
}

function eventToDocument(event: DomainEvent): EventDocument {
  const { id, ...rest } = event;
  return { ...rest, _id: id };
}

export class UnitRepository {
  private readonly units: Collection<UnitDocument>;
  private readonly events: Collection<EventDocument>;

  constructor(private readonly connection: MongoConnection) {
    const db: Db = connection.db;
    this.units = db.collection<UnitDocument>('lots');
    this.events = db.collection<EventDocument>('events');
  }

  /** Index alignés sur les requêtes réelles : lignée, stade, étape, emplacement. */
  async ensureIndexes(): Promise<void> {
    await this.units.createIndexes([
      { key: { publicCode: 1 }, unique: true },
      { key: { stage: 1, status: 1 } },
      { key: { parentUnitId: 1 } },
      { key: { processVersionId: 1 } },
      { key: { currentStepId: 1 } },
      { key: { 'location.roomId': 1 } },
    ]);
    await this.events.createIndexes([
      { key: { unitId: 1, occurredAt: 1 } },
      { key: { type: 1, occurredAt: 1 } },
      { key: { correlationId: 1 } },
    ]);
  }

  async findById(id: string): Promise<CultureUnit | null> {
    const document = await this.units.findOne({ _id: id });
    return document === null ? null : toDomain(document);
  }

  /**
   * Retrouve une unité par identifiant technique **ou** par code public.
   *
   * Les deux sont acceptés partout, pour qu'un agent — comme un humain —
   * puisse raisonner sur `SUB-2026-0042` (docs/22 §4.3, propriété 5).
   */
  async findByIdOrPublicCode(reference: string): Promise<CultureUnit | null> {
    const document = await this.units.findOne({
      $or: [{ _id: reference }, { publicCode: reference }],
    });
    return document === null ? null : toDomain(document);
  }

  async listByStage(stage: CultureUnit['stage']): Promise<CultureUnit[]> {
    const documents = await this.units.find({ stage }).sort({ createdAt: 1 }).toArray();
    return documents.map(toDomain);
  }

  async eventsForUnit(unitId: string): Promise<DomainEvent[]> {
    const documents = await this.events.find({ unitId }).sort({ occurredAt: 1, _id: 1 }).toArray();
    return documents.map((document) => {
      const { _id, ...rest } = document;
      return domainEventSchema.parse({ ...rest, id: _id });
    });
  }

  /**
   * Retrouve l'événement qui a déposé une photo.
   *
   * C'est le journal qui fait foi sur le type de l'image, pas l'extension du
   * fichier : un fichier renommé sur le disque ne doit pas changer ce que
   * l'application croit servir.
   */
  async findPhotoEvent(
    photoId: string,
  ): Promise<(DomainEvent & { type: 'unit.photo_added' }) | null> {
    const document = await this.events.findOne({
      type: 'unit.photo_added',
      'payload.photoId': photoId,
    });
    if (document === null) {
      return null;
    }
    const { _id, ...rest } = document;
    // On valide avec le schéma **précis** plutôt que l'union : le type est
    // alors garanti par construction, sans rétrécissement après coup — donc
    // sans branche que le filtre Mongo rend inatteignable.
    return unitPhotoAddedEventSchema.parse({ ...rest, id: _id });
  }

  /** Crée une unité et son événement de naissance, atomiquement. */
  async create(unit: CultureUnit, event: DomainEvent): Promise<Result<CultureUnit>> {
    try {
      await withTransaction(this.connection, async (session: ClientSession) => {
        await this.units.insertOne(toDocument(unit), { session });
        await this.events.insertOne(eventToDocument(event), { session });
      });
      return ok(unit);
    } catch (cause) {
      if (isDuplicateKey(cause)) {
        return err(
          appError('CONFLICT', `Le code public « ${unit.publicCode} » est déjà utilisé.`, {
            hint: 'Les codes publics sont uniques. Laisse le serveur en générer un plutôt que de le fixer.',
            path: 'publicCode',
          }),
        );
      }
      throw cause;
    }
  }

  /**
   * Remplace l'état d'une unité et journalise l'événement correspondant.
   *
   * `expectedVersion` est le verrou optimiste : la mise à jour ne s'applique
   * que si l'unité n'a pas bougé depuis la lecture. Sur Wi-Fi instable avec
   * des retries, c'est ce qui évite le double avancement silencieux.
   */
  async saveWithEvent(
    unit: CultureUnit,
    event: DomainEvent,
    expectedVersion: number,
  ): Promise<Result<CultureUnit>> {
    const conflict = await withTransaction(this.connection, async (session: ClientSession) => {
      const outcome = await this.units.replaceOne(
        { _id: unit.id, version: expectedVersion },
        toDocument(unit),
        { session },
      );
      if (outcome.matchedCount === 0) {
        // Abandonne la transaction : ni l'état ni l'événement ne sont écrits.
        await session.abortTransaction();
        return true;
      }
      await this.events.insertOne(eventToDocument(event), { session });
      return false;
    });

    if (conflict) {
      const current = await this.findById(unit.id);
      return err(
        appError(
          'CONFLICT',
          `L'unité ${unit.publicCode} a été modifiée entre-temps : la version attendue était ${String(expectedVersion)}, la version en base est ${String(current?.version ?? -1)}.`,
          {
            hint: 'Relis l’unité, réapplique ton changement sur la version courante, puis réessaie.',
            path: 'version',
          },
        ),
      );
    }
    return ok(unit);
  }

  /** Nombre d'unités par stade — utilisé par l'endpoint de découverte. */
  async countByStage(): Promise<Record<string, number>> {
    const rows = await this.units
      .aggregate<{ _id: string; count: number }>([
        { $group: { _id: '$stage', count: { $sum: 1 } } },
      ])
      .toArray();
    return Object.fromEntries(rows.map((row) => [row._id, row.count]));
  }
}

/** MongoDB signale une violation d'unicité par le code 11000. */
function isDuplicateKey(cause: unknown): boolean {
  return typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === 11000;
}
