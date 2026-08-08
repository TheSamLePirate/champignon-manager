import { describe, expect, it } from 'vitest';
import { DEFAULT_MODEL_DISCLAIMER, defaultProcessGraph, inventedStepIds } from './default-model.js';
import { inspectProcessGraph, validateProcessGraph } from './graph.js';

/**
 * Le modèle par défaut est l'anti-écran-vide de la mise en service — le moment
 * classique d'abandon d'un outil de traçabilité (`docs/20` §1). Il doit donc
 * être **publiable tel quel**, sans correction préalable.
 */

describe('defaultProcessGraph', () => {
  it('est valide et publiable sans retouche', () => {
    expect(validateProcessGraph(defaultProcessGraph()).ok).toBe(true);
  });

  it('ne présente aucun problème, même mineur', () => {
    expect(inspectProcessGraph(defaultProcessGraph())).toEqual([]);
  });

  /**
   * Le process réel du cultivateur fait **six étapes**, pas treize : les
   * subdivisions incubation 1/2/3 et fructification 1/2 n'existent pas sur le
   * terrain (« pas de différence », export v8 du 30/07).
   */
  it('décrit le cycle de production en six étapes, plus la fin de cycle', () => {
    const production = defaultProcessGraph().steps.filter(
      (step) => step.stage === 'substrate' || step.stage === 'fruiting',
    );
    expect(production.map((s) => s.id)).toEqual([
      'inoculation',
      'incubation',
      'fructification',
      'flush_1',
      'flush_2',
      'flush_3',
      'fin_de_cycle',
    ]);
  });

  it('ne contient aucune subdivision d’incubation ou de fructification', () => {
    const ids = defaultProcessGraph().steps.map((s) => s.id);
    for (const absent of ['incubation_1', 'incubation_2', 'fructification_1']) {
      expect(ids).not.toContain(absent);
    }
  });

  it('rend les stades de laboratoire optionnels', () => {
    const graph = defaultProcessGraph();
    for (const id of ['gelose', 'culture_liquide', 'ballot_grain']) {
      expect(graph.steps.find((s) => s.id === id)?.optional).toBe(true);
    }
  });

  it('marque le flush 3 optionnel — mais rentable, d’après le cultivateur', () => {
    const flush3 = defaultProcessGraph().steps.find((s) => s.id === 'flush_3');
    expect(flush3?.optional).toBe(true);
    expect(flush3?.provenance).toBe('cultivator');
  });

  it('reprend les valeurs réelles d’incubation', () => {
    const incubation = defaultProcessGraph().steps.find((s) => s.id === 'incubation');
    // 2 à 3 semaines, 24 °C, obscurité — export v8.
    expect(incubation?.targetDurationDays).toBe(21);
    expect(incubation?.conditions.temperatureC).toEqual({ min: 24, max: 24 });
    expect(incubation?.conditions.light).toBe('darkness');
    expect(incubation?.provenance).toBe('cultivator');
  });

  it('reprend les conditions réelles de fructification', () => {
    const step = defaultProcessGraph().steps.find((s) => s.id === 'fructification');
    expect(step?.conditions.humidityPct).toEqual({ min: 90, max: 90 });
    expect(step?.conditions.temperatureC).toEqual({ min: 18, max: 24 });
    expect(step?.conditions.light).toBe('light');
    // La durée, elle, est inventée : la provenance le dit.
    expect(step?.provenance).toBe('invented');
  });

  it('note que l’humidité n’est pas contrôlée en incubation', () => {
    const incubation = defaultProcessGraph().steps.find((s) => s.id === 'incubation');
    expect(incubation?.conditions.notes).toContain('Humidité non contrôlée');
    expect(incubation?.conditions.humidityPct).toBeUndefined();
  });

  it('active les alarmes seulement là où une durée existe', () => {
    for (const step of defaultProcessGraph().steps) {
      if (step.alarms.enabled) {
        expect(step.targetDurationDays).toBeDefined();
      }
    }
  });

  it('prévoit la bifurcation flush 2 → flush 3 ou fin de cycle', () => {
    const fromFlush2 = defaultProcessGraph().transitions.filter((t) => t.from === 'flush_2');
    expect(fromFlush2.map((t) => t.to)).toEqual(['flush_3', 'fin_de_cycle']);
    expect(fromFlush2[1]?.label).toBe('sans flush 3');
  });

  /** Le modèle décrit un process, pas une image : le layout est calculé. */
  it('ne porte aucune disposition', () => {
    expect(defaultProcessGraph().layout).toBeUndefined();
  });

  it('attend un poids en kilogrammes à l’inoculation et en grammes aux flushs', () => {
    const graph = defaultProcessGraph();
    expect(graph.steps.find((s) => s.id === 'inoculation')?.expectedWeightUnit).toBe('kg');
    expect(graph.steps.find((s) => s.id === 'flush_1')?.expectedWeightUnit).toBe('g');
  });
});

/**
 * Épinglage complet du modèle.
 *
 * Ce modèle est la **première chose que voit le cultivateur**. Changer une
 * valeur — 24 °C en 25 °C, 21 jours en 20 — doit être un geste délibéré, pas
 * un effet de bord. Ces assertions échouent donc à chaque modification, et
 * c'est leur raison d'être.
 */
