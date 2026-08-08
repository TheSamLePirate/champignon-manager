import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { CultureUnit, DomainEvent, ProcessGraph } from '@champi/contracts';
import {
  connect,
  ProcessRepository,
  QrRepository,
  UnitRepository,
  type MongoConnection,
} from '@champi/persistence';
import { InMemoryTransport, PrintQueue } from '@champi/printing';
import type { Hono } from 'hono';
import { createApp, ensureApiIndexes } from './app.js';

/**
 * Tests HTTP en processus, contre une vraie base.
 *
 * On vérifie ici les trois propriétés qui rendent l'API pilotable par un agent
 * (docs/22 §4.3) : `dryRun`, `Idempotency-Key`, et des erreurs qui portent les
 * valeurs valides.
 */

const TEST_DB = `champignon_api_${String(Date.now())}`;
const NOW = '2026-08-22T09:00:00.000Z';

let connection: MongoConnection;
let repository: UnitRepository;
let qr: QrRepository;
let processes: ProcessRepository;
let transport: InMemoryTransport;
let app: Hono;
let idCounter = 0;
let randomSeed = 0;

/** Source d'aléa déterministe : chaque appel produit un token différent. */
function seededBytes(length: number): Uint8Array {
  randomSeed += 1;
  return Uint8Array.from({ length }, (_, index) => (randomSeed * 7 + index) % 256);
}

const graph: ProcessGraph = {
  steps: [
    {
      id: 'inoculation',
      name: 'Inoculation substrat',
      stage: 'substrate',
      conditions: {},
      alarms: { enabled: false },
      optional: false,
      provenance: 'cultivator',
    },
    {
      id: 'incubation',
      name: 'Incubation',
      stage: 'substrate',
      targetDurationDays: 21,
      conditions: {},
      alarms: { enabled: true, reminderDaysBefore: 1 },
      optional: false,
      provenance: 'cultivator',
    },
    {
      id: 'fructification',
      name: 'Fructification',
      stage: 'fruiting',
      conditions: {},
      alarms: { enabled: false },
      optional: false,
      provenance: 'cultivator',
    },
  ],
  transitions: [
    { from: 'inoculation', to: 'incubation' },
    { from: 'incubation', to: 'fructification' },
  ],
};

function makeUnit(overrides: Partial<CultureUnit> = {}): CultureUnit {
  return {
    id: 'u-1',
    publicCode: 'SUB-2026-0001',
    name: 'Bloc pleurote 1',
    stage: 'substrate',
    status: 'active',
    parentUnitId: null,
    lineageRelation: 'origin',
    generation: 0,
    processVersionId: 'pv-1',
    currentStepId: 'inoculation',
    currentStepEnteredAt: '2026-08-01T08:00:00.000Z',
    substrateWeight: { value: 5, unit: 'kg', kind: 'substrate' },
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z',
    version: 0,
    ...overrides,
  };
}

function birthEvent(unitId = 'u-1'): DomainEvent {
  return {
    id: `birth-${unitId}`,
    type: 'unit.created',
    occurredAt: '2026-08-01T08:00:00.000Z',
    recordedAt: '2026-08-01T08:00:00.000Z',
    source: 'manual',
    unitId,
    payload: {
      stage: 'substrate',
      processVersionId: 'pv-1',
      stepId: 'inoculation',
      parentUnitId: null,
      substrateWeight: { value: 5, unit: 'kg', kind: 'substrate' },
    },
  };
}

async function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  connection = await connect(undefined, TEST_DB);
  repository = new UnitRepository(connection);
  qr = new QrRepository(connection);
  processes = new ProcessRepository(connection);
  transport = new InMemoryTransport();
  await repository.ensureIndexes();
  await qr.ensureIndexes();
  await processes.ensureIndexes();
  await ensureApiIndexes(connection);
  app = createApp({
    connection,
    units: repository,
    qr,
    processes,
    printQueue: new PrintQueue(transport),
    now: () => NOW,
    newId: () => `evt-${String(++idCounter)}`,
    randomBytes: seededBytes,
    graphForVersion: (versionId) => Promise.resolve(versionId === 'pv-1' ? graph : null),
  });
});

afterAll(async () => {
  await connection.db.dropDatabase();
  await connection.close();
});

beforeEach(async () => {
  idCounter = 0;
  randomSeed = 0;
  transport = new InMemoryTransport();
  app = createApp({
    connection,
    units: repository,
    qr,
    processes,
    printQueue: new PrintQueue(transport),
    now: () => NOW,
    newId: () => `evt-${String(++idCounter)}`,
    randomBytes: seededBytes,
    graphForVersion: (versionId) => Promise.resolve(versionId === 'pv-1' ? graph : null),
  });
  await connection.db.collection('lots').deleteMany({});
  await connection.db.collection('events').deleteMany({});
  await connection.db.collection('idempotencyKeys').deleteMany({});
  await connection.db.collection('qrRegistry').deleteMany({});
  // Le compteur démarre au-dessus du code de la fixture (SUB-2026-0001) :
  // sans cela, la première unité créée par l'API réclamerait le même code.
  await connection.db
    .collection('counters')
    .replaceOne({ _id: 'publicCode:SUB:2026' as never }, { sequence: 5000 }, { upsert: true });
  await connection.db.collection('processTemplates').deleteMany({});
  await connection.db.collection('processVersions').deleteMany({});
  await repository.create(makeUnit(), birthEvent());
});

describe('découverte', () => {
  it('répond au contrôle de santé', async () => {
    const response = await app.request('/api/health');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok', now: NOW });
  });

  it('décrit l’application, ses conventions et l’état courant en un appel', async () => {
    const response = await app.request('/api/_discover');
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body['authentication']).toContain('aucune');
    expect(body['state']).toEqual({ unitsByStage: { substrate: 1 } });
    expect(JSON.stringify(body['conventions'])).toContain('dryRun');
    expect(JSON.stringify(body['conventions'])).toContain('Idempotency-Key');
    expect(JSON.stringify(body['recipes'])).toContain('next-steps');
  });
});

