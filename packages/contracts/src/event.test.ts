import { describe, expect, it } from 'vitest';
import { domainEventSchema, type DomainEvent, type DomainEventType } from './index.js';

/**
 * Tests exhaustifs du schéma d'événement.
 *
 * Le journal d'événements **est** la traçabilité : c'est lui qu'on rejoue pour
 * reconstruire l'état, et lui qu'un contrôle sanitaire lirait. Un schéma trop
 * permissif laisserait entrer des événements inexploitables, qu'on ne
 * découvrirait qu'au moment de remonter une chaîne — c'est-à-dire trop tard.
 *
 * Chaque type est donc testé sur son cas valide **et** sur le rejet de chaque
 * champ obligatoire de sa charge utile.
 */

const envelope = {
  id: 'e-1',
  occurredAt: '2026-08-02T08:00:00.000Z',
  recordedAt: '2026-08-02T08:00:00.000Z',
  source: 'manual',
} as const;

const validPayloads: Record<DomainEventType, Record<string, unknown>> = {
  'unit.created': {
    stage: 'substrate',
    processVersionId: 'pv-1',
    stepId: 'inoculation',
    parentUnitId: null,
  },
  'unit.step_advanced': { fromStepId: 'a', toStepId: 'b', followedNominalPath: true },
  'unit.moved': { to: { roomId: 'r-1' } },
  'unit.observed': { kind: 'contamination', severity: 'critical' },
  'unit.measured': { metric: 'temperature_c', numericValue: 24 },
  'unit.status_changed': { from: 'active', to: 'contaminated' },
  'harvest.recorded': {
    harvestId: 'h-1',
    flushNumber: 1,
    weight: { value: 800, unit: 'g', kind: 'harvest' },
  },
  'product.created': { productId: 'p-1', harvestIds: ['h-1'] },
  'event.compensated': { compensatesEventId: 'e-0', reason: 'saisie erronée' },
};

const ALL_TYPES = Object.keys(validPayloads) as DomainEventType[];

function build(type: DomainEventType, payload: Record<string, unknown>): unknown {
  return { ...envelope, type, unitId: 'u-1', payload };
}

describe('domainEventSchema — cas valides', () => {
  it.each(ALL_TYPES)('accepte un événement « %s » complet', (type) => {
    const result = domainEventSchema.safeParse(build(type, validPayloads[type]));
    expect(result.success).toBe(true);
  });

  it('couvre tous les types de l’union — aucun type oublié dans ce fichier', () => {
    expect(ALL_TYPES).toHaveLength(domainEventSchema.options.length);
  });
});

describe('domainEventSchema — enveloppe', () => {
  const valid = build('unit.moved', validPayloads['unit.moved']);

  it.each(['id', 'occurredAt', 'recordedAt', 'source', 'type'])(
    'refuse un événement sans « %s »',
    (field) => {
      const { [field]: _dropped, ...rest } = valid as Record<string, unknown>;
      expect(domainEventSchema.safeParse(rest).success).toBe(false);
    },
  );

  it('refuse un identifiant vide', () => {
    expect(domainEventSchema.safeParse({ ...(valid as object), id: '' }).success).toBe(false);
  });

  it('refuse un horodatage non ISO', () => {
    expect(domainEventSchema.safeParse({ ...(valid as object), occurredAt: 'hier' }).success).toBe(
      false,
    );
  });

  it('accepte un correlationId, qui relie une action de masse', () => {
    expect(
      domainEventSchema.safeParse({ ...(valid as object), correlationId: 'batch-1' }).success,
    ).toBe(true);
  });

  it('refuse un auteur : il n’y a pas d’utilisateurs dans le système', () => {
    const result = domainEventSchema.safeParse({ ...(valid as object), recordedBy: 'julien' });
    expect(result.success).toBe(false);
  });
});

