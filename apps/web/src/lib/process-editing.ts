import type { ProcessGraph, ProcessStep, ProcessTransition, Stage } from '@champi/contracts';

/**
 * Opérations d'édition d'un graphe de process.
 *
 * Toutes **pures** : elles prennent un graphe et en rendent un nouveau. Le
 * canvas n'est qu'une vue — c'est ici que vit la logique, et c'est ici qu'on
 * la teste (docs/22 §3.1).
 *
 * ⚠️ Aucune de ces opérations ne contraint le graphe à une forme particulière.
 * Les arêtes décrivent le chemin **nominal**, pas le chemin autorisé : les
 * étapes sont sautables, refaisables et réversibles. Interdire des formes ici
 * reviendrait à interdire des pratiques que le cultivateur a demandé de garder
 * possibles (docs/22 §3.3).
 */

/** Identifiant technique dérivé d'un nom : lisible, stable, sans accent. */
export function slugify(name: string): string {
  const withoutAccents = name.normalize('NFD').replace(/[̀-ͯ]/gu, '');
  return (
    withoutAccents
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, '_')
      .replace(/^_+|_+$/gu, '') || 'etape'
  );
}

/** Identifiant unique dans le graphe : `incubation`, puis `incubation_2`… */
export function uniqueStepId(graph: ProcessGraph, base: string): string {
  const slug = slugify(base);
  if (!graph.steps.some((step) => step.id === slug)) {
    return slug;
  }
  let suffix = 2;
  while (graph.steps.some((step) => step.id === `${slug}_${String(suffix)}`)) {
    suffix += 1;
  }
  return `${slug}_${String(suffix)}`;
}

export interface NewStepInput {
  readonly name: string;
  readonly stage: Stage;
}

/** Ajoute une étape. Elle naît déconnectée : relier est un geste distinct. */
export function addStep(graph: ProcessGraph, input: NewStepInput): ProcessGraph {
  const step: ProcessStep = {
    id: uniqueStepId(graph, input.name),
    name: input.name,
    stage: input.stage,
    conditions: {},
    alarms: { enabled: false },
    optional: false,
    provenance: 'cultivator',
  };
  return { ...graph, steps: [...graph.steps, step] };
}

/** Modifie une étape. Son identifiant ne change jamais — les arêtes le citent. */
export function updateStep(
  graph: ProcessGraph,
  stepId: string,
  patch: Partial<Omit<ProcessStep, 'id'>>,
): ProcessGraph {
  return {
    ...graph,
    steps: graph.steps.map((step) => (step.id === stepId ? { ...step, ...patch } : step)),
  };
}

/**
 * Supprime une étape **et les arêtes qui la citent**.
 *
 * Laisser des arêtes pendantes produirait un graphe que la validation refuse
 * de publier — autant nettoyer tout de suite plutôt que d'exiger un second
 * geste de réparation.
 */
export function removeStep(graph: ProcessGraph, stepId: string): ProcessGraph {
  // On reconstruit le layout sans la clé plutôt que de la supprimer : un
  // `delete` dynamique est plus difficile à optimiser et à relire.
  const layout =
    graph.layout === undefined
      ? undefined
      : Object.fromEntries(Object.entries(graph.layout).filter(([id]) => id !== stepId));
  return {
    ...graph,
    steps: graph.steps.filter((step) => step.id !== stepId),
    transitions: graph.transitions.filter((t) => t.from !== stepId && t.to !== stepId),
    ...(layout !== undefined ? { layout } : {}),
  };
}

/** Relie deux étapes. Sans effet si l'arête existe déjà ou si elle boucle sur elle-même. */
export function connectSteps(graph: ProcessGraph, from: string, to: string): ProcessGraph {
  const known = new Set(graph.steps.map((step) => step.id));
  const exists = graph.transitions.some((t) => t.from === from && t.to === to);
  if (from === to || !known.has(from) || !known.has(to) || exists) {
    return graph;
  }
  return { ...graph, transitions: [...graph.transitions, { from, to }] };
}

export function disconnectSteps(graph: ProcessGraph, from: string, to: string): ProcessGraph {
  return {
    ...graph,
    transitions: graph.transitions.filter((t) => !(t.from === from && t.to === to)),
  };
}

/**
 * Déplace une étape sur le canvas.
 *
 * Le `layout` est **séparé et jetable** : le perdre ne perd jamais le process
 * (docs/22 §3.1). C'est pour cela qu'il est stocké à part et non dans l'étape.
 */
export function moveStep(graph: ProcessGraph, stepId: string, x: number, y: number): ProcessGraph {
  return { ...graph, layout: { ...graph.layout, [stepId]: { x, y } } };
}

/** Renomme une étape sans toucher à son identifiant, donc sans casser les arêtes. */
export function renameStep(graph: ProcessGraph, stepId: string, name: string): ProcessGraph {
  return updateStep(graph, stepId, { name });
}

/** Retrouve une étape. */
export function findStepById(graph: ProcessGraph, stepId: string): ProcessStep | undefined {
  return graph.steps.find((step) => step.id === stepId);
}

/** Arêtes partant d'une étape. */
export function outgoingTransitions(graph: ProcessGraph, stepId: string): ProcessTransition[] {
  return graph.transitions.filter((t) => t.from === stepId);
}

/**
 * Retire le layout d'un graphe avant envoi à l'API.
 *
 * Utile pour comparer deux graphes sur leur **contenu** : deux process
 * identiques dont seules les positions diffèrent ne sont pas deux process
 * différents.
 */
export function withoutLayout(graph: ProcessGraph): ProcessGraph {
  const { layout: _layout, ...rest } = graph;
  return rest;
}

/** Deux graphes décrivent-ils le même process, positions mises à part ? */
export function sameProcess(a: ProcessGraph, b: ProcessGraph): boolean {
  return JSON.stringify(withoutLayout(a)) === JSON.stringify(withoutLayout(b));
}
