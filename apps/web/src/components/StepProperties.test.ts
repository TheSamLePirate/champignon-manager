import { describe, expect, it } from 'vitest';
import { parseOptionalNumber } from './StepProperties.js';

/**
 * Le comportement de cette fonction décide si une consigne de culture est
 * modifiée ou laissée intacte : elle mérite ses propres tests.
 */
describe('parseOptionalNumber', () => {
  it('lit un entier', () => {
    expect(parseOptionalNumber('24')).toBe(24);
  });

  it('lit un décimal', () => {
    expect(parseOptionalNumber('0.5')).toBe(0.5);
  });

  /** Clavier français : la virgule est ce qu'on tape naturellement. */
  it('accepte la virgule décimale', () => {
    expect(parseOptionalNumber('2,5')).toBe(2.5);
  });

  it('tolère les espaces autour', () => {
    expect(parseOptionalNumber('  18  ')).toBe(18);
  });

  it('lit une valeur négative', () => {
    expect(parseOptionalNumber('-3')).toBe(-3);
  });

  it('rend undefined pour un champ vide', () => {
    expect(parseOptionalNumber('')).toBeUndefined();
    expect(parseOptionalNumber('   ')).toBeUndefined();
  });

  /** Une saisie illisible ne devient pas 0 : l'appelant ne modifie rien. */
  it('rend undefined pour une saisie non numérique', () => {
    expect(parseOptionalNumber('abc')).toBeUndefined();
    expect(parseOptionalNumber('12abc')).toBeUndefined();
  });

  it('rend undefined pour une valeur non finie', () => {
    expect(parseOptionalNumber('Infinity')).toBeUndefined();
  });
});
