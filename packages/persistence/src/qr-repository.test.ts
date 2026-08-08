import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TOKEN_LENGTH } from '@champi/domain';
import { connect, type MongoConnection } from './client.js';
import { QrRepository } from './qr-repository.js';

const TEST_DB = `champignon_qr_${String(Date.now())}`;
const NOW = '2026-08-08T10:00:00.000Z';

let connection: MongoConnection;
let repository: QrRepository;

/** Source d'aléa déterministe, pilotable par test. */
function fixedBytes(seed: number): (length: number) => Uint8Array {
  return (length) => Uint8Array.from({ length }, (_, index) => (seed + index) % 256);
}

beforeAll(async () => {
  connection = await connect(undefined, TEST_DB);
  repository = new QrRepository(connection);
});

afterAll(async () => {
  await connection.db.dropDatabase();
  await connection.close();
});

beforeEach(async () => {
  await connection.db.collection('qrRegistry').deleteMany({});
  await connection.db.collection('counters').deleteMany({});
  await repository.ensureIndexes();
});

describe('codes publics', () => {
  it('attribue des numéros successifs', async () => {
    expect(await repository.allocatePublicCode('SUB', 2026)).toEqual({
      ok: true,
      value: 'SUB-2026-0001',
    });
    expect(await repository.allocatePublicCode('SUB', 2026)).toEqual({
      ok: true,
      value: 'SUB-2026-0002',
    });
  });

  it('tient un compteur distinct par préfixe', async () => {
    await repository.allocatePublicCode('SUB', 2026);
    expect(await repository.allocatePublicCode('GEL', 2026)).toEqual({
      ok: true,
      value: 'GEL-2026-0001',
    });
  });

  it('tient un compteur distinct par année', async () => {
    await repository.allocatePublicCode('SUB', 2026);
    expect(await repository.allocatePublicCode('SUB', 2027)).toEqual({
      ok: true,
      value: 'SUB-2027-0001',
    });
  });

  /**
   * Deux créations simultanées ne doivent **jamais** obtenir le même numéro :
   * deux unités partageant un code public rendraient la traçabilité ambiguë,
   * et l'index unique refuserait la seconde en production.
   */
  it('n’attribue jamais deux fois le même numéro, même en parallèle', async () => {
    const codes = await Promise.all(
      Array.from({ length: 25 }, () => repository.allocatePublicCode('SUB', 2026)),
    );
    const values = codes.map((c) => (c.ok ? c.value : 'échec'));
    expect(new Set(values).size).toBe(25);
    expect(values).not.toContain('échec');
  });
});