describe('lecture', () => {
  it('retrouve une unité par code public', async () => {
    const response = await app.request('/api/units/SUB-2026-0001');
    const body = (await response.json()) as { data: CultureUnit };
    expect(response.status).toBe(200);
    expect(body.data.id).toBe('u-1');
  });

  it('retrouve la même unité par identifiant technique', async () => {
    const response = await app.request('/api/units/u-1');
    expect(response.status).toBe(200);
  });

  it('renvoie 404 avec un indice utilisable', async () => {
    const response = await app.request('/api/units/SUB-2026-9999');
    const body = (await response.json()) as {
      error: { code: string; message: string; hint: string; path: string; docsUrl: string };
    };
    expect(response.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toContain('SUB-2026-9999');
    expect(body.error.message).toContain('Aucune unité');
    expect(body.error.hint).toContain('code public');
    expect(body.error.hint).toContain('/api/units?stage=');
  });

  it('liste par stade', async () => {
    const response = await app.request('/api/units?stage=substrate');
    const body = (await response.json()) as { data: CultureUnit[] };
    expect(body.data).toHaveLength(1);
  });

  it('exige le paramètre de stade et liste les valeurs acceptées', async () => {
    const response = await app.request('/api/units');
    const body = (await response.json()) as {
      error: { code: string; message: string; hint: string; path: string; docsUrl: string };
    };
    expect(response.status).toBe(400);
    expect(body.error.message).toContain('« stage » est requis');
    expect(body.error.hint).toContain('gelose');
    expect(body.error.hint).toContain('fruiting');
  });

  it('refuse un stade inconnu en citant les stades valides', async () => {
    const response = await app.request('/api/units?stage=compost');
    const body = (await response.json()) as {
      error: { code: string; message: string; hint: string; path: string; docsUrl: string };
    };
    expect(response.status).toBe(400);
    expect(body.error.message).toContain('compost');
    expect(body.error.hint).toContain('substrate');
  });

  it('renvoie le journal ordonné', async () => {
    const response = await app.request('/api/units/SUB-2026-0001/timeline');
    const body = (await response.json()) as { data: DomainEvent[] };
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.type).toBe('unit.created');
  });

  it('renvoie 404 sur le journal d’une unité inconnue', async () => {
    expect((await app.request('/api/units/inconnue/timeline')).status).toBe(404);
  });
});

describe('étapes suivantes', () => {
  it('donne le chemin nominal et rappelle qu’il n’est pas contraignant', async () => {
    const response = await app.request('/api/units/SUB-2026-0001/next-steps');
    const body = (await response.json()) as {
      data: { nominal: { id: string }[]; note: string; allSteps: string[] };
    };

    expect(body.data.nominal.map((s) => s.id)).toEqual(['incubation']);
    expect(body.data.note).toContain('confirmOffNominal');
    expect(body.data.note).toContain('revenir en arrière');
    expect(body.data.allSteps).toEqual(['inoculation', 'incubation', 'fructification']);
  });

  it('renvoie 404 si la version de process épinglée est introuvable', async () => {
    await repository.create(
      makeUnit({ id: 'u-2', publicCode: 'SUB-2026-0002', processVersionId: 'pv-inconnue' }),
      birthEvent('u-2'),
    );
    const response = await app.request('/api/units/SUB-2026-0002/next-steps');
    const body = (await response.json()) as {
      error: { code: string; message: string; hint: string; path: string; docsUrl: string };
    };
    expect(response.status).toBe(404);
    expect(body.error.message).toContain('pv-inconnue');
    expect(body.error.hint).toContain('épinglée');
    expect(body.error.hint).toContain('jamais être supprimée');
  });

  it('renvoie 404 sur les étapes suivantes d’une unité inconnue', async () => {
    expect((await app.request('/api/units/inconnue/next-steps')).status).toBe(404);
  });
});

describe('avancement', () => {
  it('avance sur le chemin nominal et renvoie l’unité et l’événement', async () => {
    const response = await post('/api/units/SUB-2026-0001/advance', {
      toStepId: 'incubation',
      expectedVersion: 0,
    });
    const body = (await response.json()) as { data: { unit: CultureUnit; event: DomainEvent } };

    expect(response.status).toBe(200);
    expect(body.data.unit.currentStepId).toBe('incubation');
    expect(body.data.unit.version).toBe(1);
    expect(body.data.event.type).toBe('unit.step_advanced');
  });

  it('refuse un écart non confirmé en indiquant comment procéder', async () => {
    const response = await post('/api/units/SUB-2026-0001/advance', {
      toStepId: 'fructification',
      expectedVersion: 0,
    });
    const body = (await response.json()) as {
      error: { code: string; message: string; hint: string; path: string; docsUrl: string };
    };

    expect(response.status).toBe(400);
    expect(body.error.hint).toContain('confirmOffNominal');
    expect(body.error.hint).toContain('incubation');
  });

  it('accepte l’écart une fois confirmé et enregistre qu’il en est un', async () => {
    const response = await post('/api/units/SUB-2026-0001/advance', {
      toStepId: 'fructification',
      expectedVersion: 0,
      confirmOffNominal: true,
    });
    const body = (await response.json()) as { data: { event: DomainEvent } };

    expect(response.status).toBe(200);
    const event = body.data.event;
    expect(event.type).toBe('unit.step_advanced');
    if (event.type !== 'unit.step_advanced') return;
    expect(event.payload.followedNominalPath).toBe(false);
  });

  it('refuse une étape inexistante en listant les étapes valides', async () => {
    const response = await post('/api/units/SUB-2026-0001/advance', {
      toStepId: 'flush_4',
      expectedVersion: 0,
    });
    const body = (await response.json()) as {
      error: { code: string; message: string; hint: string; path: string; docsUrl: string };
    };

    expect(response.status).toBe(422);
    expect(body.error.code).toBe('STEP_NOT_IN_PROCESS');
    expect(body.error.hint).toContain('inoculation');
    expect(body.error.hint).toContain('fructification');
    expect(body.error.hint).not.toContain('flush_4');
  });

  it('refuse un corps invalide en décrivant la forme attendue', async () => {
    const response = await post('/api/units/SUB-2026-0001/advance', { toStepId: 'incubation' });
    const body = (await response.json()) as {
      error: { code: string; message: string; hint: string; path: string; docsUrl: string };
    };

    expect(response.status).toBe(400);
    expect(body.error.message).toContain('Corps de requête invalide');
    expect(body.error.hint).toContain('toStepId');
    expect(body.error.hint).toContain('expectedVersion');
    expect(body.error.path).toBe('expectedVersion');
  });

  it('pointe la racine quand le corps est absent ou n’est pas un objet', async () => {
    const response = await app.request('/api/units/SUB-2026-0001/advance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'ceci n’est pas du JSON',
    });
    const body = (await response.json()) as {
      error: { code: string; message: string; hint: string; path: string; docsUrl: string };
    };

    expect(response.status).toBe(400);
    expect(body.error.path).toBe('body');
  });

  it('renvoie 409 quand le verrou optimiste rejette', async () => {
    await post('/api/units/SUB-2026-0001/advance', { toStepId: 'incubation', expectedVersion: 0 });
    const stale = await post('/api/units/SUB-2026-0001/advance', {
      toStepId: 'fructification',
      expectedVersion: 0,
    });
    const body = (await stale.json()) as {
      error: { code: string; message: string; hint: string; path: string; docsUrl: string };
    };

    expect(stale.status).toBe(409);
    expect(body.error.code).toBe('CONFLICT');
  });

  it('renvoie 404 sur une unité inconnue', async () => {
    const response = await post('/api/units/inconnue/advance', {
      toStepId: 'incubation',
      expectedVersion: 0,
    });
    expect(response.status).toBe(404);
  });

  it('renvoie 404 si la version de process est introuvable', async () => {
    await repository.create(
      makeUnit({ id: 'u-3', publicCode: 'SUB-2026-0003', processVersionId: 'pv-absente' }),
      birthEvent('u-3'),
    );
    const response = await post('/api/units/SUB-2026-0003/advance', {
      toStepId: 'incubation',
      expectedVersion: 0,
    });
    expect(response.status).toBe(404);
  });
});

