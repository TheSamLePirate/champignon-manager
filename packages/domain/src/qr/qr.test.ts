import { describe, expect, it } from 'vitest';
import type { Stage } from '@champi/contracts';
import {
  formatPublicCode,
  KNOWN_PREFIXES,
  looksLikePublicCode,
  parsePublicCode,
  PREFIX_HARVEST,
  PREFIX_PRODUCT,
  PREFIX_ROOM,
  prefixForStage,
} from './public-code.js';
import {
  isValidTokenFormat,
  makeToken,
  TOKEN_ALPHABET,
  TOKEN_LENGTH,
  validateTokenFormat,
} from './token.js';

describe('prefixForStage', () => {
  it.each<[Stage, string]>([
    ['gelose', 'GEL'],
    ['liquid_culture', 'LC'],
    ['grain', 'GRA'],
    ['substrate', 'SUB'],
    ['fruiting', 'FRU'],
  ])('associe le stade « %s » au préfixe « %s »', (stage, prefix) => {
    expect(prefixForStage(stage)).toBe(prefix);
  });

  it('expose aussi les préfixes hors unités de culture', () => {
    expect(KNOWN_PREFIXES).toContain(PREFIX_HARVEST);
    expect(KNOWN_PREFIXES).toContain(PREFIX_PRODUCT);
    expect(KNOWN_PREFIXES).toContain(PREFIX_ROOM);
  });

  it('épingle la liste complète des préfixes — c’est un contrat visible sur les étiquettes', () => {
    expect(KNOWN_PREFIXES).toEqual(['GEL', 'LC', 'GRA', 'SUB', 'FRU', 'REC', 'PRO', 'CHA']);
  });
});

describe('formatPublicCode', () => {
  it('compose un code lisible avec séquence complétée', () => {
    expect(formatPublicCode('SUB', 2026, 42)).toEqual({ ok: true, value: 'SUB-2026-0042' });
  });

  it('accepte un préfixe court', () => {
    expect(formatPublicCode('LC', 2026, 7)).toEqual({ ok: true, value: 'LC-2026-0007' });
  });

  it('ne tronque pas une séquence à cinq chiffres', () => {
    expect(formatPublicCode('SUB', 2026, 12345)).toEqual({ ok: true, value: 'SUB-2026-12345' });
  });

  it('accepte la toute première séquence', () => {
    expect(formatPublicCode('SUB', 2026, 1)).toEqual({ ok: true, value: 'SUB-2026-0001' });
  });

  it('accepte la dernière séquence représentable', () => {
    expect(formatPublicCode('SUB', 2026, 999_999)).toEqual({ ok: true, value: 'SUB-2026-999999' });
  });

  it('refuse une séquence nulle', () => {
    const result = formatPublicCode('SUB', 2026, 0);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_FAILED');
    expect(result.error.message).toContain('commence à 1');
    expect(result.error.hint).toContain('Séquence reçue : 0');
    expect(result.error.path).toBe('sequence');
  });

  it('refuse une séquence négative', () => {
    expect(formatPublicCode('SUB', 2026, -1).ok).toBe(false);
  });

  it('refuse la première séquence qui déborde le format, sans la tronquer en silence', () => {
    const result = formatPublicCode('SUB', 2026, 1_000_000);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_FAILED');
    expect(result.error.message).toContain('999 999');
    expect(result.error.hint).toContain('élargir le format');
    expect(result.error.path).toBe('sequence');
  });

  it('complète l’année sur quatre chiffres', () => {
    expect(formatPublicCode('SUB', 42, 1)).toEqual({ ok: true, value: 'SUB-0042-0001' });
  });

  it('refuse un préfixe qui ne produirait pas un code valide', () => {
    const result = formatPublicCode('substrat-trop-long', 2026, 1);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_FAILED');
    expect(result.error.message).toContain('substrat-trop-long');
    expect(result.error.hint).toContain('Préfixes connus');
    expect(result.error.hint).toContain('SUB');
    expect(result.error.path).toBe('prefix');
  });

  it('refuse un préfixe en minuscules', () => {
    expect(formatPublicCode('sub', 2026, 1).ok).toBe(false);
  });
});

