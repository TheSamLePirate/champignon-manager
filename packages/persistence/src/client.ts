import { MongoClient, type Db, type ClientSession } from 'mongodb';

/**
 * Connexion MongoDB.
 *
 * Le **replica set** n'est pas là pour la haute disponibilité : il est exigé
 * par les transactions, et toute écriture « état courant + événement » en est
 * une (docs/06, docs/22 §2.4). Sans transaction, le double-write pourrait
 * laisser un état sans son événement — et la traçabilité mentirait
 * silencieusement.
 */

export interface MongoConnection {
  readonly client: MongoClient;
  readonly db: Db;
  close(): Promise<void>;
}

/**
 * Port 27018 et non 27017 : une installation MongoDB locale occupe souvent déjà
 * 27017 et intercepterait la connexion en silence (voir docker/docker-compose.yml).
 */
export const DEFAULT_MONGO_URL =
  process.env['CHAMPI_MONGO_URL'] ?? 'mongodb://localhost:27018/?replicaSet=rs0';
export const DEFAULT_DB_NAME = process.env['CHAMPI_DB_NAME'] ?? 'champignon';

export async function connect(
  url: string = DEFAULT_MONGO_URL,
  dbName: string = DEFAULT_DB_NAME,
): Promise<MongoConnection> {
  const client = new MongoClient(url);
  await client.connect();
  return {
    client,
    db: client.db(dbName),
    close: () => client.close(),
  };
}

/**
 * Exécute un travail dans une transaction.
 *
 * Toute méthode d'écriture qui touche à la fois l'état courant et le journal
 * passe par ici. C'est le seul endroit où une transaction est ouverte, pour
 * qu'il n'existe pas de chemin d'écriture non transactionnel.
 */
export async function withTransaction<T>(
  connection: MongoConnection,
  work: (session: ClientSession) => Promise<T>,
): Promise<T> {
  const session = connection.client.startSession();
  try {
    return await session.withTransaction(() => work(session));
  } finally {
    await session.endSession();
  }
}