describe('dryRun — voir avant d’agir', () => {
  it('décrit l’effet sans rien écrire', async () => {
    const response = await post('/api/units/SUB-2026-0001/advance?dryRun=true', {
      toStepId: 'incubation',
      expectedVersion: 0,
    });
    const body = (await response.json()) as {
      dryRun: boolean;
      data: { wouldBecome: CultureUnit; wouldRecord: DomainEvent };
    };

    expect(body.dryRun).toBe(true);
    expect(body.data.wouldBecome.currentStepId).toBe('incubation');
    expect(body.data.wouldRecord.type).toBe('unit.step_advanced');

    // Rien n'a bougé en base.
    const stored = await repository.findById('u-1');
    expect(stored?.currentStepId).toBe('inoculation');
    expect(stored?.version).toBe(0);
    expect(await repository.eventsForUnit('u-1')).toHaveLength(1);
  });

  it('valide aussi les refus, sans écrire', async () => {
    const response = await post('/api/units/SUB-2026-0001/advance?dryRun=true', {
      toStepId: 'flush_4',
      expectedVersion: 0,
    });
    expect(response.status).toBe(422);
    expect(await repository.eventsForUnit('u-1')).toHaveLength(1);
  });
});

/**
 * Le scénario Wi-Fi instable, vu depuis l'API : le client renvoie la même
 * requête avec la même clé. Sans idempotence, l'unité avancerait deux fois —
 * ou, avec le seul verrou optimiste, le second appel renverrait une erreur
 * incompréhensible alors que l'action a bien eu lieu.
 */
describe('idempotence', () => {
  it('rejoue la réponse d’origine sans réexécuter l’action', async () => {
    const headers = { 'Idempotency-Key': 'terrain-001' };
    const body = { toStepId: 'incubation', expectedVersion: 0 };

    const first = await post('/api/units/SUB-2026-0001/advance', body, headers);
    const retry = await post('/api/units/SUB-2026-0001/advance', body, headers);

    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    expect(retry.headers.get('Idempotent-Replay')).toBe('true');
    await expect(retry.json()).resolves.toEqual(await first.json());

    // Un seul avancement dans le journal.
    const events = await repository.eventsForUnit('u-1');
    expect(events.filter((e) => e.type === 'unit.step_advanced')).toHaveLength(1);
  });

  it('refuse une clé réutilisée pour une requête différente', async () => {
    const headers = { 'Idempotency-Key': 'terrain-002' };
    await post(
      '/api/units/SUB-2026-0001/advance',
      { toStepId: 'incubation', expectedVersion: 0 },
      headers,
    );

    const different = await post(
      '/api/units/SUB-2026-0001/advance',
      { toStepId: 'fructification', expectedVersion: 1, confirmOffNominal: true },
      headers,
    );
    const body = (await different.json()) as {
      error: { code: string; message: string; hint: string; path: string; docsUrl: string };
    };

    expect(different.status).toBe(409);
    expect(body.error.code).toBe('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_BODY');
    expect(body.error.path).toBe('Idempotency-Key');
  });

  it('deux clés différentes produisent deux actions distinctes', async () => {
    await post(
      '/api/units/SUB-2026-0001/advance',
      { toStepId: 'incubation', expectedVersion: 0 },
      { 'Idempotency-Key': 'a' },
    );
    await post(
      '/api/units/SUB-2026-0001/advance',
      { toStepId: 'fructification', expectedVersion: 1 },
      { 'Idempotency-Key': 'b' },
    );

    const events = await repository.eventsForUnit('u-1');
    expect(events.filter((e) => e.type === 'unit.step_advanced')).toHaveLength(2);
  });

  it('sans clé, aucune mémorisation n’a lieu', async () => {
    await post('/api/units/SUB-2026-0001/advance', { toStepId: 'incubation', expectedVersion: 0 });
    expect(await connection.db.collection('idempotencyKeys').countDocuments()).toBe(0);
  });
});

describe('lien de documentation', () => {
  it('dérive un lien de doc du code d’erreur', async () => {
    const response = await app.request('/api/units/inconnue');
    const body = (await response.json()) as {
      error: { code: string; message: string; hint: string; path: string; docsUrl: string };
    };
    expect(body.error.docsUrl).toBe('/api/docs#not-found');
  });

  it('dérive un lien lisible même pour un code composé', async () => {
    const response = await post('/api/units/SUB-2026-0001/advance', {
      toStepId: 'flush_4',
      expectedVersion: 0,
    });
    const body = (await response.json()) as {
      error: { code: string; message: string; hint: string; path: string; docsUrl: string };
    };
    expect(body.error.docsUrl).toBe('/api/docs#step-not-in-process');
  });
});

