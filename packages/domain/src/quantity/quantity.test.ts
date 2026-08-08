import { describe, expect, it } from 'vitest';
import type { Quantity } from '@champi/contracts';
import {
  addQuantities,
  biologicalEfficiencyPct,
  convertTo,
  quantitiesEqual,
  ratio,
  subtractQuantities,
  sumQuantities,
  toCanonical,
  unitFamily,
} from './quantity.js';

const g = (value: number): Quantity => ({ value, unit: 'g', kind: 'harvest' });
const kg = (value: number): Quantity => ({ value, unit: 'kg', kind: 'harvest' });
const substrate = (value: number): Quantity => ({ value, unit: 'kg', kind: 'substrate' });

describe('unitFamily', () => {
  it('classe les masses', () => {
    expect(unitFamily('g')).toBe('mass');
    expect(unitFamily('kg')).toBe('mass');
  });

  it('classe les volumes', () => {
    expect(unitFamily('mL')).toBe('volume');
    expect(unitFamily('L')).toBe('volume');
  });

  it('classe les comptages', () => {
    expect(unitFamily('piece')).toBe('count');
    expect(unitFamily('tray')).toBe('count');
  });
});

describe('toCanonical', () => {
  it('ramène les masses en grammes', () => {
    expect(toCanonical(kg(2.5))).toEqual({ value: 2500, unit: 'g', kind: 'harvest' });
  });

  it('laisse les grammes inchangés', () => {
    expect(toCanonical(g(120))).toEqual(g(120));
  });

  it('ramène les volumes en millilitres', () => {
    expect(toCanonical({ value: 1.5, unit: 'L', kind: 'inoculum' })).toEqual({
      value: 1500,
      unit: 'mL',
      kind: 'inoculum',
    });
  });

  it('laisse les comptages inchangés', () => {
    const trays: Quantity = { value: 4, unit: 'tray', kind: 'product' };
    expect(toCanonical(trays)).toEqual(trays);
  });
});

describe('convertTo', () => {
  it('renvoie la quantité telle quelle si l’unité est déjà la bonne', () => {
    const result = convertTo(g(50), 'g');
    expect(result).toEqual({ ok: true, value: g(50) });
  });

  it('convertit des kilogrammes en grammes', () => {
    const result = convertTo(kg(1.2), 'g');
    expect(result.ok && result.value.value).toBe(1200);
  });

  it('convertit des grammes en kilogrammes', () => {
    const result = convertTo(g(2500), 'kg');
    expect(result.ok && result.value.value).toBe(2.5);
  });

  it('convertit des litres en millilitres', () => {
    const result = convertTo({ value: 2, unit: 'L', kind: 'inoculum' }, 'mL');
    expect(result.ok && result.value.value).toBe(2000);
  });

  it('refuse de convertir entre deux familles et cite les unités valides', () => {
    const result = convertTo(g(100), 'L');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('QUANTITY_UNIT_NOT_CONVERTIBLE');
    expect(result.error.hint).toContain('mL');
  });

  it('cite les unités de masse quand la cible est une masse', () => {
    const result = convertTo({ value: 1, unit: 'L', kind: 'inoculum' }, 'kg');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.hint).toContain('kg');
  });

  it('refuse de convertir entre deux unités de comptage', () => {
    const result = convertTo({ value: 3, unit: 'tray', kind: 'product' }, 'piece');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('QUANTITY_UNIT_NOT_CONVERTIBLE');
    expect(result.error.hint).toContain('unité voulue');
  });
});

