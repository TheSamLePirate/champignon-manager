import { describe, expect, it } from 'vitest';
import type { DomainEvent } from '@champi/contracts';
import {
  checkJournalIntegrity,
  diffReplayAgainstStored,
  replayUnit,
  sortEvents,
} from './replay.js';
import { makeUnit } from '../__testing__/builders.js';

const base = {
  source: 'manual',
  recordedAt: '2026-08-01T08:00:00.000Z',
} as const;

const created: DomainEvent = {
  ...base,
  id: 'e-1',
  type: 'unit.created',
  occurredAt: '2026-08-01T08:00:00.000Z',
  unitId: 'unit-1',
  payload: {
    stage: 'substrate',
    processVersionId: 'pv-1',
    stepId: 'inoculation',
    parentUnitId: null,
    substrateWeight: { value: 5, unit: 'kg', kind: 'substrate' },
  },
};

const advanced: DomainEvent = {
  ...base,
  id: 'e-2',
  type: 'unit.step_advanced',
  occurredAt: '2026-08-02T08:00:00.000Z',
  recordedAt: '2026-08-02T08:00:00.000Z',
  unitId: 'unit-1',
  payload: { fromStepId: 'inoculation', toStepId: 'incubation', followedNominalPath: true },
};

const moved: DomainEvent = {
  ...base,
  id: 'e-3',
  type: 'unit.moved',
  occurredAt: '2026-08-03T08:00:00.000Z',
  recordedAt: '2026-08-03T08:00:00.000Z',
  unitId: 'unit-1',
  payload: { to: { roomId: 'room-1', shelf: 'A', level: '2' } },
};

const harvested: DomainEvent = {
  ...base,
  id: 'e-4',
  type: 'harvest.recorded',
  occurredAt: '2026-08-25T08:00:00.000Z',
  recordedAt: '2026-08-25T08:00:00.000Z',
  unitId: 'unit-1',
  payload: { harvestId: 'h-1', flushNumber: 1, weight: { value: 800, unit: 'g', kind: 'harvest' } },
};

describe('sortEvents', () => {
  it('ordonne par instant de survenue', () => {
    expect(sortEvents([harvested, created, advanced]).map((e) => e.id)).toEqual([
      'e-1',
      'e-2',
      'e-4',
    ]);
  });

  it('départage deux événements simultanés par identifiant', () => {
    const twin: DomainEvent = { ...advanced, id: 'e-0' };
    expect(sortEvents([advanced, twin]).map((e) => e.id)).toEqual(['e-0', 'e-2']);
  });

  it('ne modifie pas la liste d’origine', () => {
    const events = [harvested, created];
    sortEvents(events);
    expect(events[0]?.id).toBe('e-4');
  });
});

