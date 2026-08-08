import { describe, expect, it } from 'vitest';
import type { ProcessGraph } from '@champi/contracts';
import {
  addStep,
  connectSteps,
  disconnectSteps,
  findStepById,
  moveStep,
  outgoingTransitions,
  removeStep,
  renameStep,
  sameProcess,
  slugify,
  uniqueStepId,
  updateStep,
  withoutLayout,
} from './process-editing.js';

function graph(): ProcessGraph {
  return {
    steps: [
      {
        id: 'inoculation',
        name: 'Inoculation',
        stage: 'substrate',
        conditions: {},
        alarms: { enabled: false },
        optional: false,
        provenance: 'cultivator',
      },
      {
        id: 'incubation',
        name: 'Incubation',
        stage: 'substrate',
        conditions: {},
        alarms: { enabled: false },
        optional: false,
        provenance: 'cultivator',
      },
    ],
    transitions: [{ from: 'inoculation', to: 'incubation' }],
  };
}

describe('slugify', () => {
  it('met en minuscules et remplace les espaces', () => {
    expect(slugify('Inoculation substrat')).toBe('inoculation_substrat');
  });

  it('retire les accents — un identifiant se tape au clavier', () => {
    expect(slugify('Gélose mère')).toBe('gelose_mere');
  });

  it('supprime la ponctuation', () => {
    expect(slugify('Flush n°1 !')).toBe('flush_n_1');
  });

  it('ne laisse pas de séparateur en bordure', () => {
    expect(slugify('  Incubation  ')).toBe('incubation');
  });

  /** Un nom entièrement exotique ne doit pas produire un identifiant vide. */
  it('rend un identifiant de repli pour un nom sans caractère utilisable', () => {
    expect(slugify('!!!')).toBe('etape');
    expect(slugify('')).toBe('etape');
  });
});

describe('uniqueStepId', () => {
  it('utilise le slug quand il est libre', () => {
    expect(uniqueStepId(graph(), 'Fructification')).toBe('fructification');
  });

  it('suffixe en cas de collision', () => {
    expect(uniqueStepId(graph(), 'Incubation')).toBe('incubation_2');
  });

  it('continue à suffixer tant que c’est nécessaire', () => {
    const withTwo = addStep(graph(), { name: 'Incubation', stage: 'substrate' });
    expect(uniqueStepId(withTwo, 'Incubation')).toBe('incubation_3');
  });
});

describe('addStep', () => {
  it('ajoute une étape avec des valeurs par défaut sûres', () => {
    const next = addStep(graph(), { name: 'Fructification', stage: 'fruiting' });
    const step = findStepById(next, 'fructification');

    expect(step?.name).toBe('Fructification');
    expect(step?.stage).toBe('fruiting');
    expect(step?.optional).toBe(false);
    expect(step?.alarms).toEqual({ enabled: false });
    // Une étape créée à la main vient du cultivateur, pas d'une invention.
    expect(step?.provenance).toBe('cultivator');
  });

  /** Relier est un geste distinct : une étape naît isolée. */
  it('n’ajoute aucune arête', () => {
    const next = addStep(graph(), { name: 'Fructification', stage: 'fruiting' });
    expect(next.transitions).toEqual(graph().transitions);
  });

  it('ne modifie pas le graphe d’origine', () => {
    const original = graph();
    addStep(original, { name: 'Fructification', stage: 'fruiting' });
    expect(original.steps).toHaveLength(2);
  });
});

describe('updateStep', () => {
  it('applique un correctif partiel', () => {
    const next = updateStep(graph(), 'incubation', { targetDurationDays: 21 });
    expect(findStepById(next, 'incubation')?.targetDurationDays).toBe(21);
    expect(findStepById(next, 'incubation')?.name).toBe('Incubation');
  });

  it('laisse les autres étapes intactes', () => {
    const next = updateStep(graph(), 'incubation', { optional: true });
    expect(findStepById(next, 'inoculation')?.optional).toBe(false);
  });

  it('ignore une étape inconnue', () => {
    expect(updateStep(graph(), 'jamais', { optional: true }).steps).toEqual(graph().steps);
  });

  it('renomme sans changer l’identifiant — les arêtes le citent', () => {
    const next = renameStep(graph(), 'incubation', 'Incubation longue');
    expect(findStepById(next, 'incubation')?.name).toBe('Incubation longue');
    expect(next.transitions).toEqual([{ from: 'inoculation', to: 'incubation' }]);
  });
});

