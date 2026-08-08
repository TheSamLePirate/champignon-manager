import { appError, listHint, type Stage } from '@champi/contracts';
import { err, ok, type Result } from '../result.js';

/**
 * Codes publics — l'identifiant que lisent les humains et les agents.
 *
 * Format : `PREFIXE-ANNEE-SEQUENCE`, par exemple `SUB-2026-0042`.
 *
 * Ce n'est **pas** le contenu du QR : le QR ne porte qu'un token opaque
 * (`docs/10` §3, voir `token.ts`). Le code public sert à parler d'une unité —
 * sur une étiquette, dans une conversation, dans un appel d'API. C'est
 * précisément pour ça qu'il est accepté partout où un identifiant technique
 * l'est (docs/22 §4.3, propriété 5).
 */

/** Préfixe par stade. Court, lisible, sans ambiguïté à l'oral. */
const PREFIX_BY_STAGE: Readonly<Record<Stage, string>> = {
  gelose: 'GEL',
  liquid_culture: 'LC',
  grain: 'GRA',
  substrate: 'SUB',
  fruiting: 'FRU',
};

/** Préfixes des objets qui ne sont pas des unités de culture. */
export const PREFIX_HARVEST = 'REC';
export const PREFIX_PRODUCT = 'PRO';
export const PREFIX_ROOM = 'CHA';

export function prefixForStage(stage: Stage): string {
  return PREFIX_BY_STAGE[stage];
}

/** Tous les préfixes connus — sert aux messages d'erreur et à la validation. */
export const KNOWN_PREFIXES: readonly string[] = [
  ...Object.values(PREFIX_BY_STAGE),
  PREFIX_HARVEST,
  PREFIX_PRODUCT,
  PREFIX_ROOM,
];

const PUBLIC_CODE_PATTERN = /^([A-Z]{2,4})-(\d{4})-(\d{4,6})$/;

export interface ParsedPublicCode {
  readonly prefix: string;
  readonly year: number;
  readonly sequence: number;
}

/**
 * Compose un code public.
 *
 * La séquence est **fournie**, jamais calculée ici : elle vient d'un compteur
 * atomique en base. Le domaine reste pur.
 */
export function formatPublicCode(prefix: string, year: number, sequence: number): Result<string> {
  if (sequence < 1) {
    return err(
      appError('VALIDATION_FAILED', 'La séquence d’un code public commence à 1.', {
        hint: `Séquence reçue : ${String(sequence)}.`,
        path: 'sequence',
      }),
    );
  }
  if (sequence > 999_999) {
    return err(
      appError(
        'VALIDATION_FAILED',
        'La séquence dépasse 999 999 : le format de code public ne peut plus la représenter.',
        {
          hint: 'Il faut élargir le format avant de continuer à créer des unités.',
          path: 'sequence',
        },
      ),
    );
  }
  const code = `${prefix}-${String(year).padStart(4, '0')}-${String(sequence).padStart(4, '0')}`;
  return parsePublicCode(code).ok
    ? ok(code)
    : err(
        appError('VALIDATION_FAILED', `Le préfixe « ${prefix} » ne produit pas un code valide.`, {
          hint: listHint('Préfixes connus', KNOWN_PREFIXES),
          path: 'prefix',
        }),
      );
}

/** Décompose un code public. Refuse tout ce qui ne suit pas exactement le format. */
export function parsePublicCode(code: string): Result<ParsedPublicCode> {
  const match = PUBLIC_CODE_PATTERN.exec(code);
  if (match === null) {
    return err(
      appError('VALIDATION_FAILED', `« ${code} » n'est pas un code public valide.`, {
        hint: 'Format attendu : PREFIXE-ANNEE-SEQUENCE, par exemple SUB-2026-0042.',
        path: 'publicCode',
      }),
    );
  }
  // Les trois groupes existent dès lors que l'expression a filé.
  const [, prefix = '', year = '0', sequence = '0'] = match;
  return ok({ prefix, year: Number(year), sequence: Number(sequence) });
}

/** Une référence ressemble-t-elle à un code public plutôt qu'à un identifiant technique ? */
export function looksLikePublicCode(reference: string): boolean {
  return PUBLIC_CODE_PATTERN.test(reference);
}
