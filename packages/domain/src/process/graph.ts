import {
  appError,
  listHint,
  type ProcessGraph,
  type ProcessStep,
  type ProcessTransition,
} from '@champi/contracts';
import { err, ok, type Result } from '../result.js';

/**
 * Validation d'un graphe de process.
 *
 * ⚠️ Ce que cette validation **ne fait pas**, délibérément : elle n'interdit
 * aucune transition à l'exécution. Les étapes sont sautables, refaisables et
 * réversibles (réponses cultivateur) — le graphe décrit le chemin *nominal*,
 * pas le chemin *autorisé* (docs/22 §3.3).
 *
 * Ce qu'elle vérifie, c'est la cohérence interne de ce que l'éditeur produit :
 * pas d'arête pendante, pas d'identifiant en double, pas d'étape orpheline.
 */

export interface GraphIssue {
  readonly severity: 'error' | 'warning';
  readonly message: string;
  readonly stepId?: string;
}

function findDuplicateIds(steps: readonly ProcessStep[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const step of steps) {
    if (seen.has(step.id)) {
      duplicates.add(step.id);
    }
    seen.add(step.id);
  }
  return [...duplicates];
}

function findDanglingTransitions(
  transitions: readonly ProcessTransition[],
  stepIds: ReadonlySet<string>,
): ProcessTransition[] {
  return transitions.filter((t) => !stepIds.has(t.from) || !stepIds.has(t.to));
}

/**
 * Étapes qu'aucune transition n'atteint et qui n'en émettent aucune.
 *
 * C'est un **avertissement**, pas une erreur : une unité peut naître à
 * n'importe quel stade, donc plusieurs points d'entrée sont légitimes.
 */
function findIsolatedSteps(
  steps: readonly ProcessStep[],
  transitions: readonly ProcessTransition[],
): ProcessStep[] {
  const connected = new Set<string>();
  for (const transition of transitions) {
    connected.add(transition.from);
    connected.add(transition.to);
  }
  return steps.filter((step) => !connected.has(step.id));
}

/** Analyse un graphe et renvoie tous les problèmes détectés, erreurs et avertissements. */
export function inspectProcessGraph(graph: ProcessGraph): GraphIssue[] {
  const issues: GraphIssue[] = [];

  if (graph.steps.length === 0) {
    issues.push({ severity: 'error', message: 'Le process ne contient aucune étape.' });
    return issues;
  }

  for (const id of findDuplicateIds(graph.steps)) {
    issues.push({
      severity: 'error',
      message: `L'identifiant d'étape « ${id} » apparaît plusieurs fois.`,
      stepId: id,
    });
  }

  const stepIds = new Set(graph.steps.map((s) => s.id));
  for (const transition of findDanglingTransitions(graph.transitions, stepIds)) {
    const missing = stepIds.has(transition.from) ? transition.to : transition.from;
    issues.push({
      severity: 'error',
      message: `La transition « ${transition.from} → ${transition.to} » référence une étape inexistante : « ${missing} ».`,
      stepId: missing,
    });
  }

  for (const step of graph.steps) {
    if (step.targetDurationDays !== undefined && step.targetDurationDays <= 0) {
      issues.push({
        severity: 'error',
        message: `L'étape « ${step.name} » a une durée cible nulle ou négative.`,
        stepId: step.id,
      });
    }
  }

  // Plusieurs points d'entrée sont normaux : une unité peut démarrer à
  // n'importe quel stade. Une étape totalement déconnectée reste un signal utile.
  if (graph.steps.length > 1) {
    for (const step of findIsolatedSteps(graph.steps, graph.transitions)) {
      issues.push({
        severity: 'warning',
        message: `L'étape « ${step.name} » n'est reliée à aucune autre. Elle reste utilisable, mais ne fait partie d'aucun chemin nominal.`,
        stepId: step.id,
      });
    }
  }

  return issues;
}

/** Valide un graphe : échoue s'il contient au moins une erreur. Les avertissements passent. */
export function validateProcessGraph(graph: ProcessGraph): Result<ProcessGraph> {
  const issues = inspectProcessGraph(graph);
  const errors = issues.filter((issue) => issue.severity === 'error');
  if (errors.length > 0) {
    return err(
      appError(
        'PROCESS_GRAPH_INVALID',
        `Le graphe de process comporte ${String(errors.length)} erreur(s) : ${errors
          .map((e) => e.message)
          .join(' ')}`,
        { hint: 'Corrige ces points dans l’éditeur avant de publier la version.' },
      ),
    );
  }
  return ok(graph);
}

/** Retrouve une étape par son identifiant, avec une erreur qui liste les étapes valides. */
export function findStep(graph: ProcessGraph, stepId: string): Result<ProcessStep> {
  const step = graph.steps.find((s) => s.id === stepId);
  if (step === undefined) {
    return err(
      appError('STEP_NOT_IN_PROCESS', `L'étape « ${stepId} » n'existe pas dans ce process.`, {
        hint: listHint(
          'Étapes disponibles',
          graph.steps.map((s) => s.id),
        ),
        path: 'stepId',
      }),
    );
  }
  return ok(step);
}

/** Une transition suit-elle une arête du graphe nominal ? */
export function isNominalTransition(graph: ProcessGraph, from: string, to: string): boolean {
  return graph.transitions.some((t) => t.from === from && t.to === to);
}

/** Étapes atteignables en un pas depuis `stepId`, selon le chemin nominal. */
export function nominalNextSteps(graph: ProcessGraph, stepId: string): ProcessStep[] {
  const targets = graph.transitions.filter((t) => t.from === stepId).map((t) => t.to);
  return graph.steps.filter((step) => targets.includes(step.id));
}
