import { z } from 'zod';
import { idSchema, quantityUnitSchema, stageSchema, timestampSchema } from './primitives.js';

/**
 * Process configurable.
 *
 * Deux principes structurants issus des réponses du cultivateur :
 *
 * 1. **Les transitions sont nominales, pas contraignantes.** Les étapes sont
 *    sautables, refaisables et réversibles. Le graphe décrit le chemin
 *    conseillé ; s'en écarter reste possible, avec confirmation, et l'écart est
 *    enregistré (docs/22 §3.3).
 * 2. **La durée ne déclenche rien.** Le passage se fait à l'observation
 *    visuelle, validée par une personne. La durée cible ne sert qu'aux alarmes
 *    (docs/04 §16).
 */

/** Provenance d'une valeur du modèle par défaut (docs/20 §2). */
export const provenanceSchema = z.enum(['cultivator', 'invented']);
export type Provenance = z.infer<typeof provenanceSchema>;

/** Fourchette de valeurs cibles. */
export const targetRangeSchema = z
  .object({
    min: z.number().finite(),
    max: z.number().finite(),
  })
  .refine((r) => r.min <= r.max, {
    message: 'La borne minimale doit être inférieure ou égale à la borne maximale.',
  });
export type TargetRange = z.infer<typeof targetRangeSchema>;

/** Conditions d'ambiance visées à une étape. Toutes optionnelles : rien n'est obligatoire. */
export const stepConditionsSchema = z.object({
  temperatureC: targetRangeSchema.optional(),
  humidityPct: targetRangeSchema.optional(),
  light: z.enum(['darkness', 'light', 'indifferent']).optional(),
  notes: z.string().optional(),
});
export type StepConditions = z.infer<typeof stepConditionsSchema>;

/**
 * Réglage des alarmes de durée.
 *
 * Une alarme prévient, crée une alerte, marque un retard — elle **ne bloque
 * jamais** et **ne fait jamais avancer** une unité (docs/20 §5).
 */
export const alarmSettingsSchema = z.object({
  enabled: z.boolean(),
  /** Rappel N jours avant l'échéance. */
  reminderDaysBefore: z.number().int().nonnegative().optional(),
  /** Seuil de retard critique, en pourcentage de la durée cible. */
  criticalOverduePct: z.number().int().positive().optional(),
});
export type AlarmSettings = z.infer<typeof alarmSettingsSchema>;

/** Une étape du process. */
export const processStepSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  stage: stageSchema,
  /** Durée cible en jours. Sert aux alarmes, jamais à faire avancer une unité. */
  targetDurationDays: z.number().finite().positive().optional(),
  conditions: stepConditionsSchema.default({}),
  alarms: alarmSettingsSchema.default({ enabled: false }),
  /** Une étape optionnelle peut être sautée sans que ce soit un écart. */
  optional: z.boolean().default(false),
  /** Unité de saisie du poids attendue à cette étape, si pertinent. */
  expectedWeightUnit: quantityUnitSchema.optional(),
  provenance: provenanceSchema.default('cultivator'),
});
export type ProcessStep = z.infer<typeof processStepSchema>;

/** Transition nominale entre deux étapes. N'interdit aucune autre transition. */
export const processTransitionSchema = z.object({
  from: idSchema,
  to: idSchema,
  label: z.string().optional(),
});
export type ProcessTransition = z.infer<typeof processTransitionSchema>;

/**
 * Disposition visuelle de l'éditeur graphique.
 *
 * Stockée **à part** et optionnelle : perdre le layout ne perd jamais le
 * process, et un process créé par API sans layout est auto-disposé à
 * l'affichage (docs/22 §3.1).
 */
export const processLayoutSchema = z.record(
  idSchema,
  z.object({ x: z.number().finite(), y: z.number().finite() }),
);
export type ProcessLayout = z.infer<typeof processLayoutSchema>;

/** Contenu éditable d'une version de process. */
export const processGraphSchema = z.object({
  steps: z.array(processStepSchema),
  transitions: z.array(processTransitionSchema),
  layout: processLayoutSchema.optional(),
});
export type ProcessGraph = z.infer<typeof processGraphSchema>;

/**
 * Version de process.
 *
 * Une version **publiée est immuable** ; toute modification crée une nouvelle
 * version. Une unité y reste épinglée jusqu'à la fin de son cycle : publier
 * n'affecte aucune unité en cours (docs/21 §2).
 */
export const processVersionSchema = z.object({
  id: idSchema,
  templateId: idSchema,
  versionNumber: z.number().int().positive(),
  status: z.enum(['draft', 'published']),
  graph: processGraphSchema,
  publishedAt: timestampSchema.optional(),
});
export type ProcessVersion = z.infer<typeof processVersionSchema>;

/** Modèle de process, indépendant de ses versions. */
export const processTemplateSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  /** `any` = applicable à toute espèce (docs/20 §6). */
  speciesScope: z.union([z.literal('any'), idSchema]),
  currentVersionId: idSchema.optional(),
});
export type ProcessTemplate = z.infer<typeof processTemplateSchema>;
