import type { ProcessGraph, ProcessStep } from '@champi/contracts';

/**
 * Modèle de process pré-rempli, proposé au premier démarrage.
 *
 * ⚠️ **Ce n'est pas un seed métier.** Le cultivateur a tranché que « le tableau
 * sera de toute façon configurable » : les valeurs se saisissent dans
 * l'application. Mais sans rien, la première utilisation commence par une page
 * blanche — le moment classique d'abandon d'un outil de traçabilité
 * (`docs/20` §1).
 *
 * C'est donc un **point de départ éditable**, et chaque valeur porte sa
 * provenance :
 *
 * - `cultivator` — réponse réelle de l'export du 30/07/2026 ;
 * - `invented` — valeur inventée pour éviter un champ vide, **sans aucune base
 *   agronomique**. L'interface doit les afficher comme des exemples à ajuster,
 *   jamais comme des recommandations.
 *
 * Six étapes, pas treize : les subdivisions incubation 1/2/3 et fructification
 * 1/2 n'existent pas sur le terrain (« pas de différence », `docs/20` §3).
 */

function step(
  step: Omit<ProcessStep, 'conditions' | 'alarms' | 'optional'> & Partial<ProcessStep>,
): ProcessStep {
  return {
    conditions: {},
    alarms: { enabled: false },
    optional: false,
    ...step,
  };
}

/** Les étapes de laboratoire, en amont du substrat. Toutes optionnelles. */
const LAB_STEPS: readonly ProcessStep[] = [
  step({
    id: 'gelose',
    name: 'Gélose',
    stage: 'gelose',
    targetDurationDays: 12,
    optional: true,
    provenance: 'invented',
    conditions: { temperatureC: { min: 22, max: 24 }, light: 'darkness' },
  }),
  step({
    id: 'culture_liquide',
    name: 'Culture liquide',
    stage: 'liquid_culture',
    targetDurationDays: 10,
    optional: true,
    provenance: 'invented',
    conditions: { temperatureC: { min: 22, max: 24 }, light: 'darkness' },
  }),
  step({
    id: 'ballot_grain',
    name: 'Ballot de grain',
    stage: 'grain',
    targetDurationDays: 18,
    optional: true,
    provenance: 'invented',
    conditions: { temperatureC: { min: 24, max: 24 }, light: 'darkness' },
  }),
];

/** Le cycle réel du cultivateur, du substrat à la fin de cycle. */
const PRODUCTION_STEPS: readonly ProcessStep[] = [
  step({
    id: 'inoculation',
    name: 'Inoculation substrat',
    stage: 'substrate',
    provenance: 'cultivator',
    expectedWeightUnit: 'kg',
  }),
  step({
    id: 'incubation',
    name: 'Incubation',
    stage: 'substrate',
    // 2 à 3 semaines, 24 °C, obscurité — valeurs réelles de l'export v8.
    targetDurationDays: 21,
    provenance: 'cultivator',
    conditions: {
      temperatureC: { min: 24, max: 24 },
      light: 'darkness',
      notes: 'Humidité non contrôlée. CO₂ et aération sans importance.',
    },
    alarms: { enabled: true, reminderDaysBefore: 1, criticalOverduePct: 50 },
  }),
  step({
    id: 'fructification',
    name: 'Fructification',
    stage: 'fruiting',
    // Conditions réelles ; durée inventée.
    targetDurationDays: 6,
    provenance: 'invented',
    conditions: {
      temperatureC: { min: 18, max: 24 },
      humidityPct: { min: 90, max: 90 },
      light: 'light',
      notes: 'Déclenchée par ouverture du sac. Primordia à 2-3 jours.',
    },
    alarms: { enabled: true, reminderDaysBefore: 1 },
  }),
  step({
    id: 'flush_1',
    name: 'Flush 1',
    stage: 'fruiting',
    targetDurationDays: 2,
    provenance: 'invented',
    expectedWeightUnit: 'g',
  }),
  step({
    id: 'flush_2',
    name: 'Flush 2',
    stage: 'fruiting',
    targetDurationDays: 2,
    provenance: 'invented',
    expectedWeightUnit: 'g',
  }),
  step({
    id: 'flush_3',
    name: 'Flush 3',
    stage: 'fruiting',
    targetDurationDays: 2,
    // Optionnel mais rentable, d'après le cultivateur.
    optional: true,
    provenance: 'cultivator',
    expectedWeightUnit: 'g',
  }),
  step({
    id: 'fin_de_cycle',
    name: 'Fin de cycle',
    stage: 'fruiting',
    provenance: 'cultivator',
  }),
];

/**
 * Graphe complet du modèle par défaut.
 *
 * Aucun `layout` : la disposition est calculée à l'affichage. Le modèle décrit
 * un process, pas une image.
 */
export function defaultProcessGraph(): ProcessGraph {
  return {
    steps: [...LAB_STEPS, ...PRODUCTION_STEPS],
    transitions: [
      { from: 'gelose', to: 'culture_liquide' },
      { from: 'culture_liquide', to: 'ballot_grain' },
      { from: 'ballot_grain', to: 'inoculation' },
      { from: 'inoculation', to: 'incubation' },
      { from: 'incubation', to: 'fructification' },
      { from: 'fructification', to: 'flush_1' },
      { from: 'flush_1', to: 'flush_2' },
      { from: 'flush_2', to: 'flush_3' },
      { from: 'flush_2', to: 'fin_de_cycle', label: 'sans flush 3' },
      { from: 'flush_3', to: 'fin_de_cycle' },
    ],
  };
}

/** Étapes dont les valeurs sont inventées — à signaler visuellement. */
export function inventedStepIds(graph: ProcessGraph): string[] {
  return graph.steps.filter((s) => s.provenance === 'invented').map((s) => s.id);
}

/**
 * Avertissement à afficher au-dessus du modèle par défaut.
 *
 * Le formuler dans le domaine plutôt que dans l'interface garantit qu'il
 * accompagne le modèle partout où il est proposé — y compris à un agent.
 */
export const DEFAULT_MODEL_DISCLAIMER =
  'Ce process est un exemple à ajuster, pas une recommandation agronomique. ' +
  'Les valeurs marquées « inventée » n’ont aucune base : elles évitent seulement un champ vide.';
