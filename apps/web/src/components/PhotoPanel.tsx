import { useCallback, useEffect, useRef, useState } from 'react';
import type { DomainEvent } from '@champi/contracts';

/**
 * Photos d'une unité.
 *
 * Le cultivateur photographie ce qu'il voit — un front de colonisation, une
 * tache suspecte, un flush prêt. Jusqu'ici l'application ne savait enregistrer
 * qu'un identifiant de photo, sans image derrière ; l'image vit maintenant sur
 * le disque et sa **référence entre au journal**, comme le reste.
 *
 * La prise de vue réutilise la caméra du scanner : mêmes contraintes, mêmes
 * ports injectés, donc testable sans matériel. On capture une image fixe depuis
 * le flux vidéo plutôt que d'ouvrir l'appareil photo du système — cela garde
 * l'opérateur dans l'application, une main occupée.
 */

export interface PhotoPanelProps {
  /** Événements de l'unité : les photos se lisent dans le journal, pas ailleurs. */
  readonly events: readonly DomainEvent[];
  readonly urlDe: (photoId: string) => string;
  readonly ouvrirCamera: () => Promise<MediaStream>;
  /** Capture une image fixe et rend une data-URL JPEG. Injecté : pas de canvas en test. */
  readonly capturer: (source: HTMLVideoElement) => string;
  readonly busy: boolean;
  readonly onPhoto: (dataUrl: string) => void;
}

interface Photo {
  readonly photoId: string;
  readonly note: string | undefined;
  readonly occurredAt: string;
}

/** Photos d'une unité, les plus récentes d'abord. */
export function photosDuJournal(events: readonly DomainEvent[]): Photo[] {
  return events
    .filter((event) => event.type === 'unit.photo_added')
    .map((event) => ({
      photoId: event.payload.photoId,
      note: event.payload.note,
      occurredAt: event.occurredAt,
    }))
    .reverse();
}

export function PhotoPanel({
  events,
  urlDe,
  ouvrirCamera,
  capturer,
  busy,
  onPhoto,
}: PhotoPanelProps): React.JSX.Element {
  const [cible, setCible] = useState<HTMLVideoElement | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);
  const flux = useRef<MediaStream | null>(null);
  const photos = photosDuJournal(events);

  /**
   * Rend la caméra au système.
   *
   * Une seule implémentation, appelée par le bouton **et** par le démontage :
   * deux boucles d'arrêt séparées se seraient désynchronisées, et une caméra
   * laissée ouverte chauffe le téléphone en pleine tournée.
   */
  const rendreCamera = useCallback(() => {
    for (const piste of flux.current?.getTracks() ?? []) {
      piste.stop();
    }
    flux.current = null;
  }, []);

  const fermer = useCallback(() => {
    rendreCamera();
    setOuvert(false);
  }, [rendreCamera]);

  useEffect(() => {
    if (!ouvert || cible === null) {
      return;
    }
    let vivant = true;

    void ouvrirCamera()
      .then((stream) => {
        if (!vivant) {
          for (const piste of stream.getTracks()) {
            piste.stop();
          }
          return;
        }
        flux.current = stream;
        cible.srcObject = stream;
        setRefus(null);
      })
      .catch(() => {
        if (vivant) {
          setRefus('La caméra n’a pas pu s’ouvrir. Vérifie l’autorisation pour ce site.');
          setOuvert(false);
        }
      });

    return () => {
      vivant = false;
      rendreCamera();
    };
  }, [ouvert, cible, ouvrirCamera, rendreCamera]);

  return (
    <section className="photos" aria-labelledby="photos-titre">
      <h3 id="photos-titre" className="unit__titre-section">
        Photos
      </h3>

      {refus !== null && (
        <p className="viseur__refus" role="alert">
          {refus}
        </p>
      )}

      {ouvert ? (
        <div className="viseur">
          <video
            ref={setCible}
            className="viseur__video"
            autoPlay
            muted
            playsInline
            aria-label="Viseur de prise de photo"
          />
          <div className="saisie__actions">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (cible !== null) {
                  onPhoto(capturer(cible));
                  fermer();
                }
              }}
            >
              Prendre la photo
            </button>
            <button type="button" className="bouton--secondaire" onClick={fermer}>
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="bouton--secondaire"
          disabled={busy}
          onClick={() => {
            setOuvert(true);
          }}
        >
          Prendre une photo
        </button>
      )}

      {photos.length === 0 ? (
        <p className="unit__hint">Aucune photo. Une image vaut souvent mieux qu’une observation.</p>
      ) : (
        <ul className="photos__galerie">
          {photos.map((photo) => (
            <li key={photo.photoId}>
              <img
                src={urlDe(photo.photoId)}
                alt={photo.note ?? `Photo du ${photo.occurredAt.slice(0, 10)}`}
                loading="lazy"
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
