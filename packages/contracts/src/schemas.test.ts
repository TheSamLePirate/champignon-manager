import { describe, expect, it } from 'vitest';
import {
  appError,
  cultureUnitSchema,
  domainEventSchema,
  listHint,
  processStepSchema,
  productBatchSchema,
  publicCodeSchema,
  quantitySchema,
  targetRangeSchema,
} from './index.js';

/**
 * Tests de contrat.
 *
 * Ils vérifient que les schémas **refusent** ce qu'ils doivent refuser. Un
 * schéma qui n'est testé que sur ses cas valides ne prouve rien : c'est
 * exactement le genre de test que le score de mutation débusque.
 */

describe('publicCodeSchema', () => {
  it('accepte un code au format attendu', () => {
    expect(publicCodeSchema.parse('SUB-2026-0042')).toBe('SUB-2026-0042');
  });

  it('accepte un préfixe de deux à quatre lettres', () => {
    expect(publicCodeSchema.safeParse('GE-2026-0001').success).toBe(true);
    expect(publicCodeSchema.safeParse('PROD-2026-0001').success).toBe(true);
  });

  it('refuse un préfixe en minuscules', () => {
    expect(publicCodeSchema.safeParse('sub-2026-0042').success).toBe(false);
  });

  it('refuse un numéro trop court', () => {
    expect(publicCodeSchema.safeParse('SUB-2026-1').success).toBe(false);
  });
});

describe('targetRangeSchema', () => {
  it('accepte une fourchette croissante', () => {
    expect(targetRangeSchema.parse({ min: 18, max: 24 })).toEqual({ min: 18, max: 24 });
  });

  it('accepte une fourchette réduite à une valeur', () => {
    expect(targetRangeSchema.safeParse({ min: 24, max: 24 }).success).toBe(true);
  });

  it('refuse une fourchette inversée', () => {
    const result = targetRangeSchema.safeParse({ min: 30, max: 20 });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toContain('inférieure');
  });
});

describe('quantitySchema', () => {
  it('accepte une masse en grammes', () => {
    expect(quantitySchema.parse({ value: 800, unit: 'g', kind: 'harvest' }).value).toBe(800);
  });

  it('refuse une valeur négative', () => {
    expect(quantitySchema.safeParse({ value: -1, unit: 'g', kind: 'harvest' }).success).toBe(false);
  });

  it('refuse une unité inconnue', () => {
    expect(quantitySchema.safeParse({ value: 1, unit: 'oz', kind: 'harvest' }).success).toBe(false);
  });

  it('refuse une nature inconnue', () => {
    expect(quantitySchema.safeParse({ value: 1, unit: 'g', kind: 'compost' }).success).toBe(false);
  });
});

describe('processStepSchema', () => {
  it('applique les valeurs par défaut', () => {
    const step = processStepSchema.parse({
      id: 'incubation',
      name: 'Incubation',
      stage: 'substrate',
    });
    expect(step.optional).toBe(false);
    expect(step.alarms).toEqual({ enabled: false });
    expect(step.conditions).toEqual({});
    expect(step.provenance).toBe('cultivator');
  });

  it('accepte une valeur marquée comme inventée', () => {
    const step = processStepSchema.parse({
      id: 'gelose',
      name: 'Gélose',
      stage: 'gelose',
      provenance: 'invented',
    });
    expect(step.provenance).toBe('invented');
  });

  it('refuse une durée cible nulle', () => {
    const result = processStepSchema.safeParse({
      id: 'x',
      name: 'X',
      stage: 'substrate',
      targetDurationDays: 0,
    });
    expect(result.success).toBe(false);
  });

  it('refuse un stade inconnu', () => {
    expect(processStepSchema.safeParse({ id: 'x', name: 'X', stage: 'compost' }).success).toBe(
      false,
    );
  });
});

