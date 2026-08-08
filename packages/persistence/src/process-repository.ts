import {
  appError,
  processTemplateSchema,
  processVersionSchema,
  type ProcessTemplate,
  type ProcessVersion,
} from '@champi/contracts';
import { err, ok, type Result } from '@champi/domain';
import type { Collection, Db } from 'mongodb';
import type { MongoConnection } from './client.js';

/**
 * Dépôt des modèles de process et de leurs versions.
 *
 * Règle tenue ici : **une version publiée ne se réécrit jamais**. Le dépôt
 * refuse toute mise à jour d'une version publiée, en plus du refus déjà porté
 * par le domaine (`editVersionGraph`). Deux barrières valent mieux qu'une quand
 * l'invariant conditionne la comparaison entre versions (docs/21 §2).
 */

interface TemplateDocument extends Omit<ProcessTemplate, 'id'> {
  _id: string;
}

interface VersionDocument extends Omit<ProcessVersion, 'id'> {
  _id: string;
}

function templateToDomain(document: TemplateDocument): ProcessTemplate {
  const { _id, ...rest } = document;
  return processTemplateSchema.parse({ ...rest, id: _id });
}

function versionToDomain(document: VersionDocument): ProcessVersion {
  const { _id, ...rest } = document;
  return processVersionSchema.parse({ ...rest, id: _id });
}

export class ProcessRepository {
  private readonly templates: Collection<TemplateDocument>;
  private readonly versions: Collection<VersionDocument>;

  constructor(connection: MongoConnection) {
    const db: Db = connection.db;
    this.templates = db.collection<TemplateDocument>('processTemplates');
    this.versions = db.collection<VersionDocument>('processVersions');
  }

  async ensureIndexes(): Promise<void> {
    await this.templates.createIndex({ name: 1 }, { unique: true });
    await this.versions.createIndexes([
      { key: { templateId: 1, versionNumber: 1 }, unique: true },
      { key: { status: 1 } },
    ]);
  }

  async saveTemplate(template: ProcessTemplate): Promise<Result<ProcessTemplate>> {
    const { id, ...rest } = template;
    try {
      // `replaceOne` prend le document sans son `_id` : celui-ci vient du filtre.
      await this.templates.replaceOne({ _id: id }, rest, { upsert: true });
      return ok(template);
    } catch (cause) {
      if (isDuplicateKey(cause)) {
        return err(
          appError('CONFLICT', `Un process nommé « ${template.name} » existe déjà.`, {
            hint: 'Choisis un autre nom, ou crée une nouvelle version du process existant.',
            path: 'name',
          }),
        );
      }
      throw cause;
    }
  }

  async findTemplate(id: string): Promise<ProcessTemplate | null> {
    const document = await this.templates.findOne({ _id: id });
    return document === null ? null : templateToDomain(document);
  }

  async listTemplates(): Promise<ProcessTemplate[]> {
    const documents = await this.templates.find({}).sort({ name: 1 }).toArray();
    return documents.map(templateToDomain);
  }

  /**
   * Enregistre une version.
   *
   * Refuse d'écraser une version **publiée** : c'est l'invariant qui rend la
   * comparaison entre versions possible. Sans lui, modifier une version
   * publiée réécrirait rétroactivement l'histoire des unités qui y sont
   * épinglées.
   */
  async saveVersion(version: ProcessVersion): Promise<Result<ProcessVersion>> {
    const existing = await this.versions.findOne({ _id: version.id });
    if (existing !== null && existing.status === 'published') {
      return err(
        appError(
          'VERSION_PUBLISHED_IMMUTABLE',
          `La version ${String(existing.versionNumber)} est publiée : elle ne peut plus être réécrite.`,
          {
            hint: 'Crée une nouvelle version. Les unités déjà lancées resteront épinglées à la leur — c’est ce qui permet de comparer les résultats.',
            path: 'versionId',
          },
        ),
      );
    }

    const { id, ...rest } = version;
    await this.versions.replaceOne({ _id: id }, rest, { upsert: true });
    return ok(version);
  }

  async findVersion(id: string): Promise<ProcessVersion | null> {
    const document = await this.versions.findOne({ _id: id });
    return document === null ? null : versionToDomain(document);
  }

  async listVersions(templateId: string): Promise<ProcessVersion[]> {
    const documents = await this.versions.find({ templateId }).sort({ versionNumber: 1 }).toArray();
    return documents.map(versionToDomain);
  }

  /** Numéro de version suivant pour un modèle. */
  async nextVersionNumber(templateId: string): Promise<number> {
    const last = await this.versions
      .find({ templateId })
      .sort({ versionNumber: -1 })
      .limit(1)
      .next();
    return last === null ? 1 : last.versionNumber + 1;
  }
}

function isDuplicateKey(cause: unknown): boolean {
  return typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === 11000;
}
