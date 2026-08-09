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

describe('process', () => {
  it('liste les modèles de process', async () => {
    const fetchImpl = mockFetch(() => Promise.resolve(jsonResponse({ data: [] })));
    await makeClient(fetchImpl).listProcessTemplates();
    expect(fetchImpl).toHaveBeenCalledWith(`${BASE}/api/process-templates`);
  });

  it('lit une version de process', async () => {
    const fetchImpl = mockFetch(() =>
      Promise.resolve(jsonResponse({ data: { id: 'v', status: 'draft' } })),
    );
    const result = await makeClient(fetchImpl).getProcessVersion('v-1');
    expect(fetchImpl).toHaveBeenCalledWith(`${BASE}/api/process-versions/v-1`);
    expect(result.ok && result.data.status).toBe('draft');
  });

  it('crée un modèle avec son graphe', async () => {
    const fetchImpl = mockFetch(() => Promise.resolve(jsonResponse({ data: {} })));
    await makeClient(fetchImpl).createProcessTemplate('Pleurote', { steps: [], transitions: [] });

    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${BASE}/api/process-templates`);
    expect(JSON.parse(firstInit(fetchImpl).body as string)).toEqual({
      name: 'Pleurote',
      graph: { steps: [], transitions: [] },
    });
  });

  /** Le canvas envoie exactement le JSON qu'il édite — aucune conversion. */
  it('envoie le graphe tel quel à l’enregistrement', async () => {
    const fetchImpl = mockFetch(() => Promise.resolve(jsonResponse({ data: {} })));
    const graph = { steps: [], transitions: [], layout: { a: { x: 1, y: 2 } } };
    await makeClient(fetchImpl).saveProcessGraph('v-1', graph);

    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${BASE}/api/process-versions/v-1/graph`);
    expect(JSON.parse(firstInit(fetchImpl).body as string)).toEqual(graph);
  });

  it('liste les unités d’un stade', async () => {
    const fetchImpl = mockFetch(() => Promise.resolve(jsonResponse({ data: [] })));
    await makeClient(fetchImpl).listUnits('substrate');
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${BASE}/api/units?stage=substrate`);
  });

  it('crée une unité avec son corps complet', async () => {
    const fetchImpl = mockFetch(() => Promise.resolve(jsonResponse({ data: {} })));
    await makeClient(fetchImpl).createUnit({
      name: 'Bloc 12',
      stage: 'substrate',
      processVersionId: 'pv-1',
      stepId: 'inoculation',
    });

    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${BASE}/api/units`);
    expect(JSON.parse(firstInit(fetchImpl).body as string)).toEqual({
      name: 'Bloc 12',
      stage: 'substrate',
      processVersionId: 'pv-1',
      stepId: 'inoculation',
    });
  });

  /** Lire le QR ne doit pas en créer un : c'est une lecture, pas une écriture. */
  it('lit le QR d’une unité sans l’attribuer', async () => {
    const fetchImpl = mockFetch(() => Promise.resolve(jsonResponse({ data: {} })));
    await makeClient(fetchImpl).getQr('SUB-2026-0042');

    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${BASE}/api/units/SUB-2026-0042/qr`);
    expect(fetchImpl.mock.calls[0]?.[1]).toBeUndefined();
  });

  it('attribue un QR', async () => {
    const fetchImpl = mockFetch(() => Promise.resolve(jsonResponse({ data: {} })));
    await makeClient(fetchImpl).assignQr('SUB-2026-0042');
    expect(firstInit(fetchImpl).method).toBe('POST');
  });

  it('imprime le nombre de copies demandé', async () => {
    const fetchImpl = mockFetch(() => Promise.resolve(jsonResponse({ data: {} })));
    await makeClient(fetchImpl).printLabel('SUB-2026-0042', 2);

    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${BASE}/api/units/SUB-2026-0042/label/print`);
    expect(JSON.parse(firstInit(fetchImpl).body as string)).toEqual({ copies: 2 });
  });

  it('imprime un seul exemplaire par défaut', async () => {
    const fetchImpl = mockFetch(() => Promise.resolve(jsonResponse({ data: {} })));
    await makeClient(fetchImpl).printLabel('SUB-2026-0042');
    expect(JSON.parse(firstInit(fetchImpl).body as string)).toEqual({ copies: 1 });
  });

  it('teste l’imprimante sans rien imprimer', async () => {
    const fetchImpl = mockFetch(() => Promise.resolve(jsonResponse({ data: {} })));
    await makeClient(fetchImpl).testPrinter();

    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${BASE}/api/printer/test`);
    expect(fetchImpl.mock.calls[0]?.[1]).toBeUndefined();
  });

  it('envoie une photo en base64, dans du JSON', async () => {
    const fetchImpl = mockFetch(() => Promise.resolve(jsonResponse({ data: {} })));
    await makeClient(fetchImpl).addPhoto('SUB-2026-0042', { data: 'AAAA', note: 'bordure' });

    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${BASE}/api/units/SUB-2026-0042/photos`);
    expect(JSON.parse(firstInit(fetchImpl).body as string)).toEqual({
      data: 'AAAA',
      note: 'bordure',
    });
  });

  it('donne l’adresse d’affichage d’une photo', () => {
    expect(makeClient(mockFetch(() => Promise.resolve(jsonResponse({})))).photoUrl('ph 1/2')).toBe(
      `${BASE}/api/photos/ph%201%2F2`,
    );
  });

  it('liste les récoltes d’une unité', async () => {
    const fetchImpl = mockFetch(() => Promise.resolve(jsonResponse({ data: {} })));
    await makeClient(fetchImpl).listHarvests('FRU-2026-0001');
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${BASE}/api/units/FRU-2026-0001/harvests`);
  });

  it('enregistre une récolte avec ses pertes', async () => {
    const fetchImpl = mockFetch(() => Promise.resolve(jsonResponse({ data: {} })));
    const corps = {
      flushNumber: 1,
      weight: { value: 820, unit: 'g' as const, kind: 'harvest' as const },
      quality: 'A' as const,
      losses: [{ weight: { value: 40, unit: 'g', kind: 'harvest' as const }, cause: 'overripe' }],
    };
    await makeClient(fetchImpl).recordHarvest('FRU-2026-0001', corps);

    expect(JSON.parse(firstInit(fetchImpl).body as string)).toEqual(corps);
  });

  it('crée un produit à partir de plusieurs récoltes', async () => {
    const fetchImpl = mockFetch(() => Promise.resolve(jsonResponse({ data: {} })));
    await makeClient(fetchImpl).createProduct({
      name: 'Barquette',
      quantity: { value: 400, unit: 'g', kind: 'product' },
      origins: [{ harvestId: 'h-1', weight: { value: 400, unit: 'g', kind: 'harvest' }, share: 1 }],
    });

    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${BASE}/api/products`);
  });

  it('remonte d’un produit à ses unités', async () => {
    const fetchImpl = mockFetch(() => Promise.resolve(jsonResponse({ data: {} })));
    await makeClient(fetchImpl).traceProduct('PRD-2026-0001');
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${BASE}/api/products/PRD-2026-0001/trace`);
  });

  it('remonte la lignée d’une unité', async () => {
    const fetchImpl = mockFetch(() => Promise.resolve(jsonResponse({ data: {} })));
    await makeClient(fetchImpl).traceUnit('SUB-2026-0042');
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${BASE}/api/units/SUB-2026-0042/trace`);
  });

  it('demande le contrôle d’audit d’une unité', async () => {
    const fetchImpl = mockFetch(() => Promise.resolve(jsonResponse({ data: {} })));
    await makeClient(fetchImpl).auditUnit('SUB-2026-0042');
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${BASE}/api/units/SUB-2026-0042/audit`);
  });

  it('publie une version', async () => {
    const fetchImpl = mockFetch(() => Promise.resolve(jsonResponse({ data: {} })));
    await makeClient(fetchImpl).publishProcessVersion('v-1');
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${BASE}/api/process-versions/v-1/publish`);
  });

  /**
   * La liste des versions est la source de la version courante : le
   * `currentVersionId` du modèle n'est pas déplacé par une publication.
   */
  it('liste les versions d’un process', async () => {
    const fetchImpl = mockFetch(() => Promise.resolve(jsonResponse({ data: [] })));
    await makeClient(fetchImpl).listProcessVersions('t 1/2');

    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${BASE}/api/process-templates/t%201%2F2/versions`);
  });

  /** Modifier un process publié passe obligatoirement par un nouveau brouillon. */
  it('ouvre un brouillon à partir d’une version', async () => {
    const fetchImpl = mockFetch(() => Promise.resolve(jsonResponse({ data: {} })));
    await makeClient(fetchImpl).draftProcessVersion('v 1/2');

    // L'identifiant est encodé : il vient du serveur, pas d'une saisie sûre.
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${BASE}/api/process-versions/v%201%2F2/draft`);
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