describe('registre QR', () => {
  it('enregistre un token pour une unité', async () => {
    const result = await repository.register('unit', 'u-1', fixedBytes(0), NOW);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.token).toHaveLength(TOKEN_LENGTH);
    expect(result.value.targetType).toBe('unit');
    expect(result.value.targetId).toBe('u-1');
    expect(result.value.printCount).toBe(0);
  });

  it('résout un token scanné vers sa cible', async () => {
    const created = await repository.register('unit', 'u-1', fixedBytes(0), NOW);
    if (!created.ok) return;

    const resolved = await repository.resolve(created.value.token);
    expect(resolved?.targetId).toBe('u-1');
  });

  it('renvoie null pour un token inconnu', async () => {
    expect(await repository.resolve('ZZZZZZZZZZZZZZZZZZZZZZ')).toBeNull();
  });

  it('retrouve le QR d’une cible', async () => {
    await repository.register('unit', 'u-1', fixedBytes(0), NOW);
    expect((await repository.findByTarget('unit', 'u-1'))?.targetId).toBe('u-1');
  });

  it('renvoie null quand la cible n’a pas de QR', async () => {
    expect(await repository.findByTarget('unit', 'jamais-vue')).toBeNull();
  });

  it('accepte des cibles de types différents portant le même identifiant', async () => {
    await repository.register('unit', 'x-1', fixedBytes(0), NOW);
    const harvest = await repository.register('harvest', 'x-1', fixedBytes(40), NOW);
    expect(harvest.ok).toBe(true);
  });

  /**
   * Une unité n'a qu'un seul QR, à vie. Regénérer un token casserait le lien
   * avec l'étiquette déjà collée sur l'objet physique.
   */
  it('refuse un second QR pour la même cible, et indique le token existant', async () => {
    const first = await repository.register('unit', 'u-1', fixedBytes(0), NOW);
    if (!first.ok) return;

    const second = await repository.register('unit', 'u-1', fixedBytes(40), NOW);
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe('CONFLICT');
    expect(second.error.hint).toContain(first.value.token);
    expect(second.error.hint).toContain('ne change jamais');
    expect(second.error.path).toBe('targetId');
  });

  /**
   * Même principe que pour les unités : une panne d'infrastructure remonte
   * telle quelle. La confondre avec « cette cible a déjà un QR » afficherait un
   * message faux et masquerait la panne.
   */
  it('laisse remonter une erreur d’infrastructure au lieu de la déguiser', async () => {
    const closed = await connect(undefined, TEST_DB);
    const orphan = new QrRepository(closed);
    await closed.close();

    await expect(orphan.register('unit', 'u-9', fixedBytes(0), NOW)).rejects.toThrow();
  });

  it('remonte l’échec d’une source d’aléa défaillante', async () => {
    const result = await repository.register('unit', 'u-2', () => new Uint8Array(3), NOW);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('3 octets');
  });

  /**
   * Collision de token : la même source d'aléa produit le même token pour deux
   * cibles différentes. On doit retenter, pas écraser le QR existant.
   */
  it('retente sur collision de token plutôt que d’écraser', async () => {
    await repository.register('unit', 'u-1', fixedBytes(0), NOW);

    let call = 0;
    const collidesOnce = (length: number): Uint8Array => {
      call += 1;
      // Premier appel : le même token que u-1. Ensuite : un token différent.
      return fixedBytes(call === 1 ? 0 : 40)(length);
    };

    const result = await repository.register('unit', 'u-2', collidesOnce, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(call).toBe(2);
    expect((await repository.resolve(result.value.token))?.targetId).toBe('u-2');
    // Le QR de u-1 est intact.
    expect((await repository.findByTarget('unit', 'u-1'))?.targetId).toBe('u-1');
  });

  it('abandonne si la source d’aléa produit toujours le même token', async () => {
    await repository.register('unit', 'u-1', fixedBytes(0), NOW);
    const result = await repository.register('unit', 'u-2', fixedBytes(0), NOW);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('5 tentatives');
    expect(result.error.hint).toContain('défaillante');
  });
});

describe('compteur d’impressions', () => {
  it('incrémente sans changer le token', async () => {
    const created = await repository.register('unit', 'u-1', fixedBytes(0), NOW);
    if (!created.ok) return;
    const token = created.value.token;

    expect(await repository.recordPrint(token)).toEqual({ ok: true, value: 1 });
    expect(await repository.recordPrint(token)).toEqual({ ok: true, value: 2 });

    // Réimprimer ne fabrique pas un nouveau token : c'est tout l'enjeu.
    expect((await repository.resolve(token))?.token).toBe(token);
  });

  it('refuse d’imprimer un token absent du registre', async () => {
    const result = await repository.recordPrint('ZZZZZZZZZZZZZZZZZZZZZZ');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NOT_FOUND');
    expect(result.error.hint).toContain('enregistré avant');
    expect(result.error.path).toBe('token');
  });
});

describe('index', () => {
  it('crée l’index unique sur la cible', async () => {
    const indexes = await connection.db.collection('qrRegistry').indexes();
    const unique = indexes.find(
      (i) => JSON.stringify(i.key) === JSON.stringify({ targetType: 1, targetId: 1 }),
    );
    expect(unique?.unique).toBe(true);
  });

  it('crée l’index de recherche par cible', async () => {
    const keys = (await connection.db.collection('qrRegistry').indexes()).map((i) =>
      JSON.stringify(i.key),
    );
    expect(keys).toContain(JSON.stringify({ targetId: 1 }));
  });
});
