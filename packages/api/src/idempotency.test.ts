import { describe, expect, it } from 'vitest';
import { fingerprint } from './idempotency.js';
import { firstIssuePath } from './app.js';

/**
 * L'empreinte doit être **insensible à l'ordre des clés** : deux clients qui
 * sérialisent le même objet différemment ne doivent pas se voir refuser une
 * clé d'idempotence pour « contenu différent ».
 */
describe('fingerprint', () => {
  it('ignore l’ordre des clés', () => {
    expect(fingerprint({ a: 1, b: 2 })).toBe(fingerprint({ b: 2, a: 1 }));
  });

  it('ignore l’ordre des clés en profondeur', () => {
    expect(fingerprint({ x: { a: 1, b: 2 } })).toBe(fingerprint({ x: { b: 2, a: 1 } }));
  });

  it('préserve l’ordre des tableaux — il porte du sens', () => {
    expect(fingerprint([1, 2])).not.toBe(fingerprint([2, 1]));
  });

  it('trie les objets contenus dans un tableau', () => {
    expect(fingerprint([{ a: 1, b: 2 }])).toBe(fingerprint([{ b: 2, a: 1 }]));
  });

  it('distingue deux contenus réellement différents', () => {
    expect(fingerprint({ toStepId: 'incubation' })).not.toBe(
      fingerprint({ toStepId: 'fructification' }),
    );
  });

  it('gère les primitives et null', () => {
    expect(fingerprint(null)).toBe('null');
    expect(fingerprint(42)).toBe('42');
    expect(fingerprint('a')).toBe('"a"');
  });
});

describe('firstIssuePath', () => {
  it('rend le chemin pointé du premier problème', () => {
    expect(firstIssuePath([{ path: ['payload', 'weight', 'value'] }])).toBe('payload.weight.value');
  });

  it('rend « body » quand le problème porte sur la racine', () => {
    expect(firstIssuePath([{ path: [] }])).toBe('body');
  });

  it('rend « body » quand il n’y a aucun problème listé', () => {
    expect(firstIssuePath([])).toBe('body');
  });
});
