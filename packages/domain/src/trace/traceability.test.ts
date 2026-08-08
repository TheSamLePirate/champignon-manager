import { describe, expect, it } from 'vitest';
import type { DomainEvent, Harvest, ProductBatch } from '@champi/contracts';
import { checkTraceIntegrity, traceDownstream, traceUpstream } from './traceability.js';
import { makeUnit } from '../__testing__/builders.js';

function makeHarvest(overrides: Partial<Harvest> = {}): Harvest {
  return {
    id: 'h-1',
    publicCode: 'REC-2026-0001',
    unitId: 'unit-1',
    flushNumber: 1,
    weight: { value: 800, unit: 'g', kind: 'harvest' },
    quality: 'A',
    losses: [],
    harvestedAt: '2026-08-25T07:00:00.000Z',
    ...overrides,
  };
}

function makeProduct(overrides: Partial<ProductBatch> = {}): ProductBatch {
  return {
    id: 'p-1',
    publicCode: 'PRO-2026-0001',
    name: 'Barquette 500 g',
    origins: [
      {
        harvestId: 'h-1',
        unitId: 'unit-1',
        weight: { value: 500, unit: 'g', kind: 'harvest' },
        share: 1,
      },
    ],
    quantity: { value: 1, unit: 'tray', kind: 'product' },
    producedAt: '2026-08-26T08:00:00.000Z',
    ...overrides,
  };
}

function harvestEvent(harvestId: string): DomainEvent {
  return {
    id: `e-${harvestId}`,
    type: 'harvest.recorded',
    occurredAt: '2026-08-25T07:00:00.000Z',
    recordedAt: '2026-08-25T07:00:00.000Z',
    source: 'manual',
    unitId: 'unit-1',
    payload: {
      harvestId,
      flushNumber: 1,
      weight: { value: 800, unit: 'g', kind: 'harvest' },
    },
  };
}

describe('traceUpstream', () => {
  it('remonte d’un produit à son unique unité d’origine', () => {
    const result = traceUpstream(makeProduct(), [makeHarvest()], [makeUnit()]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.productPublicCode).toBe('PRO-2026-0001');
    expect(result.value.singleOrigin).toBe(true);
    expect(result.value.contributions).toEqual([
      {
        unitId: 'unit-1',
        unitPublicCode: 'SUB-2026-0001',
        harvestId: 'h-1',
        harvestPublicCode: 'REC-2026-0001',
        flushNumber: 1,
        sharePct: 100,
        grams: 500,
      },
    ]);
  });

  /**
   * Le cœur de `q14_5` : un mélange est autorisé, mais les proportions doivent
   * être exactes — sinon la remontée devient approximative, donc inutilisable.
   */
  it('remonte d’un mélange à ses deux unités, avec la part de chacune', () => {
    const product = makeProduct({
      origins: [
        {
          harvestId: 'h-1',
          unitId: 'unit-1',
          weight: { value: 300, unit: 'g', kind: 'harvest' },
          share: 0.6,
        },
        {
          harvestId: 'h-2',
          unitId: 'unit-2',
          weight: { value: 200, unit: 'g', kind: 'harvest' },
          share: 0.4,
        },
      ],
    });
    const result = traceUpstream(
      product,
      [makeHarvest(), makeHarvest({ id: 'h-2', publicCode: 'REC-2026-0002', unitId: 'unit-2' })],
      [makeUnit(), makeUnit({ id: 'unit-2', publicCode: 'SUB-2026-0002' })],
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.singleOrigin).toBe(false);
    expect(result.value.contributions.map((c) => c.sharePct)).toEqual([60, 40]);
    expect(result.value.contributions.map((c) => c.unitPublicCode)).toEqual([
      'SUB-2026-0001',
      'SUB-2026-0002',
    ]);
  });

  it('convertit les masses en grammes', () => {
    const product = makeProduct({
      origins: [
        {
          harvestId: 'h-1',
          unitId: 'unit-1',
          weight: { value: 1.2, unit: 'kg', kind: 'harvest' },
          share: 1,
        },
      ],
    });
    const result = traceUpstream(product, [makeHarvest()], [makeUnit()]);
    expect(result.ok && result.value.contributions[0]?.grams).toBe(1200);
  });

  it('arrondit les parts au dixième de pourcent', () => {
    const third = 1 / 3;
    const product = makeProduct({
      origins: [
        {
          harvestId: 'h-1',
          unitId: 'unit-1',
          weight: { value: 100, unit: 'g', kind: 'harvest' },
          share: third,
        },
      ],
    });
    const result = traceUpstream(product, [makeHarvest()], [makeUnit()]);
    expect(result.ok && result.value.contributions[0]?.sharePct).toBe(33.3);
  });

  /**
   * Une traçabilité partielle est pire qu'une absence : elle a l'air complète.
   * On échoue donc bruyamment plutôt que d'omettre une contribution.
   */
  it('échoue si une récolte citée est introuvable', () => {
    const result = traceUpstream(makeProduct(), [], [makeUnit()]);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NOT_FOUND');
    expect(result.error.message).toContain('h-1');
    expect(result.error.hint).toContain('trompeuse');
    expect(result.error.path).toBe('origins.harvestId');
  });

  it('échoue si une unité citée est introuvable', () => {
    const result = traceUpstream(makeProduct(), [makeHarvest()], []);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('unit-1');
    expect(result.error.hint).toContain('jamais');
    expect(result.error.path).toBe('origins.unitId');
  });
});

