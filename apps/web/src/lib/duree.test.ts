import { describe, expect, it } from 'vitest';
import { formatAnciennete, joursEcoules, libelleEtape } from './duree.js';

const T0 = '2026-08-01T08:00:00.000Z';

describe('joursEcoules', () => {
  it('compte les jours entiers', () => {
    expect(joursEcoules(T0, '2026-08-13T08:00:00.000Z')).toBe(12);
  });

  it('n’arrondit pas vers le haut : douze jours et demi restent douze', () => {
    expect(joursEcoules(T0, '2026-08-13T20:00:00.000Z')).toBe(12);
  });

  it('rend zéro le jour même', () => {
    expect(joursEcoules(T0, '2026-08-01T23:00:00.000Z')).toBe(0);
  });

  it('rend un nombre négatif si l’ordre est inversé', () => {
    expect(joursEcoules('2026-08-13T08:00:00.000Z', T0)).toBe(-12);
  });

  it('rend null sur une date illisible plutôt qu’un NaN silencieux', () => {
    expect(joursEcoules('hier', T0)).toBeNull();
    expect(joursEcoules(T0, 'demain')).toBeNull();
  });
});

describe('formatAnciennete', () => {
  it('dit « depuis 12 jours »', () => {
    expect(formatAnciennete(T0, '2026-08-13T08:00:00.000Z')).toBe('depuis 12 jours');
  });

  it('dit « depuis hier » au singulier', () => {
    expect(formatAnciennete(T0, '2026-08-02T09:00:00.000Z')).toBe('depuis hier');
  });

  it('dit « depuis aujourd’hui » le jour même', () => {
    expect(formatAnciennete(T0, '2026-08-01T18:00:00.000Z')).toBe("depuis aujourd'hui");
  });

  /** Une date future ou illisible n'affiche rien : mieux vaut rien qu'un chiffre faux. */
  it('rend null plutôt qu’une durée négative', () => {
    expect(formatAnciennete('2026-08-13T08:00:00.000Z', T0)).toBeNull();
  });

  it('rend null sur une date illisible', () => {
    expect(formatAnciennete('jamais', T0)).toBeNull();
  });
});

describe('libelleEtape', () => {
  it('met en forme un identifiant à rallonge', () => {
    expect(libelleEtape('fin_de_cycle')).toBe('Fin de cycle');
  });

  it('met la première lettre en capitale', () => {
    expect(libelleEtape('incubation')).toBe('Incubation');
  });

  it('accepte le tiret comme séparateur', () => {
    expect(libelleEtape('flush-1')).toBe('Flush 1');
  });

  /** Un identifiant vide ou fait de séparateurs se rend tel quel : ne rien inventer. */
  it('rend l’identifiant inchangé quand il ne reste rien à mettre en forme', () => {
    expect(libelleEtape('___')).toBe('___');
  });
});
