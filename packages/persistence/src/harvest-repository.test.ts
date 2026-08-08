import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DomainEvent, Harvest, ProductBatch } from '@champi/contracts';
import { connect, type MongoConnection } from './client.js';
import { HarvestRepository } from './harvest-repository.js';

const TEST_DB = `champignon_harvest_${String(Date.now())}`;

let connection: MongoConnection;
let repository: HarvestRepository;

function makeHarvest(overrides: Partial<Harvest> = {}): Harvest {
  return {
    id: 'h-1',
    publicCode: 'REC-2026-0001',
    unitId: 'u-1',
    flushNumber: 1,
    weight: { value: 800, unit: 'g', kind: 'harvest' },
    quality: 'A',
    losses: [],
    harvestedAt: '2026-08-25T07:00:00.000Z',
    ...overrides,
  };
}

function harvestEvent(harvestId = 'h-1', id = 'e-1'): DomainEvent {
  return {
    id,
    type: 'harvest.recorded',
    occurredAt: '2026-08-25T07:00:00.000Z',
    recordedAt: '2026-08-25T07:00:00.000Z',
    source: 'manual',
    unitId: 'u-1',
    payload: { harvestId, flushNumber: 1, weight: { value: 800, unit: 'g', kind: 'harvest' } },
  };
}

function makeProduct(overrides: Partial<ProductBatch> = {}): ProductBatch {
  return {
    id: 'p-1',
    publicCode: 'PRO-2026-0001',
    name: 'Barquette',
    origins: [
      {
        harvestId: 'h-1',
        unitId: 'u-1',
        weight: { value: 500, unit: 'g', kind: 'harvest' },
        share: 1,
      },
    ],
    quantity: { value: 1, unit: 'tray', kind: 'product' },
    producedAt: '2026-08-26T08:00:00.000Z',
    ...overrides,
  };
}

function productEvent(id = 'e-p1'): DomainEvent {
  return {
    id,
    type: 'product.created',
    occurredAt: '2026-08-26T08:00:00.000Z',
    recordedAt: '2026-08-26T08:00:00.000Z',
    source: 'manual',
    unitId: 'u-1',
    payload: { productId: 'p-1', harvestIds: ['h-1'] },
  };
}

beforeAll(async () => {
  connection = await connect(undefined, TEST_DB);
  repository = new HarvestRepository(connection);
});

afterAll(async () => {
  await connection.db.dropDatabase();
  await connection.close();
});

beforeEach(async () => {
  await connection.db.collection('harvests').deleteMany({});
  await connection.db.collection('productBatches').deleteMany({});
  await connection.db.collection('events').deleteMany({});
  await repository.ensureIndexes();
});

describe('récoltes', () => {
  it('enregistre une récolte et son événement', async () => {
    const result = await repository.recordHarvest(makeHarvest(), harvestEvent());

    expect(result.ok).toBe(true);
    expect((await repository.findHarvest('h-1'))?.publicCode).toBe('REC-2026-0001');
    expect(await connection.db.collection('events').countDocuments()).toBe(1);
  });

  it('retrouve une récolte par son code public', async () => {
    await repository.recordHarvest(makeHarvest(), harvestEvent());
    expect((await repository.findHarvestByIdOrPublicCode('REC-2026-0001'))?.id).toBe('h-1');
  });

  it('renvoie null pour une récolte inconnue', async () => {
    expect(await repository.findHarvest('inexistante')).toBeNull();
    expect(await repository.findHarvestByIdOrPublicCode('REC-2026-9999')).toBeNull();
  });

  it('liste les récoltes d’une unité dans l’ordre des flushs', async () => {
    await repository.recordHarvest(
      makeHarvest({ id: 'h-2', publicCode: 'REC-2026-0002', flushNumber: 2 }),
      harvestEvent('h-2', 'e-2'),
    );
    await repository.recordHarvest(makeHarvest(), harvestEvent());

    expect((await repository.harvestsForUnit('u-1')).map((h) => h.flushNumber)).toEqual([1, 2]);
  });

  it('ne mélange pas les récoltes de deux unités', async () => {
    await repository.recordHarvest(makeHarvest(), harvestEvent());
    await repository.recordHarvest(
      makeHarvest({ id: 'h-9', publicCode: 'REC-2026-0009', unitId: 'u-9' }),
      harvestEvent('h-9', 'e-9'),
    );
    expect(await repository.harvestsForUnit('u-1')).toHaveLength(1);
  });

  /**
   * Un même flush ne se récolte qu'une fois. Sans cet index, une double saisie
   * gonflerait le rendement sans que rien ne le signale — et un rendement faux
   * est pire qu'un rendement absent.
   */
  it('refuse deux récoltes pour le même flush de la même unité', async () => {
    await repository.recordHarvest(makeHarvest(), harvestEvent());
    const duplicate = await repository.recordHarvest(
      makeHarvest({ id: 'h-2', publicCode: 'REC-2026-0002' }),
      harvestEvent('h-2', 'e-2'),
    );

    expect(duplicate.ok).toBe(false);
    if (duplicate.ok) return;
    expect(duplicate.error.code).toBe('CONFLICT');
    expect(duplicate.error.message).toContain('flush 1');
    expect(duplicate.error.hint).toContain('gonflerait le rendement');
    expect(duplicate.error.path).toBe('flushNumber');
  });

  it('n’écrit aucun événement quand la récolte est refusée', async () => {
    await repository.recordHarvest(makeHarvest(), harvestEvent());
    await repository.recordHarvest(
      makeHarvest({ id: 'h-2', publicCode: 'REC-2026-0002' }),
      harvestEvent('h-2', 'e-2'),
    );
    // La transaction avortée n'a rien laissé derrière elle.
    expect(await connection.db.collection('events').countDocuments()).toBe(1);
  });

  it('laisse remonter une erreur d’infrastructure', async () => {
    const closed = await connect(undefined, TEST_DB);
    const orphan = new HarvestRepository(closed);
    await closed.close();
    await expect(orphan.recordHarvest(makeHarvest(), harvestEvent())).rejects.toThrow();
  });
});