describe('audit à la demande', () => {
  it('confirme la concordance après un avancement', async () => {
    await post('/api/units/SUB-2026-0001/advance', { toStepId: 'incubation', expectedVersion: 0 });

    const response = await app.request('/api/units/SUB-2026-0001/audit');
    const body = (await response.json()) as {
      data: { verified: boolean; divergences: unknown[]; eventCount: number };
    };

    expect(body.data.verified).toBe(true);
    expect(body.data.divergences).toEqual([]);
    expect(body.data.eventCount).toBe(2);
  });

  /**
   * On corrompt volontairement l'état courant en base, sans passer par l'API :
   * c'est ce qu'aurait produit un double-write cassé. Le contrôle doit le voir.
   */
  it('détecte un état courant désaccordé du journal', async () => {
    await connection.db
      .collection('lots')
      .updateOne({ _id: 'u-1' as never }, { $set: { currentStepId: 'fructification' } });

    const response = await app.request('/api/units/SUB-2026-0001/audit');
    const body = (await response.json()) as {
      data: { verified: boolean; divergences: { field: string }[] };
    };

    expect(body.data.verified).toBe(false);
    expect(body.data.divergences.map((d) => d.field)).toContain('currentStepId');
  });

  it('signale un journal irrecevable plutôt que de prétendre vérifier', async () => {
    await connection.db.collection('events').deleteMany({ unitId: 'u-1' });

    const response = await app.request('/api/units/SUB-2026-0001/audit');
    const body = (await response.json()) as {
      data: { verified: boolean; integrityIssues: { code: string }[] };
    };

    expect(body.data.verified).toBe(false);
    expect(body.data.integrityIssues.length).toBeGreaterThan(0);
  });

  it('renvoie 404 sur une unité inconnue', async () => {
    expect((await app.request('/api/units/inconnue/audit')).status).toBe(404);
  });
});

describe('QR — attribution et résolution', () => {
  it('attribue un QR à une unité qui n’en a pas', async () => {
    const response = await post('/api/units/SUB-2026-0001/qr', {});
    const body = (await response.json()) as {
      data: { token: string; targetId: string; printCount: number };
      alreadyExisted: boolean;
    };

    expect(response.status).toBe(200);
    expect(body.alreadyExisted).toBe(false);
    expect(body.data.targetId).toBe('u-1');
    expect(body.data.printCount).toBe(0);
  });

  /**
   * Redemander le QR d'une unité rend le sien : l'opération est idempotente
   * par nature, sans clé. Un token d'unité ne change jamais (`q17_5`).
   */
  it('rend le QR existant plutôt que d’en fabriquer un second', async () => {
    const first = await post('/api/units/SUB-2026-0001/qr', {});
    const firstBody = (await first.json()) as { data: { token: string } };

    const second = await post('/api/units/SUB-2026-0001/qr', {});
    const secondBody = (await second.json()) as {
      data: { token: string };
      alreadyExisted: boolean;
    };

    expect(secondBody.alreadyExisted).toBe(true);
    expect(secondBody.data.token).toBe(firstBody.data.token);
  });

  it('décrit sans écrire en dryRun', async () => {
    const response = await post('/api/units/SUB-2026-0001/qr?dryRun=true', {});
    const body = (await response.json()) as { dryRun: boolean; data: { wouldRegisterFor: string } };

    expect(body.dryRun).toBe(true);
    expect(body.data.wouldRegisterFor).toBe('SUB-2026-0001');
    expect(await qr.findByTarget('unit', 'u-1')).toBeNull();
  });

  it('renvoie 404 pour une unité inconnue', async () => {
    expect((await post('/api/units/inconnue/qr', {})).status).toBe(404);
  });

  it('résout un token scanné directement vers la fiche de l’unité', async () => {
    const created = await post('/api/units/SUB-2026-0001/qr', {});
    const token = ((await created.json()) as { data: { token: string } }).data.token;

    const response = await app.request(`/api/qr/${token}`);
    const body = (await response.json()) as {
      data: { qr: { targetType: string }; target: { publicCode: string } | null };
    };

    expect(response.status).toBe(200);
    expect(body.data.qr.targetType).toBe('unit');
    // Après un scan, l'opérateur veut la fiche — pas un identifiant à
    // ré-interroger. La réponse la porte déjà.
    expect(body.data.target?.publicCode).toBe('SUB-2026-0001');
  });

  it('distingue un QR mal formé d’un QR inconnu', async () => {
    const malformed = await app.request('/api/qr/pas-un-token');
    const malformedBody = (await malformed.json()) as {
      error: { code: string; message: string; hint: string; path: string; docsUrl: string };
    };
    expect(malformed.status).toBe(400);
    expect(malformedBody.error.hint).toContain("étiquette de l'application");

    const unknown = await app.request('/api/qr/ZZZZZZZZZZZZZZZZZZZZZZ');
    const unknownBody = (await unknown.json()) as {
      error: { code: string; message: string; hint: string; path: string; docsUrl: string };
    };
    expect(unknown.status).toBe(404);
    expect(unknownBody.error.hint).toContain('autre installation');
  });

  it('rend une cible nulle quand l’unité liée a disparu', async () => {
    const created = await post('/api/units/SUB-2026-0001/qr', {});
    const token = ((await created.json()) as { data: { token: string } }).data.token;
    await connection.db.collection('lots').deleteMany({});

    const response = await app.request(`/api/qr/${token}`);
    const body = (await response.json()) as { data: { target: unknown } };
    expect(response.status).toBe(200);
    expect(body.data.target).toBeNull();
  });
});