describe('removeStep', () => {
  /**
   * Laisser des arêtes pendantes produirait un graphe impubliable : autant
   * nettoyer tout de suite plutôt qu'exiger un geste de réparation.
   */
  it('supprime l’étape et les arêtes qui la citent', () => {
    const next = removeStep(graph(), 'incubation');
    expect(next.steps.map((s) => s.id)).toEqual(['inoculation']);
    expect(next.transitions).toEqual([]);
  });

  it('supprime aussi les arêtes entrantes et sortantes', () => {
    const three = connectSteps(
      addStep(graph(), { name: 'Fructification', stage: 'fruiting' }),
      'incubation',
      'fructification',
    );
    const next = removeStep(three, 'incubation');
    expect(next.transitions).toEqual([]);
  });

  it('retire la position du layout', () => {
    const positioned = moveStep(graph(), 'incubation', 10, 20);
    const next = removeStep(positioned, 'incubation');
    expect(next.layout).toEqual({});
  });

  it('tolère un graphe sans layout', () => {
    expect(removeStep(graph(), 'incubation').layout).toBeUndefined();
  });

  it('ignore une étape inconnue', () => {
    expect(removeStep(graph(), 'jamais').steps).toHaveLength(2);
  });
});

describe('connectSteps', () => {
  it('ajoute une arête', () => {
    const three = addStep(graph(), { name: 'Fructification', stage: 'fruiting' });
    const next = connectSteps(three, 'incubation', 'fructification');
    expect(next.transitions).toHaveLength(2);
  });

  it('refuse une arête en double', () => {
    expect(connectSteps(graph(), 'inoculation', 'incubation').transitions).toHaveLength(1);
  });

  it('refuse une boucle sur soi-même', () => {
    expect(connectSteps(graph(), 'incubation', 'incubation').transitions).toHaveLength(1);
  });

  it('refuse une arête vers une étape inconnue', () => {
    expect(connectSteps(graph(), 'incubation', 'jamais').transitions).toHaveLength(1);
    expect(connectSteps(graph(), 'jamais', 'incubation').transitions).toHaveLength(1);
  });

  /**
   * Un cycle est autorisé : les étapes sont réversibles et refaisables. Le
   * graphe décrit le chemin nominal, il n'interdit pas.
   */
  it('accepte un cycle — les retours en arrière sont autorisés', () => {
    const next = connectSteps(graph(), 'incubation', 'inoculation');
    expect(next.transitions).toHaveLength(2);
  });
});

describe('disconnectSteps', () => {
  it('retire une arête', () => {
    expect(disconnectSteps(graph(), 'inoculation', 'incubation').transitions).toEqual([]);
  });

  it('ignore une arête inexistante', () => {
    expect(disconnectSteps(graph(), 'incubation', 'inoculation').transitions).toHaveLength(1);
  });
});

describe('moveStep', () => {
  it('enregistre une position', () => {
    expect(moveStep(graph(), 'incubation', 120, 40).layout).toEqual({
      incubation: { x: 120, y: 40 },
    });
  });

  it('conserve les positions déjà enregistrées', () => {
    const next = moveStep(moveStep(graph(), 'inoculation', 0, 0), 'incubation', 220, 0);
    expect(Object.keys(next.layout ?? {})).toEqual(['inoculation', 'incubation']);
  });

  it('écrase la position précédente d’une même étape', () => {
    const next = moveStep(moveStep(graph(), 'incubation', 1, 1), 'incubation', 9, 9);
    expect(next.layout?.['incubation']).toEqual({ x: 9, y: 9 });
  });
});

describe('outgoingTransitions', () => {
  it('donne les arêtes sortantes', () => {
    expect(outgoingTransitions(graph(), 'inoculation')).toEqual([
      { from: 'inoculation', to: 'incubation' },
    ]);
  });

  it('rend une liste vide pour une étape terminale', () => {
    expect(outgoingTransitions(graph(), 'incubation')).toEqual([]);
  });
});

describe('withoutLayout et sameProcess', () => {
  /**
   * Deux process identiques dont seules les positions diffèrent ne sont pas
   * deux process différents : le layout n'est pas du contenu métier.
   */
  it('ignore les positions pour comparer deux process', () => {
    const a = moveStep(graph(), 'incubation', 10, 10);
    const b = moveStep(graph(), 'incubation', 999, 999);
    expect(sameProcess(a, b)).toBe(true);
  });

  it('distingue deux process au contenu différent', () => {
    expect(sameProcess(graph(), addStep(graph(), { name: 'X', stage: 'fruiting' }))).toBe(false);
  });

  it('retire le layout', () => {
    expect(withoutLayout(moveStep(graph(), 'incubation', 1, 1)).layout).toBeUndefined();
  });

  it('tolère un graphe déjà sans layout', () => {
    expect(withoutLayout(graph())).toEqual(graph());
  });
});
