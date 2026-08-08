import {
  appError,
  type CultureUnit,
  type Harvest,
  type ProductOrigin,
  type Quantity,
} from '@champi/contracts';
import { err, ok, type Result } from '../result.js';
import {
  biologicalEfficiencyPct,
  subtractQuantities,
  sumQuantities,
  toCanonical,
} from '../quantity/quantity.js';

/**
 * Récoltes et produits finaux.
 *
 * Règles issues des réponses du cultivateur :
 * - poids **par unité**, à chaque flush, en grammes (`q14_1`) ;
 * - qualité et **pertes avec leur cause** (`q9_7_2`→`5`) ;
 * - mélanges autorisés **en conservant les proportions exactes** (`q14_5`) ;
 * - une unité contaminée **ne peut plus produire** (`q18_2`).
 */

/** Tolérance de somme des parts. Nécessaire : 1/3 + 1/3 + 1/3 ≠ 1 en flottant. */
const SHARE_EPSILON = 1e-9;

export function canHarvest(unit: CultureUnit): boolean {
  return unit.status === 'active';
}

export interface RecordHarvestRequest {
  readonly unit: CultureUnit;
  readonly weight: Quantity;
  readonly flushNumber: number;
}

/** Vérifie qu'une récolte est enregistrable sur cette unité. */
export function validateHarvest(request: RecordHarvestRequest): Result<Quantity> {
  const { unit, weight } = request;

  if (!canHarvest(unit)) {
    return err(
      appError(
        'UNIT_NOT_ACTIVE',
        `L'unité ${unit.publicCode} est au statut « ${unit.status} » : aucune récolte ne peut y être enregistrée.`,
        {
          hint: 'Une unité contaminée ne peut plus produire. Vérifie le statut de l’unité avant de saisir une récolte.',
          path: 'unitId',
        },
      ),
    );
  }

  if (weight.kind !== 'harvest') {
    return err(
      appError(
        'QUANTITY_KIND_MISMATCH',
        `Le poids d'une récolte doit être de nature « harvest », reçu « ${weight.kind} ».`,
        {
          hint: 'Utilise kind: "harvest" pour une masse de champignons récoltés.',
          path: 'weight.kind',
        },
      ),
    );
  }

  return ok(toCanonical(weight));
}

/** Masse nette d'une récolte : brut moins les pertes. */
export function netHarvestWeight(harvest: Harvest): Result<Quantity> {
  const losses = sumQuantities(
    harvest.losses.map((loss) => loss.weight),
    'g',
    'harvest',
  );
  if (!losses.ok) {
    return losses;
  }
  const gross = toCanonical(harvest.weight);
  // On passe par `subtractQuantities` plutôt que de retrancher les valeurs
  // brutes : c'est ce qui empêche de soustraire un comptage de pièces d'une
  // masse en grammes, et c'est aussi lui qui refuse un résultat négatif.
  const net = subtractQuantities(gross, losses.value);
  if (!net.ok) {
    // On conserve le code d'erreur d'origine — il distingue déjà « pertes
    // supérieures au brut » d'« unités incomparables » — et on l'enrichit des
    // deux valeurs en jeu, qui sont ce dont l'utilisateur a besoin.
    return err({
      ...net.error,
      hint: `Poids récolté : ${String(gross.value)} ${gross.unit}, pertes déclarées : ${String(losses.value.value)} ${losses.value.unit}.`,
      path: 'losses',
    });
  }
  return ok(net.value);
}

/** Cumul des récoltes d'une unité, tous flushs confondus. */
export function totalHarvested(harvests: readonly Harvest[]): Result<Quantity> {
  return sumQuantities(
    harvests.map((h) => h.weight),
    'g',
    'harvest',
  );
}

/**
 * Rendement d'une unité : efficacité biologique en pourcentage.
 *
 * Le poids de substrat est obligatoire — c'est le dénominateur. Sans lui,
 * aucun rendement n'est calculable, et c'est précisément pour cela que
 * `substrateWeight` est un champ de premier rang (docs/21 §4).
 */
export function unitYieldPct(unit: CultureUnit, harvests: readonly Harvest[]): Result<number> {
  const substrateWeight = unit.substrateWeight;
  if (substrateWeight === undefined) {
    return err(
      appError(
        'VALIDATION_FAILED',
        `L'unité ${unit.publicCode} n'a pas de poids de substrat : son rendement ne peut pas être calculé.`,
        {
          hint: 'Le poids substrat total se saisit à l’inoculation. Corrige l’unité avant de demander son rendement.',
          path: 'substrateWeight',
        },
      ),
    );
  }
  const total = totalHarvested(harvests);
  if (!total.ok) {
    return total;
  }
  return biologicalEfficiencyPct(total.value, substrateWeight);
}

/**
 * Vérifie qu'un mélange de récoltes conserve des proportions exactes.
 *
 * C'est l'assertion n°6 du test d'audit de traçabilité (docs/22 §6.3) : sans
 * elle, la remontée depuis un produit mélangé serait approximative.
 */
export function validateProductOrigins(
  origins: readonly ProductOrigin[],
): Result<readonly ProductOrigin[]> {
  if (origins.length === 0) {
    return err(
      appError('VALIDATION_FAILED', 'Un produit final doit avoir au moins une récolte d’origine.', {
        hint: 'Renseigne au moins une entrée dans `origins`.',
        path: 'origins',
      }),
    );
  }

  const total = origins.reduce((sum, origin) => sum + origin.share, 0);
  if (Math.abs(total - 1) > SHARE_EPSILON) {
    return err(
      appError(
        'SHARES_DO_NOT_SUM_TO_ONE',
        `Les proportions du mélange totalisent ${total.toFixed(6)} au lieu de 1.`,
        {
          hint: 'Les mélanges sont autorisés, mais les proportions doivent être exactes pour que la traçabilité remonte correctement.',
          path: 'origins[].share',
        },
      ),
    );
  }

  return ok(origins);
}
