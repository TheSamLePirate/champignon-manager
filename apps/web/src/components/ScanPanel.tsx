import { useState } from 'react';
import { diagnoseScanning, interpretScan, type ScanEnvironment } from '../lib/scanner.js';
import { CameraScanner } from './CameraScanner.js';

/**
 * Panneau de scan, avec saisie manuelle en repli permanent.
 *
 * La saisie manuelle n'est **pas** un mode dégradé caché : elle est toujours
 * visible. Une étiquette abîmée, une caméra en panne ou un iPhone récalcitrant
 * ne doivent pas empêcher de travailler — et le spike iOS n'étant pas encore
 * validé, c'est aussi ce qui rend ce risque non bloquant (docs/22 §9).
 */

/**
 * `onScan` ne reçoit jamais d'entrée non reconnue : le panneau interprète et
 * ne remonte que ce qui est exploitable. L'appelant n'a donc pas de cas
 * « inconnu » à traiter — l'impossible est rendu impossible par le type.
 */
export type RecognisedScan =
  | { readonly kind: 'token'; readonly value: string }
  | { readonly kind: 'public-code'; readonly value: string };

export interface ScanPanelProps {
  readonly environment: ScanEnvironment;
  readonly onScan: (input: RecognisedScan) => void;
  /** Ouvre la caméra. Injecté : le composant reste testable sans matériel. */
  readonly ouvrirCamera: () => Promise<MediaStream>;
  /** Décode les QR d'une image. Injecté pour la même raison. */
  readonly detecter: (source: HTMLVideoElement) => Promise<readonly string[]>;
  /**
   * Une fiche est déjà ouverte : le panneau se réduit à l'essentiel.
   *
   * Le diagnostic caméra a été lu une fois, il n'a pas à réoccuper l'écran
   * sous chaque unité consultée.
   */
  readonly compact?: boolean;
}

export function ScanPanel({
  environment,
  onScan,
  ouvrirCamera,
  detecter,
  compact = false,
}: ScanPanelProps): React.JSX.Element {
  const [manual, setManual] = useState('');
  const [viseurOuvert, setViseurOuvert] = useState(false);
  const capability = diagnoseScanning(environment);
  const interpreted = interpretScan(manual);
  const canSubmit = manual.trim().length > 0 && interpreted.kind !== 'unknown';

  return (
    <section className="scan" aria-labelledby="scan-title">
      <h2 id="scan-title">{compact ? 'Scanner une autre étiquette' : 'Scanner une étiquette'}</h2>

      {capability.available ? (
        viseurOuvert ? (
          <CameraScanner
            ouvrirCamera={ouvrirCamera}
            detecter={detecter}
            onScan={(input) => {
              setViseurOuvert(false);
              onScan(input);
            }}
            onFermer={() => {
              setViseurOuvert(false);
            }}
          />
        ) : (
          <button
            type="button"
            className="scan__camera"
            onClick={() => {
              setViseurOuvert(true);
            }}
          >
            Scanner avec la caméra
          </button>
        )
      ) : compact ? null : (
        // Le diagnostic remplace le bouton : dire *pourquoi* ça ne marche pas
        // vaut mieux qu'un bouton qui échoue.
        <p className="scan__unavailable" role="status">
          {capability.message}
        </p>
      )}

      <form
        className="scan__manual"
        onSubmit={(event) => {
          event.preventDefault();
          // `canSubmit` exclut déjà le cas « inconnu » — TypeScript le sait et
          // rétrécit le type, donc aucune vérification supplémentaire ici.
          if (canSubmit) {
            onScan({ kind: interpreted.kind, value: interpreted.value });
            setManual('');
          }
        }}
      >
        <label htmlFor="scan-manual">Code de l’étiquette</label>
        <input
          id="scan-manual"
          name="manual"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="SUB-2026-0042"
          value={manual}
          onChange={(event) => {
            setManual(event.target.value);
          }}
          aria-describedby="scan-manual-help"
        />
        <p id="scan-manual-help" className="scan__help">
          {manual.trim().length === 0
            ? 'Le code est imprimé sous le QR.'
            : canSubmit
              ? `Reconnu : ${interpreted.kind === 'token' ? 'code QR' : 'code d’unité'}`
              : 'Code non reconnu — vérifie la saisie.'}
        </p>
        <button type="submit" disabled={!canSubmit}>
          Ouvrir la fiche
        </button>
      </form>
    </section>
  );
}
