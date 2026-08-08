import type { AppError, ErrorCode } from '@champi/contracts';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/**
 * Traduction des erreurs métier en réponses HTTP.
 *
 * Le corps renvoyé conserve **toujours** le `hint` du domaine. C'est ce qui
 * distingue une erreur exploitable d'un simple constat d'échec : un agent —
 * comme un humain — doit pouvoir se corriger sans consulter la documentation
 * (docs/22 §4.3, propriété 4).
 */

const STATUS_BY_CODE: Record<ErrorCode, ContentfulStatusCode> = {
  VALIDATION_FAILED: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VERSION_PUBLISHED_IMMUTABLE: 409,
  STEP_NOT_IN_PROCESS: 422,
  PROCESS_GRAPH_INVALID: 422,
  UNIT_NOT_ACTIVE: 409,
  QUANTITY_KIND_MISMATCH: 422,
  QUANTITY_UNIT_NOT_CONVERTIBLE: 422,
  SHARES_DO_NOT_SUM_TO_ONE: 422,
  PHOTO_REQUIRED: 422,
  IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_BODY: 409,
};

export function statusForError(code: ErrorCode): ContentfulStatusCode {
  return STATUS_BY_CODE[code];
}

export interface ErrorBody {
  readonly error: AppError & { readonly docsUrl: string };
}

/** Enveloppe une erreur métier, en y ajoutant systématiquement un lien de doc. */
export function errorBody(error: AppError): ErrorBody {
  return {
    error: {
      ...error,
      docsUrl: error.docsUrl ?? `/api/docs#${error.code.toLowerCase().replaceAll('_', '-')}`,
    },
  };
}
