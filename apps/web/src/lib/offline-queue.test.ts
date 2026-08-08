import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LocalStorageQueueStorage,
  MAX_QUEUE_ATTEMPTS,
  OfflineQueue,
  type QueuedMutation,
  type QueueStorage,
  type SendOutcome,
} from './offline-queue.js';

/** Stockage en mémoire — même contrat que `localStorage`, sans navigateur. */
class MemoryStorage implements QueueStorage {
  items: QueuedMutation[] = [];
  read(): QueuedMutation[] {
    return this.items.map((item) => ({ ...item }));
  }
  write(items: readonly QueuedMutation[]): void {
    this.items = items.map((item) => ({ ...item }));
  }
}

const NOW = '2026-08-08T10:00:00.000Z';

function entry(id: string): Omit<QueuedMutation, 'attempts' | 'status'> {
  return {
    id,
    method: 'POST',
    path: `/api/units/SUB-2026-0001/advance`,
    body: { toStepId: 'incubation', expectedVersion: 0 },
    idempotencyKey: id,
    queuedAt: NOW,
  };
}

const ok: SendOutcome = { ok: true, retryable: false };
const networkDown: SendOutcome = { ok: false, retryable: true, error: 'Réseau indisponible.' };
const rejected: SendOutcome = { ok: false, retryable: false, error: 'Le serveur a répondu 409.' };

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
});

describe('mise en file', () => {
  it('conserve une saisie avec sa clé d’idempotence', () => {
    const queue = new OfflineQueue(storage, () => Promise.resolve(ok));
    const queued = queue.enqueue(entry('k-1'));

    expect(queued.status).toBe('pending');
    expect(queued.attempts).toBe(0);
    expect(queued.idempotencyKey).toBe('k-1');
    expect(queue.pendingCount()).toBe(1);
  });

  it('empile plusieurs saisies dans l’ordre', () => {
    const queue = new OfflineQueue(storage, () => Promise.resolve(ok));
    queue.enqueue(entry('k-1'));
    queue.enqueue(entry('k-2'));
    expect(queue.pending().map((i) => i.id)).toEqual(['k-1', 'k-2']);
  });
});