describe('domainEventSchema — charges utiles obligatoires', () => {
  const requiredFields: Record<DomainEventType, readonly string[]> = {
    'unit.created': ['stage', 'processVersionId', 'stepId', 'parentUnitId'],
    'unit.step_advanced': ['fromStepId', 'toStepId', 'followedNominalPath'],
    'unit.moved': ['to'],
    'unit.observed': ['kind', 'severity'],
    'unit.measured': ['metric'],
    'unit.status_changed': ['from', 'to'],
    'harvest.recorded': ['harvestId', 'flushNumber', 'weight'],
    'product.created': ['productId', 'harvestIds'],
    'event.compensated': ['compensatesEventId', 'reason'],
  };

  for (const type of ALL_TYPES) {
    for (const field of requiredFields[type]) {
      it(`refuse « ${type} » sans « ${field} »`, () => {
        const { [field]: _dropped, ...payload } = validPayloads[type];
        expect(domainEventSchema.safeParse(build(type, payload)).success).toBe(false);
      });
    }
  }
});

describe('domainEventSchema — contraintes métier de charge utile', () => {
  it('accepte une naissance sans ascendant', () => {
    const result = domainEventSchema.safeParse(
      build('unit.created', { ...validPayloads['unit.created'], parentUnitId: null }),
    );
    expect(result.success).toBe(true);
  });

  it('accepte une naissance avec ascendant', () => {
    const result = domainEventSchema.safeParse(
      build('unit.created', { ...validPayloads['unit.created'], parentUnitId: 'u-0' }),
    );
    expect(result.success).toBe(true);
  });

  it('refuse un numéro de flush nul', () => {
    const result = domainEventSchema.safeParse(
      build('harvest.recorded', { ...validPayloads['harvest.recorded'], flushNumber: 0 }),
    );
    expect(result.success).toBe(false);
  });

  it('refuse un numéro de flush non entier', () => {
    const result = domainEventSchema.safeParse(
      build('harvest.recorded', { ...validPayloads['harvest.recorded'], flushNumber: 1.5 }),
    );
    expect(result.success).toBe(false);
  });

  it('refuse un produit sans aucune récolte d’origine', () => {
    const result = domainEventSchema.safeParse(
      build('product.created', { productId: 'p-1', harvestIds: [] }),
    );
    expect(result.success).toBe(false);
  });

  it('refuse une compensation dont la raison est vide', () => {
    const result = domainEventSchema.safeParse(
      build('event.compensated', { compensatesEventId: 'e-0', reason: '' }),
    );
    expect(result.success).toBe(false);
  });

  it('refuse une gravité hors des trois niveaux', () => {
    const result = domainEventSchema.safeParse(
      build('unit.observed', { kind: 'odeur', severity: 'catastrophique' }),
    );
    expect(result.success).toBe(false);
  });

  it('refuse une observation au type vide', () => {
    const result = domainEventSchema.safeParse(
      build('unit.observed', { kind: '', severity: 'low' }),
    );
    expect(result.success).toBe(false);
  });

  it('refuse une métrique inconnue', () => {
    const result = domainEventSchema.safeParse(
      build('unit.measured', { metric: 'ph', numericValue: 7 }),
    );
    expect(result.success).toBe(false);
  });

  it('accepte une mesure de poids exprimée en quantité typée', () => {
    const result = domainEventSchema.safeParse(
      build('unit.measured', {
        metric: 'weight',
        quantity: { value: 5, unit: 'kg', kind: 'substrate' },
      }),
    );
    expect(result.success).toBe(true);
  });

  it('refuse un déplacement vers un emplacement sans chambre', () => {
    const result = domainEventSchema.safeParse(build('unit.moved', { to: { shelf: 'A' } }));
    expect(result.success).toBe(false);
  });

  it('accepte un emplacement précisé jusqu’à la position', () => {
    const result = domainEventSchema.safeParse(
      build('unit.moved', {
        to: { roomId: 'r-1', shelf: 'A', level: '2', position: '3' },
      }),
    );
    expect(result.success).toBe(true);
  });

  it('refuse un statut d’unité hors catalogue', () => {
    const result = domainEventSchema.safeParse(
      build('unit.status_changed', { from: 'active', to: 'moisi' }),
    );
    expect(result.success).toBe(false);
  });

  it('type l’événement rendu selon son discriminant', () => {
    const parsed = domainEventSchema.parse(
      build('unit.step_advanced', validPayloads['unit.step_advanced']),
    );
    const event: DomainEvent = parsed;
    expect(event.type).toBe('unit.step_advanced');
    if (event.type !== 'unit.step_advanced') return;
    expect(event.payload.followedNominalPath).toBe(true);
  });
});
