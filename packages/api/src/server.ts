import {
  connect,
  HarvestRepository,
  ProcessRepository,
  QrRepository,
  UnitRepository,
  type MongoConnection,
} from '@champi/persistence';
import { InMemoryTransport, PrintQueue, type PrintTransport } from '@champi/printing';
import type { Hono } from 'hono';
import { createApp, ensureApiIndexes } from './app.js';
import { seedDefaultProcess, type SeedOutcome } from './seed.js';

/**
 * Assemblage du serveur.
 *
 * C'est **le seul endroit** où l'application touche à l'horloge, à l'aléa et
 * au réseau. Tout le reste les reçoit en paramètre — c'est ce qui rend le
 * domaine testable sans mock et l'API testable sans serveur (docs/22 §2.1).
 */

export interface ServerOptions {
  readonly mongoUrl?: string;
  readonly dbName?: string;
  /** Transport d'impression. Le faux transport sert au développement et aux E2E. */
  readonly transport?: PrintTransport;
  /**
   * Installe le modèle de process par défaut si la base est vierge.
   *
   * Faux par défaut : un test doit poser lui-même ses données, sinon il
   * vérifierait un état qu'il n'a pas construit. Le point d'entrée de
   * production, lui, l'active — c'est ce qui évite l'écran vide à la mise en
   * service.
   */
  readonly seed?: boolean;
}

export interface AssembledServer {
  readonly app: Hono;
  readonly connection: MongoConnection;
  readonly transport: PrintTransport;
  /** Résultat de l'amorçage, à journaliser au démarrage. */
  readonly seed: SeedOutcome | undefined;
  close(): Promise<void>;
}

/** Construit l'application complète et prépare la base. */
export async function assembleServer(options: ServerOptions = {}): Promise<AssembledServer> {
  const connection = await connect(options.mongoUrl, options.dbName);

  const units = new UnitRepository(connection);
  const qr = new QrRepository(connection);
  const processes = new ProcessRepository(connection);
  const harvests = new HarvestRepository(connection);

  await units.ensureIndexes();
  await qr.ensureIndexes();
  await processes.ensureIndexes();
  await harvests.ensureIndexes();
  await ensureApiIndexes(connection);

  const transport = options.transport ?? new InMemoryTransport();

  const app = createApp({
    connection,
    units,
    qr,
    processes,
    harvests,
    printQueue: new PrintQueue(transport),
    now: () => new Date().toISOString(),
    newId: () => crypto.randomUUID(),
    randomBytes: (length) => crypto.getRandomValues(new Uint8Array(length)),
    // Le graphe vient de la version **épinglée** à l'unité, jamais de la
    // version courante du modèle : c'est ce qui garantit qu'une publication
    // ne déplace aucune unité en cours (docs/21 §2).
    graphForVersion: async (versionId) => {
      const version = await processes.findVersion(versionId);
      return version?.graph ?? null;
    },
  });

  // Après les index, jamais avant : l'amorçage s'appuie sur l'unicité du nom
  // de process pour renoncer proprement si un autre démarrage l'a devancé.
  const seed =
    options.seed === true
      ? await seedDefaultProcess({
          processes,
          newId: () => crypto.randomUUID(),
          now: () => new Date().toISOString(),
        })
      : undefined;

  return {
    app,
    connection,
    transport,
    seed,
    close: () => connection.close(),
  };
}
