/**
 * Scanner QR web.
 *
 * ⚠️ **Point de risque restant du projet.** Le scanner exige `getUserMedia`,
 * donc un contexte sécurisé sous Safari iOS. Tailscale fournit HTTPS via
 * `tailscale serve` et un certificat Let's Encrypt (docs/21, P0-4) — le chemin
 * est correct sur le papier, mais **n'a pas encore été validé sur un iPhone
 * réel**. C'est le seul spike encore ouvert.
 *
 * Ce module est écrit pour que ce risque ne bloque rien :
 *
 * - il **diagnostique** l'environnement au lieu d'échouer sur un message
 *   générique — un opérateur en chambre doit savoir si le problème vient du
 *   HTTPS, de la permission caméra ou du navigateur ;
 * - il expose une **saisie manuelle** du code public comme repli permanent.
 *   Une étiquette illisible ou une caméra en panne ne doit pas empêcher de
 *   travailler.
 */

export type ScanCapability =
  | { readonly available: true }
  | { readonly available: false; readonly reason: ScanBlockReason; readonly message: string };

export type ScanBlockReason =
  'insecure-context' | 'no-camera-api' | 'no-barcode-detector' | 'permission-denied';

export interface ScanEnvironment {
  readonly isSecureContext: boolean;
  readonly hasMediaDevices: boolean;
  readonly hasBarcodeDetector: boolean;
}

/**
 * Diagnostique la capacité à scanner.
 *
 * L'ordre des vérifications suit celui des causes réelles : sous iOS, un
 * contexte non sécurisé est de loin la première raison d'échec, et c'est celle
 * qu'un message générique masque le plus souvent.
 */
export function diagnoseScanning(environment: ScanEnvironment): ScanCapability {
  if (!environment.isSecureContext) {
    return {
      available: false,
      reason: 'insecure-context',
      message:
        "La caméra n'est accessible qu'en HTTPS. Ouvre l'application par son adresse Tailscale (https://…​.ts.net) plutôt que par une adresse IP.",
    };
  }
  if (!environment.hasMediaDevices) {
    return {
      available: false,
      reason: 'no-camera-api',
      message:
        "Ce navigateur n'expose pas de caméra. Sur iPhone, utilise Safari ; sinon, saisis le code de l'étiquette à la main.",
    };
  }
  if (!environment.hasBarcodeDetector) {
    return {
      available: false,
      reason: 'no-barcode-detector',
      message:
        'Ce navigateur ne sait pas décoder les QR nativement. La saisie manuelle du code reste disponible.',
    };
  }
  return { available: true };
}

/** Lit l'environnement réel du navigateur. Isolé pour rester testable. */
export function readScanEnvironment(win: {
  isSecureContext: boolean;
  navigator: { mediaDevices?: unknown };
  BarcodeDetector?: unknown;
}): ScanEnvironment {
  return {
    isSecureContext: win.isSecureContext,
    hasMediaDevices: win.navigator.mediaDevices !== undefined,
    hasBarcodeDetector: win.BarcodeDetector !== undefined,
  };
}

export type ScanInput =
  | { readonly kind: 'token'; readonly value: string }
  | { readonly kind: 'public-code'; readonly value: string }
  | { readonly kind: 'unknown'; readonly value: string };

const TOKEN_PATTERN = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{22}$/;
const PUBLIC_CODE_PATTERN = /^[A-Z]{2,4}-\d{4}-\d{4,6}$/;

/**
 * Interprète ce qui a été scanné ou saisi.
 *
 * Les deux entrées mènent au même endroit, ce qui rend le repli manuel
 * réellement équivalent au scan : l'opérateur tape le code lisible sous le QR
 * et obtient la même fiche.
 *
 * La normalisation est généreuse — espaces, minuscules, URL collée — parce que
 * la saisie se fait avec des gants humides sur un clavier tactile.
 */
export function interpretScan(raw: string): ScanInput {
  const cleaned = raw.trim().replace(/\s+/gu, '').toUpperCase();

  // Un QR d'une autre installation peut contenir une URL : on récupère le
  // dernier segment plutôt que de refuser sèchement.
  //
  // `lastIndexOf` + `slice` plutôt que `split().pop() ?? ''` : cette dernière
  // forme portait un repli que rien ne pouvait atteindre — donc du code mort.
  const slash = cleaned.lastIndexOf('/');
  const lastSegment = slash === -1 ? cleaned : cleaned.slice(slash + 1);

  if (TOKEN_PATTERN.test(lastSegment)) {
    return { kind: 'token', value: lastSegment };
  }
  if (PUBLIC_CODE_PATTERN.test(lastSegment)) {
    return { kind: 'public-code', value: lastSegment };
  }
  return { kind: 'unknown', value: cleaned };
}

/** Chemin d'API correspondant à ce qui a été scanné. */
export function pathForScan(input: ScanInput): string | null {
  switch (input.kind) {
    case 'token':
      return `/api/qr/${input.value}`;
    case 'public-code':
      return `/api/units/${input.value}`;
    case 'unknown':
      return null;
  }
}
