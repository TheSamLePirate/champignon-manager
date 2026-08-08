import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { ProcessGraph } from '@champi/contracts';
import { connect, ProcessRepository, type MongoConnection } from '@champi/persistence';
import { seedDefaultProcess, SEED_TEMPLATE_NAME } from './seed.js';

/**
 * Tests d'amorçage, contre une vraie base.
 *
 * Deux propriétés comptent réellement à la mise en service :
 *
 * 1. une base neuve devient **utilisable sans rien saisir** ;
 * 2. une base déjà peuplée n'est **jamais** touchée — un amorçage qui écrase le
 *    travail du cultivateur serait pire que l'écran vide qu'il évite.
 */

const TEST_DB = `champignon_seed_${String(Date.now())}`;

const connection: MongoConnection = await connect(undefined, TEST_DB);
const processes = new ProcessRepository(connection);
await processes.ensureIndexes();

let idCounter = 0;
const deps = {
  processes,
  newId: () => {
    idCounter += 1;
    return `seed-${String(idCounter)}`;
  },
  now: () => '2026-08-08T10:00:00.000Z',
};

beforeEach(async () => {
  await connection.db.collection('processTemplates').deleteMany({});
  await connection.db.collection('processVersions').deleteMany({});
  idCounter = 0;
});

afterAll(async () => {
  await connection.db.dropDatabase();
  await connection.close();
});

describe('seedDefaultProcess sur une base neuve', () => {
  it('installe un process publié, immédiatement utilisable', async () => {
    const outcome = await seedDefaultProcess(deps);

    expect(outcome.seeded).toBe(true);
    const templates = await processes.listTemplates();
    expect(templates.map((template) => template.name)).toEqual([SEED_TEMPLATE_NAME]);

    // Publié, pas brouillon : sans cela, la première unité serait impossible à
    // créer et l'amorçage n'aurait rien résolu.
    const version = await processes.findVersion(templates[0]?.currentVersionId ?? '');
    expect(version?.status).toBe('published');
    expect(version?.publishedAt).toBe('2026-08-08T10:00:00.000Z');
  });

  it('installe le process à six étapes de production du cultivateur', async () => {
    await seedDefaultProcess(deps);

    const [template] = await processes.listTemplates();
    const version = await processes.findVersion(template?.currentVersionId ?? '');
    const production = (version?.graph.steps ?? []).filter((step) =>
      ['substrate', 'fruiting'].includes(step.stage),
    );

    // Le process réel fait six étapes, pas treize : les incubations 1/2/3 et
    // les fructifications 1/2 sont « sans différence » (export v8 du 30/07).
    expect(production.map((step) => step.id)).toEqual([
      'inoculation',
      'incubation',
      'fructification',
      'flush_1',
      'flush_2',
      'flush_3',
      'fin_de_cycle',
    ]);
  });

  it('accompagne le modèle de son avertissement', async () => {
    const outcome = await seedDefaultProcess(deps);

    // Les valeurs inventées ne doivent pas se faire passer pour des
    // recommandations : l'avertissement voyage avec le modèle.
    expect(outcome.seeded && outcome.disclaimer).toMatch(/exemple à ajuster/);
    expect(outcome.reason).toMatch(/utilisable immédiatement/);
  });

  it('accepte un modèle importé plutôt que le modèle par défaut', async () => {
    const imported: ProcessGraph = {
      steps: [
        {
          id: 'unique',
          name: 'Étape importée',
          stage: 'substrate',
          conditions: {},
          alarms: { enabled: false },
          optional: false,
          provenance: 'cultivator',
        },
      ],
      transitions: [],
    };

    await seedDefaultProcess(deps, imported);

    const [template] = await processes.listTemplates();
    const version = await processes.findVersion(template?.currentVersionId ?? '');
    expect(version?.graph.steps.map((step) => step.id)).toEqual(['unique']);
  });
});

