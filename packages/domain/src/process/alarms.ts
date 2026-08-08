import type { AlarmSettings, ProcessStep } from '@champi/contracts';

/**
 * Alarmes de durée.
 *
 * Règle absolue issue des réponses du cultivateur (`q9_7_1`, docs/04 §16) :
 * **la durée ne déclenche aucun passage d'étape.** Le passage se fait à
 * l'observation visuelle, validée par une personne.
 *
 * Une alarme se contente donc de : prévenir avant l'échéance, signaler le
 * dépassement, signaler un retard critique. Elle ne bloque jamais une unité et
 * ne la fait jamais avancer. Il n'y a **aucun job planifié d'avancement** dans
 * cette application — cette fonction est pure et se contente de qualifier un
 * instant donné.
 */

export type AlarmLevel = 'none' | 'reminder' | 'overdue' | 'critical';

export interface AlarmState {
  readonly level: AlarmLevel;
  /** Jours écoulés depuis l'entrée dans l'étape. */
  readonly elapsedDays: number;
  /** Jours restants avant l'échéance. Négatif en cas de dépassement. */
  readonly remainingDays: number | null;
}

const MS_PER_DAY = 86_400_000;

/** Jours écoulés entre deux instants, en valeur fractionnaire. */
export function elapsedDaysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  return (to - from) / MS_PER_DAY;
}

/**
 * Qualifie l'état d'alarme d'une étape à un instant donné.
 *
 * `now` est **injecté** : le domaine ne lit jamais l'horloge lui-même
 * (docs/22 §2.1). C'est ce qui rend cette logique testable sans geler le temps.
 */
export function evaluateAlarm(step: ProcessStep, enteredAtIso: string, nowIso: string): AlarmState {
  const elapsedDays = elapsedDaysBetween(enteredAtIso, nowIso);
  const target = step.targetDurationDays;
  const settings: AlarmSettings = step.alarms;

  if (target === undefined || !settings.enabled) {
    return { level: 'none', elapsedDays, remainingDays: null };
  }

  const remainingDays = target - elapsedDays;
  const criticalPct = settings.criticalOverduePct;
  if (criticalPct !== undefined && elapsedDays >= target * (1 + criticalPct / 100)) {
    return { level: 'critical', elapsedDays, remainingDays };
  }
  if (elapsedDays >= target) {
    return { level: 'overdue', elapsedDays, remainingDays };
  }

  const reminderDays = settings.reminderDaysBefore;
  if (reminderDays !== undefined && remainingDays <= reminderDays) {
    return { level: 'reminder', elapsedDays, remainingDays };
  }

  return { level: 'none', elapsedDays, remainingDays };
}

/**
 * Une alarme autorise-t-elle un passage automatique ?
 *
 * Toujours `false`. Cette fonction existe pour que l'intention soit explicite
 * dans le code et testée, plutôt que d'être une absence silencieuse : une
 * relecture ultérieure ne doit pas « rétablir » une transition temporelle en
 * croyant combler un oubli.
 */
export function alarmCanAdvanceUnit(): false {
  return false;
}
