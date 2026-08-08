import { appError, type ProcessGraph, type ProcessVersion } from '@champi/contracts';
import { err, ok, type Result } from '../result.js';
import { validateProcessGraph } from './graph.js';

/**
 * Cycle de vie d'une version de process.
 *
 * Décision du 2026-08-08 (docs/21 §2) — **la comparaison entre versions
 * l'emporte sur la bascule** :
 *
 * - une version publiée est **immuable** ; toute modification crée une version ;
 * - une unité reste **épinglée** à sa version jusqu'à la fin de son cycle ;
 * - publier **n'affecte aucune unité en cours** ;
 * - migrer est possible, mais **explicite, manuel et par sélection**.
 *
 * C'est ce qui préserve une population témoin et rend la comparaison possible.
 */

/** Modifie le graphe d'une version. Refusé si la version est publiée. */
export function editVersionGraph(
  version: ProcessVersion,
  graph: ProcessGraph,
): Result<ProcessVersion> {
  if (version.status === 'published') {
    return err(
      appError(
        'VERSION_PUBLISHED_IMMUTABLE',
        `La version ${String(version.versionNumber)} est publiée : elle ne peut plus être modifiée.`,
        {
          hint: 'Crée une nouvelle version à partir de celle-ci. Les unités en cours resteront épinglées à leur version — c’est ce qui permet de comparer les résultats entre versions.',
          path: 'versionId',
        },
      ),
    );
  }
  return ok({ ...version, graph });
}

/** Publie une version après validation de son graphe. Le gel est définitif. */
export function publishVersion(
  version: ProcessVersion,
  publishedAtIso: string,
): Result<ProcessVersion> {
  if (version.status === 'published') {
    return err(
      appError(
        'VERSION_PUBLISHED_IMMUTABLE',
        `La version ${String(version.versionNumber)} est déjà publiée.`,
        { hint: 'Crée une nouvelle version pour repartir de celle-ci.' },
      ),
    );
  }
  const validated = validateProcessGraph(version.graph);
  if (!validated.ok) {
    return validated;
  }
  return ok({ ...version, status: 'published', publishedAt: publishedAtIso });
}

/** Ouvre un brouillon à partir d'une version existante. */
export function draftFromVersion(version: ProcessVersion, newId: string): ProcessVersion {
  const { publishedAt: _publishedAt, ...rest } = version;
  return {
    ...rest,
    id: newId,
    versionNumber: version.versionNumber + 1,
    status: 'draft',
  };
}

/**
 * Publier impacte-t-il les unités en cours ?
 *
 * Toujours `false`. Comme `alarmCanAdvanceUnit`, cette fonction rend une
 * absence explicite et testée : une relecture ultérieure ne doit pas
 * réintroduire une bascule en croyant combler un oubli. La demande initiale du
 * cultivateur (« les unités basculent ») a été écartée au profit de la
 * comparaison, qu'il avait également demandée.
 */
export function publishingAffectsRunningUnits(): false {
  return false;
}

export interface MigrationPlan {
  readonly unitIds: readonly string[];
  readonly targetVersionId: string;
}

/**
 * Prépare une migration d'unités vers une autre version.
 *
 * Toujours **par sélection explicite** : une migration sans liste d'unités est
 * refusée, précisément pour qu'aucun chemin de code ne puisse produire une
 * bascule globale.
 */
export function planMigration(
  unitIds: readonly string[],
  targetVersion: ProcessVersion,
): Result<MigrationPlan> {
  if (unitIds.length === 0) {
    return err(
      appError('VALIDATION_FAILED', 'Aucune unité sélectionnée pour la migration.', {
        hint: 'La migration se fait toujours sur une sélection explicite d’unités : il n’existe pas de bascule globale.',
        path: 'unitIds',
      }),
    );
  }
  if (targetVersion.status !== 'published') {
    return err(
      appError(
        'VALIDATION_FAILED',
        `La version ${String(targetVersion.versionNumber)} est un brouillon : on ne migre pas d'unités vers une version non publiée.`,
        { hint: 'Publie la version cible avant de migrer des unités.', path: 'targetVersionId' },
      ),
    );
  }
  return ok({ unitIds: [...new Set(unitIds)], targetVersionId: targetVersion.id });
}
