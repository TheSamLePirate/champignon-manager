import { z } from 'zod';
import {
  idSchema,
  locationSchema,
  quantitySchema,
  severitySchema,
  stageSchema,
  timestampSchema,
  unitStatusSchema,
} from './primitives.js';

/**
 * Journal d'événements — le cœur de la traçabilité.
 *
 * Le journal est **immuable** : rien ne s'y efface. Corriger ou annuler produit
 * un événement de compensation (docs/21 §6).
 *
 * Il ne porte **aucun auteur** : il n'y a pas d'utilisateurs dans le système.
 * `recordedBy` existe en champ réservé, jamais peuplé ni exposé, pour qu'une
 * réintroduction d'identité soit une migration et non une refonte.
 */

export const eventSourceSchema = z.enum(['manual', 'qr_scan', 'import', 'system']);
export type EventSource = z.infer<typeof eventSourceSchema>;

const baseEventFields = {
  id: idSchema,
  occurredAt: timestampSchema,
  recordedAt: timestampSchema,
  source: eventSourceSchema,
  /** Relie les événements produits par une même action de masse. */
  correlationId: idSchema.optional(),
  /** ⚠️ Réservé, jamais peuplé au MVP (docs/21 §6). */
  recordedBy: z.undefined().optional(),
};

export const unitCreatedEventSchema = z.object({
  ...baseEventFields,
  type: z.literal('unit.created'),
  unitId: idSchema,
  payload: z.object({
    stage: stageSchema,
    processVersionId: idSchema,
    stepId: idSchema,
    parentUnitId: idSchema.nullable(),
    substrateWeight: quantitySchema.optional(),
  }),
});

export const unitStepAdvancedEventSchema = z.object({
  ...baseEventFields,
  type: z.literal('unit.step_advanced'),
  unitId: idSchema,
  payload: z.object({
    fromStepId: idSchema,
    toStepId: idSchema,
    /**
     * `false` quand la transition ne suit pas une arête du graphe nominal.
     * Les étapes sont sautables et réversibles : l'écart est enregistré, pas
     * interdit (docs/22 §3.3).
     */
    followedNominalPath: z.boolean(),
  }),
});

export const unitMovedEventSchema = z.object({
  ...baseEventFields,
  type: z.literal('unit.moved'),
  unitId: idSchema,
  payload: z.object({
    from: locationSchema.optional(),
    to: locationSchema,
  }),
});

export const unitObservedEventSchema = z.object({
  ...baseEventFields,
  type: z.literal('unit.observed'),
  unitId: idSchema,
  payload: z.object({
    kind: z.string().min(1),
    severity: severitySchema,
    note: z.string().optional(),
    /** Obligatoire en cas de contamination (réponse cultivateur `q12_4`). */
    photoId: idSchema.optional(),
  }),
});

export const unitMeasuredEventSchema = z.object({
  ...baseEventFields,
  type: z.literal('unit.measured'),
  unitId: idSchema,
  payload: z.object({
    metric: z.enum(['temperature_c', 'humidity_pct', 'weight']),
    numericValue: z.number().finite().optional(),
    quantity: quantitySchema.optional(),
  }),
});

export const unitStatusChangedEventSchema = z.object({
  ...baseEventFields,
  type: z.literal('unit.status_changed'),
  unitId: idSchema,
  payload: z.object({
    from: unitStatusSchema,
    to: unitStatusSchema,
    reason: z.string().optional(),
  }),
});

export const harvestRecordedEventSchema = z.object({
  ...baseEventFields,
  type: z.literal('harvest.recorded'),
  unitId: idSchema,
  payload: z.object({
    harvestId: idSchema,
    flushNumber: z.number().int().positive(),
    weight: quantitySchema,
  }),
});

export const productCreatedEventSchema = z.object({
  ...baseEventFields,
  type: z.literal('product.created'),
  unitId: idSchema.optional(),
  payload: z.object({
    productId: idSchema,
    harvestIds: z.array(idSchema).min(1),
  }),
});

/** Compensation : annule ou corrige un événement antérieur. Jamais de suppression. */
export const eventCompensatedEventSchema = z.object({
  ...baseEventFields,
  type: z.literal('event.compensated'),
  unitId: idSchema.optional(),
  payload: z.object({
    compensatesEventId: idSchema,
    reason: z.string().min(1),
  }),
});

export const domainEventSchema = z.discriminatedUnion('type', [
  unitCreatedEventSchema,
  unitStepAdvancedEventSchema,
  unitMovedEventSchema,
  unitObservedEventSchema,
  unitMeasuredEventSchema,
  unitStatusChangedEventSchema,
  harvestRecordedEventSchema,
  productCreatedEventSchema,
  eventCompensatedEventSchema,
]);
export type DomainEvent = z.infer<typeof domainEventSchema>;
export type DomainEventType = DomainEvent['type'];