describe('seedDefaultProcess sur une base déjà peuplée', () => {
  it('ne touche à rien et le dit', async () => {
    await processes.saveTemplate({
      id: 'existant',
      name: 'Process du cultivateur',
      speciesScope: 'any',
      currentVersionId: 'v-existante',
    });

    const outcome = await seedDefaultProcess(deps);

    expect(outcome.seeded).toBe(false);
    expect(outcome.reason).toMatch(/contient déjà 1 process/);
    // Le process du cultivateur est intact et reste seul.
    expect((await processes.listTemplates()).map((template) => template.name)).toEqual([
      'Process du cultivateur',
    ]);
  });

  it('reste inerte quand on le rejoue — un redémarrage n’ajoute rien', async () => {
    await seedDefaultProcess(deps);
    const second = await seedDefaultProcess(deps);
    const third = await seedDefaultProcess(deps);

    expect(second.seeded).toBe(false);
    expect(third.seeded).toBe(false);
    expect(await processes.listTemplates()).toHaveLength(1);
  });
});

describe('seedDefaultProcess refuse d’installer un modèle bancal', () => {
  it('refuse un graphe invalide sans rien écrire', async () => {
    const cassé: ProcessGraph = {
      steps: [],
      transitions: [],
    };

    const outcome = await seedDefaultProcess(deps, cassé);

    expect(outcome.seeded).toBe(false);
    expect(outcome.reason).toMatch(/n'a pas pu être publié/);
    // Rien d'écrit : un amorçage refusé laisse la base exactement comme il
    // l'a trouvée, sinon le démarrage suivant se croirait déjà amorcé.
    expect(await processes.listTemplates()).toEqual([]);
    expect(await connection.db.collection('processVersions').countDocuments()).toBe(0);
  });
});

/**
 * Démarrage concurrent.
 *
 * Docker Compose relance un conteneur, ou le serveur et un outil d'exploitation
 * démarrent ensemble : deux amorçages lisent une base vide, puis écrivent. Le
 * second doit échouer proprement, pas laisser la base à moitié installée.
 *
 * On simule la course en faisant mentir la seule lecture concernée. La base,
 * elle, est réelle : c'est bien son index unique qui produit le conflit.
 */
describe('seedDefaultProcess face à un démarrage concurrent', () => {
  it('renonce quand un autre démarrage a déjà posé le modèle', async () => {
    await seedDefaultProcess(deps);

    const aveugle: ProcessRepository = Object.assign(
      Object.create(processes) as ProcessRepository,
      {
        listTemplates: () => Promise.resolve([]),
      },
    );

    const outcome = await seedDefaultProcess({ ...deps, processes: aveugle });

    expect(outcome.seeded).toBe(false);
    expect(outcome.reason).toMatch(/n'a pas pu être enregistré/);
    expect(outcome).toHaveProperty('failure', expect.stringContaining('existe déjà'));
    // Le modèle installé par le premier démarrage reste seul et intact.
    expect(await processes.listTemplates()).toHaveLength(1);
  });

  it('renonce quand l’identifiant de version est déjà pris par une version publiée', async () => {
    // Le premier amorçage consomme `seed-1` et `seed-2` ; on rejoue avec le
    // même compteur, donc la version publiée existe déjà sous ce même
    // identifiant.
    await seedDefaultProcess(deps);
    idCounter = 0;

    const aveugle: ProcessRepository = Object.assign(
      Object.create(processes) as ProcessRepository,
      {
        listTemplates: () => Promise.resolve([]),
      },
    );

    const outcome = await seedDefaultProcess({ ...deps, processes: aveugle });

    expect(outcome.seeded).toBe(false);
    // Une version publiée ne se réécrit jamais : l'amorçage s'arrête avant
    // d'avoir touché au modèle.
    expect(outcome).toHaveProperty('failure', expect.stringContaining('publiée'));
    expect(await processes.listTemplates()).toHaveLength(1);
  });
});
