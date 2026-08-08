import { appError } from '@champi/contracts';
import type { Collection, Db } from 'mongodb';

/**
 * Idempotence des actions.
 *
 * Scénario visé (`claude-critics.md` P2-4, le plus probable de l'application) :
 * Wi-Fi de chambre instable, la requête part, la réponse se perd, le client
 * réessaie. Sans clé d'idempotence, l'unité avance deux fois.
 *
 * Le rejeu d'une même clé renvoie **la réponse d'origine**, sans réexécuter
 * l'action ni créer d'événement. C'est ce qui rend un agent LLM sûr : il peut
 * réessayer sans réfléchir aux effets de bord (docs/22 §4.3, propriété 3).
 */

interface IdempotencyRecord {
  _id: string;
  /** Empreinte du corps, pour détecter une clé réutilisée sur une requête différente. */
  requestFingerprint: string;
  status: number;
  body: unknown;
  createdAt: Date;
}

/** Rétention : au moins la durée d'une session terrain (docs/08 §2.1). */
const RETENTION_SECONDS = 86_400;

export type IdempotencyLookup =
  | { readonly kind: 'miss' }
  | { readonly kind: 'replay'; readonly status: number; readonly body: unknown }
  | { readonly kind: 'conflict'; readonly body: ReturnType<typeof conflictBody> };

function conflictBody(key: string): { error: ReturnType<typeof appError> } {
  return {
    error: appError(
      'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_BODY',
      `La clé d'idempotence « ${key} » a déjà servi pour une requête au contenu différent.`,
      {
        hint: "Utilise une clé différente pour une action différente. Une même clé ne doit servir qu'à rejouer exactement la même requête.",
        path: 'Idempotency-Key',
      },
    ),
  };
}

/** Empreinte stable d'un corps de requête, insensible à l'ordre des clés. */
export function fingerprint(body: unknown): string {
  return JSON.stringify(sortDeep(body));
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortDeep);
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return Object.fromEntries(entries.map(([k, v]) => [k, sortDeep(v)]));
  }
  return value;
}

export class IdempotencyStore {
  private readonly records: Collection<IdempotencyRecord>;

  constructor(db: Db) {
    this.records = db.collection<IdempotencyRecord>('idempotencyKeys');
  }

  async ensureIndexes(): Promise<void> {
    await this.records.createIndex({ createdAt: 1 }, { expireAfterSeconds: RETENTION_SECONDS });
  }

  /** Cherche une réponse déjà produite pour cette clé. */
  async lookup(key: string, body: unknown): Promise<IdempotencyLookup> {
    const existing = await this.records.findOne({ _id: key });
    if (existing === null) {
      return { kind: 'miss' };
    }
    if (existing.requestFingerprint !== fingerprint(body)) {
      return { kind: 'conflict', body: conflictBody(key) };
    }
    return { kind: 'replay', status: existing.status, body: existing.body };
  }

  /** Mémorise la réponse produite pour cette clé. */
  async remember(key: string, body: unknown, status: number, response: unknown): Promise<void> {
    await this.records.insertOne({
      _id: key,
      requestFingerprint: fingerprint(body),
      status,
      body: response,
      createdAt: new Date(),
    });
  }
}
