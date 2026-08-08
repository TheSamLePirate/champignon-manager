import { describe, expect, it } from 'vitest';
import {
  findStep,
  inspectProcessGraph,
  isNominalTransition,
  nominalNextSteps,
  validateProcessGraph,
} from './graph.js';
import { makeDefaultGraph, makeStep } from '../__testing__/builders.js';

describe('inspectProcessGraph', () => {
  it('ne signale rien sur le process par défaut à six étapes', () => {
    expect(inspectProcessGraph(makeDefaultGraph())).toEqual([]);
  });

  it('signale un process vide', () => {
    const issues = inspectProcessGraph({ steps: [], transitions: [] });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe('error');
    expect(issues[0]?.message).toContain('aucune étape');
  });

  it('signale un identifiant d’étape en double', () => {
    const issues = inspectProcessGraph({
      steps: [makeStep({ id: 'a' }), makeStep({ id: 'a' })],
      transitions: [],
    });
    expect(issues.some((i) => i.message.includes('plusieurs fois'))).toBe(true);
  });

  it('signale une arête dont la cible n’existe pas', () => {
    const issues = inspectProcessGraph({
      steps: [makeStep({ id: 'a' })],
      transitions: [{ from: 'a', to: 'fantome' }],
    });
    expect(issues[0]?.message).toContain('fantome');
    expect(issues[0]?.stepId).toBe('fantome');
  });

  it('signale une arête dont la source n’existe pas', () => {
    const issues = inspectProcessGraph({
      steps: [makeStep({ id: 'a' })],
      transitions: [{ from: 'fantome', to: 'a' }],
    });
    expect(issues[0]?.stepId).toBe('fantome');
  });

  it('signale une durée cible négative', () => {
    const issues = inspectProcessGraph({
      steps: [makeStep({ id: 'a', name: 'Étape A', targetDurationDays: -3 })],
      transitions: [],
    });
    expect(issues.some((i) => i.message.includes('nulle ou négative'))).toBe(true);
  });

  it('avertit — sans bloquer — sur une étape déconnectée', () => {
    const issues = inspectProcessGraph({
      steps: [makeStep({ id: 'a' }), makeStep({ id: 'b' }), makeStep({ id: 'orpheline' })],
      transitions: [{ from: 'a', to: 'b' }],
    });
    const warning = issues.find((i) => i.severity === 'warning');
    expect(warning?.stepId).toBe('orpheline');
    expect(warning?.message).toContain('reste utilisable');
  });

  it('n’avertit pas sur une étape unique — un process à une étape est légitime', () => {
    expect(inspectProcessGraph({ steps: [makeStep({ id: 'seule' })], transitions: [] })).toEqual(
      [],
    );
  });

  it('accepte plusieurs points d’entrée : une unité peut naître à tout stade', () => {
    const issues = inspectProcessGraph({
      steps: [makeStep({ id: 'a' }), makeStep({ id: 'b' }), makeStep({ id: 'c' })],
      transitions: [
        { from: 'a', to: 'c' },
        { from: 'b', to: 'c' },
      ],
    });
    expect(issues).toEqual([]);
  });
});

describe('validateProcessGraph', () => {
  it('accepte un graphe valide', () => {
    const graph = makeDefaultGraph();
    expect(validateProcessGraph(graph)).toEqual({ ok: true, value: graph });
  });

  it('accepte un graphe qui n’a que des avertissements', () => {
    const result = validateProcessGraph({
      steps: [makeStep({ id: 'a' }), makeStep({ id: 'b' }), makeStep({ id: 'orpheline' })],
      transitions: [{ from: 'a', to: 'b' }],
    });
    expect(result.ok).toBe(true);
  });

  it('refuse un graphe en erreur et compte les problèmes', () => {
    const result = validateProcessGraph({
      steps: [makeStep({ id: 'a' }), makeStep({ id: 'a' })],
      transitions: [{ from: 'a', to: 'fantome' }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('PROCESS_GRAPH_INVALID');
    expect(result.error.message).toContain('2 erreur');
    expect(result.error.hint).toContain('éditeur');
  });
});

describe('findStep', () => {
  it('retrouve une étape existante', () => {
    const result = findStep(makeDefaultGraph(), 'incubation');
    expect(result.ok && result.value.name).toBe('Incubation');
  });

  it('liste les étapes valides quand l’étape demandée n’existe pas', () => {
    const result = findStep(makeDefaultGraph(), 'flush_4');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('STEP_NOT_IN_PROCESS');
    expect(result.error.hint).toContain('inoculation');
    expect(result.error.path).toBe('stepId');
  });
});

describe('isNominalTransition', () => {
  it('reconnaît une arête déclarée', () => {
    expect(isNominalTransition(makeDefaultGraph(), 'incubation', 'fructification')).toBe(true);
  });

  it('rejette une transition non déclarée', () => {
    expect(isNominalTransition(makeDefaultGraph(), 'inoculation', 'flush_1')).toBe(false);
  });

  it('rejette le sens inverse d’une arête', () => {
    expect(isNominalTransition(makeDefaultGraph(), 'fructification', 'incubation')).toBe(false);
  });
});

describe('nominalNextSteps', () => {
  it('donne la suite unique d’une étape linéaire', () => {
    expect(nominalNextSteps(makeDefaultGraph(), 'incubation').map((s) => s.id)).toEqual([
      'fructification',
    ]);
  });

  it('donne les deux suites d’une bifurcation', () => {
    expect(nominalNextSteps(makeDefaultGraph(), 'flush_2').map((s) => s.id)).toEqual([
      'flush_3',
      'fin_de_cycle',
    ]);
  });

  it('renvoie une liste vide pour une étape terminale', () => {
    expect(nominalNextSteps(makeDefaultGraph(), 'fin_de_cycle')).toEqual([]);
  });
});
