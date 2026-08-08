import { describe, expect, it } from 'vitest';
import type { UnitStatus } from '@champi/contracts';
import { advanceUnit, canAdvance } from './advance.js';
import { makeDefaultGraph, makeUnit } from '../__testing__/builders.js';

const graph = makeDefaultGraph();
const NOW = '2026-08-22T09:00:00.000Z';

describe('canAdvance', () => {
  it('autorise une unité active', () => {
    expect(canAdvance(makeUnit({ status: 'active' }))).toBe(true);
  });

  it('autorise une unité archivée — l’archivage est réversible', () => {
    expect(canAdvance(makeUnit({ status: 'archived' }))).toBe(true);
  });

  it.each<UnitStatus>(['completed', 'composted', 'discarded', 'contaminated'])(
    'refuse une unité au statut « %s »',
    (status) => {
      expect(canAdvance(makeUnit({ status }))).toBe(false);
    },
  );
});

describe('advanceUnit — chemin nominal', () => {
  it('avance d’inoculation vers incubation sans confirmation', () => {
    const result = advanceUnit({
      unit: makeUnit({ currentStepId: 'inoculation' }),
      graph,
      toStepId: 'incubation',
      nowIso: NOW,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.followedNominalPath).toBe(true);
    expect(result.value.fromStepId).toBe('inoculation');
    expect(result.value.toStepId).toBe('incubation');
    expect(result.value.unit.currentStepId).toBe('incubation');
    expect(result.value.unit.currentStepEnteredAt).toBe(NOW);
  });

  it('incrémente le verrou optimiste', () => {
    const result = advanceUnit({
      unit: makeUnit({ version: 7 }),
      graph,
      toStepId: 'incubation',
      nowIso: NOW,
    });
    expect(result.ok && result.value.unit.version).toBe(8);
  });

  it('met le stade de l’unité à jour d’après l’étape atteinte', () => {
    const result = advanceUnit({
      unit: makeUnit({ currentStepId: 'incubation', stage: 'substrate' }),
      graph,
      toStepId: 'fructification',
      nowIso: NOW,
    });
    expect(result.ok && result.value.unit.stage).toBe('fruiting');
  });

  it('suit une bifurcation nominale : flush 2 peut aller vers flush 3 ou fin de cycle', () => {
    const toFlush3 = advanceUnit({
      unit: makeUnit({ currentStepId: 'flush_2' }),
      graph,
      toStepId: 'flush_3',
      nowIso: NOW,
    });
    const toEnd = advanceUnit({
      unit: makeUnit({ currentStepId: 'flush_2' }),
      graph,
      toStepId: 'fin_de_cycle',
      nowIso: NOW,
    });
    expect(toFlush3.ok && toFlush3.value.followedNominalPath).toBe(true);
    expect(toEnd.ok && toEnd.value.followedNominalPath).toBe(true);
  });
});

describe('advanceUnit — écarts au chemin nominal', () => {
  it('refuse un saut d’étape sans confirmation, en citant les suites nominales', () => {
    const result = advanceUnit({
      unit: makeUnit({ currentStepId: 'inoculation' }),
      graph,
      toStepId: 'flush_1',
      nowIso: NOW,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_FAILED');
    expect(result.error.message).toContain('inoculation');
    expect(result.error.message).toContain('flush_1');
    expect(result.error.message).toContain('ne suit pas le chemin nominal');
    expect(result.error.hint).toContain('incubation');
    expect(result.error.hint).toContain('confirmOffNominal');
    expect(result.error.path).toBe('toStepId');
  });

  it('autorise le saut d’étape avec confirmation, et enregistre l’écart', () => {
    const result = advanceUnit({
      unit: makeUnit({ currentStepId: 'inoculation' }),
      graph,
      toStepId: 'flush_1',
      confirmOffNominal: true,
      nowIso: NOW,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.followedNominalPath).toBe(false);
    expect(result.value.unit.currentStepId).toBe('flush_1');
  });

  it('autorise un retour en arrière avec confirmation', () => {
    const result = advanceUnit({
      unit: makeUnit({ currentStepId: 'fructification' }),
      graph,
      toStepId: 'incubation',
      confirmOffNominal: true,
      nowIso: NOW,
    });
    expect(result.ok && result.value.followedNominalPath).toBe(false);
  });

  it('autorise de refaire la même étape avec confirmation', () => {
    const result = advanceUnit({
      unit: makeUnit({ currentStepId: 'flush_1' }),
      graph,
      toStepId: 'flush_1',
      confirmOffNominal: true,
      nowIso: NOW,
    });
    expect(result.ok && result.value.followedNominalPath).toBe(false);
  });

  it('adapte le message quand l’étape courante n’a aucune suite nominale', () => {
    const result = advanceUnit({
      unit: makeUnit({ currentStepId: 'fin_de_cycle' }),
      graph,
      toStepId: 'incubation',
      nowIso: NOW,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.hint).toContain('aucune suite nominale');
  });
});

describe('advanceUnit — refus', () => {
  it('refuse une étape inexistante et liste les étapes valides', () => {
    const result = advanceUnit({
      unit: makeUnit(),
      graph,
      toStepId: 'flush_4',
      nowIso: NOW,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('STEP_NOT_IN_PROCESS');
    expect(result.error.hint).toContain('flush_3');
    expect(result.error.hint).not.toContain('flush_4');
  });

  it('refuse d’avancer une unité contaminée', () => {
    const result = advanceUnit({
      unit: makeUnit({ status: 'contaminated' }),
      graph,
      toStepId: 'incubation',
      nowIso: NOW,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('UNIT_NOT_ACTIVE');
    expect(result.error.message).toContain('SUB-2026-0001');
    expect(result.error.message).toContain('contaminated');
    expect(result.error.hint).toContain('historique reste consultable');
    expect(result.error.path).toBe('unitId');
  });

  it('laisse l’unité d’origine intacte — le domaine ne mute rien en place', () => {
    const unit = makeUnit({ currentStepId: 'inoculation', version: 3 });
    advanceUnit({ unit, graph, toStepId: 'incubation', nowIso: NOW });
    expect(unit.currentStepId).toBe('inoculation');
    expect(unit.version).toBe(3);
  });
});
