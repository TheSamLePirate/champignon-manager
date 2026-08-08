import { appError } from '@champi/contracts';
import { err, ok, type Result } from '../result.js';

/**
 * Tokens QR — le contenu réel du code imprimé.
 *
 * Le QR ne porte **qu'un token opaque**, sans URL et sans donnée métier
 * (`docs/10` §3). Conséquences assumées :
 *
 * - un QR perdu ou photographié ne révèle rien sur l'unité ;
 * - la caméra native iOS ne peut pas l'ouvrir : c'est le scanner web intégré
 *   qui résout le token, via HTTPS Tailscale ;
 * - une étiquette abîmée se **réimprime à l'identique** (`q17_5`) — le token ne
 *   change pas, sinon la traçabilité perdrait le lien avec l'objet physique.
 *
 * L'exigence « tokens non prédictibles » de `docs/12` §3 est **maintenue malgré
 * l'absence d'authentification** : sans elle, deviner un token donnerait accès
 * à une unité indépendamment du réseau.
 */

/** Alphabet sans caractères ambigus : ni 0/O, ni 1/I/l. Lisible si saisi à la main. */
export const TOKEN_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** 22 caractères sur 31 symboles ≈ 109 bits d'entropie. Hors de portée du devinable. */
export const TOKEN_LENGTH = 22;

const TOKEN_PATTERN = new RegExp(`^[${TOKEN_ALPHABET}]{${String(TOKEN_LENGTH)}}$`);

/**
 * Fabrique un token à partir d'une source d'aléa **injectée**.
 *
 * Le domaine n'appelle jamais `Math.random()` (règle ESLint) : la source vient
 * de la coquille impérative, qui utilise `crypto.getRandomValues`. C'est ce qui
 * rend cette fonction testable de façon déterministe tout en restant
 * cryptographiquement sûre en production.
 *
 * @param randomBytes doit rendre exactement `TOKEN_LENGTH` octets.
 */
export function makeToken(randomBytes: (length: number) => Uint8Array): Result<string> {
  const bytes = randomBytes(TOKEN_LENGTH);
  if (bytes.length !== TOKEN_LENGTH) {
    return err(
      appError(
        'VALIDATION_FAILED',
        `La source d'aléa a rendu ${String(bytes.length)} octets au lieu de ${String(TOKEN_LENGTH)}.`,
        { hint: 'Le générateur doit rendre exactement la longueur demandée.' },
      ),
    );
  }
  // `charAt` plutôt que l'indexation : il rend toujours une chaîne, donc pas de
  // branche défensive inatteignable à écrire — ni à couvrir.
  let token = '';
  for (const byte of bytes) {
    token += TOKEN_ALPHABET.charAt(byte % TOKEN_ALPHABET.length);
  }
  return ok(token);
}

/** Valide la forme d'un token, sans rien dire de son existence en base. */
export function isValidTokenFormat(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

/** Valide un token scanné, avec un message qui distingue forme et existence. */
export function validateTokenFormat(token: string): Result<string> {
  if (!isValidTokenFormat(token)) {
    return err(
      appError('VALIDATION_FAILED', `« ${token} » n'a pas la forme d'un token QR.`, {
        hint: `Un token fait ${String(TOKEN_LENGTH)} caractères de l'alphabet ${TOKEN_ALPHABET}. Vérifie que le QR scanné est bien une étiquette de l'application.`,
        path: 'token',
      }),
    );
  }
  return ok(token);
}