describe('replayUnit', () => {
  it('reconstruit l’état à la naissance', () => {
    const result = replayUnit([created]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.currentStepId).toBe('inoculation');
    expect(result.value.status).toBe('active');
    expect(result.value.stage).toBe('substrate');
    expect(result.value.parentUnitId).toBeNull();
    expect(result.value.eventCount).toBe(1);
  });

  it('applique un avancement d’étape', () => {
    const result = replayUnit([created, advanced]);
    expect(result.ok && result.value.currentStepId).toBe('incubation');
    expect(result.ok && result.value.currentStepEnteredAt).toBe('2026-08-02T08:00:00.000Z');
  });

  it('applique un déplacement', () => {
    const result = replayUnit([created, moved]);
    expect(result.ok && result.value.location?.shelf).toBe('A');
  });

  it('applique un changement de statut', () => {
    const statusChanged: DomainEvent = {
      ...base,
      id: 'e-5',
      type: 'unit.status_changed',
      occurredAt: '2026-08-26T08:00:00.000Z',
      recordedAt: '2026-08-26T08:00:00.000Z',
      unitId: 'unit-1',
      payload: { from: 'active', to: 'completed' },
    };
    const result = replayUnit([created, statusChanged]);
    expect(result.ok && result.value.status).toBe('completed');
  });

  it('collecte les récoltes', () => {
    const result = replayUnit([created, harvested]);
    expect(result.ok && result.value.harvestIds).toEqual(['h-1']);
  });

  it('ignore observations, mesures et produits pour l’état courant', () => {
    const observed: DomainEvent = {
      ...base,
      id: 'e-6',
      type: 'unit.observed',
      occurredAt: '2026-08-04T08:00:00.000Z',
      recordedAt: '2026-08-04T08:00:00.000Z',
      unitId: 'unit-1',
      payload: { kind: 'colonisation', severity: 'low' },
    };
    const measured: DomainEvent = {
      ...base,
      id: 'e-7',
      type: 'unit.measured',
      occurredAt: '2026-08-05T08:00:00.000Z',
      recordedAt: '2026-08-05T08:00:00.000Z',
      unitId: 'unit-1',
      payload: { metric: 'temperature_c', numericValue: 24 },
    };
    const product: DomainEvent = {
      ...base,
      id: 'e-8',
      type: 'product.created',
      occurredAt: '2026-08-26T08:00:00.000Z',
      recordedAt: '2026-08-26T08:00:00.000Z',
      payload: { productId: 'p-1', harvestIds: ['h-1'] },
    };
    const result = replayUnit([created, observed, measured, product]);
    expect(result.ok && result.value.currentStepId).toBe('inoculation');
    expect(result.ok && result.value.eventCount).toBe(4);
  });

  it('neutralise un événement compensé', () => {
    const compensation: DomainEvent = {
      ...base,
      id: 'e-9',
      type: 'event.compensated',
      occurredAt: '2026-08-03T09:00:00.000Z',
      recordedAt: '2026-08-03T09:00:00.000Z',
      unitId: 'unit-1',
      payload: { compensatesEventId: 'e-2', reason: 'saisie erronée' },
    };
    const result = replayUnit([created, advanced, compensation]);
    // L'avancement est annulé : l'unité est restée à l'inoculation.
    expect(result.ok && result.value.currentStepId).toBe('inoculation');
  });

  it('refuse un journal qui ne commence pas par une naissance', () => {
    const result = replayUnit([advanced]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_FAILED');
    expect(result.error.message).toContain('unit.created');
    expect(result.error.message).toContain('pas reconstructible');
    expect(result.error.hint).toContain('acte de naissance');
  });

  it('refuse un journal vide', () => {
    const result = replayUnit([]);
    expect(result.ok).toBe(false);
  });

  it('refuse un journal contenant deux naissances', () => {
    const secondBirth: DomainEvent = {
      ...created,
      id: 'e-99',
      occurredAt: '2026-08-10T08:00:00.000Z',
    };
    const result = replayUnit([created, secondBirth]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_FAILED');
    expect(result.error.message).toContain('plusieurs événements');
    expect(result.error.hint).toContain('ne naît qu’une fois');
  });
});

describe('diffReplayAgainstStored', () => {
  it('ne trouve aucune divergence quand le double-write a tenu', () => {
    const replayed = replayUnit([created, advanced, moved]);
    expect(replayed.ok).toBe(true);
    if (!replayed.ok) return;

    const stored = makeUnit({
      currentStepId: 'incubation',
      currentStepEnteredAt: '2026-08-02T08:00:00.000Z',
      location: { roomId: 'room-1', shelf: 'A', level: '2' },
    });
    expect(diffReplayAgainstStored(replayed.value, stored)).toEqual([]);
  });

  it('détecte un état courant désaccordé du journal', () => {
    const replayed = replayUnit([created, advanced]);
    if (!replayed.ok) return;

    const stored = makeUnit({ currentStepId: 'fructification' });
    const divergences = diffReplayAgainstStored(replayed.value, stored);
    expect(divergences.map((d) => d.field)).toEqual(['currentStepId', 'currentStepEnteredAt']);
    expect(divergences[0]?.replayed).toBe('incubation');
    expect(divergences[0]?.stored).toBe('fructification');
  });

  it('détecte une divergence de statut', () => {
    const replayed = replayUnit([created]);
    if (!replayed.ok) return;
    const divergences = diffReplayAgainstStored(
      replayed.value,
      makeUnit({ status: 'contaminated' }),
    );
    expect(divergences.map((d) => d.field)).toContain('status');
  });

  /**
   * Chaque champ reconstructible doit être réellement comparé. Sans ce test,
   * retirer une ligne de comparaison passerait inaperçu — et une divergence
   * état/journal deviendrait invisible, ce qui viderait l'audit de son sens.
   */
  describe('couverture des champs comparés', () => {
    const baseline = makeUnit({
      currentStepId: 'inoculation',
      currentStepEnteredAt: created.occurredAt,
      stage: 'substrate',
      status: 'active',
      parentUnitId: null,
      location: undefined,
      substrateWeight: { value: 5, unit: 'kg', kind: 'substrate' },
    });

    const cases = [
      { field: 'stage', stored: makeUnit({ ...baseline, stage: 'fruiting' }) },
      { field: 'status', stored: makeUnit({ ...baseline, status: 'completed' }) },
      { field: 'currentStepId', stored: makeUnit({ ...baseline, currentStepId: 'incubation' }) },
      {
        field: 'currentStepEnteredAt',
        stored: makeUnit({ ...baseline, currentStepEnteredAt: '2027-01-01T00:00:00.000Z' }),
      },
      { field: 'parentUnitId', stored: makeUnit({ ...baseline, parentUnitId: 'autre' }) },
      {
        field: 'location',
        stored: makeUnit({ ...baseline, location: { roomId: 'room-9' } }),
      },
      {
        field: 'substrateWeight',
        stored: makeUnit({
          ...baseline,
          substrateWeight: { value: 99, unit: 'kg', kind: 'substrate' },
        }),
      },
    ] as const;

    it('ne diverge sur aucun champ quand l’état stocké est fidèle', () => {
      const replayed = replayUnit([created]);
      if (!replayed.ok) return;
      expect(diffReplayAgainstStored(replayed.value, baseline)).toEqual([]);
    });

    it.each(cases)('détecte une divergence isolée sur « $field »', ({ field, stored }) => {
      const replayed = replayUnit([created]);
      expect(replayed.ok).toBe(true);
      if (!replayed.ok) return;

      const divergences = diffReplayAgainstStored(replayed.value, stored);
      expect(divergences.map((d) => d.field)).toEqual([field]);
    });
  });
});

describe('checkJournalIntegrity', () => {
  it('ne signale rien sur un journal sain', () => {
    expect(checkJournalIntegrity([created, advanced, moved])).toEqual([]);
  });

  it('signale un identifiant d’événement en double', () => {
    const issues = checkJournalIntegrity([created, { ...advanced, id: 'e-1' }]);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe('DUPLICATE_EVENT_ID');
    expect(issues[0]?.message).toContain('e-1');
    expect(issues[0]?.message).toContain('plusieurs fois');
  });

  it('signale une compensation orpheline', () => {
    const orphan: DomainEvent = {
      ...base,
      id: 'e-10',
      type: 'event.compensated',
      occurredAt: '2026-08-05T08:00:00.000Z',
      recordedAt: '2026-08-05T08:00:00.000Z',
      payload: { compensatesEventId: 'inexistant', reason: 'test' },
    };
    const issues = checkJournalIntegrity([created, orphan]);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe('ORPHAN_COMPENSATION');
    expect(issues[0]?.message).toContain('e-10');
    expect(issues[0]?.message).toContain('inexistant');
  });

  it('ne signale pas une compensation dont la cible est présente', () => {
    const valid: DomainEvent = {
      ...base,
      id: 'e-12',
      type: 'event.compensated',
      occurredAt: '2026-08-05T08:00:00.000Z',
      recordedAt: '2026-08-05T08:00:00.000Z',
      payload: { compensatesEventId: 'e-2', reason: 'correction' },
    };
    expect(checkJournalIntegrity([created, advanced, valid])).toEqual([]);
  });

  it('signale un enregistrement antérieur à la survenue', () => {
    const impossible: DomainEvent = {
      ...created,
      id: 'e-11',
      occurredAt: '2026-08-10T08:00:00.000Z',
      recordedAt: '2026-08-01T08:00:00.000Z',
    };
    const issues = checkJournalIntegrity([impossible]);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.code).toBe('RECORDED_BEFORE_OCCURRED');
    expect(issues[0]?.message).toContain('e-11');
    expect(issues[0]?.message).toContain("avant d'être survenu");
  });

  it('accepte un enregistrement simultané à la survenue', () => {
    expect(checkJournalIntegrity([created])).toEqual([]);
  });
});
