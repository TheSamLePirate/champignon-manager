import type { ProcessGraph, ProcessLayout } from '@champi/contracts';

/**
 * Disposition automatique du graphe.
 *
 * Un process créé par l'API — ou par un agent — n'a pas de `layout` : la
 * disposition est **calculée**, pas exigée. C'est ce qui permet au canvas et à
 * l'API d'éditer le même JSON sans que l'un impose sa forme à l'autre
 * (docs/22 §3.1).
 *
 * L'algorithme est volontairement simple : un rang par distance depuis les
 * points d'entrée, puis empilement vertical dans le rang. Un process de
 * culture est presque linéaire — six étapes chez le cultivateur — et une mise
 * en page sophistiquée n'y apporterait rien.
 */

export const COLUMN_WIDTH = 220;
export const ROW_HEIGHT = 110;
export const MARGIN = 40;

/**
 * Rang de chaque étape : 0 pour les points d'entrée, puis distance maximale.
 *
 * On prend la distance **maximale** et non minimale pour qu'une étape placée
 * après une longue branche n'apparaisse pas avant elle.
 *
 * Les cycles sont tolérés : le process autorise les retours en arrière, et un
 * graphe cyclique doit s'afficher plutôt que de faire boucler l'algorithme.
 */
export function computeRanks(graph: ProcessGraph): Map<string, number> {
  const ranks = new Map<string, number>();
  const incoming = new Map<string, string[]>();

  for (const step of graph.steps) {
    incoming.set(step.id, []);
  }
  for (const transition of graph.transitions) {
    incoming.get(transition.to)?.push(transition.from);
  }

  /** Profondeur maximale, avec garde anti-cycle par marquage du chemin. */
  function depthOf(id: string, visiting: ReadonlySet<string>): number {
    const cached = ranks.get(id);
    if (cached !== undefined) {
      return cached;
    }
    // Cycle détecté : on arrête la remontée plutôt que de boucler.
    if (visiting.has(id)) {
      return 0;
    }

    const parents = incoming.get(id) ?? [];
    const nextVisiting = new Set(visiting).add(id);
    let depth = 0;
    for (const parent of parents) {
      depth = Math.max(depth, depthOf(parent, nextVisiting) + 1);
    }
    ranks.set(id, depth);
    return depth;
  }

  for (const step of graph.steps) {
    depthOf(step.id, new Set());
  }
  return ranks;
}

export interface PositionedStep {
  readonly step: ProcessGraph['steps'][number];
  readonly x: number;
  readonly y: number;
}

/**
 * Place chaque étape, en un seul passage.
 *
 * Rendre les étapes **et** leurs positions ensemble évite au canvas de faire
 * une recherche qui pourrait échouer : il n'y a donc aucune position de repli
 * à écrire — ni à couvrir.
 *
 * Les positions déjà présentes dans le graphe sont **conservées** : déplacer
 * une étape à la main ne doit pas être annulé au prochain rendu.
 */
export function layoutGraph(graph: ProcessGraph): PositionedStep[] {
  const ranks = computeRanks(graph);
  const perRank = new Map<number, number>();
  const positioned: PositionedStep[] = [];

  for (const [id, rank] of ranks) {
    const step = graph.steps.find((candidate) => candidate.id === id);
    if (step === undefined) {
      continue;
    }
    const stored = graph.layout?.[id];
    if (stored !== undefined) {
      positioned.push({ step, x: stored.x, y: stored.y });
      continue;
    }
    const row = perRank.get(rank) ?? 0;
    perRank.set(rank, row + 1);
    positioned.push({
      step,
      x: MARGIN + rank * COLUMN_WIDTH,
      y: MARGIN + row * ROW_HEIGHT,
    });
  }

  return positioned;
}

/** Disposition sous forme de dictionnaire, pour le tracé des arêtes. */
export function autoLayout(graph: ProcessGraph): ProcessLayout {
  return Object.fromEntries(
    layoutGraph(graph).map((positioned) => [
      positioned.step.id,
      { x: positioned.x, y: positioned.y },
    ]),
  );
}

export interface CanvasBounds {
  readonly width: number;
  readonly height: number;
}

/** Dimensions du canvas, calculées pour contenir toutes les étapes. */
export function canvasBounds(
  layout: ProcessLayout,
  nodeWidth = 170,
  nodeHeight = 70,
): CanvasBounds {
  const positions = Object.values(layout);
  if (positions.length === 0) {
    return { width: COLUMN_WIDTH, height: ROW_HEIGHT };
  }
  return {
    width: Math.max(...positions.map((p) => p.x)) + nodeWidth + MARGIN,
    height: Math.max(...positions.map((p) => p.y)) + nodeHeight + MARGIN,
  };
}

export interface EdgePath {
  readonly from: string;
  readonly to: string;
  readonly d: string;
  readonly label?: string;
}

/**
 * Trace les arêtes en courbes de Bézier horizontales.
 *
 * Une arête dont une extrémité manque est **ignorée** plutôt que de produire
 * un `NaN` dans le SVG — le graphe s'affiche, la validation signalera le
 * problème ailleurs.
 */
export function edgePaths(
  graph: ProcessGraph,
  layout: ProcessLayout,
  nodeWidth = 170,
  nodeHeight = 70,
): EdgePath[] {
  const paths: EdgePath[] = [];

  for (const transition of graph.transitions) {
    const from = layout[transition.from];
    const to = layout[transition.to];
    if (from === undefined || to === undefined) {
      continue;
    }

    const x1 = from.x + nodeWidth;
    const y1 = from.y + nodeHeight / 2;
    const x2 = to.x;
    const y2 = to.y + nodeHeight / 2;
    const curve = Math.max(30, Math.abs(x2 - x1) / 2);

    paths.push({
      from: transition.from,
      to: transition.to,
      d: `M ${String(x1)} ${String(y1)} C ${String(x1 + curve)} ${String(y1)}, ${String(x2 - curve)} ${String(y2)}, ${String(x2)} ${String(y2)}`,
      ...(transition.label !== undefined ? { label: transition.label } : {}),
    });
  }

  return paths;
}
