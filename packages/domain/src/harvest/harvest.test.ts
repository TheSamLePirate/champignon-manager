import { describe, expect, it } from 'vitest';
import type { Harvest, ProductOrigin } from '@champi/contracts';
import {
  canHarvest,
  netHarvestWeight,
  totalHarvested,
  unitYieldPct,
  validateHarvest,
  validateProductOrigins,
} from './harvest.js';
import { makeUnit } from '../__testing__/builders.js';

function makeHarvest(overrides: Partial<Harvest> = {}): Harvest {
  return {
    id: 'h-1',
    publicCode: 'REC-2026-0001',
    unitId: 'unit-1',
    flushNumber: 1,
    weight: { value: 800, unit: 'g', kind: 'harvest' },
    quality: 'A',
    losses: [],
    harvestedAt: '2026-08-25T07:00:00.000Z',
    ...overrides,
  };
}

const origin = (share: number, id: string): ProductOrigin => ({
  harvestId: id,
  unitId: 'unit-1',
  weight: { value: 100, unit: 'g', kind: 'harvest' },
  share,
});

describe('canHarvest', () => {
  it('autorise une unité active', () => {
    expect(canHarvest(makeUnit({ status: 'active' }))).toBe(true);
  });

  it('refuse une unité contaminée — elle ne peut plus produire', () => {
    expect(canHarvest(makeUnit({ status: 'contaminated' }))).toBe(false);
  });

  it('refuse une unité archivée', () => {
    expect(canHarvest(makeUnit({ status: 'archived' }))).toBe(false);
  });
});

