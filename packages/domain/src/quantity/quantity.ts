import {
  appError,
  listHint,
  type Quantity,
  type QuantityKind,
  type QuantityUnit,
} from '@champi/contracts';
import { err, ok, type Result } from '../result.js';

/**
 * Arithmétique des quantités.
 *
 * Deux règles, toutes deux issues de docs/21 §4 :
 *
 * 1. **Stockage canonique en grammes** pour toute masse. L'unité de saisie est
 *    conservée pour l'affichage, jamais pour le calcul.
 * 2. **Aucune conversion implicite entre `kind` différents.** Additionner une
 *    masse de substrat et une masse récoltée est une erreur, pas un arrondi :
 *    c'est exactement la confusion qui rendait `currentQuantity` inutilisable.
 */

/**
 * Facteurs vers l'unité canonique de chaque famille.
 *
 * La table est **totale** sur les unités convertibles : aucune valeur par
 * défaut n'est nécessaire à l'indexation, donc aucune branche défensive
 * inatteignable ne vient polluer la couverture.
 */
const CONVERSION_FACTORS = {
  g: 1,
  kg: 1000,
  mL: 1,
  L: 1000,
} as const satisfies Partial<Record<QuantityUnit, number>>;

type ConvertibleUnit = keyof typeof CONVERSION_FACTORS;

const MASS_UNITS: readonly ConvertibleUnit[] = ['g', 'kg'];
const VOLUME_UNITS: readonly ConvertibleUnit[] = ['mL', 'L'];

function isConvertible(unit: QuantityUnit): unit is ConvertibleUnit {
  return unit in CONVERSION_FACTORS;
}

/** Famille d'une unité : deux unités ne sont comparables que dans la même famille. */
export type UnitFamily = 'mass' | 'volume' | 'count';

export function unitFamily(unit: QuantityUnit): UnitFamily {
  if (MASS_UNITS.includes(unit as ConvertibleUnit)) {
    return 'mass';
  }
  if (VOLUME_UNITS.includes(unit as ConvertibleUnit)) {
    return 'volume';
  }
  return 'count';
}

/** Unité canonique d'une famille convertible. */
function canonicalUnitOf(family: 'mass' | 'volume'): ConvertibleUnit {
  return family === 'mass' ? 'g' : 'mL';
}

/**
 * Convertit une quantité vers l'unité canonique de sa famille.
 *
 * Masses → grammes, volumes → millilitres. Les unités de comptage (`piece`,
 * `tray`) sont déjà canoniques : elles ne se convertissent pas entre elles,
 * une barquette n'étant pas un multiple fixe de pièces.
 */
export function toCanonical(quantity: Quantity): Quantity {
  if (!isConvertible(quantity.unit)) {
    return quantity;
  }
  const family = unitFamily(quantity.unit);
  // `count` est exclu par `isConvertible` : les deux seules familles restantes
  // sont `mass` et `volume`, toutes deux couvertes par la table.
  const canonical = canonicalUnitOf(family === 'mass' ? 'mass' : 'volume');
  return {
    value: quantity.value * CONVERSION_FACTORS[quantity.unit],
    unit: canonical,
    kind: quantity.kind,
  };
}

/** Convertit une quantité vers une unité cible de la même famille. */
export function convertTo(quantity: Quantity, target: QuantityUnit): Result<Quantity> {
  if (quantity.unit === target) {
    return ok(quantity);
  }
  if (unitFamily(quantity.unit) !== unitFamily(target)) {
    return err(
      appError(
        'QUANTITY_UNIT_NOT_CONVERTIBLE',
        `Impossible de convertir « ${quantity.unit} » en « ${target} » : ce ne sont pas des grandeurs de même nature.`,
        {
          hint: listHint(
            'Unités convertibles entre elles',
            unitFamily(target) === 'mass' ? ['g', 'kg'] : ['mL', 'L'],
          ),
        },
      ),
    );
  }
  if (!isConvertible(quantity.unit) || !isConvertible(target)) {
    return err(
      appError(
        'QUANTITY_UNIT_NOT_CONVERTIBLE',
        `Impossible de convertir « ${quantity.unit} » en « ${target} » : il n'existe pas de facteur fixe entre ces unités de comptage.`,
        { hint: 'Saisis directement la quantité dans l’unité voulue.' },
      ),
    );
  }
  return ok({
    value: (quantity.value * CONVERSION_FACTORS[quantity.unit]) / CONVERSION_FACTORS[target],
    unit: target,
    kind: quantity.kind,
  });
}

