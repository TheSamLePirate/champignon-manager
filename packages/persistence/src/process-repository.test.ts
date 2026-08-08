import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ProcessTemplate, ProcessVersion } from '@champi/contracts';
import { connect, type MongoConnection } from './client.js';
import { ProcessRepository } from './process-repository.js';

const TEST_DB = `champignon_process_${String(Date.now())}`;

let connection: MongoConnection;
let repository: ProcessRepository;

const graph = {
  steps: [
    {
      id: 'inoculation',
      name: 'Inoculation',
      stage: 'substrate' as const,
      conditions: {},
      alarms: { enabled: false },
      optional: false,
      provenance: 'cultivator' as const,
    },
  ],
  transitions: [],
};

function makeTemplate(overrides: Partial<ProcessTemplate> = {}): ProcessTemplate {
  return { id: 'pt-1', name: 'Pleurote standard', speciesScope: 'any', ...overrides };
}

function makeVersion(overrides: Partial<ProcessVersion> = {}): ProcessVersion {
  return {
    id: 'pv-1',
    templateId: 'pt-1',
    versionNumber: 1,
    status: 'draft',
    graph,
    ...overrides,
  };
}

beforeAll(async () => {
  connection = await connect(undefined, TEST_DB);
  repository = new ProcessRepository(connection);
});

afterAll(async () => {
  await connection.db.dropDatabase();
  await connection.close();
});

beforeEach(async () => {
  await connection.db.collection('processTemplates').deleteMany({});
  await connection.db.collection('processVersions').deleteMany({});
  await repository.ensureIndexes();
});

describe('modèles de process', () => {
  it('enregistre et relit un modèle', async () => {
    const saved = await repository.saveTemplate(makeTemplate());
    expect(saved.ok).toBe(true);
    expect((await repository.findTemplate('pt-1'))?.name).toBe('Pleurote standard');
  });

  it('renvoie null pour un modèle inconnu', async () => {
    expect(await repository.findTemplate('inexistant')).toBeNull();
  });

  it('liste les modèles par ordre alphabétique', async () => {
    await repository.saveTemplate(makeTemplate({ id: 'pt-2', name: 'Shiitake' }));
    await repository.saveTemplate(makeTemplate({ id: 'pt-1', name: 'Pleurote' }));
    expect((await repository.listTemplates()).map((t) => t.name)).toEqual(['Pleurote', 'Shiitake']);
  });

  it('met à jour un modèle existant sans le dupliquer', async () => {
    await repository.saveTemplate(makeTemplate());
    await repository.saveTemplate(makeTemplate({ currentVersionId: 'pv-9' }));
    expect(await repository.listTemplates()).toHaveLength(1);
    expect((await repository.findTemplate('pt-1'))?.currentVersionId).toBe('pv-9');
  });

  it('refuse deux modèles de même nom', async () => {
    await repository.saveTemplate(makeTemplate());
    const duplicate = await repository.saveTemplate(makeTemplate({ id: 'pt-2' }));

    expect(duplicate.ok).toBe(false);
    if (duplicate.ok) return;
    expect(duplicate.error.code).toBe('CONFLICT');
    expect(duplicate.error.message).toContain('Pleurote standard');
    expect(duplicate.error.hint).toContain('nouvelle version');
    expect(duplicate.error.path).toBe('name');
  });

  it('laisse remonter une erreur d’infrastructure', async () => {
    const closed = await connect(undefined, TEST_DB);
    const orphan = new ProcessRepository(closed);
    await closed.close();
    await expect(orphan.saveTemplate(makeTemplate({ id: 'pt-9' }))).rejects.toThrow();
  });

  it('accepte une portée limitée à une espèce', async () => {
    await repository.saveTemplate(makeTemplate({ speciesScope: 'sp-pleurote' }));
    expect((await repository.findTemplate('pt-1'))?.speciesScope).toBe('sp-pleurote');
  });
});