describe('impression d’étiquette', () => {
  async function withQr(): Promise<string> {
    const created = await post('/api/units/SUB-2026-0001/qr', {});
    return ((await created.json()) as { data: { token: string } }).data.token;
  }

  it('imprime les quatre éléments demandés par le cultivateur', async () => {
    const token = await withQr();
    const response = await post('/api/units/SUB-2026-0001/label/print', {});
    const body = (await response.json()) as {
      data: { status: string; isReprint: boolean; label: { name: string; type: string } };
    };

    expect(response.status).toBe(200);
    expect(body.data.status).toBe('printed');
    expect(body.data.isReprint).toBe(false);
    expect(transport.printed[0]?.label).toEqual({
      name: 'Bloc pleurote 1',
      type: 'Ballot de substrat',
      date: '01/08/2026',
      publicCode: 'SUB-2026-0001',
      qrToken: token,
    });
  });

  /** L'enjeu de `q17_5` : une étiquette abîmée se remplace à l'identique. */
  it('réimprime exactement le même token', async () => {
    const token = await withQr();
    await post('/api/units/SUB-2026-0001/label/print', {});
    const second = await post('/api/units/SUB-2026-0001/label/print', {});
    const body = (await second.json()) as { data: { isReprint: boolean } };

    expect(body.data.isReprint).toBe(true);
    expect(transport.printed[0]?.label.qrToken).toBe(token);
    expect(transport.printed[1]?.label.qrToken).toBe(token);
  });

  it('compte les impressions réussies', async () => {
    await withQr();
    await post('/api/units/SUB-2026-0001/label/print', {});
    await post('/api/units/SUB-2026-0001/label/print', {});
    expect((await qr.findByTarget('unit', 'u-1'))?.printCount).toBe(2);
  });

  /**
   * Une impression ratée ne doit pas incrémenter le compteur : on croirait
   * qu'une étiquette circule alors qu'elle n'est jamais sortie de l'imprimante.
   */
  it('ne compte pas une impression qui a échoué', async () => {
    await withQr();
    transport.failNext(99);

    const response = await post('/api/units/SUB-2026-0001/label/print', {});
    const body = (await response.json()) as { data: { status: string; attempts: number } };

    expect(body.data.status).toBe('failed');
    expect(body.data.attempts).toBe(3);
    expect((await qr.findByTarget('unit', 'u-1'))?.printCount).toBe(0);
  });

  it('imprime le nombre de copies demandé', async () => {
    await withQr();
    await post('/api/units/SUB-2026-0001/label/print', { copies: 4 });
    expect(transport.printed[0]?.copies).toBe(4);
  });

  it('refuse un nombre de copies aberrant', async () => {
    await withQr();
    const response = await post('/api/units/SUB-2026-0001/label/print', { copies: 0 });
    expect(response.status).toBe(400);
    expect(transport.printed).toHaveLength(0);
  });

  it('refuse un corps mal typé', async () => {
    await withQr();
    const response = await post('/api/units/SUB-2026-0001/label/print', { copies: 'trois' });
    const body = (await response.json()) as {
      error: { code: string; message: string; hint: string; path: string; docsUrl: string };
    };
    expect(response.status).toBe(400);
    expect(body.error.path).toBe('copies');
  });

  it('tolère un corps absent et imprime une copie', async () => {
    await withQr();
    const response = await app.request('/api/units/SUB-2026-0001/label/print', { method: 'POST' });
    expect(response.status).toBe(200);
    expect(transport.printed[0]?.copies).toBe(1);
  });

  it('exige un QR avant d’imprimer, et dit comment l’obtenir', async () => {
    const response = await post('/api/units/SUB-2026-0001/label/print', {});
    const body = (await response.json()) as {
      error: { code: string; message: string; hint: string; path: string; docsUrl: string };
    };

    expect(response.status).toBe(404);
    expect(body.error.hint).toContain('/qr');
    expect(body.error.hint).toContain('SUB-2026-0001');
  });

  it('décrit sans imprimer en dryRun', async () => {
    await withQr();
    const response = await post('/api/units/SUB-2026-0001/label/print?dryRun=true', { copies: 2 });
    const body = (await response.json()) as {
      dryRun: boolean;
      data: { wouldPrint: { publicCode: string }; copies: number };
    };

    expect(body.dryRun).toBe(true);
    expect(body.data.wouldPrint.publicCode).toBe('SUB-2026-0001');
    expect(body.data.copies).toBe(2);
    expect(transport.printed).toHaveLength(0);
  });

  it('annonce une copie par défaut en dryRun', async () => {
    await withQr();
    const response = await post('/api/units/SUB-2026-0001/label/print?dryRun=true', {});
    const body = (await response.json()) as { data: { copies: number } };
    expect(body.data.copies).toBe(1);
  });

  it('renvoie 404 pour une unité inconnue', async () => {
    expect((await post('/api/units/inconnue/label/print', {})).status).toBe(404);
  });

  /**
   * Un document corrompu en base est une **panne**, pas un refus métier. La
   * réponse doit garder la forme habituelle — un agent ne doit pas avoir à
   * traiter deux formats d'erreur — sans divulguer de pile d'appel.
   */
  it('rend une panne sous la même forme qu’une erreur métier', async () => {
    await withQr();
    await connection.db
      .collection('lots')
      .updateOne({ _id: 'u-1' as never }, { $set: { createdAt: 'hier' } });

    const response = await post('/api/units/SUB-2026-0001/label/print', {});
    const body = (await response.json()) as {
      error: { code: string; message: string; hint: string; path: string; docsUrl: string };
    };

    expect(response.status).toBe(500);
    expect(body.error.message).toContain("n'a pas pu traiter");
    expect(body.error.hint).toContain('panne');
    expect(body.error.hint).toContain('Référence à citer');
    expect(body.error.docsUrl).toBeDefined();
    expect(JSON.stringify(body)).not.toContain('at Object');
  });
});

describe('test imprimante', () => {
  it('confirme une imprimante joignable', async () => {
    const response = await app.request('/api/printer/test');
    const body = (await response.json()) as { data: { reachable: boolean; transport: string } };
    expect(response.status).toBe(200);
    expect(body.data.reachable).toBe(true);
  });

  it('signale une imprimante muette sans dramatiser', async () => {
    transport.setReachable(false);
    const response = await app.request('/api/printer/test');
    const body = (await response.json()) as {
      error: { code: string; message: string; hint: string; path: string; docsUrl: string };
    };

    expect(response.status).toBe(409);
    expect(body.error.hint).toContain('à la reconnexion');
  });
});

/**
 * Certains chemins d'échec ne sont pas atteignables par la porte d'entrée
 * normale — le dépôt valide déjà les documents qu'il relit. On monte donc des
 * instances dédiées avec une dépendance défaillante, plutôt que de laisser ces
 * branches non testées : ce sont elles qui parlent à l'utilisateur le jour où
 * quelque chose casse.
 */
