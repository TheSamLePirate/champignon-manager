import { useCallback, useEffect, useRef, useState } from 'react';
import { interpretScan, type ScanInput } from '../lib/scanner.js';

/**
 * Scanner à la caméra.
 *
 * C'était le dernier trou du parcours terrain : l'application diagnostiquait la
 * caméra sans jamais l'ouvrir. En chambre, on arrive **par une étiquette** — la
 * saisie manuelle est un repli, pas le geste normal.
 *
 * Deux dépendances du navigateur, toutes deux **injectées**, pour que l'écran
 * soit testable sans matériel :
 *
 * - `ouvrirCamera` — `getUserMedia`, qui exige un contexte sécurisé. Sous
 *   Safari iOS, c'est la première cause d'échec, et l'écran le dit en clair ;
 * - `detecter` — la lecture du QR. Safari n'implémente pas `BarcodeDetector` ;
 *   l'assemblage y branche donc un équivalent WebAssembly. Le composant, lui,
 *   ne connaît qu'une fonction qui rend des chaînes.
 *
 * La caméra arrière est demandée explicitement : sur un téléphone tenu à bout
 * de bras au-dessus d'un sac, la caméra frontale filmerait le plafond.
 */

export interface CameraScannerProps {
  readonly ouvrirCamera: () => Promise<MediaStream>;
  readonly detecter: (source: HTMLVideoElement) => Promise<readonly string[]>;
  /** Cadence de lecture. 300 ms suffit et laisse la batterie tranquille. */
  readonly intervalleMs?: number;
  readonly onScan: (input: Exclude<ScanInput, { kind: 'unknown' }>) => void;
  readonly onFermer: () => void;
}

/**
 * Choisit ce qu'il faut retenir parmi les codes lus dans une image.
 *
 * Plusieurs étiquettes peuvent entrer dans le cadre — des sacs sont côte à côte
 * sur une étagère. On retient le premier code **reconnu**, et on ignore les
 * autres plutôt que d'ouvrir une fiche au hasard.
 */
export function choisirCode(
  codes: readonly string[],
): Exclude<ScanInput, { kind: 'unknown' }> | null {
  for (const code of codes) {
    const lu = interpretScan(code);
    if (lu.kind !== 'unknown') {
      return lu;
    }
  }
  return null;
}

type Etat =
  | { readonly phase: 'ouverture' }
  | { readonly phase: 'lecture' }
  | { readonly phase: 'refus'; readonly message: string };

export function CameraScanner({
  ouvrirCamera,
  detecter,
  intervalleMs = 300,
  onScan,
  onFermer,
}: CameraScannerProps): React.JSX.Element {
  /*
   * L'élément vidéo passe par un **état**, pas par une `ref`.
   *
   * Avec une `ref`, le « et si l'élément n'existait pas ? » était une garde
   * qu'aucun chemin ne pouvait atteindre — donc du code mort, que la barrière à
   * 100 % a signalé. Ici, l'absence est réelle au premier rendu et l'effet se
   * relance quand l'élément apparaît.
   */
  const [cible, setCible] = useState<HTMLVideoElement | null>(null);
  const flux = useRef<MediaStream | null>(null);
  const [etat, setEtat] = useState<Etat>({ phase: 'ouverture' });

  /** Coupe la caméra. Une caméra laissée ouverte chauffe et vide la batterie. */
  const arreter = useCallback(() => {
    for (const piste of flux.current?.getTracks() ?? []) {
      piste.stop();
    }
    flux.current = null;
  }, []);

  useEffect(() => {
    if (cible === null) {
      return;
    }

    let vivant = true;
    let minuteur: ReturnType<typeof setInterval> | undefined;

    const demarrer = async (): Promise<void> => {
      try {
        const stream = await ouvrirCamera();
        if (!vivant) {
          // Le composant a été fermé pendant l'autorisation : on rend la caméra
          // au système au lieu de la garder ouverte pour personne.
          for (const piste of stream.getTracks()) {
            piste.stop();
          }
          return;
        }
        flux.current = stream;
        cible.srcObject = stream;
        setEtat({ phase: 'lecture' });

        minuteur = setInterval(() => {
          void (async () => {
            const codes = await detecter(cible).catch(() => []);
            const choisi = choisirCode(codes);
            if (choisi !== null && vivant) {
              onScan(choisi);
            }
          })();
        }, intervalleMs);
      } catch (cause) {
        if (vivant) {
          setEtat({
            phase: 'refus',
            message:
              cause instanceof Error && cause.name === 'NotAllowedError'
                ? 'Accès à la caméra refusé. Autorise-la pour ce site, ou saisis le code à la main.'
                : 'La caméra n’a pas pu s’ouvrir. Saisis le code imprimé sous le QR.',
          });
        }
      }
    };

    void demarrer();

    return () => {
      vivant = false;
      if (minuteur !== undefined) {
        clearInterval(minuteur);
      }
      arreter();
    };
  }, [cible, ouvrirCamera, detecter, intervalleMs, onScan, arreter]);

  return (
    <div className="viseur">
      {etat.phase === 'refus' ? (
        <p className="viseur__refus" role="alert">
          {etat.message}
        </p>
      ) : (
        <>
          {/* `playsInline` est obligatoire : sans lui, iOS ouvre la vidéo en
              plein écran et le cadrage devient impossible. */}
          <video
            ref={setCible}
            className="viseur__video"
            autoPlay
            muted
            playsInline
            aria-label="Viseur de la caméra"
          />
          <p className="viseur__consigne" role="status">
            {etat.phase === 'ouverture' ? 'Ouverture de la caméra…' : 'Cadre le QR de l’étiquette.'}
          </p>
        </>
      )}
      <button type="button" className="bouton--secondaire" onClick={onFermer}>
        Fermer la caméra
      </button>
    </div>
  );
}
