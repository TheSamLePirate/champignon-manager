import { describe, expect, it } from 'vitest';
import { alarmCanAdvanceUnit, elapsedDaysBetween, evaluateAlarm } from './alarms.js';
import { makeStep } from '../__testing__/builders.js';

const ENTERED = '2026-08-01T00:00:00.000Z';

/** Incubation réelle : 21 jours, rappel à J-1, retard critique à +50 %. */
const incubation = makeStep({
  id: 'incubation',
  name: 'Incubation',
  targetDurationDays: 21,
  alarms: { enabled: true, reminderDaysBefore: 1, criticalOverduePct: 50 },
});

describe('elapsedDaysBetween', () => {
  it('compte les jours pleins', () => {
    expect(elapsedDaysBetween(ENTERED, '2026-08-11T00:00:00.000Z')).toBe(10);
  });

  it('compte les fractions de jour', () => {
    expect(elapsedDaysBetween(ENTERED, '2026-08-01T12:00:00.000Z')).toBe(0.5);
  });

  it('renvoie une valeur négative si l’instant est antérieur', () => {
    expect(elapsedDaysBetween(ENTERED, '2026-07-31T00:00:00.000Z')).toBe(-1);
  });
});

describe('evaluateAlarm', () => {
  it('ne signale rien en début d’étape', () => {
    const state = evaluateAlarm(incubation, ENTERED, '2026-08-05T00:00:00.000Z');
    expect(state.level).toBe('none');
    expect(state.elapsedDays).toBe(4);
    expect(state.remainingDays).toBe(17);
  });

  it('passe en rappel à J-1 de l’échéance', () => {
    const state = evaluateAlarm(incubation, ENTERED, '2026-08-21T00:00:00.000Z');
    expect(state.level).toBe('reminder');
    expect(state.remainingDays).toBe(1);
  });

  it('passe en dépassement à l’échéance exacte', () => {
    const state = evaluateAlarm(incubation, ENTERED, '2026-08-22T00:00:00.000Z');
    expect(state.level).toBe('overdue');
    expect(state.remainingDays).toBe(0);
  });

  it('passe en retard critique au-delà de +50 %', () => {
    // 21 j + 50 % = 31,5 j → le 1er septembre est à 31 j, le 2 à 32 j.
    const state = evaluateAlarm(incubation, ENTERED, '2026-09-02T00:00:00.000Z');
    expect(state.level).toBe('critical');
    expect(state.remainingDays).toBeLessThan(0);
  });

  it('reste en dépassement juste avant le seuil critique', () => {
    const state = evaluateAlarm(incubation, ENTERED, '2026-09-01T00:00:00.000Z');
    expect(state.level).toBe('overdue');
  });

  it('ne signale rien si l’étape n’a pas de durée cible', () => {
    const step = makeStep({ id: 'inoculation', alarms: { enabled: true } });
    const state = evaluateAlarm(step, ENTERED, '2027-01-01T00:00:00.000Z');
    expect(state.level).toBe('none');
    expect(state.remainingDays).toBeNull();
  });

  it('ne signale rien si les alarmes sont désactivées sur l’étape', () => {
    const step = makeStep({ id: 'x', targetDurationDays: 3, alarms: { enabled: false } });
    const state = evaluateAlarm(step, ENTERED, '2027-01-01T00:00:00.000Z');
    expect(state.level).toBe('none');
    expect(state.remainingDays).toBeNull();
  });

  it('ne rappelle jamais si aucun délai de rappel n’est configuré', () => {
    const step = makeStep({ id: 'x', targetDurationDays: 10, alarms: { enabled: true } });
    const state = evaluateAlarm(step, ENTERED, '2026-08-09T00:00:00.000Z');
    expect(state.level).toBe('none');
  });

  it('dépasse sans jamais devenir critique si aucun seuil critique n’est configuré', () => {
    const step = makeStep({ id: 'x', targetDurationDays: 2, alarms: { enabled: true } });
    const state = evaluateAlarm(step, ENTERED, '2027-01-01T00:00:00.000Z');
    expect(state.level).toBe('overdue');
  });
});

describe('alarmCanAdvanceUnit', () => {
  it('ne fait jamais avancer une unité — le passage est décidé par une personne', () => {
    expect(alarmCanAdvanceUnit()).toBe(false);
  });
});