describe('dépendances défaillantes', () => {
  function appWith(overrides: Partial<Parameters<typeof createApp>[0]>): Hono {
    return createApp({
      connection,
      units: repository,
      qr,
      processes,
      printQueue: new PrintQueue(transport),
      now: () => NOW,
      newId: () => `evt-${String(++idCounter)}`,
      randomBytes: seededBytes,
      graphForVersion: (versionId) => Promise.resolve(versionId === 'pv-1' ? graph : null),
      ...overrides,
    });
  }

  it('remonte l’échec d’attribution de QR quand la source d’aléa est défaillante', async () => {
    const broken = appWith({ randomBytes: () => new Uint8Array(2) });
    const response = await broken.request('/api/units/SUB-2026-0001/qr', { method: 'POST' });
    const body = (await response.json()) as {
      error: { code: string; message: string; hint: string; path: string; docsUrl: string };
    };

    expect(response.status).toBe(400);
    expect(body.error.message).toContain('2 octets');
  });

  it('remonte l’échec de composition d’étiquette', async () => {
    await post('/api/units/SUB-2026-0001/qr', {});

    // Un dépôt qui rend une unité dont la date est inexploitable : c'est ce que
    // verrait la route si la validation amont venait à être relâchée.
    // On ne copie pas le dépôt à coups de spread — cela perdrait son prototype.
    // La route n'appelle qu'une méthode : un objet minimal suffit et dit
    // exactement ce qui est simulé.
    const corrupting = {
      findByIdOrPublicCode: () => Promise.resolve(makeUnit({ createdAt: 'hier' })),
    } as unknown as UnitRepository;

    const broken = appWith({ units: corrupting });
    const response = await broken.request('/api/units/SUB-2026-0001/label/print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const body = (await response.json()) as {
      error: { code: string; message: string; hint: string; path: string; docsUrl: string };
    };

    expect(response.status).toBe(400);
    expect(body.error.path).toBe('date');
    expect(transport.printed).toHaveLength(0);
  });
});

describe('process — création et versions', () => {
  const simpleGraph = {
    steps: [
      { id: 'a', name: 'Étape A', stage: 'substrate' },
      { id: 'b', name: 'Étape B', stage: 'fruiting' },
    ],
    transitions: [{ from: 'a', to: 'b' }],
  };

  function uniqueProcess(overrides: Record<string, unknown> = {}) {
    return { name: `Process ${String(Math.random())}`, graph: simpleGraph, ...overrides };
  }

  it('crée un modèle et sa première version en brouillon', async () => {
    const response = await post('/api/process-templates', uniqueProcess());
    const body = (await response.json()) as {
      data: {
        template: { id: string; speciesScope: string; currentVersionId: string };
        version: { id: string; versionNumber: number; status: string };
      };
    };

    expect(response.status).toBe(200);
    expect(body.data.version.versionNumber).toBe(1);
    expect(body.data.version.status).toBe('draft');
    // La portée par défaut est « toute espèce » (docs/20 §6).
    expect(body.data.template.speciesScope).toBe('any');
    expect(body.data.template.currentVersionId).toBe(body.data.version.id);
  });

  it('accepte une portée limitée à une espèce', async () => {
    const response = await post('/api/process-templates', uniqueProcess({ speciesScope: 'sp-1' }));
    const body = (await response.json()) as { data: { template: { speciesScope: string } } };
    expect(body.data.template.speciesScope).toBe('sp-1');
  });

  it('refuse un corps invalide en décrivant la forme attendue', async () => {
    const response = await post('/api/process-templates', { name: 'Sans graphe' });
    const body = (await response.json()) as {
      error: { code: string; message: string; hint: string; path: string; docsUrl: string };
    };
    expect(response.status).toBe(400);
    expect(body.error.hint).toContain('graph');
    expect(body.error.path).toBe('graph');
  });

  it('refuse un graphe incohérent avant même de l’enregistrer', async () => {
    const response = await post(
      '/api/process-templates',
      uniqueProcess({
        graph: {
          steps: [{ id: 'a', name: 'A', stage: 'substrate' }],
          transitions: [{ from: 'a', to: 'fantome' }],
        },
      }),
    );
    const body = (await response.json()) as {
      error: { code: string; message: string; hint: string; path: string; docsUrl: string };
    };
    expect(response.status).toBe(422);
    expect(body.error.code).toBe('PROCESS_GRAPH_INVALID');
    expect(body.error.message).toContain('fantome');
  });

  it('refuse deux modèles de même nom', async () => {
    const payload = uniqueProcess({ name: 'Nom unique test' });
    await post('/api/process-templates', payload);
    const duplicate = await post('/api/process-templates', payload);
    expect(duplicate.status).toBe(409);
  });

  it('décrit sans créer en dryRun', async () => {
    const before = (
      (await (await app.request('/api/process-templates')).json()) as { data: unknown[] }
    ).data.length;
    const response = await post('/api/process-templates?dryRun=true', uniqueProcess());
    const body = (await response.json()) as { dryRun: boolean; data: { wouldCreate: string } };

    expect(body.dryRun).toBe(true);
    expect(body.data.wouldCreate).toBeTruthy();
    const after = (
      (await (await app.request('/api/process-templates')).json()) as { data: unknown[] }
    ).data.length;
    expect(after).toBe(before);
  });

  it('liste les modèles et leurs versions', async () => {
    const created = await post('/api/process-templates', uniqueProcess());
    const createdBody = (await created.json()) as { data: { template: { id: string } } };

    const templates = await app.request('/api/process-templates');
    expect(((await templates.json()) as { data: unknown[] }).data.length).toBeGreaterThan(0);

    const versions = await app.request(
      `/api/process-templates/${createdBody.data.template.id}/versions`,
    );
    expect(((await versions.json()) as { data: unknown[] }).data).toHaveLength(1);
  });

  it('renvoie 404 pour une version inconnue, en disant où chercher', async () => {
    const response = await app.request('/api/process-versions/inexistante');
    const body = (await response.json()) as {
      error: { code: string; message: string; hint: string; path: string; docsUrl: string };
    };
    expect(response.status).toBe(404);
    expect(body.error.hint).toContain('/api/process-templates');
  });

  it('publie une version et annonce qu’aucune unité n’est déplacée', async () => {
    const created = await post('/api/process-templates', uniqueProcess());
    const versionId = ((await created.json()) as { data: { version: { id: string } } }).data.version
      .id;

    const response = await post(`/api/process-versions/${versionId}/publish`, {});
    const body = (await response.json()) as { data: { status: string }; note: string };

    expect(body.data.status).toBe('published');
    // Décision docs/21 §2 : la réponse le dit explicitement.
    expect(body.note).toContain('Aucune unité en cours');
  });

  it('refuse de republier', async () => {
    const created = await post('/api/process-templates', uniqueProcess());
    const versionId = ((await created.json()) as { data: { version: { id: string } } }).data.version
      .id;

    await post(`/api/process-versions/${versionId}/publish`, {});
    const again = await post(`/api/process-versions/${versionId}/publish`, {});
    expect(again.status).toBe(409);
  });

  it('refuse de publier une version inconnue', async () => {
    expect((await post('/api/process-versions/inexistante/publish', {})).status).toBe(404);
  });

  it('décrit la publication en dryRun sans geler la version', async () => {
    const created = await post('/api/process-templates', uniqueProcess());
    const versionId = ((await created.json()) as { data: { version: { id: string } } }).data.version
      .id;

    const dry = await post(`/api/process-versions/${versionId}/publish?dryRun=true`, {});
    expect(((await dry.json()) as { dryRun: boolean }).dryRun).toBe(true);

    const still = await app.request(`/api/process-versions/${versionId}`);
    expect(((await still.json()) as { data: { status: string } }).data.status).toBe('draft');
  });

  it('modifie le graphe d’un brouillon', async () => {
    const created = await post('/api/process-templates', uniqueProcess());
    const versionId = ((await created.json()) as { data: { version: { id: string } } }).data.version
      .id;

    const response = await post(`/api/process-versions/${versionId}/graph`, {
      steps: [{ id: 'seule', name: 'Seule', stage: 'substrate' }],
      transitions: [],
    });
    const body = (await response.json()) as { data: { graph: { steps: unknown[] } } };
    expect(response.status).toBe(200);
    expect(body.data.graph.steps).toHaveLength(1);
  });

  it('refuse de modifier une version publiée', async () => {
    const created = await post('/api/process-templates', uniqueProcess());
    const versionId = ((await created.json()) as { data: { version: { id: string } } }).data.version
      .id;
    await post(`/api/process-versions/${versionId}/publish`, {});

    const response = await post(`/api/process-versions/${versionId}/graph`, {
      steps: [{ id: 'x', name: 'X', stage: 'substrate' }],
      transitions: [],
    });
    const body = (await response.json()) as {
      error: { code: string; message: string; hint: string; path: string; docsUrl: string };
    };
    expect(response.status).toBe(409);
    expect(body.error.code).toBe('VERSION_PUBLISHED_IMMUTABLE');
  });

  it('refuse un graphe mal formé', async () => {
    const created = await post('/api/process-templates', uniqueProcess());
    const versionId = ((await created.json()) as { data: { version: { id: string } } }).data.version
      .id;

    const response = await post(`/api/process-versions/${versionId}/graph`, { steps: 'non' });
    const body = (await response.json()) as {
      error: { code: string; message: string; hint: string; path: string; docsUrl: string };
    };
    expect(response.status).toBe(400);
    expect(body.error.hint).toContain('steps');
  });

  it('refuse de modifier le graphe d’une version inconnue', async () => {
    const response = await post('/api/process-versions/inexistante/graph', {
      steps: [],
      transitions: [],
    });
    expect(response.status).toBe(404);
  });

  it('ouvre un brouillon à partir d’une version publiée', async () => {
    const created = await post('/api/process-templates', uniqueProcess());
    const versionId = ((await created.json()) as { data: { version: { id: string } } }).data.version
      .id;
    await post(`/api/process-versions/${versionId}/publish`, {});

    const response = await post(`/api/process-versions/${versionId}/draft`, {});
    const body = (await response.json()) as {
      data: { versionNumber: number; status: string; publishedAt?: string };
    };
    expect(body.data.versionNumber).toBe(2);
    expect(body.data.status).toBe('draft');
    expect(body.data.publishedAt).toBeUndefined();
  });

  it('refuse d’ouvrir un brouillon d’une version inconnue', async () => {
    expect((await post('/api/process-versions/inexistante/draft', {})).status).toBe(404);
  });
});

