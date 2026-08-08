import { z } from 'zod';

/**
 * Primitives partagées.
 *
 * Tout ce qui est ici est la source de vérité des types : l'OpenAPI, le client
 * typé et la validation d'entrée en dérivent (docs/22 §2.1).
 */

/** Identifiant technique opaque. */
export const idSchema = z.string().min(1);

/**
 * Code lisible par un humain — et par un LLM.
 *
 * Accepté partout où un identifiant technique l'est (docs/22 §4.3, propriété 5) :
 * `SUB-2026-0042` se raisonne mieux que `66b3f1e2a4c9…`.
 */
export const publicCodeSchema = z
  .string()
  .regex(/^[A-Z]{2,4}-\d{4}-\d{4,6}$/, 'Format attendu : PREFIXE-ANNEE-NUMERO, ex. SUB-2026-0042');

/** Horodatage ISO 8601 en UTC. */
export const timestampSchema = z.string().datetime({ offset: true });

/**
 * Stade d'une unité de culture.
 *
 * Une unité peut naître à n'importe lequel de ces stades, sans ascendant
 * (réponse cultivateur, docs/14 §18.1).
 */
export const stageSchema = z.enum(['gelose', 'liquid_culture', 'grain', 'substrate', 'fruiting']);
export type Stage = z.infer<typeof stageSchema>;

/** Ordre nominal des stades. Ne contraint rien : il sert au tri et à l'affichage. */
export const STAGE_ORDER: readonly Stage[] = [
  'gelose',
  'liquid_culture',
  'grain',
  'substrate',
  'fruiting',
];

/**
 * Relation de lignée avec le parent.
 *
 * - `origin`   : unité sans ascendant (départ à n'importe quel stade)
 * - `clone`    : multiplication au *même* stade ; le parent survit
 * - `transfer` : passage au stade suivant (1 amont → N aval)
 * - `split`    : division physique d'une unité
 *
 * Il n'y a **pas** de fusion : la généalogie ne connaît que des divergences
 * (réponse cultivateur `q18_5`).
 */
export const lineageRelationSchema = z.enum(['origin', 'clone', 'transfer', 'split']);
export type LineageRelation = z.infer<typeof lineageRelationSchema>;

/**
 * Nature d'une grandeur physique.
 *
 * Aucune conversion implicite n'existe entre deux `kind` différents : un
 * rendement est un rapport explicite entre deux quantités nommées, jamais une
 * soustraction de champs homonymes (docs/21 §4).
 */
export const quantityKindSchema = z.enum(['substrate', 'harvest', 'product', 'inoculum']);
export type QuantityKind = z.infer<typeof quantityKindSchema>;

/** Unités de saisie acceptées. */
export const quantityUnitSchema = z.enum(['g', 'kg', 'piece', 'tray', 'L', 'mL']);
export type QuantityUnit = z.infer<typeof quantityUnitSchema>;

/**
 * Grandeur physique typée.
 *
 * Remplace les `currentQuantity` / `initialQuantity` nus qui mélangeaient masse
 * de substrat, masse récoltée et pièces de produit fini (docs/21 §4).
 */
export const quantitySchema = z.object({
  value: z.number().finite().nonnegative(),
  unit: quantityUnitSchema,
  kind: quantityKindSchema,
});
export type Quantity = z.infer<typeof quantitySchema>;

/** Gravité d'une observation. Trois niveaux (réponse cultivateur `q12_5`). */
export const severitySchema = z.enum(['low', 'medium', 'critical']);
export type Severity = z.infer<typeof severitySchema>;

/** Statut opérationnel d'une unité. */
export const unitStatusSchema = z.enum([
  'active',
  'contaminated',
  'completed',
  'composted',
  'discarded',
  'archived',
]);
export type UnitStatus = z.infer<typeof unitStatusSchema>;

/** Emplacement physique, suivi jusqu'à la position (réponse cultivateur `q10_2`). */
export const locationSchema = z.object({
  roomId: idSchema,
  shelf: z.string().min(1).optional(),
  level: z.string().min(1).optional(),
  position: z.string().min(1).optional(),
});
export type Location = z.infer<typeof locationSchema>;
