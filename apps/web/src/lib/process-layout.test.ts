import { describe, expect, it } from 'vitest';
import type { ProcessGraph, ProcessStep } from '@champi/contracts';
import {
  autoLayout,
  layoutGraph,
  canvasBounds,
  COLUMN_WIDTH,
  computeRanks,
  edgePaths,
  MARGIN,
  ROW_HEIGHT,
} from './process-layout.js';

function step(id: string): ProcessStep {
  return {
    id,
    name: id,
    stage: 'substrate',
    conditions: {},
    alarms: { enabled: false },
    optional: false,
    provenance: 'cultivator',
  };
}

function linear(): ProcessGraph {
  return {
    steps: ['a', 'b', 'c'].map(step),
    transitions: [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
    ],
  };
}

describe('computeRanks', () => {
  it('donne le rang 0 aux points d’entrée', () => {
    expect(computeRanks(linear()).get('a')).toBe(0);
  });

  it('incrémente le rang le long d’une chaîne', () => {
    const ranks = computeRanks(linear());
    expect([ranks.get('a'), ranks.get('b'), ranks.get('c')]).toEqual([0, 1, 2]);
  });

  it('accepte plusieurs points d’entrée — une unité naît à tout stade', () => {
    const ranks = computeRanks({
      steps: ['a', 'b', 'c'].map(step),
      transitions: [
        { from: 'a', to: 'c' },
        { from: 'b', to: 'c' },
      ],
    });
    expect(ranks.get('a')).toBe(0);
    expect(ranks.get('b')).toBe(0);
    expect(ranks.get('c')).toBe(1);
  });

  /**
   * On prend la distance **maximale** : sinon une étape placée après une longue
   * branche apparaîtrait avant elle.
   */
  it('retient le chemin le plus long en cas de convergence', () => {
    const ranks = computeRanks({
      steps: ['a', 'b', 'c', 'd'].map(step),
      transitions: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'a', to: 'c' },
        { from: 'c', to: 'd' },
      ],
    });
    expect(ranks.get('c')).toBe(2);
    expect(ranks.get('d')).toBe(3);
  });

  /**
   * Le process autorise les retours en arrière : un graphe cyclique doit
   * s'afficher plutôt que faire boucler l'algorithme.
   */
  it('tolère un cycle sans boucler', () => {
    const ranks = computeRanks({
      steps: ['a', 'b'].map(step),
      transitions: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'a' },
      ],
    });
    expect(ranks.size).toBe(2);
  });

  it('tolère un cycle long', () => {
    const ranks = computeRanks({
      steps: ['a', 'b', 'c'].map(step),
      transitions: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
        { from: 'c', to: 'a' },
      ],
    });
    expect(ranks.size).toBe(3);
  });

  it('rend une carte vide pour un graphe vide', () => {
    expect(computeRanks({ steps: [], transitions: [] }).size).toBe(0);
  });

  it('ignore une arête dont la cible n’existe pas', () => {
    const ranks = computeRanks({
      steps: [step('a')],
      transitions: [{ from: 'a', to: 'fantome' }],
    });
    expect(ranks.get('a')).toBe(0);
  });
});

describe('autoLayout', () => {
  it('dispose une chaîne en colonnes', () => {
    const layout = autoLayout(linear());
    expect(layout['a']).toEqual({ x: MARGIN, y: MARGIN });
    expect(layout['b']).toEqual({ x: MARGIN + COLUMN_WIDTH, y: MARGIN });
    expect(layout['c']).toEqual({ x: MARGIN + 2 * COLUMN_WIDTH, y: MARGIN });
  });

  it('empile les étapes de même rang', () => {
    const layout = autoLayout({
      steps: ['a', 'b'].map(step),
      transitions: [],
    });
    expect(layout['a']).toEqual({ x: MARGIN, y: MARGIN });
    expect(layout['b']).toEqual({ x: MARGIN, y: MARGIN + ROW_HEIGHT });
  });

  /** Déplacer une étape à la main ne doit pas être annulé au rendu suivant. */
  it('conserve les positions déjà enregistrées', () => {
    const positioned: ProcessGraph = { ...linear(), layout: { b: { x: 999, y: 111 } } };
    const layout = autoLayout(positioned);
    expect(layout['b']).toEqual({ x: 999, y: 111 });
    // Les autres restent calculées.
    expect(layout['a']).toEqual({ x: MARGIN, y: MARGIN });
  });

  it('rend un layout vide pour un graphe vide', () => {
    expect(autoLayout({ steps: [], transitions: [] })).toEqual({});
  });
});