describe('versions de process', () => {
  it('enregistre et relit une version', async () => {
    const saved = await repository.saveVersion(makeVersion());
    expect(saved.ok).toBe(true);
    expect((await repository.findVersion('pv-1'))?.versionNumber).toBe(1);
  });

  it('renvoie null pour une version inconnue', async () => {
    expect(await repository.findVersion('inexistante')).toBeNull();
  });

  it('modifie un brouillon', async () => {
    await repository.saveVersion(makeVersion());
    const updated = await repository.saveVersion(
      makeVersion({ graph: { steps: [], transitions: [] } }),
    );
    expect(updated.ok).toBe(true);
    expect((await repository.findVersion('pv-1'))?.graph.steps).toEqual([]);
  });

  /**
   * L'invariant central : réécrire une version publiée réécrirait
   * rétroactivement l'histoire des unités qui y sont épinglées, et rendrait la
   * comparaison entre versions mensongère.
   */
  it('refuse de réécrire une version publiée', async () => {
    await repository.saveVersion(
      makeVersion({ status: 'published', publishedAt: '2026-08-08T10:00:00.000Z' }),
    );
    const overwrite = await repository.saveVersion(
      makeVersion({ status: 'published', graph: { steps: [], transitions: [] } }),
    );

    expect(overwrite.ok).toBe(false);
    if (overwrite.ok) return;
    expect(overwrite.error.code).toBe('VERSION_PUBLISHED_IMMUTABLE');
    expect(overwrite.error.message).toContain('publiée');
    expect(overwrite.error.hint).toContain('épinglées');
    expect(overwrite.error.path).toBe('versionId');

    // Le graphe d'origine est intact.
    expect((await repository.findVersion('pv-1'))?.graph.steps).toHaveLength(1);
  });

  it('liste les versions d’un modèle dans l’ordre', async () => {
    await repository.saveVersion(makeVersion({ id: 'pv-2', versionNumber: 2 }));
    await repository.saveVersion(makeVersion({ id: 'pv-1', versionNumber: 1 }));
    expect((await repository.listVersions('pt-1')).map((v) => v.versionNumber)).toEqual([1, 2]);
  });

  it('ne mélange pas les versions de modèles différents', async () => {
    await repository.saveVersion(makeVersion());
    await repository.saveVersion(makeVersion({ id: 'pv-x', templateId: 'pt-autre' }));
    expect(await repository.listVersions('pt-1')).toHaveLength(1);
  });

  it('donne 1 comme premier numéro de version', async () => {
    expect(await repository.nextVersionNumber('pt-1')).toBe(1);
  });

  it('incrémente le numéro de version suivant', async () => {
    await repository.saveVersion(makeVersion({ id: 'pv-1', versionNumber: 1 }));
    await repository.saveVersion(makeVersion({ id: 'pv-3', versionNumber: 3 }));
    // On repart du plus haut numéro, pas du nombre de versions.
    expect(await repository.nextVersionNumber('pt-1')).toBe(4);
  });
});

describe('index', () => {
  it('rend le nom de modèle unique', async () => {
    const indexes = await connection.db.collection('processTemplates').indexes();
    const unique = indexes.find((i) => JSON.stringify(i.key) === JSON.stringify({ name: 1 }));
    expect(unique?.unique).toBe(true);
  });

  it('rend le couple modèle/numéro de version unique', async () => {
    const indexes = await connection.db.collection('processVersions').indexes();
    const unique = indexes.find(
      (i) => JSON.stringify(i.key) === JSON.stringify({ templateId: 1, versionNumber: 1 }),
    );
    expect(unique?.unique).toBe(true);
  });

  it('crée l’index de statut', async () => {
    const keys = (await connection.db.collection('processVersions').indexes()).map((i) =>
      JSON.stringify(i.key),
    );
    expect(keys).toContain(JSON.stringify({ status: 1 }));
  });
});