describe('vidage', () => {
  it('envoie tout quand le réseau répond', async () => {
    const queue = new OfflineQueue(storage, () => Promise.resolve(ok));
    queue.enqueue(entry('k-1'));
    queue.enqueue(entry('k-2'));

    const result = await queue.flush();
    expect(result).toEqual({ sent: 2, remaining: 0, stoppedOnNetwork: false });
    expect(queue.pendingCount()).toBe(0);
  });

  /**
   * L'ordre compte : deux avancements sur la même unité doivent partir dans
   * l'ordre où l'opérateur les a faits. On arrête donc au premier échec réseau
   * plutôt que de continuer et de désordonner la suite.
   */
  it('s’arrête au premier échec réseau pour préserver l’ordre', async () => {
    const send = vi
      .fn<(item: QueuedMutation) => Promise<SendOutcome>>()
      .mockResolvedValueOnce(ok)
      .mockResolvedValueOnce(networkDown)
      .mockResolvedValue(ok);

    const queue = new OfflineQueue(storage, send);
    queue.enqueue(entry('k-1'));
    queue.enqueue(entry('k-2'));
    queue.enqueue(entry('k-3'));

    const result = await queue.flush();
    expect(result.sent).toBe(1);
    expect(result.stoppedOnNetwork).toBe(true);
    // La troisième n'a même pas été tentée.
    expect(send).toHaveBeenCalledTimes(2);
    expect(queue.pending().map((i) => i.id)).toEqual(['k-2', 'k-3']);
  });

  it('rejoue la même clé d’idempotence à chaque tentative', async () => {
    const seen: string[] = [];
    const send = (item: QueuedMutation): Promise<SendOutcome> => {
      seen.push(item.idempotencyKey);
      return Promise.resolve(networkDown);
    };

    const queue = new OfflineQueue(storage, send);
    queue.enqueue(entry('k-1'));
    await queue.flush();
    await queue.flush();

    // C'est cette invariance qui garantit qu'un rejeu ne crée pas de doublon.
    expect(seen).toEqual(['k-1', 'k-1']);
  });

  /**
   * Un refus métier ne se rejoue pas : insister ferait tourner la file en
   * boucle et masquerait les vraies pannes réseau.
   */
  it('abandonne immédiatement un refus métier, sans réessayer', async () => {
    const send = vi
      .fn<(item: QueuedMutation) => Promise<SendOutcome>>()
      .mockResolvedValue(rejected);
    const queue = new OfflineQueue(storage, send);
    queue.enqueue(entry('k-1'));
    queue.enqueue(entry('k-2'));

    const result = await queue.flush();
    expect(result.stoppedOnNetwork).toBe(false);
    expect(send).toHaveBeenCalledTimes(2);
    expect(queue.failed().map((i) => i.id)).toEqual(['k-1', 'k-2']);
    expect(queue.failed()[0]?.lastError).toContain('409');
  });

  it('abandonne après le nombre maximal de tentatives réseau', async () => {
    const queue = new OfflineQueue(storage, () => Promise.resolve(networkDown));
    queue.enqueue(entry('k-1'));

    for (let i = 0; i < MAX_QUEUE_ATTEMPTS; i += 1) {
      await queue.flush();
    }

    expect(queue.pendingCount()).toBe(0);
    expect(queue.failed()).toHaveLength(1);
    expect(queue.failed()[0]?.attempts).toBe(MAX_QUEUE_ATTEMPTS);
  });

  it('ignore les saisies déjà envoyées', async () => {
    const send = vi.fn<(item: QueuedMutation) => Promise<SendOutcome>>().mockResolvedValue(ok);
    const queue = new OfflineQueue(storage, send);
    queue.enqueue(entry('k-1'));

    await queue.flush();
    await queue.flush();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('ne fait rien sur une file vide', async () => {
    const queue = new OfflineQueue(storage, () => Promise.resolve(ok));
    expect(await queue.flush()).toEqual({ sent: 0, remaining: 0, stoppedOnNetwork: false });
  });

  it('conserve l’erreur seulement quand il y en a une', async () => {
    const queue = new OfflineQueue(storage, () => Promise.resolve({ ok: false, retryable: false }));
    queue.enqueue(entry('k-1'));
    await queue.flush();
    expect(queue.failed()[0]?.lastError).toBeUndefined();
  });
});

describe('purge et relance', () => {
  it('retire les envoyées et garde les échecs visibles', async () => {
    const send = vi
      .fn<(item: QueuedMutation) => Promise<SendOutcome>>()
      .mockResolvedValueOnce(ok)
      .mockResolvedValue(rejected);

    const queue = new OfflineQueue(storage, send);
    queue.enqueue(entry('k-1'));
    queue.enqueue(entry('k-2'));
    await queue.flush();

    expect(queue.purgeSent()).toBe(1);
    // Une saisie en échec ne disparaît pas : l'opérateur doit la voir.
    expect(queue.failed()).toHaveLength(1);
  });

  it('relance une saisie abandonnée', async () => {
    const queue = new OfflineQueue(storage, () => Promise.resolve(rejected));
    queue.enqueue(entry('k-1'));
    await queue.flush();

    expect(queue.retry('k-1')).toBe(true);
    expect(queue.pendingCount()).toBe(1);
    expect(queue.pending()[0]?.attempts).toBe(0);
  });

  it('refuse de relancer une saisie inconnue', () => {
    const queue = new OfflineQueue(storage, () => Promise.resolve(ok));
    expect(queue.retry('jamais-vue')).toBe(false);
  });

  it('refuse de relancer une saisie encore en attente', () => {
    const queue = new OfflineQueue(storage, () => Promise.resolve(ok));
    queue.enqueue(entry('k-1'));
    expect(queue.retry('k-1')).toBe(false);
  });
});

describe('LocalStorageQueueStorage', () => {
  function fakeStorage(): Storage {
    const map = new Map<string, string>();
    return {
      getItem: (key) => map.get(key) ?? null,
      setItem: (key, value) => void map.set(key, value),
      removeItem: (key) => void map.delete(key),
      clear: () => {
        map.clear();
      },
      key: () => null,
      length: 0,
    };
  }

  it('rend une file vide au premier démarrage', () => {
    expect(new LocalStorageQueueStorage(fakeStorage()).read()).toEqual([]);
  });

  it('fait l’aller-retour', () => {
    const store = new LocalStorageQueueStorage(fakeStorage());
    const items: QueuedMutation[] = [{ ...entry('k-1'), attempts: 0, status: 'pending' }];
    store.write(items);
    expect(store.read()).toEqual(items);
  });

  /**
   * Un stockage corrompu ne doit pas empêcher l'application de démarrer :
   * mieux vaut repartir d'une file vide qu'afficher un écran blanc en chambre.
   */
  it('repart d’une file vide si le stockage est corrompu', () => {
    const raw = fakeStorage();
    raw.setItem('champi.queue', '{ceci n’est pas du JSON');
    expect(new LocalStorageQueueStorage(raw).read()).toEqual([]);
  });

  it('repart d’une file vide si le stockage contient autre chose qu’une liste', () => {
    const raw = fakeStorage();
    raw.setItem('champi.queue', '{"pas":"une liste"}');
    expect(new LocalStorageQueueStorage(raw).read()).toEqual([]);
  });

  it('respecte une clé personnalisée', () => {
    const raw = fakeStorage();
    new LocalStorageQueueStorage(raw, 'autre.cle').write([]);
    expect(raw.getItem('autre.cle')).toBe('[]');
    expect(raw.getItem('champi.queue')).toBeNull();
  });
});
