import { appError } from '@champi/contracts';
import { err, formatPublicCode, makeToken, ok, type Result } from '@champi/domain';
import type { Collection, Db } from 'mongodb';
import type { MongoConnection } from './client.js';

/**
 * Registre central des QR et attribution des codes publics.
 *
 * Deux responsabilités qui doivent être **atomiques**, sinon deux unités
 * finissent avec le même code ou le même token :
 *
 * 1. la séquence de code public, par préfixe et par année ;
 * 2. l'unicité du token, garantie par un index unique plutôt que par un
 *    « vérifier puis insérer » qui laisserait une fenêtre de course.
 */

export type QrTargetType = 'unit' | 'harvest' | 'product' | 'room';

interface QrDocument {
  _id: string;
  targetType: QrTargetType;
  targetId: string;
  createdAt: string;
  /** Nombre d'impressions, réimpressions comprises. Le token, lui, ne change jamais. */
  printCount: number;
}

interface CounterDocument {
  _id: string;
  sequence: number;
}

export interface QrEntry {
  readonly token: string;
  readonly targetType: QrTargetType;
  readonly targetId: string;
  readonly createdAt: string;
  readonly printCount: number;
}

/** Nombre de tentatives avant de conclure à autre chose qu'une collision. */
const TOKEN_COLLISION_RETRIES = 5;

export class QrRepository {
  private readonly registry: Collection<QrDocument>;
  private readonly counters: Collection<CounterDocument>;

  constructor(connection: MongoConnection) {
    const db: Db = connection.db;
    this.registry = db.collection<QrDocument>('qrRegistry');
    this.counters = db.collection<CounterDocument>('counters');
  }

  async ensureIndexes(): Promise<void> {
    await this.registry.createIndexes([
      { key: { targetType: 1, targetId: 1 }, unique: true },
      { key: { targetId: 1 } },
    ]);
  }

  /**
   * Réserve le prochain numéro de séquence, atomiquement.
   *
   * `findOneAndUpdate` avec `$inc` et `upsert` : deux créations simultanées
   * obtiennent deux numéros différents, sans verrou applicatif.
   */
  async nextSequence(prefix: string, year: number): Promise<number> {
    const key = `publicCode:${prefix}:${String(year)}`;
    const updated = await this.counters.findOneAndUpdate(
      { _id: key },
      { $inc: { sequence: 1 } },
      { upsert: true, returnDocument: 'after' },
    );
    // `upsert: true` combiné à `returnDocument: 'after'` garantit un document :
    // Mongo vient soit de le créer, soit de l'incrémenter.
    //
    // Une valeur de repli serait pire que l'assertion : retomber sur 1
    // redistribuerait une séquence déjà attribuée, donc un code public en
    // double — exactement ce que ce compteur existe pour empêcher.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return updated!.sequence;
  }

  /** Attribue un code public à partir d'un préfixe et d'une année. */
  async allocatePublicCode(prefix: string, year: number): Promise<Result<string>> {
    const sequence = await this.nextSequence(prefix, year);
    return formatPublicCode(prefix, year, sequence);
  }

  /**
   * Enregistre un QR pour une cible.
   *
   * L'unicité du token est garantie par la clé primaire : en cas de collision
   * — astronomiquement improbable sur 109 bits, mais pas impossible si la
   * source d'aléa est défaillante — on retente plutôt que d'écraser.
   */
  async register(
    targetType: QrTargetType,
    targetId: string,
    randomBytes: (length: number) => Uint8Array,
    nowIso: string,
  ): Promise<Result<QrEntry>> {
    for (let attempt = 0; attempt < TOKEN_COLLISION_RETRIES; attempt += 1) {
      const token = makeToken(randomBytes);
      if (!token.ok) {
        return token;
      }
      const document: QrDocument = {
        _id: token.value,
        targetType,
        targetId,
        createdAt: nowIso,
        printCount: 0,
      };
      try {
        await this.registry.insertOne(document);
        return ok(toEntry(document));
      } catch (cause) {
        if (!isDuplicateKey(cause)) {
          throw cause;
        }
        // Collision sur `targetType + targetId` : la cible a déjà un QR.
        const existing = await this.findByTarget(targetType, targetId);
        if (existing !== null) {
          return err(
            appError('CONFLICT', `Un QR existe déjà pour ${targetType} « ${targetId} ».`, {
              hint: `Le token d'une cible ne change jamais — réimprime le QR existant (${existing.token}) plutôt que d'en créer un nouveau.`,
              path: 'targetId',
            }),
          );
        }
        // Sinon c'est une collision de token : on retente avec un autre.
      }
    }
    return err(
      appError(
        'CONFLICT',
        `Impossible de générer un token unique après ${String(TOKEN_COLLISION_RETRIES)} tentatives.`,
        { hint: 'La source d’aléa est probablement défaillante : vérifie le générateur.' },
      ),
    );
  }

  /** Résout un token scanné. */
  async resolve(token: string): Promise<QrEntry | null> {
    const document = await this.registry.findOne({ _id: token });
    return document === null ? null : toEntry(document);
  }

  async findByTarget(targetType: QrTargetType, targetId: string): Promise<QrEntry | null> {
    const document = await this.registry.findOne({ targetType, targetId });
    return document === null ? null : toEntry(document);
  }

  /**
   * Incrémente le compteur d'impressions.
   *
   * Le **token reste identique** : une étiquette abîmée se réimprime à
   * l'identique (`q17_5`). Seul le compteur bouge, pour savoir combien
   * d'étiquettes physiques circulent pour une même unité.
   */
  async recordPrint(token: string): Promise<Result<number>> {
    const updated = await this.registry.findOneAndUpdate(
      { _id: token },
      { $inc: { printCount: 1 } },
      { returnDocument: 'after' },
    );
    if (updated === null) {
      return err(
        appError('NOT_FOUND', `Le token « ${token} » n'existe pas dans le registre.`, {
          hint: 'Un QR doit être enregistré avant d’être imprimé.',
          path: 'token',
        }),
      );
    }
    return ok(updated.printCount);
  }
}

function toEntry(document: QrDocument): QrEntry {
  return {
    token: document._id,
    targetType: document.targetType,
    targetId: document.targetId,
    createdAt: document.createdAt,
    printCount: document.printCount,
  };
}

function isDuplicateKey(cause: unknown): boolean {
  return typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === 11000;
}