describe('valeurs épinglées du modèle par défaut', () => {
  const graph = defaultProcessGraph();
  const byId = new Map(graph.steps.map((step) => [step.id, step]));

  it('contient exactement dix étapes, dans cet ordre', () => {
    expect(graph.steps.map((s) => s.id)).toEqual([
      'gelose',
      'culture_liquide',
      'ballot_grain',
      'inoculation',
      'incubation',
      'fructification',
      'flush_1',
      'flush_2',
      'flush_3',
      'fin_de_cycle',
    ]);
  });

  it('épingle les stades', () => {
    expect(graph.steps.map((s) => s.stage)).toEqual([
      'gelose',
      'liquid_culture',
      'grain',
      'substrate',
      'substrate',
      'fruiting',
      'fruiting',
      'fruiting',
      'fruiting',
      'fruiting',
    ]);
  });

  it('épingle les durées cibles', () => {
    expect(graph.steps.map((s) => s.targetDurationDays)).toEqual([
      12,
      10,
      18,
      undefined,
      21,
      6,
      2,
      2,
      2,
      undefined,
    ]);
  });

  it('épingle les noms affichés', () => {
    expect(graph.steps.map((s) => s.name)).toEqual([
      'Gélose',
      'Culture liquide',
      'Ballot de grain',
      'Inoculation substrat',
      'Incubation',
      'Fructification',
      'Flush 1',
      'Flush 2',
      'Flush 3',
      'Fin de cycle',
    ]);
  });

  it('épingle les provenances', () => {
    expect(graph.steps.map((s) => s.provenance)).toEqual([
      'invented',
      'invented',
      'invented',
      'cultivator',
      'cultivator',
      'invented',
      'invented',
      'invented',
      'cultivator',
      'cultivator',
    ]);
  });

  it('épingle le caractère optionnel', () => {
    expect(graph.steps.map((s) => s.optional)).toEqual([
      true,
      true,
      true,
      false,
      false,
      false,
      false,
      false,
      true,
      false,
    ]);
  });

  it('épingle les conditions des stades de laboratoire', () => {
    for (const id of ['gelose', 'culture_liquide']) {
      expect(byId.get(id)?.conditions.temperatureC).toEqual({ min: 22, max: 24 });
      expect(byId.get(id)?.conditions.light).toBe('darkness');
    }
    expect(byId.get('ballot_grain')?.conditions.temperatureC).toEqual({ min: 24, max: 24 });
  });

  it('épingle les réglages d’alarme', () => {
    expect(byId.get('incubation')?.alarms).toEqual({
      enabled: true,
      reminderDaysBefore: 1,
      criticalOverduePct: 50,
    });
    expect(byId.get('fructification')?.alarms).toEqual({ enabled: true, reminderDaysBefore: 1 });
    expect(byId.get('inoculation')?.alarms).toEqual({ enabled: false });
  });

  it('épingle les transitions', () => {
    expect(graph.transitions.map((t) => `${t.from}→${t.to}`)).toEqual([
      'gelose→culture_liquide',
      'culture_liquide→ballot_grain',
      'ballot_grain→inoculation',
      'inoculation→incubation',
      'incubation→fructification',
      'fructification→flush_1',
      'flush_1→flush_2',
      'flush_2→flush_3',
      'flush_2→fin_de_cycle',
      'flush_3→fin_de_cycle',
    ]);
  });

  it('épingle la note de fructification', () => {
    expect(byId.get('fructification')?.conditions.notes).toContain('ouverture du sac');
    expect(byId.get('fructification')?.conditions.notes).toContain('2-3 jours');
  });

  it('n’attend un poids qu’aux étapes où l’on pèse', () => {
    expect(graph.steps.filter((s) => s.expectedWeightUnit !== undefined).map((s) => s.id)).toEqual([
      'inoculation',
      'flush_1',
      'flush_2',
      'flush_3',
    ]);
  });
});

describe('inventedStepIds', () => {
  /**
   * Les valeurs inventées n'ont **aucune base agronomique**. L'interface doit
   * pouvoir les signaler, sinon elles passeraient pour des recommandations.
   */
  it('recense les étapes aux valeurs inventées', () => {
    expect(inventedStepIds(defaultProcessGraph())).toEqual([
      'gelose',
      'culture_liquide',
      'ballot_grain',
      'fructification',
      'flush_1',
      'flush_2',
    ]);
  });

  it('rend une liste vide quand tout vient du cultivateur', () => {
    const graph = defaultProcessGraph();
    const allReal = {
      ...graph,
      steps: graph.steps.map((step) => ({ ...step, provenance: 'cultivator' as const })),
    };
    expect(inventedStepIds(allReal)).toEqual([]);
  });
});

describe('DEFAULT_MODEL_DISCLAIMER', () => {
  it('dit que c’est un exemple, pas une recommandation', () => {
    expect(DEFAULT_MODEL_DISCLAIMER).toContain('exemple à ajuster');
    expect(DEFAULT_MODEL_DISCLAIMER).toContain('pas une recommandation');
    expect(DEFAULT_MODEL_DISCLAIMER).toContain('aucune base');
  });
});
