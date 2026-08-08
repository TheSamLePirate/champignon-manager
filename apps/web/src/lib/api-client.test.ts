import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClient, createQueueSender } from './api-client.js';
import { OfflineQueue, type QueuedMutation, type QueueStorage } from './offline-queue.js';

class MemoryStorage implements QueueStorage {
  items: QueuedMutation[] = [];
  read(): QueuedMutation[] {
    return this.items.map((i) => ({ ...i }));
  }
  write(items: readonly QueuedMutation[]): void {
    this.items = items.map((i) => ({ ...i }));
  }
}

const NOW = '2026-08-08T10:00:00.000Z';
const BASE = 'https://champignon.tailnet.ts.net';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Mock de `fetch` correctement typé : `mock.calls` porte alors ses arguments. */
function mockFetch(
  impl: (input: string | URL | Request, init?: RequestInit) => Promise<Response>,
): ReturnType<typeof vi.fn<typeof globalThis.fetch>> {
  return vi.fn<typeof globalThis.fetch>(impl);
}

/** Lit l'init du premier appel — il existe dès qu'une requête a été émise. */
function firstInit(fetchImpl: ReturnType<typeof mockFetch>): RequestInit {
  const init = fetchImpl.mock.calls[0]?.[1];
  if (init === undefined) {
    throw new Error('aucune requête émise');
  }
  return init;
}

let storage: MemoryStorage;
let queue: OfflineQueue;
let keyCounter: number;

function makeClient(fetchImpl: typeof globalThis.fetch): ApiClient {
  return new ApiClient({
    baseUrl: BASE,
    fetch: fetchImpl,
    queue,
    newIdempotencyKey: () => `key-${String(++keyCounter)}`,
    now: () => NOW,
  });
}

beforeEach(() => {
  storage = new MemoryStorage();
  queue = new OfflineQueue(storage, () => Promise.resolve({ ok: true, retryable: false }));
  keyCounter = 0;
});

describe('lecture', () => {
  it('rend les données de l’enveloppe', async () => {
    const client = makeClient(() => Promise.resolve(jsonResponse({ data: { id: 'u-1' } })));
    const result = await client.getUnit('SUB-2026-0001');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({ id: 'u-1' });
  });

  it('encode la référence dans l’URL', async () => {
    const fetchImpl = mockFetch(() => Promise.resolve(jsonResponse({ data: [] })));
    await makeClient(fetchImpl).getTimeline('SUB/2026');
    expect(fetchImpl).toHaveBeenCalledWith(`${BASE}/api/units/SUB%2F2026/timeline`);
  });

  it('résout un token scanné', async () => {
    const fetchImpl = mockFetch(() => Promise.resolve(jsonResponse({ data: { target: null } })));
    await makeClient(fetchImpl).resolveQr('ABC');
    expect(fetchImpl).toHaveBeenCalledWith(`${BASE}/api/qr/ABC`);
  });

  it('remonte une erreur métier telle quelle, avec son indice', async () => {
    const error = { code: 'NOT_FOUND', message: 'introuvable', hint: 'vérifie le code' };
    const client = makeClient(() => Promise.resolve(jsonResponse({ error }, 404)));
    const result = await client.getUnit('SUB-2026-9999');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual(error);
    expect(result.offline).toBe(false);
  });

  /** Une lecture n'a pas d'effet : rien à mettre en file, on le dit simplement. */
  it('signale une coupure réseau sans rien mettre en file', async () => {
    const client = makeClient(() => Promise.reject(new Error('offline')));
    const result = await client.getUnit('SUB-2026-0001');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.offline).toBe(true);
    expect(result.error.hint).toContain('automatiquement dès que le réseau revient');
    expect(queue.pendingCount()).toBe(0);
  });

  it('gère une réponse illisible sans prétendre à un refus métier', async () => {
    const client = makeClient(() =>
      Promise.resolve(new Response('<html>502</html>', { status: 502 })),
    );
    const result = await client.getUnit('SUB-2026-0001');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('502');
    expect(result.error.hint).toContain('pas un refus métier');
  });

  it('gère une réponse d’erreur sans corps d’erreur', async () => {
    const client = makeClient(() => Promise.resolve(jsonResponse({}, 500)));
    const result = await client.getUnit('SUB-2026-0001');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('500');
  });

  it('traite un 200 sans données comme un échec plutôt que comme un succès vide', async () => {
    const client = makeClient(() => Promise.resolve(jsonResponse({}, 200)));
    const result = await client.getUnit('SUB-2026-0001');
    expect(result.ok).toBe(false);
  });
});