describe('traceDownstream', () => {
  it('descend d’une unité aux produits qui en sont issus', () => {
    const result = traceDownstream(makeUnit(), [makeHarvest()], [makeProduct()]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.unitPublicCode).toBe('SUB-2026-0001');
    expect(result.value.harvestCount).toBe(1);
    expect(result.value.totalHarvestedGrams).toBe(800);
    expect(result.value.products).toEqual([
      { productId: 'p-1', publicCode: 'PRO-2026-0001', sharePct: 100 },
    ]);
  });

  it('cumule les récoltes de plusieurs flushs', () => {
    const result = traceDownstream(
      makeUnit(),
      [
        makeHarvest(),
        makeHarvest({
          id: 'h-2',
          flushNumber: 2,
          weight: { value: 0.5, unit: 'kg', kind: 'harvest' },
        }),
      ],
      [],
    );
    expect(result.ok && result.value.totalHarvestedGrams).toBe(1300);
    expect(result.ok && result.value.harvestCount).toBe(2);
  });

  it('ignore les produits issus d’autres unités', () => {
    const other = makeProduct({
      id: 'p-2',
      publicCode: 'PRO-2026-0002',
      origins: [
        {
          harvestId: 'h-9',
          unitId: 'unit-9',
          weight: { value: 100, unit: 'g', kind: 'harvest' },
          share: 1,
        },
      ],
    });
    const result = traceDownstream(makeUnit(), [makeHarvest()], [makeProduct(), other]);
    expect(result.ok && result.value.products).toHaveLength(1);
  });

  it('rend une trace vide pour une unité sans récolte', () => {
    const result = traceDownstream(makeUnit(), [], []);
    expect(result.ok && result.value.totalHarvestedGrams).toBe(0);
    expect(result.ok && result.value.products).toEqual([]);
  });

  it('remonte un échec de cumul de masses incompatibles', () => {
    const result = traceDownstream(
      makeUnit(),
      [
        makeHarvest(),
        makeHarvest({ id: 'h-2', weight: { value: 2, unit: 'piece', kind: 'harvest' } }),
      ],
      [],
    );
    expect(result.ok).toBe(false);
  });
});

describe('checkTraceIntegrity', () => {
  it('ne signale rien sur une chaîne complète', () => {
    expect(checkTraceIntegrity(makeProduct(), [makeHarvest()], [harvestEvent('h-1')])).toEqual([]);
  });

  it('signale des proportions qui ne totalisent pas 1', () => {
    const product = makeProduct({
      origins: [
        {
          harvestId: 'h-1',
          unitId: 'unit-1',
          weight: { value: 100, unit: 'g', kind: 'harvest' },
          share: 0.5,
        },
      ],
    });
    const issues = checkTraceIntegrity(product, [makeHarvest()], [harvestEvent('h-1')]);
    expect(issues[0]?.code).toBe('SHARES_DO_NOT_SUM_TO_ONE');
    expect(issues[0]?.message).toContain('0.500000');
  });

  it('tolère l’imprécision flottante de trois tiers', () => {
    const third = 1 / 3;
    const product = makeProduct({
      origins: ['h-1', 'h-2', 'h-3'].map((harvestId) => ({
        harvestId,
        unitId: 'unit-1',
        weight: { value: 100, unit: 'g', kind: 'harvest' },
        share: third,
      })),
    });
    const harvests = ['h-1', 'h-2', 'h-3'].map((id, index) =>
      makeHarvest({ id, publicCode: `REC-2026-000${String(index + 1)}`, flushNumber: index + 1 }),
    );
    const events = ['h-1', 'h-2', 'h-3'].map(harvestEvent);
    expect(checkTraceIntegrity(product, harvests, events)).toEqual([]);
  });

  it('signale une récolte citée mais absente', () => {
    const issues = checkTraceIntegrity(makeProduct(), [], []);
    expect(issues.some((i) => i.code === 'MISSING_HARVEST')).toBe(true);
  });

  /**
   * Une récolte sans événement n'existe que dans l'état courant — c'est-à-dire
   * nulle part de vérifiable. C'est le pendant, côté produit, du contrôle de
   * rejeu qui vaut pour les unités.
   */
  it('signale une récolte absente du journal', () => {
    const issues = checkTraceIntegrity(makeProduct(), [makeHarvest()], []);
    const issue = issues.find((i) => i.code === 'HARVEST_NOT_JOURNALED');
    expect(issue?.message).toContain('REC-2026-0001');
  });

  it('ignore les événements d’un autre type', () => {
    const other: DomainEvent = {
      id: 'e-x',
      type: 'unit.observed',
      occurredAt: '2026-08-25T07:00:00.000Z',
      recordedAt: '2026-08-25T07:00:00.000Z',
      source: 'manual',
      unitId: 'unit-1',
      payload: { kind: 'odeur', severity: 'low' },
    };
    const issues = checkTraceIntegrity(makeProduct(), [makeHarvest()], [other]);
    expect(issues.some((i) => i.code === 'HARVEST_NOT_JOURNALED')).toBe(true);
  });

  it('cumule plusieurs problèmes plutôt que de s’arrêter au premier', () => {
    const product = makeProduct({
      origins: [
        {
          harvestId: 'absente',
          unitId: 'unit-1',
          weight: { value: 100, unit: 'g', kind: 'harvest' },
          share: 0.5,
        },
      ],
    });
    const issues = checkTraceIntegrity(product, [makeHarvest()], []);
    expect(issues.map((i) => i.code)).toEqual([
      'SHARES_DO_NOT_SUM_TO_ONE',
      'MISSING_HARVEST',
      'HARVEST_NOT_JOURNALED',
    ]);
  });
});
