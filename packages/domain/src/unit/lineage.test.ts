import { describe, expect, it } from 'vitest';
import type { CultureUnit } from '@champi/contracts';
import { deriveLineage } from './lineage.js';

/**
 * La lignée.
 *
 * Ces règles décident de ce qu'on saura d'une unité des mois plus tard : un
 * clone de cinquième génération doit se distinguer d'une souche d'origine, et
 * un transfert d'un clonage.
 */

function unite(overrides: Partial<CultureUnit> = {}): CultureUnit {
  return {
    id: 'u-parent',
    publicCode: 'GEL-2026-0001',
    name: 'Souche mère',
    stage: 'gelose',
    status: 'active',
    parentUnitId: null,
    lineageRelation: 'origin',
    generation: 0,
    processVersionId: 'pv-1',
    currentStepId: 'gelose',
    currentStepEnteredAt: '2026-08-01T08:00:00.000Z',
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z',
    version: 0,
    ...overrides,
  };
}

describe('unité sans ascendant', () => {
  it('est une origine de génération zéro', () => {
    const result = deriveLineage({ stage: 'substrate' });

    expect(result.ok && result.value).toEqual({ lineageRelation: 'origin', generation: 0 });
  });

  /** Une unité peut naître à n'importe quel stade, sans parent (`q7_2`). */
  it('reste une origine quel que soit le stade', () => {
    for (const stage of ['gelose', 'liquid_culture', 'grain', 'substrate', 'fruiting'] as const) {
      const result = deriveLineage({ stage });
      expect(result.ok && result.value.lineageRelation).toBe('origin');
    }
  });

  it('accepte « origin » dit explicitement', () => {
    expect(deriveLineage({ stage: 'substrate', relation: 'origin' }).ok).toBe(true);
  });

  it('refuse un clone sans parent, en disant quoi faire', () => {
    const result = deriveLineage({ stage: 'gelose', relation: 'clone' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.hint).toContain('parentUnitId');
    expect(result.error.path).toBe('lineageRelation');
  });
});

describe('unité issue d’une autre', () => {
  /** Même stade : on multiplie, la mère survit. */
  it('déduit un clone quand le stade ne change pas', () => {
    const result = deriveLineage({ parent: unite(), stage: 'gelose' });

    expect(result.ok && result.value).toEqual({ lineageRelation: 'clone', generation: 1 });
  });

  /** Stade différent : on passe à l'étape suivante de la propagation. */
  it('déduit un transfert quand le stade change', () => {
    const result = deriveLineage({ parent: unite(), stage: 'liquid_culture' });

    expect(result.ok && result.value.lineageRelation).toBe('transfer');
  });

  /**
   * La division ne se devine pas : deux sacs issus d'un même bloc restent au
   * même stade qu'un clone. Elle doit donc être déclarée.
   */
  it('respecte une division déclarée', () => {
    const result = deriveLineage({
      parent: unite({ stage: 'substrate' }),
      stage: 'substrate',
      relation: 'split',
    });

    expect(result.ok && result.value.lineageRelation).toBe('split');
  });

  it('respecte un transfert déclaré même à stade égal', () => {
    const result = deriveLineage({ parent: unite(), stage: 'gelose', relation: 'transfer' });

    expect(result.ok && result.value.lineageRelation).toBe('transfer');
  });

  it('refuse de traiter une unité issue d’une autre comme une origine', () => {
    const result = deriveLineage({ parent: unite(), stage: 'gelose', relation: 'origin' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('n’est pas une origine');
  });

  /** Le cultivateur clone sans limite de génération (`q7_5`). */
  it('incrémente la génération sans plafond', () => {
    const dixieme = deriveLineage({ parent: unite({ generation: 9 }), stage: 'gelose' });
    const centieme = deriveLineage({ parent: unite({ generation: 99 }), stage: 'gelose' });

    expect(dixieme.ok && dixieme.value.generation).toBe(10);
    expect(centieme.ok && centieme.value.generation).toBe(100);
  });
});
