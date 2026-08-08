import { describe, expect, it } from 'vitest';
import {
  errorCodeSchema,
  eventSourceSchema,
  lineageRelationSchema,
  lossCauseSchema,
  provenanceSchema,
  quantityKindSchema,
  quantityUnitSchema,
  severitySchema,
  stageSchema,
  STAGE_ORDER,
  unitStatusSchema,
} from './index.js';

/**
 * Épinglage des énumérations publiques.
 *
 * Ces listes **sont** le contrat de l'API : elles apparaissent dans l'OpenAPI,
 * dans les outils MCP et dans les `hint` d'erreur qu'un agent lit pour se
 * corriger (docs/22 §4.3). En ajouter une valeur est rétrocompatible ; en
 * retirer ou en renommer une casse tous les appelants.
 *
 * Ces tests échouent donc **volontairement** à chaque modification de liste :
 * ils forcent à décider si le changement est intentionnel, plutôt qu'à le
 * découvrir en production.
 */

describe('énumérations publiques — épinglage de contrat', () => {
  it('stades de culture', () => {
    expect(stageSchema.options).toEqual([
      'gelose',
      'liquid_culture',
      'grain',
      'substrate',
      'fruiting',
    ]);
  });

  it('ordre nominal des stades', () => {
    expect(STAGE_ORDER).toEqual(stageSchema.options);
  });

  it('relations de lignée — pas de fusion, seulement des divergences', () => {
    expect(lineageRelationSchema.options).toEqual(['origin', 'clone', 'transfer', 'split']);
    expect(lineageRelationSchema.options).not.toContain('merge');
  });

  it('natures de quantité', () => {
    expect(quantityKindSchema.options).toEqual(['substrate', 'harvest', 'product', 'inoculum']);
  });

  it('unités de saisie', () => {
    expect(quantityUnitSchema.options).toEqual(['g', 'kg', 'piece', 'tray', 'L', 'mL']);
  });

  it('gravités d’observation — trois niveaux', () => {
    expect(severitySchema.options).toEqual(['low', 'medium', 'critical']);
  });

  it('statuts d’unité', () => {
    expect(unitStatusSchema.options).toEqual([
      'active',
      'contaminated',
      'completed',
      'composted',
      'discarded',
      'archived',
    ]);
  });

  it('causes de perte', () => {
    expect(lossCauseSchema.options).toEqual([
      'contamination',
      'malformation',
      'overripe',
      'damage',
      'other',
    ]);
  });

  it('provenances du modèle par défaut', () => {
    expect(provenanceSchema.options).toEqual(['cultivator', 'invented']);
  });

  it('sources d’événement — aucune n’implique un utilisateur', () => {
    expect(eventSourceSchema.options).toEqual(['manual', 'qr_scan', 'import', 'system']);
  });

  it('codes d’erreur', () => {
    expect(errorCodeSchema.options).toEqual([
      'VALIDATION_FAILED',
      'NOT_FOUND',
      'CONFLICT',
      'VERSION_PUBLISHED_IMMUTABLE',
      'STEP_NOT_IN_PROCESS',
      'PROCESS_GRAPH_INVALID',
      'UNIT_NOT_ACTIVE',
      'QUANTITY_KIND_MISMATCH',
      'QUANTITY_UNIT_NOT_CONVERTIBLE',
      'SHARES_DO_NOT_SUM_TO_ONE',
      'PHOTO_REQUIRED',
      'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_BODY',
    ]);
  });
});

describe('énumérations — rejet des valeurs hors contrat', () => {
  it('refuse un stade inventé', () => {
    expect(stageSchema.safeParse('compost').success).toBe(false);
  });

  it('refuse une fusion de lignée', () => {
    expect(lineageRelationSchema.safeParse('merge').success).toBe(false);
  });

  it('refuse un code d’erreur hors catalogue', () => {
    expect(errorCodeSchema.safeParse('BOOM').success).toBe(false);
  });

  it('refuse une chaîne vide partout', () => {
    for (const schema of [
      stageSchema,
      lineageRelationSchema,
      quantityKindSchema,
      quantityUnitSchema,
      severitySchema,
      unitStatusSchema,
      lossCauseSchema,
      provenanceSchema,
      eventSourceSchema,
      errorCodeSchema,
    ]) {
      expect(schema.safeParse('').success).toBe(false);
    }
  });
});
