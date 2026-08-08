import type { CultureUnit, ProcessGraph, ProcessStep } from '@champi/contracts';

/**
 * Constructeurs d'objets de test.
 *
 * Le process de référence reproduit le modèle par défaut de `docs/20` : **six
 * étapes, pas treize**. Les subdivisions incubation 1/2/3 et fructification 1/2
 * n'existent pas sur le terrain (« pas de différence », export v8 du 30/07).
 */

export function makeStep(overrides: Partial<ProcessStep> & Pick<ProcessStep, 'id'>): ProcessStep {
  return {
    name: overrides.id,
    stage: 'substrate',
    conditions: {},
    alarms: { enabled: false },
    optional: false,
    provenance: 'cultivator',
    ...overrides,
  };
}

/** Les six étapes réelles du process cultivateur (docs/20 §3). */
export function makeDefaultGraph(): ProcessGraph {
  return {
    steps: [
      makeStep({ id: 'inoculation', name: 'Inoculation substrat', stage: 'substrate' }),
      makeStep({
        id: 'incubation',
        name: 'Incubation',
        stage: 'substrate',
        targetDurationDays: 21,
        conditions: {
          temperatureC: { min: 24, max: 24 },
          light: 'darkness',
        },
        alarms: { enabled: true, reminderDaysBefore: 1, criticalOverduePct: 50 },
      }),
      makeStep({
        id: 'fructification',
        name: 'Fructification',
        stage: 'fruiting',
        targetDurationDays: 6,
        conditions: {
          temperatureC: { min: 18, max: 24 },
          humidityPct: { min: 90, max: 90 },
          light: 'light',
        },
        alarms: { enabled: true, reminderDaysBefore: 1 },
      }),
      makeStep({ id: 'flush_1', name: 'Flush 1', stage: 'fruiting', targetDurationDays: 2 }),
      makeStep({ id: 'flush_2', name: 'Flush 2', stage: 'fruiting', targetDurationDays: 2 }),
      makeStep({
        id: 'flush_3',
        name: 'Flush 3',
        stage: 'fruiting',
        targetDurationDays: 2,
        optional: true,
      }),
      makeStep({ id: 'fin_de_cycle', name: 'Fin de cycle', stage: 'fruiting' }),
    ],
    transitions: [
      { from: 'inoculation', to: 'incubation' },
      { from: 'incubation', to: 'fructification' },
      { from: 'fructification', to: 'flush_1' },
      { from: 'flush_1', to: 'flush_2' },
      { from: 'flush_2', to: 'flush_3' },
      { from: 'flush_2', to: 'fin_de_cycle' },
      { from: 'flush_3', to: 'fin_de_cycle' },
    ],
  };
}

export function makeUnit(overrides: Partial<CultureUnit> = {}): CultureUnit {
  return {
    id: 'unit-1',
    publicCode: 'SUB-2026-0001',
    name: 'Pleurote bloc 1',
    stage: 'substrate',
    status: 'active',
    parentUnitId: null,
    lineageRelation: 'origin',
    generation: 0,
    processVersionId: 'pv-1',
    currentStepId: 'inoculation',
    currentStepEnteredAt: '2026-08-01T08:00:00.000Z',
    substrateWeight: { value: 5, unit: 'kg', kind: 'substrate' },
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z',
    version: 0,
    ...overrides,
  };
}
