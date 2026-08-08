import type { AppError, CultureUnit, DomainEvent } from '@champi/contracts';
import type { OfflineQueue, SendOutcome } from './offline-queue.js';

/**
 * Client d'API typé.
 *
 * Deux comportements portent des décisions du cadrage :
 *
 * 1. **Aucune authentification** (docs/21 §6) : pas d'en-tête, pas de session,
 *    pas de rafraîchissement de jeton. Le tailnet est la seule frontière.
 * 2. **Bascule vers la file locale** dès qu'une mutation échoue pour cause de
 *    réseau. La saisie n'est jamais perdue, et l'interface le dit franchement
 *    (docs/22 §7.2).
 */

export interface ApiSuccess<T> {
  readonly ok: true;
  readonly data: T;
}

export interface ApiFailure {
  readonly ok: false;
  readonly error: AppError;
  /** `true` quand l'échec vient du réseau, donc rejouable. */
  readonly offline: boolean;
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

/** Saisie acceptée localement, à envoyer plus tard. */
export interface QueuedResult {
  readonly ok: true;
  readonly queued: true;
  readonly pendingCount: number;
}

export type MutationResult<T> = ApiSuccess<T> | QueuedResult | ApiFailure;

export interface ApiClientOptions {
  readonly baseUrl: string;
  readonly fetch: typeof globalThis.fetch;
  readonly queue: OfflineQueue;
  /** Clé d'idempotence — la même au premier envoi et à tous les rejeux. */
  readonly newIdempotencyKey: () => string;
  readonly now: () => string;
}

interface ApiEnvelope<T> {
  data?: T;
  error?: AppError;
}

const NETWORK_ERROR: AppError = {
  code: 'CONFLICT',
  message: "L'application n'a pas pu joindre le serveur.",
  hint: 'La saisie est conservée sur l’appareil et sera envoyée automatiquement dès que le réseau revient.',
};

export class ApiClient {
  constructor(private readonly options: ApiClientOptions) {}

  private url(path: string): string {
    return `${this.options.baseUrl}${path}`;
  }

  /** Lecture. En cas de coupure, on ne met rien en file : lire n'a pas d'effet. */
  async get<T>(path: string): Promise<ApiResult<T>> {
    let response: Response;
    try {
      response = await this.options.fetch(this.url(path));
    } catch {
      return { ok: false, error: NETWORK_ERROR, offline: true };
    }
    return readEnvelope<T>(response);
  }

  /**
   * Mutation.
   *
   * Toujours accompagnée d'une clé d'idempotence : c'est elle qui rend le rejeu
   * sûr, que ce soit le navigateur ou la file locale qui réessaie.
   */
  async post<T>(path: string, body: unknown): Promise<MutationResult<T>> {
    const idempotencyKey = this.options.newIdempotencyKey();

    let response: Response;
    try {
      response = await this.options.fetch(this.url(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(body),
      });
    } catch {
      // Réseau tombé : on met en file plutôt que d'échouer devant l'opérateur.
      this.options.queue.enqueue({
        id: idempotencyKey,
        method: 'POST',
        path,
        body,
        idempotencyKey,
        queuedAt: this.options.now(),
      });
      return { ok: true, queued: true, pendingCount: this.options.queue.pendingCount() };
    }

    return readEnvelope<T>(response);
  }

  /** Vide la file locale. Appelé au retour du réseau et à l'ouverture de l'app. */
  flushQueue(): ReturnType<OfflineQueue['flush']> {
    return this.options.queue.flush();
  }

  // --- Opérations métier ---

  getUnit(reference: string): Promise<ApiResult<CultureUnit>> {
    return this.get<CultureUnit>(`/api/units/${encodeURIComponent(reference)}`);
  }

  getTimeline(reference: string): Promise<ApiResult<DomainEvent[]>> {
    return this.get<DomainEvent[]>(`/api/units/${encodeURIComponent(reference)}/timeline`);
  }

  resolveQr(token: string): Promise<ApiResult<{ qr: unknown; target: CultureUnit | null }>> {
    return this.get(`/api/qr/${encodeURIComponent(token)}`);
  }

  advance(
    reference: string,
    toStepId: string,
    expectedVersion: number,
    confirmOffNominal = false,
  ): Promise<MutationResult<{ unit: CultureUnit; event: DomainEvent }>> {
    return this.post(`/api/units/${encodeURIComponent(reference)}/advance`, {
      toStepId,
      expectedVersion,
      confirmOffNominal,
    });
  }
}

/** Lit l'enveloppe standard `{ data }` / `{ error }`. */
async function readEnvelope<T>(response: Response): Promise<ApiResult<T>> {
  let payload: ApiEnvelope<T>;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: `Réponse illisible du serveur (statut ${String(response.status)}).`,
        hint: "Ce n'est pas un refus métier : signale-le si cela se reproduit.",
      },
      offline: false,
    };
  }

  if (response.ok && payload.data !== undefined) {
    return { ok: true, data: payload.data };
  }

  return {
    ok: false,
    error: payload.error ?? {
      code: 'VALIDATION_FAILED',
      message: `Le serveur a répondu ${String(response.status)} sans détail.`,
    },
    offline: false,
  };
}

/**
 * Émetteur utilisé par la file locale au moment du rejeu.
 *
 * Distingue l'échec **réseau** (à rejouer) de l'échec **métier** (inutile
 * d'insister) : sans cette distinction, une saisie refusée pour une bonne
 * raison tournerait en boucle et masquerait les vraies pannes.
 */
export function createQueueSender(
  baseUrl: string,
  fetchImpl: typeof globalThis.fetch,
): (item: { path: string; body: unknown; idempotencyKey: string }) => Promise<SendOutcome> {
  return async (item) => {
    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${item.path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': item.idempotencyKey,
        },
        body: JSON.stringify(item.body),
      });
    } catch {
      return { ok: false, retryable: true, error: 'Réseau indisponible.' };
    }

    if (response.ok) {
      return { ok: true, retryable: false };
    }
    // 5xx : le serveur a un souci passager, on réessaiera.
    // 4xx : c'est la requête qui ne convient pas, insister ne sert à rien.
    return {
      ok: false,
      retryable: response.status >= 500,
      error: `Le serveur a répondu ${String(response.status)}.`,
    };
  };
}