describe('parsePublicCode', () => {
  it('décompose un code valide', () => {
    expect(parsePublicCode('SUB-2026-0042')).toEqual({
      ok: true,
      value: { prefix: 'SUB', year: 2026, sequence: 42 },
    });
  });

  it('accepte un préfixe de deux lettres', () => {
    const result = parsePublicCode('LC-2026-0007');
    expect(result.ok && result.value.prefix).toBe('LC');
  });

  it.each(['sub-2026-0042', 'SUB-26-0042', 'SUB-2026-1', 'SUB20260042', '', 'SUB-2026-'])(
    'refuse « %s »',
    (code) => {
      expect(parsePublicCode(code).ok).toBe(false);
    },
  );

  it('explique le format attendu quand le code est invalide', () => {
    const result = parsePublicCode('BLOC1');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_FAILED');
    expect(result.error.message).toContain('BLOC1');
    expect(result.error.message).toContain('code public valide');
    expect(result.error.hint).toContain('PREFIXE-ANNEE-SEQUENCE');
    expect(result.error.hint).toContain('SUB-2026-0042');
    expect(result.error.path).toBe('publicCode');
  });

  it('fait l’aller-retour avec formatPublicCode', () => {
    const code = formatPublicCode('FRU', 2027, 999);
    expect(code.ok).toBe(true);
    if (!code.ok) return;
    expect(parsePublicCode(code.value)).toEqual({
      ok: true,
      value: { prefix: 'FRU', year: 2027, sequence: 999 },
    });
  });
});

describe('looksLikePublicCode', () => {
  it('reconnaît un code public', () => {
    expect(looksLikePublicCode('SUB-2026-0042')).toBe(true);
  });

  it('ne confond pas un identifiant technique avec un code public', () => {
    expect(looksLikePublicCode('66b3f1e2a4c9d0e1f2a3b4c5')).toBe(false);
  });
});

describe('makeToken', () => {
  /** Source déterministe : chaque octet vaut son index, pour un token reproductible. */
  const sequentialBytes = (length: number): Uint8Array =>
    Uint8Array.from({ length }, (_, index) => index);

  it('produit un token de la longueur attendue', () => {
    const result = makeToken(sequentialBytes);
    expect(result.ok && result.value).toHaveLength(TOKEN_LENGTH);
  });

  it('n’utilise que l’alphabet déclaré', () => {
    const result = makeToken(sequentialBytes);
    expect(result.ok && isValidTokenFormat(result.value)).toBe(true);
  });

  it('est déterministe pour une source donnée — donc testable', () => {
    const first = makeToken(sequentialBytes);
    const second = makeToken(sequentialBytes);
    expect(first).toEqual(second);
  });

  it('replie les octets au-delà de la taille de l’alphabet', () => {
    const result = makeToken((length) => new Uint8Array(length).fill(255));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // L'alphabet fait 31 symboles : 255 % 31 = 7, soit le huitième, « H ».
    expect(TOKEN_ALPHABET).toHaveLength(31);
    expect(result.value).toBe('H'.repeat(TOKEN_LENGTH));
  });

  it('refuse une source qui rend trop peu d’octets', () => {
    const result = makeToken(() => new Uint8Array(4));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_FAILED');
    expect(result.error.message).toContain('4 octets');
    expect(result.error.message).toContain('22');
    expect(result.error.hint).toContain('exactement la longueur demandée');
  });

  it('accepte exactement la longueur attendue', () => {
    expect(makeToken((length) => new Uint8Array(length)).ok).toBe(true);
  });

  it('refuse une source qui rend trop d’octets', () => {
    expect(makeToken(() => new Uint8Array(64)).ok).toBe(false);
  });

  it('n’emploie aucun caractère ambigu — les étiquettes se lisent sous condensation', () => {
    for (const ambiguous of ['0', 'O', '1', 'I', 'l']) {
      expect(TOKEN_ALPHABET).not.toContain(ambiguous);
    }
  });
});

describe('validateTokenFormat', () => {
  const valid = 'ABCDEFGHJKMNPQRSTUVW';

  it('accepte un token bien formé', () => {
    const token = valid + 'XY';
    expect(validateTokenFormat(token)).toEqual({ ok: true, value: token });
  });

  it('refuse un token trop court', () => {
    expect(validateTokenFormat(valid).ok).toBe(false);
  });

  it('refuse un token trop long', () => {
    expect(validateTokenFormat(valid + 'XYZ').ok).toBe(false);
  });

  it('refuse un caractère hors alphabet', () => {
    expect(validateTokenFormat(valid + 'X0').ok).toBe(false);
  });

  it('refuse les minuscules', () => {
    expect(validateTokenFormat(valid.toLowerCase() + 'xy').ok).toBe(false);
  });

  it('oriente vers la bonne cause quand le scan ne vient pas de l’application', () => {
    const result = validateTokenFormat('https://exemple.fr/produit/42');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.hint).toContain('22 caractères');
    expect(result.error.hint).toContain("étiquette de l'application");
    expect(result.error.path).toBe('token');
  });
});
