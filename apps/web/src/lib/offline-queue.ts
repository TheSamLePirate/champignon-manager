/**
 * File d'attente locale des saisies.
 *
 * Répond à `claude-critics.md` P2-7 : les chambres de fructification ont un
 * Wi-Fi médiocre (humidité, métal, parfois sous-sol), et une application
 * *online-only* échoue **précisément au moment de la saisie** — quand
 * l'opérateur a les mains humides et l'unité devant lui.
 *
 * Ce n'est pas une PWA (hors MVP). C'est le minimum vital : une saisie faite
 * hors réseau est conservée et rejouée automatiquement, **avec sa clé
 * d'idempotence**, ce qui garantit qu'un rejeu ne crée pas de doublon
 * (docs/08 §2.1).
 *
 * Le module est agnostique du stockage et du réseau : les deux sont injectés,
 * donc entièrement testables sans navigateur ni serveur.
 */

export type QueuedStatus = 'pending' | 'sent' | 'failed';

export interface QueuedMutation {
  readonly id: string;
  readonly method: 'POST';
  readonly path: string;
  readonly body: unknown;
  /** Rejouée telle quelle : c'est elle qui rend le rejeu sûr. */
  readonly idempotencyKey: string;
  readonly queuedAt: string;
  readonly attempts: number;
  readonly status: QueuedStatus;
  readonly lastError?: string;
}

/** Stockage persistant minimal — `localStorage` en production, un objet en test. */
export interface QueueStorage {
  read(): QueuedMutation[];
  write(items: readonly QueuedMutation[]): void;
}

export interface SendOutcome {
  readonly ok: boolean;
  /** `true` si l'échec est réseau (donc à rejouer), `false` s'il est métier. */
  readonly retryable: boolean;
  readonly error?: string;
}

export type Sender = (item: QueuedMutation) => Promise<SendOutcome>;

/** Stockage adossé à `localStorage`, tolérant aux données corrompues. */
export class LocalStorageQueueStorage implements QueueStorage {
  constructor(
    private readonly storage: Storage,
    private readonly key = 'champi.queue',
  ) {}

  read(): QueuedMutation[] {
    const raw = this.storage.getItem(this.key);
    if (raw === null) {
      return [];
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      // Un stockage corrompu ne doit pas empêcher l'application de démarrer :
      // mieux vaut repartir d'une file vide que d'un écran blanc en chambre.
      return Array.isArray(parsed) ? (parsed as QueuedMutation[]) : [];
    } catch {
      return [];
    }
  }

  write(items: readonly QueuedMutation[]): void {
    this.storage.setItem(this.key, JSON.stringify(items));
  }
}

/** Au-delà, on cesse de réessayer automatiquement et on le signale. */
export const MAX_QUEUE_ATTEMPTS = 5;

export class OfflineQueue {
  constructor(
    private readonly storage: QueueStorage,
    private readonly send: Sender,
  ) {}

  /** Saisies encore à envoyer. */
  pending(): QueuedMutation[] {
    return this.storage.read().filter((item) => item.status === 'pending');
  }

  /** Saisies abandonnées après trop d'échecs — elles restent visibles. */
  failed(): QueuedMutation[] {
    return this.storage.read().filter((item) => item.status === 'failed');
  }

  /** Nombre de saisies en attente — alimente l'indicateur d'état de l'interface. */
  pendingCount(): number {
    return this.pending().length;
  }

  /**
   * Met une saisie en file.
   *
   * L'appelant fournit la clé d'idempotence : c'est la même qui servira au
   * premier envoi et à tous les rejeux, sinon un doublon serait créé.
   */
  enqueue(item: Omit<QueuedMutation, 'attempts' | 'status'>): QueuedMutation {
    const queued: QueuedMutation = { ...item, attempts: 0, status: 'pending' };
    this.storage.write([...this.storage.read(), queued]);
    return queued;
  }

  /**
   * Tente d'envoyer toutes les saisies en attente, dans l'ordre de saisie.
   *
   * L'ordre compte : deux avancements sur la même unité doivent partir dans
   * l'ordre où l'opérateur les a faits. Un échec réseau **arrête** le vidage —
   * inutile d'insister, et cela préserve l'ordre.
   */
  async flush(): Promise<{ sent: number; remaining: number; stoppedOnNetwork: boolean }> {
    const items = this.storage.read();
    let sent = 0;
    let stoppedOnNetwork = false;

    for (const [index, item] of items.entries()) {
      if (item.status !== 'pending') {
        continue;
      }

      const outcome = await this.send(item);

      if (outcome.ok) {
        items[index] = { ...item, status: 'sent', attempts: item.attempts + 1 };
        sent += 1;
        continue;
      }

      const attempts = item.attempts + 1;
      const base = {
        ...item,
        attempts,
        ...(outcome.error !== undefined ? { lastError: outcome.error } : {}),
      };

      if (!outcome.retryable) {
        // Refus métier : réessayer ne changera rien. On le marque en échec
        // pour que l'opérateur le voie, plutôt que de boucler en silence.
        items[index] = { ...base, status: 'failed' };
        continue;
      }

      items[index] = { ...base, status: attempts >= MAX_QUEUE_ATTEMPTS ? 'failed' : 'pending' };
      stoppedOnNetwork = true;
      break;
    }

    this.storage.write(items);
    return {
      sent,
      remaining: items.filter((item) => item.status === 'pending').length,
      stoppedOnNetwork,
    };
  }

  /** Retire les saisies envoyées. Les échecs restent, volontairement. */
  purgeSent(): number {
    const items = this.storage.read();
    const kept = items.filter((item) => item.status !== 'sent');
    this.storage.write(kept);
    return items.length - kept.length;
  }

  /** Relance une saisie abandonnée, après correction par l'opérateur. */
  retry(id: string): boolean {
    const items = this.storage.read();
    const index = items.findIndex((item) => item.id === id);
    const item = items[index];
    if (item?.status !== 'failed') {
      return false;
    }
    items[index] = { ...item, status: 'pending', attempts: 0 };
    this.storage.write(items);
    return true;
  }
}
