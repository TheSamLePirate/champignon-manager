import { describe, expect, it } from 'vitest';
import {
  alarmSettingsSchema,
  cultureUnitSchema,
  harvestSchema,
  processGraphSchema,
  processLayoutSchema,
  processStepSchema,
  processTemplateSchema,
  processTransitionSchema,
  processVersionSchema,
  productOriginSchema,
  stepConditionsSchema,
} from './index.js';

/**
 * Tests de bornes des schémas.
 *
 * Un schéma n'est utile que par ce qu'il **refuse**. Ces tests fixent chaque
 * borne — chaîne vide, zéro, valeur négative, non-entier — pour qu'un
 * relâchement de contrainte casse la suite plutôt que de laisser entrer une
 * donnée inexploitable dans le journal de traçabilité.
 */

describe('processStepSchema — bornes', () => {
  const valid = { id: 'incubation', name: 'Incubation', stage: 'substrate' };

  it('refuse un identifiant vide', () => {
    expect(processStepSchema.safeParse({ ...valid, id: '' }).success).toBe(false);
  });

  it('refuse un nom vide', () => {
    expect(processStepSchema.safeParse({ ...valid, name: '' }).success).toBe(false);
  });

  it('refuse une durée négative', () => {
    expect(processStepSchema.safeParse({ ...valid, targetDurationDays: -1 }).success).toBe(false);
  });

  it('accepte une durée fractionnaire — une étape peut durer une demi-journée', () => {
    expect(processStepSchema.safeParse({ ...valid, targetDurationDays: 0.5 }).success).toBe(true);
  });

  it('refuse une durée infinie', () => {
    expect(
      processStepSchema.safeParse({ ...valid, targetDurationDays: Number.POSITIVE_INFINITY })
        .success,
    ).toBe(false);
  });

  it('accepte une unité de pesée attendue', () => {
    const step = processStepSchema.parse({ ...valid, expectedWeightUnit: 'g' });
    expect(step.expectedWeightUnit).toBe('g');
  });

  it('refuse une provenance hors catalogue', () => {
    expect(processStepSchema.safeParse({ ...valid, provenance: 'devine' }).success).toBe(false);
  });
});

describe('stepConditionsSchema — bornes', () => {
  it('accepte des conditions vides — rien n’est obligatoire', () => {
    expect(stepConditionsSchema.parse({})).toEqual({});
  });

  it('accepte les trois régimes de lumière', () => {
    for (const light of ['darkness', 'light', 'indifferent']) {
      expect(stepConditionsSchema.safeParse({ light }).success).toBe(true);
    }
  });

  it('refuse un régime de lumière inconnu', () => {
    expect(stepConditionsSchema.safeParse({ light: 'penombre' }).success).toBe(false);
  });

  it('refuse une fourchette de température inversée', () => {
    expect(stepConditionsSchema.safeParse({ temperatureC: { min: 30, max: 10 } }).success).toBe(
      false,
    );
  });

  it('accepte l’humidité réelle de fructification', () => {
    const parsed = stepConditionsSchema.parse({ humidityPct: { min: 90, max: 90 } });
    expect(parsed.humidityPct).toEqual({ min: 90, max: 90 });
  });
});

describe('alarmSettingsSchema — bornes', () => {
  it('accepte une alarme désactivée sans autre réglage', () => {
    expect(alarmSettingsSchema.parse({ enabled: false })).toEqual({ enabled: false });
  });

  it('accepte un rappel à J-0', () => {
    expect(alarmSettingsSchema.safeParse({ enabled: true, reminderDaysBefore: 0 }).success).toBe(
      true,
    );
  });

  it('refuse un rappel négatif', () => {
    expect(alarmSettingsSchema.safeParse({ enabled: true, reminderDaysBefore: -1 }).success).toBe(
      false,
    );
  });

  it('refuse un rappel fractionnaire', () => {
    expect(alarmSettingsSchema.safeParse({ enabled: true, reminderDaysBefore: 1.5 }).success).toBe(
      false,
    );
  });

  it('refuse un seuil critique nul', () => {
    expect(alarmSettingsSchema.safeParse({ enabled: true, criticalOverduePct: 0 }).success).toBe(
      false,
    );
  });

  it('exige le drapeau d’activation', () => {
    expect(alarmSettingsSchema.safeParse({ reminderDaysBefore: 1 }).success).toBe(false);
  });
});

describe('processTransitionSchema et layout', () => {
  it('refuse une transition sans source', () => {
    expect(processTransitionSchema.safeParse({ to: 'b' }).success).toBe(false);
  });

  it('refuse une transition sans cible', () => {
    expect(processTransitionSchema.safeParse({ from: 'a' }).success).toBe(false);
  });

  it('accepte un libellé d’arête', () => {
    expect(processTransitionSchema.parse({ from: 'a', to: 'b', label: 'si colonisé' }).label).toBe(
      'si colonisé',
    );
  });

  it('accepte une disposition de canvas', () => {
    expect(processLayoutSchema.parse({ a: { x: 10, y: 20 } })).toEqual({ a: { x: 10, y: 20 } });
  });

  it('refuse une coordonnée non finie', () => {
    expect(processLayoutSchema.safeParse({ a: { x: Number.NaN, y: 0 } }).success).toBe(false);
  });

  it('accepte un graphe sans layout — le layout est optionnel et jetable', () => {
    const graph = processGraphSchema.parse({ steps: [], transitions: [] });
    expect(graph.layout).toBeUndefined();
  });
});

