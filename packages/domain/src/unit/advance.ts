import {
  appError,
  type CultureUnit,
  type ProcessGraph,
  type ProcessStep,
  type UnitStatus,
} from '@champi/contracts';
import { err, ok, type Result } from '../result.js';
import { findStep, isNominalTransition, nominalNextSteps } from '../process/graph.js';

/**
 * Avancement d'une unité d'une étape à une autre.
 *
 * Trois principes, tous issus des réponses du cultivateur :
 *
 * 1. **Un humain déclenche toujours.** Aucune durée, aucune échéance ne fait
 *    avancer une unité (docs/04 §16).
 * 2. **Toute transition est possible** — sauter, refaire, revenir en arrière.
 *    Le graphe décrit le chemin nominal ; s'en écarter demande une
 *    confirmation, jamais une permission (docs/22 §3.3).
 * 3. **L'écart est enregistré**, pas empêché : `followedNominalPath` alimentera
 *    la statistique « écart au process ».
 */

/** Statuts dans lesquels une unité ne peut plus progresser. */
const TERMINAL_STATUSES: readonly UnitStatus[] = [
  'completed',
  'composted',
  'discarded',
  'contaminated',
];

export interface AdvanceRequest {
  readonly unit: CultureUnit;
  readonly graph: ProcessGraph;
  readonly toStepId: string;
  /**
   * Confirmation explicite pour un écart au chemin nominal.
   *
   * Ce n'est **pas** un droit d'accès : c'est le « êtes-vous sûr ? » d'un geste
   * inhabituel. Sans lui, un écart est refusé — avec un message qui dit
   * exactement comment procéder.
   */
  readonly confirmOffNominal?: boolean;
  readonly nowIso: string;
}

export interface AdvanceOutcome {
  readonly unit: CultureUnit;
  readonly fromStepId: string;
  readonly toStepId: string;
  readonly followedNominalPath: boolean;
  readonly step: ProcessStep;
}

/**
 * Une unité contaminée ne peut plus produire (réponse cultivateur `q18_2`).
 * Les statuts terminaux bloquent l'avancement, mais **n'effacent rien** :
 * l'unité reste consultable et son historique intact.
 */
export function canAdvance(unit: CultureUnit): boolean {
  return !TERMINAL_STATUSES.includes(unit.status);
}

/** Fait avancer une unité vers une étape, en enregistrant si le chemin était nominal. */
export function advanceUnit(request: AdvanceRequest): Result<AdvanceOutcome> {
  const { unit, graph, toStepId, nowIso } = request;

  if (!canAdvance(unit)) {
    return err(
      appError(
        'UNIT_NOT_ACTIVE',
        `L'unité ${unit.publicCode} est au statut « ${unit.status} » : elle ne peut plus changer d'étape.`,
        {
          hint: 'Une unité terminée, compostée, rebutée ou contaminée ne progresse plus. Son historique reste consultable.',
          path: 'unitId',
        },
      ),
    );
  }

  const target = findStep(graph, toStepId);
  if (!target.ok) {
    return target;
  }

  const followedNominalPath = isNominalTransition(graph, unit.currentStepId, toStepId);
  if (!followedNominalPath && request.confirmOffNominal !== true) {
    const suggestions = nominalNextSteps(graph, unit.currentStepId).map((s) => s.id);
    return err(
      appError(
        'VALIDATION_FAILED',
        `Le passage de « ${unit.currentStepId} » à « ${toStepId} » ne suit pas le chemin nominal du process.`,
        {
          hint:
            suggestions.length > 0
              ? `Chemin nominal depuis l'étape courante : ${suggestions.join(', ')}. Pour t'en écarter volontairement, renvoie la demande avec confirmOffNominal: true — sauter, refaire ou revenir en arrière est autorisé.`
              : "Cette étape n'a aucune suite nominale déclarée. Renvoie la demande avec confirmOffNominal: true pour continuer.",
          path: 'toStepId',
        },
      ),
    );
  }

  const advanced: CultureUnit = {
    ...unit,
    currentStepId: toStepId,
    stage: target.value.stage,
    currentStepEnteredAt: nowIso,
    updatedAt: nowIso,
    version: unit.version + 1,
  };

  return ok({
    unit: advanced,
    fromStepId: unit.currentStepId,
    toStepId,
    followedNominalPath,
    step: target.value,
  });
}
