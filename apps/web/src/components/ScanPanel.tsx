import { useState } from 'react';
import { diagnoseScanning, interpretScan, type ScanEnvironment } from '../lib/scanner.js';

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
  compact = false,
}: ScanPanelProps): React.JSX.Element {
  const [manual, setManual] = useState('');
  const capability = diagnoseScanning(environment);
  const interpreted = interpretScan(manual);
  const canSubmit = manual.trim().length > 0 && interpreted.kind !== 'unknown';

  return (
    <section className="scan" aria-labelledby="scan-title">
      <h2 id="scan-title">{compact ? 'Scanner une autre étiquette' : 'Scanner une étiquette'}</h2>

      {compact ? null : capability.available ? (
        // ⚠️ La capture caméra n'est pas encore branchée : elle attend la
        // validation de `getUserMedia` sous Safari iOS via `tailscale serve`,
        // dernier spike ouvert du projet (docs/22 §9). Annoncer honnêtement
        // l'attente vaut mieux qu'un bouton qui ne ferait rien.
        <p className="scan__unavailable" role="status">
          Cet appareil peut scanner. La capture caméra sera activée après validation sur iPhone — en
          attendant, saisis le code imprimé sous le QR.
        </p>
      ) : (
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