describe('validateHarvest', () => {
  it('accepte une récolte sur une unité active et ramène en grammes', () => {
    const result = validateHarvest({
      unit: makeUnit(),
      weight: { value: 1.2, unit: 'kg', kind: 'harvest' },
      flushNumber: 1,
    });
    expect(result).toEqual({ ok: true, value: { value: 1200, unit: 'g', kind: 'harvest' } });
  });

  it('refuse une récolte sur une unité contaminée', () => {
    const result = validateHarvest({
      unit: makeUnit({ status: 'contaminated' }),
      weight: { value: 800, unit: 'g', kind: 'harvest' },
      flushNumber: 1,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('UNIT_NOT_ACTIVE');
    expect(result.error.message).toContain('SUB-2026-0001');
    expect(result.error.message).toContain('contaminated');
    expect(result.error.message).toContain('aucune récolte');
    expect(result.error.hint).toContain('ne peut plus produire');
    expect(result.error.path).toBe('unitId');
  });

  it('refuse un poids qui n’est pas de nature « harvest »', () => {
    const result = validateHarvest({
      unit: makeUnit(),
      weight: { value: 800, unit: 'g', kind: 'substrate' },
      flushNumber: 1,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('QUANTITY_KIND_MISMATCH');
    expect(result.error.message).toContain('harvest');
    expect(result.error.message).toContain('substrate');
    expect(result.error.hint).toContain('kind: "harvest"');
    expect(result.error.path).toBe('weight.kind');
  });
});

describe('netHarvestWeight', () => {
  it('retire les pertes du poids brut', () => {
    const result = netHarvestWeight(
      makeHarvest({
        weight: { value: 1000, unit: 'g', kind: 'harvest' },
        losses: [
          { weight: { value: 80, unit: 'g', kind: 'harvest' }, cause: 'contamination' },
          { weight: { value: 20, unit: 'g', kind: 'harvest' }, cause: 'malformation' },
        ],
      }),
    );
    expect(result.ok && result.value.value).toBe(900);
  });

  it('renvoie le brut, en grammes, quand il n’y a aucune perte', () => {
    const result = netHarvestWeight(makeHarvest());
    expect(result.ok && result.value).toEqual({ value: 800, unit: 'g', kind: 'harvest' });
  });

  it('refuse des pertes supérieures au poids récolté', () => {
    const result = netHarvestWeight(
      makeHarvest({
        weight: { value: 100, unit: 'g', kind: 'harvest' },
        losses: [{ weight: { value: 1, unit: 'kg', kind: 'harvest' }, cause: 'damage' }],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_FAILED');
    expect(result.error.hint).toContain('100 g');
    expect(result.error.hint).toContain('1000 g');
    expect(result.error.path).toBe('losses');
  });

  it('refuse une perte exprimée dans une unité incomparable au poids récolté', () => {
    const result = netHarvestWeight(
      makeHarvest({
        losses: [{ weight: { value: 1, unit: 'piece', kind: 'harvest' }, cause: 'other' }],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('QUANTITY_UNIT_NOT_CONVERTIBLE');
    expect(result.error.path).toBe('losses');
  });

  it('remonte l’échec du cumul quand deux pertes ont des unités incompatibles entre elles', () => {
    const result = netHarvestWeight(
      makeHarvest({
        losses: [
          { weight: { value: 50, unit: 'g', kind: 'harvest' }, cause: 'damage' },
          { weight: { value: 2, unit: 'piece', kind: 'harvest' }, cause: 'other' },
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('QUANTITY_UNIT_NOT_CONVERTIBLE');
    // L'échec vient du cumul lui-même : le chemin ne va pas jusqu'à la
    // soustraction, donc l'erreur ne porte pas encore de `path`.
    expect(result.error.path).toBeUndefined();
  });
});

describe('totalHarvested', () => {
  it('cumule les flushs', () => {
    const result = totalHarvested([
      makeHarvest({
        id: 'h-1',
        flushNumber: 1,
        weight: { value: 800, unit: 'g', kind: 'harvest' },
      }),
      makeHarvest({
        id: 'h-2',
        flushNumber: 2,
        weight: { value: 0.5, unit: 'kg', kind: 'harvest' },
      }),
    ]);
    expect(result.ok && result.value.value).toBe(1300);
  });

  it('vaut zéro gramme de récolte sans aucun flush', () => {
    const result = totalHarvested([]);
    expect(result.ok && result.value).toEqual({ value: 0, unit: 'g', kind: 'harvest' });
  });
});

describe('unitYieldPct', () => {
  it('calcule l’efficacité biologique', () => {
    const unit = makeUnit({ substrateWeight: { value: 5, unit: 'kg', kind: 'substrate' } });
    const result = unitYieldPct(unit, [
      makeHarvest({ weight: { value: 1, unit: 'kg', kind: 'harvest' } }),
    ]);
    expect(result.ok && result.value).toBeCloseTo(20);
  });

  it('refuse de calculer sans poids de substrat, en disant où le saisir', () => {
    const result = unitYieldPct(makeUnit({ substrateWeight: undefined }), [makeHarvest()]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_FAILED');
    expect(result.error.message).toContain('SUB-2026-0001');
    expect(result.error.message).toContain('poids de substrat');
    expect(result.error.path).toBe('substrateWeight');
    expect(result.error.hint).toContain('inoculation');
  });

  it('remonte l’échec du cumul des récoltes', () => {
    const result = unitYieldPct(makeUnit(), [
      makeHarvest({ weight: { value: 1, unit: 'piece', kind: 'harvest' } }),
      makeHarvest({ id: 'h-2', weight: { value: 1, unit: 'g', kind: 'harvest' } }),
    ]);
    expect(result.ok).toBe(false);
  });

  it('remonte une division par zéro si le substrat pèse zéro', () => {
    const unit = makeUnit({ substrateWeight: { value: 0, unit: 'kg', kind: 'substrate' } });
    const result = unitYieldPct(unit, [makeHarvest()]);
    expect(result.ok).toBe(false);
  });
});

describe('validateProductOrigins', () => {
  it('accepte une origine unique à 100 %', () => {
    const origins = [origin(1, 'h-1')];
    expect(validateProductOrigins(origins)).toEqual({ ok: true, value: origins });
  });

  it('accepte un mélange dont les parts totalisent exactement 1', () => {
    expect(validateProductOrigins([origin(0.6, 'h-1'), origin(0.4, 'h-2')]).ok).toBe(true);
  });

  it('tolère l’imprécision flottante de trois tiers', () => {
    const third = 1 / 3;
    expect(
      validateProductOrigins([origin(third, 'h-1'), origin(third, 'h-2'), origin(third, 'h-3')]).ok,
    ).toBe(true);
  });

  it('refuse un mélange vide', () => {
    const result = validateProductOrigins([]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_FAILED');
    expect(result.error.message).toContain('au moins une récolte');
    expect(result.error.hint).toContain('origins');
    expect(result.error.path).toBe('origins');
  });

  it('refuse des parts qui ne totalisent pas 1', () => {
    const result = validateProductOrigins([origin(0.5, 'h-1'), origin(0.3, 'h-2')]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('SHARES_DO_NOT_SUM_TO_ONE');
    expect(result.error.message).toContain('0.800000');
    expect(result.error.hint).toContain('proportions doivent être exactes');
    expect(result.error.path).toBe('origins[].share');
  });

  it('refuse des parts qui dépassent 1', () => {
    const result = validateProductOrigins([origin(0.7, 'h-1'), origin(0.5, 'h-2')]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('1.200000');
  });
});
