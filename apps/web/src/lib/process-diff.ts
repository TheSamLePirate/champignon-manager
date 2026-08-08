import type { ProcessGraph, ProcessStep } from '@champi/contracts';

/**
 * Comparaison de deux versions de process.
 *
 * Le cultivateur veut **comparer les résultats entre deux versions**
 * (`docs/21` §2) — c'est ce qui a fait écarter la bascule automatique. Avant de
 * comparer des rendements, il faut pouvoir voir ce qui a changé dans le
 * process : sans cela, une différence de résultat n'est pas interprétable.
 *
 * Module pur : il compare deux graphes déjà chargés.
 */

export type StepChangeKind = 'added' | 'removed' | 'modified';

export interface StepChange {
  readonly kind: StepChangeKind;
  readonly stepId: string;
  readonly name: string;
  /** Champs modifiés, en clair. Vide pour un ajout ou un retrait. */
  readonly fields: readonly string[];
}

export interface TransitionChange {
  readonly kind: 'added' | 'removed';
  readonly from: string;
  readonly to: string;
}

export interface ProcessDiff {
  readonly steps: readonly StepChange[];
  readonly transitions: readonly TransitionChange[];
  readonly identical: boolean;
}

/** Libellés lisibles des champs comparés. */
const FIELD_LABEL: Readonly<Record<string, string>> = {
  name: 'nom',
  stage: 'stade',
  targetDurationDays: 'durée cible',
  conditions: 'conditions',
  alarms: 'alarmes',
  optional: 'caractère optionnel',
  expectedWeightUnit: 'unité de pesée',
  provenance: 'provenance',
};

/** Champs comparés. Le `layout` en est absent : ce n'est pas du process. */
const COMPARED_FIELDS: readonly (keyof ProcessStep)[] = [
  'name',
  'stage',
  'targetDurationDays',
  'conditions',
  'alarms',
  'optional',
  'expectedWeightUnit',
  'provenance',
];

function changedFields(before: ProcessStep, after: ProcessStep): string[] {
  return COMPARED_FIELDS.filter(
    (field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]),
  ).map((field) => FIELD_LABEL[field] ?? field);
}

/**
 * Compare deux graphes.
 *
 * L'ordre compte : `before` est la version publiée, `after` celle qu'on
 * envisage. Un « ajout » est donc une étape qui n'existait pas.
 */
export function diffProcessGraphs(before: ProcessGraph, after: ProcessGraph): ProcessDiff {
  const beforeById = new Map(before.steps.map((step) => [step.id, step]));
  const afterById = new Map(after.steps.map((step) => [step.id, step]));

  const steps: StepChange[] = [];

  for (const step of after.steps) {
    const previous = beforeById.get(step.id);
    if (previous === undefined) {
      steps.push({ kind: 'added', stepId: step.id, name: step.name, fields: [] });
      continue;
    }
    const fields = changedFields(previous, step);
    if (fields.length > 0) {
      steps.push({ kind: 'modified', stepId: step.id, name: step.name, fields });
    }
  }

  for (const step of before.steps) {
    if (!afterById.has(step.id)) {
      steps.push({ kind: 'removed', stepId: step.id, name: step.name, fields: [] });
    }
  }

  const key = (t: { from: string; to: string }): string => `${t.from}→${t.to}`;
  const beforeEdges = new Set(before.transitions.map(key));
  const afterEdges = new Set(after.transitions.map(key));

  const transitions: TransitionChange[] = [
    ...after.transitions
      .filter((t) => !beforeEdges.has(key(t)))
      .map((t) => ({ kind: 'added' as const, from: t.from, to: t.to })),
    ...before.transitions
      .filter((t) => !afterEdges.has(key(t)))
      .map((t) => ({ kind: 'removed' as const, from: t.from, to: t.to })),
  ];

  return {
    steps,
    transitions,
    identical: steps.length === 0 && transitions.length === 0,
  };
}

/**
 * Résume un diff en une phrase.
 *
 * ⚠️ Le résumé rappelle systématiquement que les unités en cours ne bougent
 * pas : c'est la décision la plus contre-intuitive du produit — le cultivateur
 * avait demandé l'inverse (`docs/21` §10) — et l'endroit le plus utile pour la
 * répéter est celui où il modifie un process.
 */
export function summariseDiff(diff: ProcessDiff): string {
  if (diff.identical) {
    return 'Aucune différence avec la version publiée.';
  }

  const parts: string[] = [];
  const added = diff.steps.filter((s) => s.kind === 'added').length;
  const removed = diff.steps.filter((s) => s.kind === 'removed').length;
  const modified = diff.steps.filter((s) => s.kind === 'modified').length;

  if (added > 0) {
    parts.push(`${String(added)} étape${added > 1 ? 's' : ''} ajoutée${added > 1 ? 's' : ''}`);
  }
  if (removed > 0) {
    parts.push(
      `${String(removed)} étape${removed > 1 ? 's' : ''} retirée${removed > 1 ? 's' : ''}`,
    );
  }
  if (modified > 0) {
    parts.push(
      `${String(modified)} étape${modified > 1 ? 's' : ''} modifiée${modified > 1 ? 's' : ''}`,
    );
  }
  if (diff.transitions.length > 0) {
    const count = diff.transitions.length;
    parts.push(`${String(count)} lien${count > 1 ? 's' : ''} changé${count > 1 ? 's' : ''}`);
  }

  return `${parts.join(', ')}. Les unités déjà lancées resteront sur leur version.`;
}
