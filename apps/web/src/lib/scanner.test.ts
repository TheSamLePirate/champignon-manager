import { describe, expect, it } from 'vitest';
import {
  diagnoseScanning,
  interpretScan,
  pathForScan,
  readScanEnvironment,
  type ScanEnvironment,
} from './scanner.js';

const capable: ScanEnvironment = {
  isSecureContext: true,
  hasMediaDevices: true,
};

const TOKEN = 'ABCDEFGHJKMNPQRSTUVWXY';

describe('diagnoseScanning', () => {
  it('confirme un environnement capable', () => {
    expect(diagnoseScanning(capable)).toEqual({ available: true });
  });

  /**
   * Cause n°1 d'échec sous iOS, et celle qu'un message générique masque le
   * plus souvent : l'opérateur a ouvert l'app par une adresse IP.
   */
  it('pointe le HTTPS en premier, en nommant l’adresse Tailscale', () => {
    const result = diagnoseScanning({ ...capable, isSecureContext: false });
    expect(result.available).toBe(false);
    if (result.available) return;
    expect(result.reason).toBe('insecure-context');
    expect(result.message).toContain('HTTPS');
    expect(result.message).toContain('.ts.net');
    expect(result.message).toContain('adresse IP');
  });

  it('signale un navigateur sans caméra et oriente vers Safari', () => {
    const result = diagnoseScanning({ ...capable, hasMediaDevices: false });
    expect(result.available).toBe(false);
    if (result.available) return;
    expect(result.reason).toBe('no-camera-api');
    expect(result.message).toContain('Safari');
    expect(result.message).toContain('à la main');
  });

  /**
   * Safari n'implémente pas `BarcodeDetector` — et c'est le navigateur du
   * cultivateur. L'application embarque son propre décodeur : l'absence de
   * support natif n'est donc plus un motif de blocage.
   */
  it('n’exige pas de décodeur QR natif', () => {
    expect(diagnoseScanning(capable).available).toBe(true);
  });

  it('donne la priorité au HTTPS quand plusieurs causes se cumulent', () => {
    const result = diagnoseScanning({
      isSecureContext: false,
      hasMediaDevices: false,
    });
    expect(result.available).toBe(false);
    if (result.available) return;
    expect(result.reason).toBe('insecure-context');
  });
});

describe('readScanEnvironment', () => {
  it('lit un environnement complet', () => {
    expect(
      readScanEnvironment({
        isSecureContext: true,
        navigator: { mediaDevices: {} },
      }),
    ).toEqual(capable);
  });

  it('détecte l’absence de caméra', () => {
    const environment = readScanEnvironment({ isSecureContext: true, navigator: {} });
    expect(environment.hasMediaDevices).toBe(false);
  });

  it('détecte un contexte non sécurisé', () => {
    const environment = readScanEnvironment({
      isSecureContext: false,
      navigator: { mediaDevices: {} },
    });
    expect(environment.isSecureContext).toBe(false);
  });
});

describe('interpretScan', () => {
  it('reconnaît un token', () => {
    expect(interpretScan(TOKEN)).toEqual({ kind: 'token', value: TOKEN });
  });

  it('reconnaît un code public', () => {
    expect(interpretScan('SUB-2026-0042')).toEqual({
      kind: 'public-code',
      value: 'SUB-2026-0042',
    });
  });

  /**
   * La saisie se fait avec des gants humides sur un clavier tactile : la
   * normalisation doit être généreuse, sinon le repli manuel est inutilisable.
   */
  it('tolère minuscules et espaces parasites', () => {
    expect(interpretScan('  sub-2026-0042 ')).toEqual({
      kind: 'public-code',
      value: 'SUB-2026-0042',
    });
  });

  it('tolère des espaces à l’intérieur', () => {
    expect(interpretScan('SUB - 2026 - 0042').kind).toBe('public-code');
  });

  it('extrait le code d’une URL collée', () => {
    expect(interpretScan('https://champignon.tailnet.ts.net/q/' + TOKEN)).toEqual({
      kind: 'token',
      value: TOKEN,
    });
  });

  it('extrait un code public d’une URL', () => {
    expect(interpretScan('https://exemple.fr/u/SUB-2026-0042').kind).toBe('public-code');
  });

  it('classe en inconnu ce qui ne ressemble à rien', () => {
    expect(interpretScan('bonjour')).toEqual({ kind: 'unknown', value: 'BONJOUR' });
  });

  it('classe en inconnu un token de mauvaise longueur', () => {
    expect(interpretScan('ABCDEFGH').kind).toBe('unknown');
  });

  it('classe en inconnu un token contenant un caractère ambigu', () => {
    expect(interpretScan('ABCDEFGHJKMNPQRSTUVWX0').kind).toBe('unknown');
  });

  it('classe en inconnu une chaîne vide', () => {
    expect(interpretScan('   ').kind).toBe('unknown');
  });
});

describe('pathForScan', () => {
  it('route un token vers la résolution de QR', () => {
    expect(pathForScan({ kind: 'token', value: TOKEN })).toBe(`/api/qr/${TOKEN}`);
  });

  /** Le repli manuel mène au même endroit que le scan : c'est tout l'enjeu. */
  it('route un code public vers la fiche de l’unité', () => {
    expect(pathForScan({ kind: 'public-code', value: 'SUB-2026-0042' })).toBe(
      '/api/units/SUB-2026-0042',
    );
  });

  it('ne route rien pour une entrée inconnue', () => {
    expect(pathForScan({ kind: 'unknown', value: 'BONJOUR' })).toBeNull();
  });
});