function requireSameKind(a: Quantity, b: Quantity): Result<QuantityKind> {
  if (a.kind !== b.kind) {
    return err(
      appError(
        'QUANTITY_KIND_MISMATCH',
        `Opération impossible entre une quantité « ${a.kind} » et une quantité « ${b.kind} ».`,
        {
          hint: 'Un rendement est un rapport explicite entre deux grandeurs nommées, jamais une addition de natures différentes. Utilise `ratio()` pour comparer un substrat à une récolte.',
        },
      ),
    );
  }
  return ok(a.kind);
}

/** Additionne deux quantités de même nature. Le résultat est canonique. */
export function addQuantities(a: Quantity, b: Quantity): Result<Quantity> {
  const kind = requireSameKind(a, b);
  if (!kind.ok) {
    return kind;
  }
  const left = toCanonical(a);
  const right = toCanonical(b);
  if (left.unit !== right.unit) {
    return err(
      appError(
        'QUANTITY_UNIT_NOT_CONVERTIBLE',
        `Impossible d'additionner « ${a.unit} » et « ${b.unit} » : ce ne sont pas des grandeurs de même nature.`,
        {
          hint: 'Additionne des masses entre elles, des volumes entre eux, des comptages de même unité.',
        },
      ),
    );
  }
  return ok({ value: left.value + right.value, unit: left.unit, kind: kind.value });
}

/** Somme une liste de quantités de même nature. Une liste vide vaut zéro. */
export function sumQuantities(
  quantities: readonly Quantity[],
  emptyUnit: QuantityUnit,
  emptyKind: QuantityKind,
): Result<Quantity> {
  const [first, ...rest] = quantities;
  if (first === undefined) {
    return ok({ value: 0, unit: emptyUnit, kind: emptyKind });
  }
  let total: Quantity = toCanonical(first);
  for (const quantity of rest) {
    const sum = addQuantities(total, quantity);
    if (!sum.ok) {
      return sum;
    }
    total = sum.value;
  }
  return ok(total);
}

/** Soustrait `b` de `a`. Une quantité ne peut pas devenir négative. */
export function subtractQuantities(a: Quantity, b: Quantity): Result<Quantity> {
  const negated: Quantity = { ...toCanonical(b), value: -toCanonical(b).value };
  const sum = addQuantities(toCanonical(a), negated);
  if (!sum.ok) {
    return sum;
  }
  if (sum.value.value < 0) {
    return err(
      appError(
        'VALIDATION_FAILED',
        'Le résultat de la soustraction est négatif : une quantité physique ne peut pas être inférieure à zéro.',
        { hint: `Valeur obtenue : ${String(sum.value.value)} ${sum.value.unit}.` },
      ),
    );
  }
  return ok(sum.value);
}

/**
 * Rapport explicite entre deux quantités, y compris de natures différentes.
 *
 * C'est **la seule** façon de relier un substrat à une récolte : le rendement
 * (efficacité biologique) est `ratio(récolte, substrat)`. Le fait que ce soit
 * une fonction nommée, et non un opérateur, est délibéré.
 */
export function ratio(numerator: Quantity, denominator: Quantity): Result<number> {
  const top = toCanonical(numerator);
  const bottom = toCanonical(denominator);
  if (top.unit !== bottom.unit) {
    return err(
      appError(
        'QUANTITY_UNIT_NOT_CONVERTIBLE',
        `Impossible de calculer un rapport entre « ${top.unit} » et « ${bottom.unit} ».`,
        { hint: 'Les deux grandeurs doivent appartenir à la même famille d’unités.' },
      ),
    );
  }
  if (bottom.value === 0) {
    return err(
      appError('VALIDATION_FAILED', 'Division par zéro : le dénominateur est nul.', {
        hint: 'Vérifie que le poids de substrat a bien été saisi à l’inoculation.',
      }),
    );
  }
  return ok(top.value / bottom.value);
}

/**
 * Efficacité biologique : masse récoltée rapportée à la masse de substrat.
 *
 * Exprimée en pourcentage, comme dans la pratique myciculture.
 */
export function biologicalEfficiencyPct(
  totalHarvest: Quantity,
  substrateWeight: Quantity,
): Result<number> {
  const value = ratio(totalHarvest, substrateWeight);
  return value.ok ? ok(value.value * 100) : value;
}

/** Égalité de deux quantités, comparées sous forme canonique. */
export function quantitiesEqual(a: Quantity, b: Quantity): boolean {
  const left = toCanonical(a);
  const right = toCanonical(b);
  return left.kind === right.kind && left.unit === right.unit && left.value === right.value;
}