describe('création d’unité', () => {
  it('attribue un code public dérivé du stade', async () => {
    const response = await post('/api/units', {
      name: 'Nouveau bloc',
      stage: 'substrate',
      processVersionId: 'pv-1',
      stepId: 'inoculation',
    });
    const body = (await response.json()) as {
      data: { unit: { publicCode: string; lineageRelation: string }; event: { type: string } };
    };

    expect(response.status).toBe(200);
    expect(body.data.unit.publicCode).toMatch(/^SUB-\d{4}-\d{4,6}$/);
    // Sans ascendant, la relation de lignée est « origin ».
    expect(body.data.unit.lineageRelation).toBe('origin');
    expect(body.data.event.type).toBe('unit.created');
  });

  it('marque une unité issue d’un parent comme transfert', async () => {
    const response = await post('/api/units', {
      name: 'Enfant',
      stage: 'substrate',
      processVersionId: 'pv-1',
      stepId: 'inoculation',
      parentUnitId: 'u-1',
    });
    const body = (await response.json()) as { data: { unit: { lineageRelation: string } } };
    expect(body.data.unit.lineageRelation).toBe('transfer');
  });

  it('conserve le poids de substrat, dénominateur du rendement', async () => {
    const response = await post('/api/units', {
      name: 'Pesé',
      stage: 'substrate',
      processVersionId: 'pv-1',
      stepId: 'inoculation',
      substrateWeight: { value: 7, unit: 'kg', kind: 'substrate' },
    });
    const body = (await response.json()) as {
      data: { unit: { substrateWeight: { value: number } } };
    };
    expect(body.data.unit.substrateWeight.value).toBe(7);
  });

  it('refuse un corps invalide en décrivant la forme attendue', async () => {
    const response = await post('/api/units', { name: 'Sans stade' });
    const body = (await response.json()) as {
      error: { code: string; message: string; hint: string; path: string; docsUrl: string };
    };
    expect(response.status).toBe(400);
    expect(body.error.hint).toContain('processVersionId');
  });

  it('refuse une version de process inexistante', async () => {
    const response = await post('/api/units', {
      name: 'Orpheline',
      stage: 'substrate',
      processVersionId: 'pv-absente',
      stepId: 'inoculation',
    });
    const body = (await response.json()) as {
      error: { code: string; message: string; hint: string; path: string; docsUrl: string };
    };
    expect(response.status).toBe(404);
    expect(body.error.hint).toContain('publie un process');
    expect(body.error.path).toBe('processVersionId');
  });

  it('refuse une étape absente du process, en listant les valides', async () => {
    const response = await post('/api/units', {
      name: 'Mauvaise étape',
      stage: 'substrate',
      processVersionId: 'pv-1',
      stepId: 'flush_9',
    });
    const body = (await response.json()) as {
      error: { code: string; message: string; hint: string; path: string; docsUrl: string };
    };
    expect(response.status).toBe(422);
    expect(body.error.code).toBe('STEP_NOT_IN_PROCESS');
    expect(body.error.hint).toContain('inoculation');
    expect(body.error.path).toBe('stepId');
  });

  it('décrit sans créer en dryRun', async () => {
    const response = await post('/api/units?dryRun=true', {
      name: 'Fantôme',
      stage: 'substrate',
      processVersionId: 'pv-1',
      stepId: 'inoculation',
    });
    const body = (await response.json()) as {
      dryRun: boolean;
      data: { wouldCreate: { name: string } };
    };
    expect(body.dryRun).toBe(true);
    expect(body.data.wouldCreate.name).toBe('Fantôme');

    const list = await app.request('/api/units?stage=substrate');
    // Seule l'unité du `beforeEach` existe.
    expect(((await list.json()) as { data: unknown[] }).data).toHaveLength(1);
  });

  /** Sans idempotence, un retry créerait une unité fantôme et un second QR. */
  it('est idempotente', async () => {
    const payload = {
      name: 'Rejouée',
      stage: 'substrate',
      processVersionId: 'pv-1',
      stepId: 'inoculation',
    };
    const headers = { 'Idempotency-Key': 'creation-1' };

    const first = await post('/api/units', payload, headers);
    const retry = await post('/api/units', payload, headers);

    const firstBody = (await first.json()) as { data: { unit: { publicCode: string } } };
    const retryBody = (await retry.json()) as { data: { unit: { publicCode: string } } };
    expect(retry.headers.get('Idempotent-Replay')).toBe('true');
    expect(retryBody.data.unit.publicCode).toBe(firstBody.data.unit.publicCode);
  });

  it('refuse une clé d’idempotence réutilisée pour une autre unité', async () => {
    const headers = { 'Idempotency-Key': 'creation-2' };
    await post(
      '/api/units',
      { name: 'A', stage: 'substrate', processVersionId: 'pv-1', stepId: 'inoculation' },
      headers,
    );
    const different = await post(
      '/api/units',
      { name: 'B', stage: 'substrate', processVersionId: 'pv-1', stepId: 'inoculation' },
      headers,
    );
    expect(different.status).toBe(409);
  });
});

