import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { CultureUnit, DomainEvent } from '@champi/contracts';
import { checkJournalIntegrity, diffReplayAgainstStored, replayUnit } from '@champi/domain';
import { connect, type MongoConnection } from './client.js';
import { UnitRepository } from './unit-repository.js';

/**
 * Tests d'intégration sur **MongoDB réel**, jamais un mock.
 *
 * Mocker la base ferait passer des tests qui échouent en production — c'est
 * particulièrement vrai des transactions et du verrou optimiste, qui sont
 * précisément ce qu'on vérifie ici (docs/22 §6.1).
 */

const TEST_DB = `champignon_test_${String(Date.now())}`;

let connection: MongoConnection;
let repository: UnitRepository;

beforeAll(async () => {
  connection = await connect(undefined, TEST_DB);
  repository = new UnitRepository(connection);
  await repository.ensureIndexes();
});

afterAll(async () => {
  await connection.db.dropDatabase();
  await connection.close();
});

beforeEach(async () => {
  await connection.db.collection('lots').deleteMany({});
  await connection.db.collection('events').deleteMany({});
});

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

function birthEvent(unitId = 'u-1', id = 'e-1'): DomainEvent {
  return {
    id,
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

function advanceEvent(id: string, toStepId: string, occurredAt: string): DomainEvent {
  return {
    id,
    type: 'unit.step_advanced',
    occurredAt,
    recordedAt: occurredAt,
    source: 'manual',
    unitId: 'u-1',
    payload: { fromStepId: 'inoculation', toStepId, followedNominalPath: true },
  };
}

/**
 * Les index ne sont pas un détail d'optimisation : l'unicité de `publicCode`
 * est ce qui empêche deux unités de porter le même QR. Un index manquant ne
 * casse aucun test fonctionnel — il casse la production. On le vérifie donc.
 */
describe('index', () => {
  // Appelé ici, et pas seulement dans le `beforeAll` global : le code exécuté
  // en `beforeAll` n'est attribué à aucun test par l'analyse de couverture par
  // test, donc les mutants de la définition d'index survivraient sans cela.
  beforeEach(async () => {
    await repository.ensureIndexes();
  });

  it('crée l’index unique sur le code public', async () => {
    const indexes = await connection.db.collection('lots').indexes();
    const unique = indexes.find((i) => JSON.stringify(i.key) === JSON.stringify({ publicCode: 1 }));
    expect(unique?.unique).toBe(true);
  });

  it('crée les index de requête sur les unités', async () => {
    const keys = (await connection.db.collection('lots').indexes()).map((i) =>
      JSON.stringify(i.key),
    );
    expect(keys).toContain(JSON.stringify({ stage: 1, status: 1 }));
    expect(keys).toContain(JSON.stringify({ parentUnitId: 1 }));
    expect(keys).toContain(JSON.stringify({ processVersionId: 1 }));
    expect(keys).toContain(JSON.stringify({ currentStepId: 1 }));
    expect(keys).toContain(JSON.stringify({ 'location.roomId': 1 }));
  });

  it('crée les index du journal d’événements', async () => {
    const keys = (await connection.db.collection('events').indexes()).map((i) =>
      JSON.stringify(i.key),
    );
    expect(keys).toContain(JSON.stringify({ unitId: 1, occurredAt: 1 }));
    expect(keys).toContain(JSON.stringify({ type: 1, occurredAt: 1 }));
    expect(keys).toContain(JSON.stringify({ correlationId: 1 }));
  });
});

describe('création', () => {
  it('écrit l’unité et son événement de naissance', async () => {
    const result = await repository.create(makeUnit(), birthEvent());
    expect(result.ok).toBe(true);

    const stored = await repository.findById('u-1');
    expect(stored?.publicCode).toBe('SUB-2026-0001');
    expect(await repository.eventsForUnit('u-1')).toHaveLength(1);
  });

  it('refuse un code public déjà utilisé', async () => {
    await repository.create(makeUnit(), birthEvent());
    const duplicate = await repository.create(makeUnit({ id: 'u-2' }), birthEvent('u-2', 'e-2'));

    expect(duplicate.ok).toBe(false);
    if (duplicate.ok) return;
    expect(duplicate.error.code).toBe('CONFLICT');
    expect(duplicate.error.message).toContain('SUB-2026-0001');
    expect(duplicate.error.message).toContain('déjà utilisé');
    expect(duplicate.error.hint).toContain('uniques');
    expect(duplicate.error.path).toBe('publicCode');
  });

  /**
   * Une erreur d'infrastructure ne doit **pas** être traduite en `Result`
   * métier : elle remonte telle quelle. Confondre « le code public existe
   * déjà » et « la base est injoignable » ferait afficher un message faux à
   * l'utilisateur et masquerait une panne.
   */
  it('laisse remonter une erreur d’infrastructure au lieu de la déguiser', async () => {
    const closed = await connect(undefined, TEST_DB);
    const orphan = new UnitRepository(closed);
    await closed.close();

    await expect(
      orphan.create(makeUnit({ id: 'u-9' }), birthEvent('u-9', 'e-9')),
    ).rejects.toThrow();
  });

  it('n’écrit aucun événement quand la création échoue', async () => {
    await repository.create(makeUnit(), birthEvent());
    await repository.create(makeUnit({ id: 'u-2' }), birthEvent('u-2', 'e-2'));

    // Seul l'événement de la première création subsiste : la transaction
    // avortée n'a rien laissé derrière elle.
    expect(await repository.eventsForUnit('u-2')).toHaveLength(0);
  });
});

describe('recherche', () => {
  beforeEach(async () => {
    await repository.create(makeUnit(), birthEvent());
  });

  it('retrouve une unité par identifiant technique', async () => {
    expect((await repository.findByIdOrPublicCode('u-1'))?.id).toBe('u-1');
  });

  it('retrouve la même unité par son code public', async () => {
    expect((await repository.findByIdOrPublicCode('SUB-2026-0001'))?.id).toBe('u-1');
  });

  it('renvoie null pour une référence inconnue', async () => {
    expect(await repository.findByIdOrPublicCode('SUB-2026-9999')).toBeNull();
    expect(await repository.findById('inexistant')).toBeNull();
  });

  it('liste par stade', async () => {
    await repository.create(
      makeUnit({ id: 'u-2', publicCode: 'GEL-2026-0001', stage: 'gelose' }),
      birthEvent('u-2', 'e-2'),
    );
    const substrate = await repository.listByStage('substrate');
    expect(substrate.map((u) => u.publicCode)).toEqual(['SUB-2026-0001']);
    const gelose = await repository.listByStage('gelose');
    expect(gelose.map((u) => u.publicCode)).toEqual(['GEL-2026-0001']);
    expect(await repository.listByStage('fruiting')).toEqual([]);
  });

  it('compte les unités par stade', async () => {
    await repository.create(
      makeUnit({ id: 'u-2', publicCode: 'GEL-2026-0001', stage: 'gelose' }),
      birthEvent('u-2', 'e-2'),
    );
    expect(await repository.countByStage()).toEqual({ substrate: 1, gelose: 1 });
  });
});

describe('verrou optimiste', () => {
  beforeEach(async () => {
    await repository.create(makeUnit(), birthEvent());
  });

  it('accepte une écriture sur la version attendue', async () => {
    const updated = makeUnit({ currentStepId: 'incubation', version: 1 });
    const result = await repository.saveWithEvent(
      updated,
      advanceEvent('e-2', 'incubation', '2026-08-02T08:00:00.000Z'),
      0,
    );

    expect(result.ok).toBe(true);
    expect((await repository.findById('u-1'))?.currentStepId).toBe('incubation');
  });

  it('refuse une écriture sur une version périmée', async () => {
    await repository.saveWithEvent(
      makeUnit({ currentStepId: 'incubation', version: 1 }),
      advanceEvent('e-2', 'incubation', '2026-08-02T08:00:00.000Z'),
      0,
    );

    const stale = await repository.saveWithEvent(
      makeUnit({ currentStepId: 'fructification', version: 1 }),
      advanceEvent('e-3', 'fructification', '2026-08-03T08:00:00.000Z'),
      0,
    );

    expect(stale.ok).toBe(false);
    if (stale.ok) return;
    expect(stale.error.code).toBe('CONFLICT');
    expect(stale.error.message).toContain('SUB-2026-0001');
    expect(stale.error.message).toContain('modifiée entre-temps');
    expect(stale.error.message).toContain('version attendue était 0');
    expect(stale.error.message).toContain('version en base est 1');
    expect(stale.error.path).toBe('version');
    expect(stale.error.hint).toContain('Relis l’unité');
  });

  /**
   * Le scénario de perte de données le plus probable de l'application
   * (`claude-critics.md` P2-4) : Wi-Fi de chambre instable, la requête part,
   * la réponse se perd, le client réessaie.
   */
  it('n’avance pas deux fois une unité quand un retry rejoue la même écriture', async () => {
    const advanced = makeUnit({ currentStepId: 'incubation', version: 1 });
    const event = advanceEvent('e-2', 'incubation', '2026-08-02T08:00:00.000Z');

    const first = await repository.saveWithEvent(advanced, event, 0);
    const retry = await repository.saveWithEvent(advanced, event, 0);

    expect(first.ok).toBe(true);
    expect(retry.ok).toBe(false);

    // Un seul avancement dans le journal : l'unité n'a pas sauté deux étapes.
    const events = await repository.eventsForUnit('u-1');
    expect(events.filter((e) => e.type === 'unit.step_advanced')).toHaveLength(1);
  });

  it('signale un conflit lisible quand l’unité visée n’existe pas', async () => {
    const result = await repository.saveWithEvent(
      makeUnit({ id: 'jamais-cree', publicCode: 'SUB-2026-0777', version: 1 }),
      advanceEvent('e-x', 'incubation', '2026-08-02T08:00:00.000Z'),
      0,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('CONFLICT');
    // Aucune version en base : le message le dit franchement plutôt que
    // d'inventer un numéro.
    expect(result.error.message).toContain('-1');
  });

  it('n’écrit pas l’événement quand le verrou rejette l’écriture', async () => {
    await repository.saveWithEvent(
      makeUnit({ currentStepId: 'fructification', version: 1 }),
      advanceEvent('e-99', 'fructification', '2026-08-03T08:00:00.000Z'),
      42,
    );

    const events = await repository.eventsForUnit('u-1');
    expect(events.map((e) => e.id)).not.toContain('e-99');
  });
});

/**
 * L'assertion centrale du rapport d'audit (docs/22 §6.3), vérifiée ici contre
 * une vraie base : l'état reconstruit par rejeu doit être identique à l'état
 * stocké. C'est ce contrôle qui rend la promesse de traçabilité vérifiable
 * plutôt que déclarative.
 */
describe('audit — état stocké et journal restent d’accord', () => {
  it('ne diverge sur aucun champ après un cycle d’écritures', async () => {
    await repository.create(makeUnit(), birthEvent());
    await repository.saveWithEvent(
      makeUnit({
        currentStepId: 'incubation',
        // L'entrée dans l'étape date de l'avancement, pas de la création :
        // c'est précisément ce que le rejeu recalcule, et toute divergence
        // ici signalerait un double-write incohérent.
        currentStepEnteredAt: '2026-08-02T08:00:00.000Z',
        version: 1,
        updatedAt: '2026-08-02T08:00:00.000Z',
      }),
      advanceEvent('e-2', 'incubation', '2026-08-02T08:00:00.000Z'),
      0,
    );
    await repository.saveWithEvent(
      makeUnit({
        currentStepId: 'incubation',
        currentStepEnteredAt: '2026-08-02T08:00:00.000Z',
        version: 2,
        location: { roomId: 'chambre-1', shelf: 'A', level: '2' },
        updatedAt: '2026-08-03T08:00:00.000Z',
      }),
      {
        id: 'e-3',
        type: 'unit.moved',
        occurredAt: '2026-08-03T08:00:00.000Z',
        recordedAt: '2026-08-03T08:00:00.000Z',
        source: 'qr_scan',
        unitId: 'u-1',
        payload: { to: { roomId: 'chambre-1', shelf: 'A', level: '2' } },
      },
      1,
    );

    const stored = await repository.findById('u-1');
    const events = await repository.eventsForUnit('u-1');
    expect(stored).not.toBeNull();
    if (stored === null) return;

    const replayed = replayUnit(events);
    expect(replayed.ok).toBe(true);
    if (!replayed.ok) return;

    // Assertion n°3 du rapport d'audit.
    expect(diffReplayAgainstStored(replayed.value, stored)).toEqual([]);
    // Assertions n°4 et n°5.
    expect(checkJournalIntegrity(events)).toEqual([]);
    // Assertion n°4 : une mutation d'état = un événement.
    expect(events).toHaveLength(3);
  });

  it('relit fidèlement des événements de types différents', async () => {
    await repository.create(makeUnit(), birthEvent());
    await repository.saveWithEvent(
      makeUnit({ version: 1 }),
      {
        id: 'e-obs',
        type: 'unit.observed',
        occurredAt: '2026-08-02T09:00:00.000Z',
        recordedAt: '2026-08-02T09:00:00.000Z',
        source: 'manual',
        unitId: 'u-1',
        payload: { kind: 'contamination', severity: 'critical', photoId: 'f-1' },
      },
      0,
    );

    const events = await repository.eventsForUnit('u-1');
    const observation = events.find((e) => e.type === 'unit.observed');
    expect(observation?.type).toBe('unit.observed');
    if (observation?.type !== 'unit.observed') return;
    expect(observation.payload.severity).toBe('critical');
    expect(observation.payload.photoId).toBe('f-1');
  });

  it('ordonne le journal par instant de survenue', async () => {
    await repository.create(makeUnit(), birthEvent());
    await repository.saveWithEvent(
      makeUnit({ version: 1 }),
      advanceEvent('e-late', 'incubation', '2026-08-10T08:00:00.000Z'),
      0,
    );
    await repository.saveWithEvent(
      makeUnit({ version: 2 }),
      advanceEvent('e-early', 'incubation', '2026-08-05T08:00:00.000Z'),
      1,
    );

    const events = await repository.eventsForUnit('u-1');
    expect(events.map((e) => e.id)).toEqual(['e-1', 'e-early', 'e-late']);
  });
});