describe('mutation', () => {
  it('envoie une clé d’idempotence sur chaque mutation', async () => {
    const fetchImpl = mockFetch(() => Promise.resolve(jsonResponse({ data: { unit: {} } })));
    await makeClient(fetchImpl).advance('SUB-2026-0001', 'incubation', 0);

    const init = firstInit(fetchImpl);
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('key-1');
    expect(JSON.parse(init.body as string)).toEqual({
      toStepId: 'incubation',
      expectedVersion: 0,
      confirmOffNominal: false,
    });
  });

  it('transmet la confirmation d’écart au chemin nominal', async () => {
    const fetchImpl = mockFetch(() => Promise.resolve(jsonResponse({ data: {} })));
    await makeClient(fetchImpl).advance('SUB-2026-0001', 'flush_1', 0, true);
    const init = firstInit(fetchImpl);
    const body = JSON.parse(init.body as string) as { confirmOffNominal: boolean };
    expect(body.confirmOffNominal).toBe(true);
  });

  /**
   * Le scénario que la file existe pour couvrir : l'opérateur est en chambre,
   * le Wi-Fi lâche au moment où il valide. La saisie ne doit pas être perdue,
   * et l'interface doit le dire franchement.
   */
  it('met la saisie en file quand le réseau lâche, plutôt que d’échouer', async () => {
    const client = makeClient(() => Promise.reject(new Error('offline')));
    const result = await client.advance('SUB-2026-0001', 'incubation', 0);

    expect(result.ok).toBe(true);
    if (!('queued' in result)) {
      throw new Error('la saisie aurait dû être mise en file');
    }
    expect(result.queued).toBe(true);
    expect(result.pendingCount).toBe(1);
    expect(queue.pending()[0]?.idempotencyKey).toBe('key-1');
    expect(queue.pending()[0]?.queuedAt).toBe(NOW);
  });

  it('remonte un refus métier sans le mettre en file', async () => {
    const error = { code: 'CONFLICT', message: 'version périmée' };
    const client = makeClient(() => Promise.resolve(jsonResponse({ error }, 409)));
    const result = await client.advance('SUB-2026-0001', 'incubation', 0);

    expect(result.ok).toBe(false);
    expect(queue.pendingCount()).toBe(0);
  });

  it('délègue le vidage de la file', async () => {
    const client = makeClient(() => Promise.reject(new Error('offline')));
    await client.advance('SUB-2026-0001', 'incubation', 0);
    expect(await client.flushQueue()).toMatchObject({ sent: 1 });
  });
});

describe('opérations métier ajoutées', () => {
  it('interroge les étapes suivantes', async () => {
    const fetchImpl = mockFetch(() =>
      Promise.resolve(jsonResponse({ data: { currentStepId: 'a', nominal: [] } })),
    );
    const result = await makeClient(fetchImpl).nextSteps('SUB-2026-0001');

    expect(fetchImpl).toHaveBeenCalledWith(`${BASE}/api/units/SUB-2026-0001/next-steps`);
    expect(result.ok && result.data.currentStepId).toBe('a');
  });

  it('envoie une observation avec sa clé d’idempotence', async () => {
    const fetchImpl = mockFetch(() => Promise.resolve(jsonResponse({ data: {} })));
    await makeClient(fetchImpl).observe('SUB-2026-0001', {
      kind: 'contamination',
      severity: 'critical',
      photoId: 'f-1',
    });

    const [url, init] = [fetchImpl.mock.calls[0]?.[0], firstInit(fetchImpl)];
    expect(url).toBe(`${BASE}/api/units/SUB-2026-0001/observations`);
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('key-1');
    expect(JSON.parse(init.body as string)).toEqual({
      kind: 'contamination',
      severity: 'critical',
      photoId: 'f-1',
    });
  });

  it('envoie une mesure', async () => {
    const fetchImpl = mockFetch(() => Promise.resolve(jsonResponse({ data: {} })));
    await makeClient(fetchImpl).measure('SUB-2026-0001', {
      metric: 'temperature_c',
      numericValue: 24,
    });

    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${BASE}/api/units/SUB-2026-0001/measurements`);
    expect(JSON.parse(firstInit(fetchImpl).body as string)).toEqual({
      metric: 'temperature_c',
      numericValue: 24,
    });
  });

  /** Une saisie terrain hors réseau doit être conservée comme les autres. */
  it('met une observation en file quand le réseau lâche', async () => {
    const client = makeClient(() => Promise.reject(new Error('offline')));
    const result = await client.observe('SUB-2026-0001', { kind: 'odeur', severity: 'low' });

    expect(result.ok).toBe(true);
    expect(queue.pendingCount()).toBe(1);
    expect(queue.pending()[0]?.path).toBe('/api/units/SUB-2026-0001/observations');
  });

  it('met une mesure en file quand le réseau lâche', async () => {
    const client = makeClient(() => Promise.reject(new Error('offline')));
    await client.measure('SUB-2026-0001', { metric: 'humidity_pct', numericValue: 90 });
    expect(queue.pending()[0]?.path).toBe('/api/units/SUB-2026-0001/measurements');
  });
});

describe('createQueueSender', () => {
  const item = { path: '/api/units/u-1/advance', body: { a: 1 }, idempotencyKey: 'k-1' };

  it('rejoue avec la clé d’idempotence d’origine', async () => {
    const fetchImpl = mockFetch(() => Promise.resolve(new Response(null, { status: 200 })));
    await createQueueSender(BASE, fetchImpl)(item);

    const init = firstInit(fetchImpl);
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('k-1');
  });

  it('signale un succès', async () => {
    const send = createQueueSender(BASE, () =>
      Promise.resolve(new Response(null, { status: 200 })),
    );
    expect(await send(item)).toEqual({ ok: true, retryable: false });
  });

  it('considère une coupure réseau comme rejouable', async () => {
    const send = createQueueSender(BASE, () => Promise.reject(new Error('offline')));
    expect(await send(item)).toEqual({
      ok: false,
      retryable: true,
      error: 'Réseau indisponible.',
    });
  });

  /** 5xx : souci passager côté serveur, on réessaiera. */
  it('considère un 500 comme rejouable', async () => {
    const send = createQueueSender(BASE, () =>
      Promise.resolve(new Response(null, { status: 500 })),
    );
    const outcome = await send(item);
    expect(outcome.retryable).toBe(true);
    expect(outcome.error).toContain('500');
  });

  /** 4xx : c'est la requête qui ne convient pas, insister ne sert à rien. */
  it('ne rejoue pas un 409', async () => {
    const send = createQueueSender(BASE, () =>
      Promise.resolve(new Response(null, { status: 409 })),
    );
    expect((await send(item)).retryable).toBe(false);
  });

  it('ne rejoue pas un 400', async () => {
    const send = createQueueSender(BASE, () =>
      Promise.resolve(new Response(null, { status: 400 })),
    );
    expect((await send(item)).retryable).toBe(false);
  });
});