/**
 * Gardes de propagation d'erreur.
 *
 * Ces branches ne sont pas atteignables par la porte d'entrée normale : les
 * préconditions de chaque route les rendent inutiles *en théorie*. Elles
 * existent parce que la couche du dessous rend un `Result` — et ce sont elles
 * qui parleront à l'utilisateur le jour où cette couche lâchera vraiment.
 * On les exerce donc avec des dépôts défaillants.
 */
describe('propagation des échecs de la couche de persistance', () => {
  const boom = {
    ok: false as const,
    error: { code: 'CONFLICT' as const, message: 'Dépôt indisponible.', hint: 'Réessaie.' },
  };

  function appWithBroken(overrides: Record<string, unknown>): Hono {
    return createApp({
      connection,
      units: repository,
      qr,
      processes,
      printQueue: new PrintQueue(transport),
      now: () => NOW,
      newId: () => `evt-${String(++idCounter)}`,
      randomBytes: seededBytes,
      graphForVersion: (versionId) => Promise.resolve(versionId === 'pv-1' ? graph : null),
      ...overrides,
    });
  }

  const simpleGraph = {
    steps: [{ id: 'a', name: 'A', stage: 'substrate' }],
    transitions: [],
  };

  async function postTo(target: Hono, path: string, body: unknown): Promise<Response> {
    return target.request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('remonte un échec d’enregistrement de version à la création du process', async () => {
    const broken = appWithBroken({
      processes: {
        saveTemplate: () => Promise.resolve({ ok: true, value: { id: 't', name: 'n' } }),
        saveVersion: () => Promise.resolve(boom),
      },
    });
    const response = await postTo(broken, '/api/process-templates', {
      name: 'Échec version',
      graph: simpleGraph,
    });
    expect(response.status).toBe(409);
  });

  it('remonte un échec d’enregistrement à la publication', async () => {
    const broken = appWithBroken({
      processes: {
        findVersion: () =>
          Promise.resolve({
            id: 'v',
            templateId: 't',
            versionNumber: 1,
            status: 'draft',
            graph: simpleGraph,
          }),
        saveVersion: () => Promise.resolve(boom),
      },
    });
    expect((await postTo(broken, '/api/process-versions/v/publish', {})).status).toBe(409);
  });

  it('remonte un échec d’enregistrement à l’ouverture d’un brouillon', async () => {
    const broken = appWithBroken({
      processes: {
        findVersion: () =>
          Promise.resolve({
            id: 'v',
            templateId: 't',
            versionNumber: 1,
            status: 'published',
            graph: simpleGraph,
          }),
        nextVersionNumber: () => Promise.resolve(2),
        saveVersion: () => Promise.resolve(boom),
      },
    });
    expect((await postTo(broken, '/api/process-versions/v/draft', {})).status).toBe(409);
  });

  it('remonte un échec d’enregistrement à la modification du graphe', async () => {
    const broken = appWithBroken({
      processes: {
        findVersion: () =>
          Promise.resolve({
            id: 'v',
            templateId: 't',
            versionNumber: 1,
            status: 'draft',
            graph: simpleGraph,
          }),
        saveVersion: () => Promise.resolve(boom),
      },
    });
    const response = await postTo(broken, '/api/process-versions/v/graph', simpleGraph);
    expect(response.status).toBe(409);
  });

  it('remonte un échec d’attribution de code public', async () => {
    const broken = appWithBroken({
      qr: {
        allocatePublicCode: () =>
          Promise.resolve({
            ok: false,
            error: {
              code: 'VALIDATION_FAILED',
              message: 'Séquence épuisée.',
              hint: 'Élargis le format.',
            },
          }),
      },
    });
    const response = await postTo(broken, '/api/units', {
      name: 'Sans code',
      stage: 'substrate',
      processVersionId: 'pv-1',
      stepId: 'inoculation',
    });
    const body = (await response.json()) as { error: { message: string } };
    expect(response.status).toBe(400);
    expect(body.error.message).toContain('Séquence épuisée');
  });

  it('remonte un échec de création d’unité', async () => {
    const broken = appWithBroken({
      units: {
        create: () => Promise.resolve(boom),
        countByStage: () => Promise.resolve({}),
      },
    });
    const response = await postTo(broken, '/api/units', {
      name: 'Non créée',
      stage: 'substrate',
      processVersionId: 'pv-1',
      stepId: 'inoculation',
    });
    expect(response.status).toBe(409);
  });
});