describe('processVersionSchema et processTemplateSchema', () => {
  const graph = { steps: [], transitions: [] };
  const valid = {
    id: 'pv-1',
    templateId: 'pt-1',
    versionNumber: 1,
    status: 'draft',
    graph,
  };

  it('refuse un numéro de version nul', () => {
    expect(processVersionSchema.safeParse({ ...valid, versionNumber: 0 }).success).toBe(false);
  });

  it('refuse un numéro de version fractionnaire', () => {
    expect(processVersionSchema.safeParse({ ...valid, versionNumber: 1.5 }).success).toBe(false);
  });

  it('refuse un statut hors des deux états', () => {
    expect(processVersionSchema.safeParse({ ...valid, status: 'archived' }).success).toBe(false);
  });

  it('accepte une portée « toute espèce »', () => {
    const template = processTemplateSchema.parse({
      id: 'pt-1',
      name: 'Process standard',
      speciesScope: 'any',
    });
    expect(template.speciesScope).toBe('any');
  });

  it('accepte une portée limitée à une espèce', () => {
    const template = processTemplateSchema.parse({
      id: 'pt-1',
      name: 'Pleurote',
      speciesScope: 'sp-1',
    });
    expect(template.speciesScope).toBe('sp-1');
  });

  it('refuse un modèle sans nom', () => {
    expect(
      processTemplateSchema.safeParse({ id: 'pt-1', name: '', speciesScope: 'any' }).success,
    ).toBe(false);
  });
});

describe('harvestSchema — bornes', () => {
  const valid = {
    id: 'h-1',
    publicCode: 'REC-2026-0001',
    unitId: 'u-1',
    flushNumber: 1,
    weight: { value: 800, unit: 'g', kind: 'harvest' },
    quality: 'A',
    harvestedAt: '2026-08-25T07:00:00.000Z',
  };

  it('applique une liste de pertes vide par défaut', () => {
    expect(harvestSchema.parse(valid).losses).toEqual([]);
  });

  it('accepte les trois qualités', () => {
    for (const quality of ['A', 'B', 'C']) {
      expect(harvestSchema.safeParse({ ...valid, quality }).success).toBe(true);
    }
  });

  it('refuse une qualité hors barème', () => {
    expect(harvestSchema.safeParse({ ...valid, quality: 'D' }).success).toBe(false);
  });

  it('refuse un flush nul', () => {
    expect(harvestSchema.safeParse({ ...valid, flushNumber: 0 }).success).toBe(false);
  });

  it('accepte une récolte nulle — un flush peut ne rien donner', () => {
    const result = harvestSchema.safeParse({
      ...valid,
      weight: { value: 0, unit: 'g', kind: 'harvest' },
    });
    expect(result.success).toBe(true);
  });

  it('refuse une perte sans cause', () => {
    const result = harvestSchema.safeParse({
      ...valid,
      losses: [{ weight: { value: 10, unit: 'g', kind: 'harvest' } }],
    });
    expect(result.success).toBe(false);
  });
});

describe('productOriginSchema — bornes', () => {
  const valid = {
    harvestId: 'h-1',
    unitId: 'u-1',
    weight: { value: 100, unit: 'g', kind: 'harvest' },
    share: 0.5,
  };

  it('accepte une part entière', () => {
    expect(productOriginSchema.safeParse({ ...valid, share: 1 }).success).toBe(true);
  });

  it('refuse une part nulle — une origine à 0 % n’est pas une origine', () => {
    expect(productOriginSchema.safeParse({ ...valid, share: 0 }).success).toBe(false);
  });

  it('refuse une part supérieure à 1', () => {
    expect(productOriginSchema.safeParse({ ...valid, share: 1.0001 }).success).toBe(false);
  });

  it('refuse une part négative', () => {
    expect(productOriginSchema.safeParse({ ...valid, share: -0.5 }).success).toBe(false);
  });
});

describe('cultureUnitSchema — bornes de lignée et d’emplacement', () => {
  const valid = {
    id: 'u-1',
    publicCode: 'SUB-2026-0001',
    name: 'Bloc 1',
    stage: 'substrate',
    status: 'active',
    parentUnitId: null,
    lineageRelation: 'origin',
    generation: 0,
    processVersionId: 'pv-1',
    currentStepId: 'inoculation',
    currentStepEnteredAt: '2026-08-01T08:00:00.000Z',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z',
    version: 0,
  };

  it('refuse un nom vide', () => {
    expect(cultureUnitSchema.safeParse({ ...valid, name: '' }).success).toBe(false);
  });

  it('accepte une génération élevée — aucune limite de clonage n’est imposée', () => {
    expect(cultureUnitSchema.safeParse({ ...valid, generation: 500 }).success).toBe(true);
  });

  it('refuse une génération fractionnaire', () => {
    expect(cultureUnitSchema.safeParse({ ...valid, generation: 1.5 }).success).toBe(false);
  });

  it('refuse un verrou optimiste négatif', () => {
    expect(cultureUnitSchema.safeParse({ ...valid, version: -1 }).success).toBe(false);
  });

  it('accepte un emplacement réduit à la chambre', () => {
    const parsed = cultureUnitSchema.parse({ ...valid, location: { roomId: 'r-1' } });
    expect(parsed.location).toEqual({ roomId: 'r-1' });
  });

  it('refuse un emplacement dont l’étagère est une chaîne vide', () => {
    expect(
      cultureUnitSchema.safeParse({ ...valid, location: { roomId: 'r-1', shelf: '' } }).success,
    ).toBe(false);
  });

  it('refuse un code public au mauvais format', () => {
    expect(cultureUnitSchema.safeParse({ ...valid, publicCode: 'BLOC1' }).success).toBe(false);
  });
});