describe('layoutGraph', () => {
  it('rend chaque étape avec sa position, sans recherche possible en échec', () => {
    const positioned = layoutGraph(linear());
    expect(positioned.map((p) => p.step.id)).toEqual(['a', 'b', 'c']);
    expect(positioned[0]).toMatchObject({ x: MARGIN, y: MARGIN });
  });

  it('conserve une position enregistrée', () => {
    const positioned = layoutGraph({ ...linear(), layout: { b: { x: 5, y: 6 } } });
    expect(positioned.find((p) => p.step.id === 'b')).toMatchObject({ x: 5, y: 6 });
  });

  it('rend une liste vide pour un graphe vide', () => {
    expect(layoutGraph({ steps: [], transitions: [] })).toEqual([]);
  });
});

describe('canvasBounds', () => {
  it('englobe toutes les étapes', () => {
    const bounds = canvasBounds({ a: { x: 0, y: 0 }, b: { x: 200, y: 100 } });
    expect(bounds.width).toBe(200 + 170 + MARGIN);
    expect(bounds.height).toBe(100 + 70 + MARGIN);
  });

  it('rend une taille minimale pour un canvas vide', () => {
    expect(canvasBounds({})).toEqual({ width: COLUMN_WIDTH, height: ROW_HEIGHT });
  });

  it('accepte des dimensions de nœud personnalisées', () => {
    const bounds = canvasBounds({ a: { x: 10, y: 10 } }, 100, 50);
    expect(bounds.width).toBe(10 + 100 + MARGIN);
    expect(bounds.height).toBe(10 + 50 + MARGIN);
  });
});

describe('edgePaths', () => {
  it('trace une courbe entre deux étapes', () => {
    const paths = edgePaths(linear(), autoLayout(linear()));
    expect(paths).toHaveLength(2);
    expect(paths[0]?.from).toBe('a');
    expect(paths[0]?.to).toBe('b');
    expect(paths[0]?.d).toMatch(/^M [\d.]+ [\d.]+ C /);
  });

  it('ne produit jamais de NaN dans le tracé', () => {
    const paths = edgePaths(linear(), autoLayout(linear()));
    for (const path of paths) {
      expect(path.d).not.toContain('NaN');
    }
  });

  /**
   * Une arête pendante ne doit pas casser l'affichage : le graphe se dessine,
   * la validation signalera le problème ailleurs.
   */
  it('ignore une arête dont une extrémité manque', () => {
    const graph: ProcessGraph = {
      steps: [step('a')],
      transitions: [
        { from: 'a', to: 'fantome' },
        { from: 'fantome', to: 'a' },
      ],
    };
    expect(edgePaths(graph, autoLayout(graph))).toEqual([]);
  });

  it('conserve le libellé d’une arête', () => {
    const graph: ProcessGraph = {
      ...linear(),
      transitions: [{ from: 'a', to: 'b', label: 'sans flush 3' }],
    };
    expect(edgePaths(graph, autoLayout(graph))[0]?.label).toBe('sans flush 3');
  });

  it('n’ajoute pas de libellé quand il n’y en a pas', () => {
    expect(edgePaths(linear(), autoLayout(linear()))[0]?.label).toBeUndefined();
  });

  it('trace aussi une arête qui remonte vers la gauche', () => {
    const graph: ProcessGraph = {
      steps: ['a', 'b'].map(step),
      transitions: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'a' },
      ],
    };
    const paths = edgePaths(graph, autoLayout(graph));
    expect(paths).toHaveLength(2);
    expect(paths[1]?.d).not.toContain('NaN');
  });
});