describe('produits finaux', () => {
  it('enregistre un produit et son événement', async () => {
    const result = await repository.createProduct(makeProduct(), productEvent());

    expect(result.ok).toBe(true);
    expect((await repository.findProductByIdOrPublicCode('PRO-2026-0001'))?.name).toBe('Barquette');
    expect(await connection.db.collection('events').countDocuments()).toBe(1);
  });

  it('retrouve un produit par identifiant technique', async () => {
    await repository.createProduct(makeProduct(), productEvent());
    expect((await repository.findProductByIdOrPublicCode('p-1'))?.publicCode).toBe('PRO-2026-0001');
  });

  it('renvoie null pour un produit inconnu', async () => {
    expect(await repository.findProductByIdOrPublicCode('PRO-2026-9999')).toBeNull();
  });

  it('refuse un code produit déjà utilisé', async () => {
    await repository.createProduct(makeProduct(), productEvent());
    const duplicate = await repository.createProduct(
      makeProduct({ id: 'p-2' }),
      productEvent('e-p2'),
    );

    expect(duplicate.ok).toBe(false);
    if (duplicate.ok) return;
    expect(duplicate.error.code).toBe('CONFLICT');
    expect(duplicate.error.path).toBe('publicCode');
  });

  it('laisse remonter une erreur d’infrastructure', async () => {
    const closed = await connect(undefined, TEST_DB);
    const orphan = new HarvestRepository(closed);
    await closed.close();
    await expect(orphan.createProduct(makeProduct(), productEvent())).rejects.toThrow();
  });

  /**
   * La requête d'un rappel sanitaire : « ce bloc était contaminé, où sont
   * partis ses champignons ? »
   */
  it('retrouve les produits issus d’une unité', async () => {
    await repository.createProduct(makeProduct(), productEvent());
    expect((await repository.productsFromUnit('u-1')).map((p) => p.publicCode)).toEqual([
      'PRO-2026-0001',
    ]);
  });

  it('retrouve aussi une unité minoritaire dans un mélange', async () => {
    await repository.createProduct(
      makeProduct({
        origins: [
          {
            harvestId: 'h-1',
            unitId: 'u-1',
            weight: { value: 900, unit: 'g', kind: 'harvest' },
            share: 0.9,
          },
          {
            harvestId: 'h-2',
            unitId: 'u-2',
            weight: { value: 100, unit: 'g', kind: 'harvest' },
            share: 0.1,
          },
        ],
      }),
      productEvent(),
    );
    // Une part de 10 % reste tracée : c'est exactement ce qu'un rappel cherche.
    expect(await repository.productsFromUnit('u-2')).toHaveLength(1);
  });

  it('ne rend rien pour une unité sans produit', async () => {
    expect(await repository.productsFromUnit('u-jamais')).toEqual([]);
  });
});

describe('index', () => {
  it('rend le couple unité/flush unique', async () => {
    const indexes = await connection.db.collection('harvests').indexes();
    const unique = indexes.find(
      (i) => JSON.stringify(i.key) === JSON.stringify({ unitId: 1, flushNumber: 1 }),
    );
    expect(unique?.unique).toBe(true);
  });

  it('rend le code de récolte unique', async () => {
    const indexes = await connection.db.collection('harvests').indexes();
    const unique = indexes.find((i) => JSON.stringify(i.key) === JSON.stringify({ publicCode: 1 }));
    expect(unique?.unique).toBe(true);
  });

  it('indexe les origines des produits pour la traçabilité descendante', async () => {
    const keys = (await connection.db.collection('productBatches').indexes()).map((i) =>
      JSON.stringify(i.key),
    );
    expect(keys).toContain(JSON.stringify({ 'origins.unitId': 1 }));
    expect(keys).toContain(JSON.stringify({ 'origins.harvestId': 1 }));
  });
});
