import { describe, expect, it } from 'vitest';
import type { ProcessGraph, ProcessStep } from '@champi/contracts';
import { diffProcessGraphs, summariseDiff } from './process-diff.js';

function step(id: string, overrides: Partial<ProcessStep> = {}): ProcessStep {
  return {
    id,
    name: id,
    stage: 'substrate',
    conditions: {},
    alarms: { enabled: false },
    optional: false,
    provenance: 'cultivator',
    ...overrides,
  };
}

function graph(steps: ProcessStep[], transitions: ProcessGraph['transitions'] = []): ProcessGraph {
  return { steps, transitions };
}

const base = graph([step('a'), step('b')], [{ from: 'a', to: 'b' }]);

describe('diffProcessGraphs', () => {
  it('ne signale rien entre deux graphes identiques', () => {
    const diff = diffProcessGraphs(base, base);
    expect(diff.identical).toBe(true);
    expect(diff.steps).toEqual([]);
    expect(diff.transitions).toEqual([]);
  });

  it('détecte une étape ajoutée', () => {
    const diff = diffProcessGraphs(
      base,
      graph([step('a'), step('b'), step('c')], base.transitions),
    );
    expect(diff.steps).toEqual([{ kind: 'added', stepId: 'c', name: 'c', fields: [] }]);
  });

  it('détecte une étape retirée', () => {
    const diff = diffProcessGraphs(base, graph([step('a')], []));
    expect(diff.steps.some((s) => s.kind === 'removed' && s.stepId === 'b')).toBe(true);
  });

  it('nomme les champs modifiés en clair', () => {
    const diff = diffProcessGraphs(
      base,
      graph([step('a'), step('b', { targetDurationDays: 21, optional: true })], base.transitions),
    );
    const change = diff.steps[0];
    expect(change?.kind).toBe('modified');
    expect(change?.fields).toEqual(['durée cible', 'caractère optionnel']);
  });

  it('détecte un changement de nom sans changer d’identifiant', () => {
    const diff = diffProcessGraphs(
      base,
      graph([step('a'), step('b', { name: 'Incubation longue' })], base.transitions),
    );
    expect(diff.steps[0]?.fields).toEqual(['nom']);
  });

  it('détecte un changement de conditions', () => {
    const diff = diffProcessGraphs(
      base,
      graph(
        [step('a'), step('b', { conditions: { temperatureC: { min: 24, max: 24 } } })],
        base.transitions,
      ),
    );
    expect(diff.steps[0]?.fields).toEqual(['conditions']);
  });

  it('détecte un changement d’alarmes', () => {
    const diff = diffProcessGraphs(
      base,
      graph([step('a'), step('b', { alarms: { enabled: true } })], base.transitions),
    );
    expect(diff.steps[0]?.fields).toEqual(['alarmes']);
  });

  it('détecte un changement de stade et de provenance', () => {
    const diff = diffProcessGraphs(
      base,
      graph(
        [step('a'), step('b', { stage: 'fruiting', provenance: 'invented' })],
        base.transitions,
      ),
    );
    expect(diff.steps[0]?.fields).toEqual(['stade', 'provenance']);
  });

  it('détecte un changement d’unité de pesée', () => {
    const diff = diffProcessGraphs(
      base,
      graph([step('a'), step('b', { expectedWeightUnit: 'g' })], base.transitions),
    );
    expect(diff.steps[0]?.fields).toEqual(['unité de pesée']);
  });

  it('détecte une arête ajoutée', () => {
    const diff = diffProcessGraphs(
      base,
      graph(base.steps, [...base.transitions, { from: 'b', to: 'a' }]),
    );
    expect(diff.transitions).toEqual([{ kind: 'added', from: 'b', to: 'a' }]);
  });

  it('détecte une arête retirée', () => {
    const diff = diffProcessGraphs(base, graph(base.steps, []));
    expect(diff.transitions).toEqual([{ kind: 'removed', from: 'a', to: 'b' }]);
  });

  /** Le layout n'est pas du process : le déplacer ne change rien. */
  it('ignore les positions', () => {
    const moved: ProcessGraph = { ...base, layout: { a: { x: 999, y: 999 } } };
    expect(diffProcessGraphs(base, moved).identical).toBe(true);
  });

  it('cumule plusieurs changements de nature différente', () => {
    const after = graph([step('a', { name: 'Renommée' }), step('c')], [{ from: 'a', to: 'c' }]);
    const diff = diffProcessGraphs(base, after);

    expect(diff.steps.map((s) => s.kind).sort()).toEqual(['added', 'modified', 'removed']);
    expect(diff.transitions).toHaveLength(2);
    expect(diff.identical).toBe(false);
  });
});

describe('summariseDiff', () => {
  it('annonce l’absence de différence', () => {
    expect(summariseDiff(diffProcessGraphs(base, base))).toBe(
      'Aucune différence avec la version publiée.',
    );
  });

  /**
   * Le rappel le plus important du produit : le cultivateur avait demandé
   * l'inverse, et l'endroit le plus utile pour le redire est celui où il
   * modifie un process.
   */
  it('rappelle systématiquement que les unités en cours ne bougent pas', () => {
    const diff = diffProcessGraphs(base, graph([step('a')], []));
    expect(summariseDiff(diff)).toContain('resteront sur leur version');
  });

  it('accorde au singulier', () => {
    const diff = diffProcessGraphs(base, graph([...base.steps, step('c')], base.transitions));
    expect(summariseDiff(diff)).toContain('1 étape ajoutée');
  });

  it('accorde au pluriel', () => {
    const diff = diffProcessGraphs(
      base,
      graph([...base.steps, step('c'), step('d')], base.transitions),
    );
    expect(summariseDiff(diff)).toContain('2 étapes ajoutées');
  });

  it('mentionne les retraits', () => {
    expect(summariseDiff(diffProcessGraphs(base, graph([step('a')], [])))).toContain(
      '1 étape retirée',
    );
  });

  it('accorde les retraits au pluriel', () => {
    const diff = diffProcessGraphs(base, graph([], []));
    expect(summariseDiff(diff)).toContain('2 étapes retirées');
  });

  it('mentionne les modifications', () => {
    const diff = diffProcessGraphs(
      base,
      graph([step('a'), step('b', { optional: true })], base.transitions),
    );
    expect(summariseDiff(diff)).toContain('1 étape modifiée');
  });

  it('accorde les modifications au pluriel', () => {
    const diff = diffProcessGraphs(
      base,
      graph([step('a', { optional: true }), step('b', { optional: true })], base.transitions),
    );
    expect(summariseDiff(diff)).toContain('2 étapes modifiées');
  });

  it('mentionne les liens changés, au singulier', () => {
    const diff = diffProcessGraphs(base, graph(base.steps, []));
    expect(summariseDiff(diff)).toContain('1 lien changé');
  });

  it('mentionne les liens changés, au pluriel', () => {
    const diff = diffProcessGraphs(
      base,
      graph(base.steps, [
        { from: 'b', to: 'a' },
        { from: 'a', to: 'a' },
      ]),
    );
    expect(summariseDiff(diff)).toContain('3 liens changés');
  });

  it('énumère plusieurs natures de changement', () => {
    const diff = diffProcessGraphs(
      base,
      graph([step('a', { optional: true }), step('c')], [{ from: 'a', to: 'c' }]),
    );
    const summary = summariseDiff(diff);
    expect(summary).toContain('ajoutée');
    expect(summary).toContain('retirée');
    expect(summary).toContain('modifiée');
    expect(summary).toContain('liens changés');
  });
});
