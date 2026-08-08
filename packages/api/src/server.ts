import {
  connect,
  ProcessRepository,
  QrRepository,
  UnitRepository,
  type MongoConnection,
} from '@champi/persistence';
import { InMemoryTransport, PrintQueue, type PrintTransport } from '@champi/printing';
import type { Hono } from 'hono';
import { createApp, ensureApiIndexes } from './app.js';

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
}

export interface AssembledServer {
  readonly app: Hono;
  readonly connection: MongoConnection;
  readonly transport: PrintTransport;
  close(): Promise<void>;
}

/** Construit l'application complète et prépare la base. */
export async function assembleServer(options: ServerOptions = {}): Promise<AssembledServer> {
  const connection = await connect(options.mongoUrl, options.dbName);

  const units = new UnitRepository(connection);
  const qr = new QrRepository(connection);
  const processes = new ProcessRepository(connection);

  await units.ensureIndexes();
  await qr.ensureIndexes();
  await processes.ensureIndexes();
  await ensureApiIndexes(connection);

  const transport = options.transport ?? new InMemoryTransport();

  const app = createApp({
    connection,
    units,
    qr,
    processes,
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

  return {
    app,
    connection,
    transport,
    close: () => connection.close(),
  };
}
