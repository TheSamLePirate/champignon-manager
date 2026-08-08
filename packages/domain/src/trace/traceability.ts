import {
  appError,
  type CultureUnit,
  type DomainEvent,
  type Harvest,
  type ProductBatch,
} from '@champi/contracts';
import { err, ok, type Result } from '../result.js';
import { sumQuantities, toCanonical } from '../quantity/quantity.js';

/**
 * Traçabilité ascendante et descendante.
 *
 * C'est la promesse du produit : « du spore à l'assiette ». Depuis une
 * barquette, remonter aux blocs qui l'ont produite, avec **la part exacte de
 * chacun** (`q14_5`) ; depuis un bloc contaminé, descendre aux barquettes déjà
 * parties — la question qu'un rappel sanitaire pose.
 *
 * Module pur : il compose des objets déjà chargés, il n'interroge rien.
 */

export interface TraceContribution {
  readonly unitId: string;
  readonly unitPublicCode: string;
  readonly harvestId: string;
  readonly harvestPublicCode: string;
  readonly flushNumber: number;
  /** Part dans le produit, en pourcentage arrondi au dixième. */
  readonly sharePct: number;
  /** Masse issue de cette unité, en grammes. */
  readonly grams: number;
}

export interface UpstreamTrace {
  readonly productId: string;
  readonly productPublicCode: string;
  readonly producedAt: string;
  readonly contributions: readonly TraceContribution[];
  /** `true` si une seule unité est à l'origine du produit. */
  readonly singleOrigin: boolean;
}

/**
 * Remonte d'un produit fini à ses unités d'origine.
 *
 * Échoue si une récolte ou une unité citée manque : une traçabilité partielle
 * est pire qu'une absence de traçabilité, parce qu'elle a l'air complète.
 */
export function traceUpstream(
  product: ProductBatch,
  harvests: readonly Harvest[],
  units: readonly CultureUnit[],
): Result<UpstreamTrace> {
  const harvestById = new Map(harvests.map((harvest) => [harvest.id, harvest]));
  const unitById = new Map(units.map((unit) => [unit.id, unit]));

  const contributions: TraceContribution[] = [];
  for (const origin of product.origins) {
    const harvest = harvestById.get(origin.harvestId);
    if (harvest === undefined) {
      return err(
        appError(
          'NOT_FOUND',
          `La récolte « ${origin.harvestId} » citée par le produit ${product.publicCode} est introuvable.`,
          {
            hint: 'Une chaîne de traçabilité incomplète est trompeuse : mieux vaut échouer que rendre un résultat partiel.',
            path: 'origins.harvestId',
          },
        ),
      );
    }

    const unit = unitById.get(origin.unitId);
    if (unit === undefined) {
      return err(
        appError(
          'NOT_FOUND',
          `L'unité « ${origin.unitId} » citée par le produit ${product.publicCode} est introuvable.`,
          {
            hint: 'Une unité ne se supprime jamais — seulement s’archive. Vérifie l’intégrité de la base.',
            path: 'origins.unitId',
          },
        ),
      );
    }

    contributions.push({
      unitId: unit.id,
      unitPublicCode: unit.publicCode,
      harvestId: harvest.id,
      harvestPublicCode: harvest.publicCode,
      flushNumber: harvest.flushNumber,
      sharePct: Math.round(origin.share * 1000) / 10,
      grams: toCanonical(origin.weight).value,
    });
  }

  return ok({
    productId: product.id,
    productPublicCode: product.publicCode,
    producedAt: product.producedAt,
    contributions,
    singleOrigin: new Set(contributions.map((c) => c.unitId)).size === 1,
  });
}

export interface DownstreamTrace {
  readonly unitId: string;
  readonly unitPublicCode: string;
  readonly harvestCount: number;
  readonly totalHarvestedGrams: number;
  readonly products: readonly {
    readonly productId: string;
    readonly publicCode: string;
    readonly sharePct: number;
  }[];
}

/**
 * Descend d'une unité aux produits qui en sont issus.
 *
 * C'est la requête d'un rappel : « ce bloc était contaminé, où sont partis ses
 * champignons ? »
 */
export function traceDownstream(
  unit: CultureUnit,
  harvests: readonly Harvest[],
  products: readonly ProductBatch[],
): Result<DownstreamTrace> {
  const total = sumQuantities(
    harvests.map((harvest) => harvest.weight),
    'g',
    'harvest',
  );
  if (!total.ok) {
    return total;
  }

  const involved = products.flatMap((product) =>
    product.origins
      .filter((origin) => origin.unitId === unit.id)
      .map((origin) => ({
        productId: product.id,
        publicCode: product.publicCode,
        sharePct: Math.round(origin.share * 1000) / 10,
      })),
  );

  return ok({
    unitId: unit.id,
    unitPublicCode: unit.publicCode,
    harvestCount: harvests.length,
    totalHarvestedGrams: total.value.value,
    products: involved,
  });
}

/**
 * Vérifie qu'une chaîne de traçabilité est complète et cohérente.
 *
 * Complète l'audit de `replay.ts` : celui-ci vérifie qu'une unité est
 * reconstructible, celle-ci qu'un produit est **rattachable**. Les deux
 * ensemble couvrent la promesse de bout en bout.
 */
export interface TraceIssue {
  readonly code: string;
  readonly message: string;
}

export function checkTraceIntegrity(
  product: ProductBatch,
  harvests: readonly Harvest[],
  events: readonly DomainEvent[],
): TraceIssue[] {
  const issues: TraceIssue[] = [];

  const shareTotal = product.origins.reduce((sum, origin) => sum + origin.share, 0);
  if (Math.abs(shareTotal - 1) > 1e-9) {
    issues.push({
      code: 'SHARES_DO_NOT_SUM_TO_ONE',
      message: `Les proportions du produit ${product.publicCode} totalisent ${shareTotal.toFixed(6)} au lieu de 1.`,
    });
  }

  const harvestIds = new Set(harvests.map((harvest) => harvest.id));
  for (const origin of product.origins) {
    if (!harvestIds.has(origin.harvestId)) {
      issues.push({
        code: 'MISSING_HARVEST',
        message: `La récolte « ${origin.harvestId} » citée par le produit est absente.`,
      });
    }
  }

  // Chaque récolte doit avoir laissé une trace dans le journal : sans
  // événement, elle n'existe que dans l'état courant — c'est-à-dire nulle part
  // de vérifiable.
  const recorded = new Set(
    events.filter((e) => e.type === 'harvest.recorded').map((e) => e.payload.harvestId),
  );
  for (const harvest of harvests) {
    if (!recorded.has(harvest.id)) {
      issues.push({
        code: 'HARVEST_NOT_JOURNALED',
        message: `La récolte ${harvest.publicCode} n'a pas d'événement correspondant dans le journal.`,
      });
    }
  }

  return issues;
}
