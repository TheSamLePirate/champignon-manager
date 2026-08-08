import { z } from 'zod';

/**
 * Catalogue d'erreurs.
 *
 * Règle (docs/22 §4.3, propriété 4) : une erreur ne se contente jamais de
 * constater l'échec. Elle porte un `hint` qui contient **les valeurs valides**,
 * pour qu'un agent — comme un humain — sache quoi faire ensuite sans deviner.
 */

export const errorCodeSchema = z.enum([
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
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const appErrorSchema = z.object({
  code: errorCodeSchema,
  /** Ce qui s'est passé, en français, sans jargon technique. */
  message: z.string().min(1),
  /** Ce qu'il faut faire — avec les valeurs acceptées quand elles sont énumérables. */
  hint: z.string().optional(),
  /** Champ concerné, en notation pointée. */
  path: z.string().optional(),
  docsUrl: z.string().optional(),
});
export type AppError = z.infer<typeof appErrorSchema>;

/** Construit une erreur du catalogue. */
export function appError(
  code: ErrorCode,
  message: string,
  extra: Omit<AppError, 'code' | 'message'> = {},
): AppError {
  return { code, message, ...extra };
}

/**
 * Formate une liste de valeurs acceptées pour un `hint`.
 *
 * Sert à ce qu'une erreur du type « l'étape "flush_4" n'existe pas » soit
 * toujours suivie de la liste de celles qui existent.
 */
export function listHint(label: string, values: readonly string[]): string {
  return `${label} : ${values.join(', ')}.`;
}
