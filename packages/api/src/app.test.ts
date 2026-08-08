import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { CultureUnit, DomainEvent, ProcessGraph } from '@champi/contracts';
import { connect, UnitRepository, type MongoConnection } from '@champi/persistence';
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
let app: Hono;
let idCounter = 0;

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
  await repository.ensureIndexes();
  await ensureApiIndexes(connection);
  app = createApp({
    connection,
    units: repository,
    now: () => NOW,
    newId: () => `evt-${String(++idCounter)}`,
    graphForVersion: (versionId) => Promise.resolve(versionId === 'pv-1' ? graph : null),
  });
});

afterAll(async () => {
  await connection.db.dropDatabase();
  await connection.close();
});

beforeEach(async () => {
  idCounter = 0;
  await connection.db.collection('lots').deleteMany({});
  await connection.db.collection('events').deleteMany({});
  await connection.db.collection('idempotencyKeys').deleteMany({});
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
