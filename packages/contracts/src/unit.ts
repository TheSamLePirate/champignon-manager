import { z } from 'zod';
import {
  idSchema,
  lineageRelationSchema,
  locationSchema,
  publicCodeSchema,
  quantitySchema,
  stageSchema,
  timestampSchema,
  unitStatusSchema,
} from './primitives.js';

/**
 * Unité de culture — tout objet physique traçable, à n'importe quel stade.
 * « Lot » est le nom usuel de l'unité aux stades substrat et fructification.
 */
export const cultureUnitSchema = z.object({
  id: idSchema,
  publicCode: publicCodeSchema,
  name: z.string().min(1),
  stage: stageSchema,
  status: unitStatusSchema,

  /** Espèce, configurable. Aucune espèce n'est codée en dur. */
  speciesId: idSchema.optional(),
  /** Source d'origine, quand il y en a une. Source et unité sont deux objets distincts (docs/21 §5). */
  sourceId: idSchema.optional(),

  /**
   * Lignée. `parentUnitId` est **nullable** : une unité peut naître à
   * n'importe quel stade, sans ascendant (docs/14 §18.1).
   */
  parentUnitId: idSchema.nullable(),
  lineageRelation: lineageRelationSchema,
  /** Rang de clonage. Aucune limite de génération n'est imposée. */
  generation: z.number().int().nonnegative(),

  /**
   * Version de process **épinglée**. Publier une nouvelle version ne la change
   * pas : l'unité y reste jusqu'à la fin de son cycle (docs/21 §2). C'est ce
   * champ qui rend la comparaison entre versions possible.
   */
  processVersionId: idSchema,
  currentStepId: idSchema,
  currentStepEnteredAt: timestampSchema,

  /** Poids substrat total — dénominateur du rendement (docs/21 §4). */
  substrateWeight: quantitySchema.optional(),
  location: locationSchema.optional(),

  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  /** Verrou optimiste (docs/08 §2.1). */
  version: z.number().int().nonnegative(),
});
export type CultureUnit = z.infer<typeof cultureUnitSchema>;

/** Cause d'une perte à la récolte. */
export const lossCauseSchema = z.enum([
  'contamination',
  'malformation',
  'overripe',
  'damage',
  'other',
]);
export type LossCause = z.infer<typeof lossCauseSchema>;

/** Récolte d'un flush, enregistrée **par unité** (réponse cultivateur `q14_1`). */
export const harvestSchema = z.object({
  id: idSchema,
  publicCode: publicCodeSchema,
  unitId: idSchema,
  flushNumber: z.number().int().positive(),
  /** Poids récolté. En grammes chez le cultivateur. */
  weight: quantitySchema,
  quality: z.enum(['A', 'B', 'C']),
  losses: z.array(z.object({ weight: quantitySchema, cause: lossCauseSchema })).default([]),
  harvestedAt: timestampSchema,
});
export type Harvest = z.infer<typeof harvestSchema>;

/**
 * Origine pondérée d'un produit final.
 *
 * Les mélanges sont autorisés **en conservant les proportions exactes**
 * (réponse cultivateur `q14_5`) : le lien produit → récoltes est pondéré, pas
 * un simple ensemble.
 */
export const productOriginSchema = z.object({
  harvestId: idSchema,
  unitId: idSchema,
  weight: quantitySchema,
  /** Part dans le produit, en fraction de 1. La somme doit valoir exactement 1. */
  share: z.number().finite().positive().max(1),
});
export type ProductOrigin = z.infer<typeof productOriginSchema>;

/** Lot de produit final. */
export const productBatchSchema = z.object({
  id: idSchema,
  publicCode: publicCodeSchema,
  name: z.string().min(1),
  origins: z.array(productOriginSchema).min(1),
  quantity: quantitySchema,
  producedAt: timestampSchema,
});
export type ProductBatch = z.infer<typeof productBatchSchema>;