describe('cultureUnitSchema', () => {
  const valid = {
    id: 'u-1',
    publicCode: 'SUB-2026-0001',
    name: 'Bloc 1',
    stage: 'substrate',
    status: 'active',
    parentUnitId: null,
    lineageRelation: 'origin',
    generation: 0,
    processVersionId: 'pv-1',
    currentStepId: 'inoculation',
    currentStepEnteredAt: '2026-08-01T08:00:00.000Z',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z',
    version: 0,
  };

  it('accepte une unité sans ascendant — départ possible à tout stade', () => {
    expect(cultureUnitSchema.parse(valid).parentUnitId).toBeNull();
  });

  it('accepte une unité avec un parent', () => {
    const result = cultureUnitSchema.safeParse({
      ...valid,
      parentUnitId: 'u-0',
      lineageRelation: 'clone',
      generation: 3,
    });
    expect(result.success).toBe(true);
  });

  it('refuse un parent absent du document', () => {
    const { parentUnitId: _dropped, ...withoutParent } = valid;
    expect(cultureUnitSchema.safeParse(withoutParent).success).toBe(false);
  });

  it('refuse une génération négative', () => {
    expect(cultureUnitSchema.safeParse({ ...valid, generation: -1 }).success).toBe(false);
  });

  it('refuse un horodatage non ISO', () => {
    expect(cultureUnitSchema.safeParse({ ...valid, createdAt: '01/08/2026' }).success).toBe(false);
  });
});

describe('productBatchSchema', () => {
  it('refuse un produit sans origine', () => {
    const result = productBatchSchema.safeParse({
      id: 'p-1',
      publicCode: 'PRO-2026-0001',
      name: 'Barquette 500 g',
      origins: [],
      quantity: { value: 1, unit: 'tray', kind: 'product' },
      producedAt: '2026-08-26T08:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('refuse une part supérieure à 1', () => {
    const result = productBatchSchema.safeParse({
      id: 'p-1',
      publicCode: 'PRO-2026-0001',
      name: 'Barquette',
      origins: [
        {
          harvestId: 'h-1',
          unitId: 'u-1',
          weight: { value: 500, unit: 'g', kind: 'harvest' },
          share: 1.2,
        },
      ],
      quantity: { value: 1, unit: 'tray', kind: 'product' },
      producedAt: '2026-08-26T08:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });
});

describe('domainEventSchema', () => {
  it('discrimine sur le type', () => {
    const result = domainEventSchema.safeParse({
      id: 'e-1',
      type: 'unit.step_advanced',
      occurredAt: '2026-08-02T08:00:00.000Z',
      recordedAt: '2026-08-02T08:00:00.000Z',
      source: 'manual',
      unitId: 'u-1',
      payload: { fromStepId: 'a', toStepId: 'b', followedNominalPath: true },
    });
    expect(result.success).toBe(true);
  });

  it('refuse un type d’événement inconnu', () => {
    const result = domainEventSchema.safeParse({
      id: 'e-1',
      type: 'unit.teleported',
      occurredAt: '2026-08-02T08:00:00.000Z',
      recordedAt: '2026-08-02T08:00:00.000Z',
      source: 'manual',
      payload: {},
    });
    expect(result.success).toBe(false);
  });

  it('refuse un événement dont la charge utile ne correspond pas au type', () => {
    const result = domainEventSchema.safeParse({
      id: 'e-1',
      type: 'unit.step_advanced',
      occurredAt: '2026-08-02T08:00:00.000Z',
      recordedAt: '2026-08-02T08:00:00.000Z',
      source: 'manual',
      unitId: 'u-1',
      payload: { toStepId: 'b' },
    });
    expect(result.success).toBe(false);
  });

  it('refuse une source inconnue', () => {
    const result = domainEventSchema.safeParse({
      id: 'e-1',
      type: 'unit.moved',
      occurredAt: '2026-08-02T08:00:00.000Z',
      recordedAt: '2026-08-02T08:00:00.000Z',
      source: 'telepathy',
      unitId: 'u-1',
      payload: { to: { roomId: 'r-1' } },
    });
    expect(result.success).toBe(false);
  });
});

describe('appError / listHint', () => {
  it('construit une erreur minimale', () => {
    expect(appError('NOT_FOUND', 'introuvable')).toEqual({
      code: 'NOT_FOUND',
      message: 'introuvable',
    });
  });

  it('emporte les champs additionnels', () => {
    const error = appError('VALIDATION_FAILED', 'échec', { hint: 'essaie ceci', path: 'a.b' });
    expect(error.hint).toBe('essaie ceci');
    expect(error.path).toBe('a.b');
  });

  it('formate une liste de valeurs acceptées', () => {
    expect(listHint('Étapes disponibles', ['a', 'b'])).toBe('Étapes disponibles : a, b.');
  });
});