describe('addQuantities', () => {
  it('additionne deux masses de même nature en canonique', () => {
    const result = addQuantities(kg(1), g(500));
    expect(result).toEqual({ ok: true, value: { value: 1500, unit: 'g', kind: 'harvest' } });
  });

  it('refuse d’additionner deux natures différentes', () => {
    const result = addQuantities(g(100), { value: 100, unit: 'g', kind: 'substrate' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('QUANTITY_KIND_MISMATCH');
    expect(result.error.hint).toContain('ratio()');
  });

  it('refuse d’additionner une masse et un comptage', () => {
    const result = addQuantities(g(100), { value: 2, unit: 'piece', kind: 'harvest' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('QUANTITY_UNIT_NOT_CONVERTIBLE');
  });
});

describe('sumQuantities', () => {
  it('renvoie zéro pour une liste vide, dans l’unité demandée', () => {
    const result = sumQuantities([], 'g', 'harvest');
    expect(result).toEqual({ ok: true, value: { value: 0, unit: 'g', kind: 'harvest' } });
  });

  it('somme plusieurs récoltes', () => {
    const result = sumQuantities([g(250), kg(1), g(50)], 'g', 'harvest');
    expect(result.ok && result.value.value).toBe(1300);
  });

  it('somme un seul élément en le ramenant en canonique', () => {
    const result = sumQuantities([kg(2)], 'g', 'harvest');
    expect(result.ok && result.value.value).toBe(2000);
  });

  it('remonte le premier échec rencontré', () => {
    const result = sumQuantities(
      [g(100), { value: 1, unit: 'piece', kind: 'harvest' }],
      'g',
      'harvest',
    );
    expect(result.ok).toBe(false);
  });
});

describe('subtractQuantities', () => {
  it('soustrait deux masses', () => {
    const result = subtractQuantities(kg(1), g(250));
    expect(result.ok && result.value.value).toBe(750);
  });

  it('accepte un résultat nul', () => {
    const result = subtractQuantities(g(100), g(100));
    expect(result.ok && result.value.value).toBe(0);
  });

  it('refuse un résultat négatif', () => {
    const result = subtractQuantities(g(100), kg(1));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_FAILED');
    expect(result.error.hint).toContain('-900');
  });

  it('remonte une incompatibilité de nature', () => {
    const result = subtractQuantities(g(100), { value: 10, unit: 'g', kind: 'substrate' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('QUANTITY_KIND_MISMATCH');
  });
});

describe('ratio', () => {
  it('rapporte une récolte à un substrat, malgré des natures différentes', () => {
    const result = ratio(g(600), substrate(3));
    expect(result.ok && result.value).toBeCloseTo(0.2);
  });

  it('refuse un rapport entre familles d’unités différentes', () => {
    const result = ratio(g(100), { value: 1, unit: 'piece', kind: 'product' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('QUANTITY_UNIT_NOT_CONVERTIBLE');
  });

  it('refuse la division par zéro en pointant le poids de substrat', () => {
    const result = ratio(g(600), substrate(0));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_FAILED');
    expect(result.error.hint).toContain('substrat');
  });
});

describe('biologicalEfficiencyPct', () => {
  it('exprime le rendement en pourcentage', () => {
    const result = biologicalEfficiencyPct(kg(1.5), substrate(5));
    expect(result.ok && result.value).toBeCloseTo(30);
  });

  it('remonte l’échec du rapport sous-jacent', () => {
    const result = biologicalEfficiencyPct(kg(1.5), substrate(0));
    expect(result.ok).toBe(false);
  });
});

describe('bornes de conversion', () => {
  it('convertit exactement 1 kg en 1000 g', () => {
    const result = convertTo(kg(1), 'g');
    expect(result.ok && result.value).toEqual({ value: 1000, unit: 'g', kind: 'harvest' });
  });

  it('convertit exactement 1 L en 1000 mL', () => {
    const result = convertTo({ value: 1, unit: 'L', kind: 'inoculum' }, 'mL');
    expect(result.ok && result.value).toEqual({ value: 1000, unit: 'mL', kind: 'inoculum' });
  });

  it('préserve la nature lors d’une conversion', () => {
    const result = convertTo(substrate(2), 'g');
    expect(result.ok && result.value.kind).toBe('substrate');
  });

  it('cite les deux unités en cause dans le message d’erreur', () => {
    const result = convertTo(g(100), 'L');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('g');
    expect(result.error.message).toContain('L');
    expect(result.error.message).toContain('même nature');
  });

  it('cite les deux natures en cause lors d’une addition impossible', () => {
    const result = addQuantities(g(100), { value: 100, unit: 'g', kind: 'substrate' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('harvest');
    expect(result.error.message).toContain('substrate');
  });

  it('une somme reste dans la nature de ses termes', () => {
    const result = sumQuantities([substrate(1), substrate(2)], 'g', 'substrate');
    expect(result.ok && result.value.kind).toBe('substrate');
    expect(result.ok && result.value.value).toBe(3000);
  });

  it('un rapport de deux grandeurs égales vaut exactement 1', () => {
    const result = ratio(kg(1), { value: 1000, unit: 'g', kind: 'substrate' });
    expect(result.ok && result.value).toBe(1);
  });

  it('un rendement nul reste calculable', () => {
    const result = biologicalEfficiencyPct(g(0), substrate(5));
    expect(result.ok && result.value).toBe(0);
  });
});

describe('quantitiesEqual', () => {
  it('reconnaît deux écritures de la même masse', () => {
    expect(quantitiesEqual(kg(1), g(1000))).toBe(true);
  });

  it('distingue deux natures différentes', () => {
    expect(quantitiesEqual(g(1000), { value: 1000, unit: 'g', kind: 'substrate' })).toBe(false);
  });

  it('distingue deux valeurs différentes', () => {
    expect(quantitiesEqual(g(999), g(1000))).toBe(false);
  });

  it('distingue deux familles d’unités', () => {
    expect(
      quantitiesEqual(
        { value: 1, unit: 'piece', kind: 'product' },
        { value: 1, unit: 'tray', kind: 'product' },
      ),
    ).toBe(false);
  });
});
