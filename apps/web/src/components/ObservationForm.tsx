import { useState } from 'react';
import type { CultureUnit, Severity } from '@champi/contracts';
import { relevantObservationKinds, type ObservationKind } from '@champi/domain';

/**
 * Saisie d'une observation terrain.
 *
 * Trois règles du cadrage sont visibles à l'écran :
 *
 * 1. **Pas de liste d'observations par étape** (`q12_2`) : la liste complète
 *    existe partout, on masque seulement ce qui n'a aucun sens au stade courant.
 *    C'est la même fonction pure que celle du serveur — donc jamais deux avis.
 * 2. **Gravité à trois niveaux** (`q12_3`), pas davantage : le cultivateur les a
 *    nommés, et une échelle plus fine ne serait pas tenue en chambre.
 * 3. **Photo obligatoire sur contamination** (`q12_4`) — la seule saisie
 *    obligatoire de toute l'application. L'interface le dit **avant** que le
 *    serveur ne refuse, et explique pourquoi.
 */

export interface ObservationDraft {
  readonly kind: string;
  readonly severity: Severity;
  readonly note?: string;
  readonly photoId?: string;
}

export interface ObservationFormProps {
  readonly unit: CultureUnit;
  /** Horloge injectée : la référence de photo est horodatée. */
  readonly nowIso: string;
  readonly busy: boolean;
  readonly onSubmit: (draft: ObservationDraft) => void;
  readonly onCancel: () => void;
}

/** Exhaustif par construction : le type refuse qu'on oublie un cas. */
const KIND_LABEL: Readonly<Record<ObservationKind, string>> = {
  contamination: 'Contamination',
  colonisation: 'Colonisation',
  odeur: 'Odeur',
  couleur_suspecte: 'Couleur suspecte',
  humidite_visuelle: 'Humidité visible',
  taille: 'Taille',
  couleur: 'Couleur',
  autre: 'Autre',
};

const SEVERITES: readonly { value: Severity; label: string }[] = [
  { value: 'low', label: 'Léger' },
  { value: 'medium', label: 'Moyen' },
  { value: 'critical', label: 'Critique' },
];

export function ObservationForm({
  unit,
  nowIso,
  busy,
  onSubmit,
  onCancel,
}: ObservationFormProps): React.JSX.Element {
  const kinds = relevantObservationKinds(unit.stage);
  // La colonisation est l'observation de routine ; la contamination est
  // l'exception. Ouvrir sur « contamination » — première de la liste du
  // domaine — imposerait une photo avant même que l'opérateur ait choisi, et
  // le bouton d'enregistrement s'afficherait désactivé sans raison visible.
  // La colonisation n'est masquée à aucun stade : un test du domaine le tient.
  const [kind, setKind] = useState<string>('colonisation');
  const [severity, setSeverity] = useState<Severity>('low');
  const [note, setNote] = useState('');
  const [photoId, setPhotoId] = useState<string | null>(null);

  const photoRequise = kind === 'contamination';
  const photoManquante = photoRequise && photoId === null;

  return (
    <form
      className="saisie"
      aria-labelledby="observation-titre"
      onSubmit={(event) => {
        event.preventDefault();
        if (photoManquante) {
          return;
        }
        onSubmit({
          kind,
          severity,
          ...(note.trim() === '' ? {} : { note: note.trim() }),
          ...(photoId === null ? {} : { photoId }),
        });
      }}
    >
      <h3 id="observation-titre" className="saisie__titre">
        Noter une observation
      </h3>

      <div className="champ">
        <label htmlFor="observation-kind">Ce que tu vois</label>
        <select
          id="observation-kind"
          value={kind}
          onChange={(event) => {
            setKind(event.target.value);
          }}
        >
          {kinds.map((candidat) => (
            <option key={candidat} value={candidat}>
              {KIND_LABEL[candidat]}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="champ champ--gravite">
        <legend>Gravité</legend>
        <div className="puces">
          {SEVERITES.map((niveau) => (
            <label key={niveau.value} className="puce">
              <input
                type="radio"
                name="severity"
                value={niveau.value}
                checked={severity === niveau.value}
                onChange={() => {
                  setSeverity(niveau.value);
                }}
              />
              <span>{niveau.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {photoRequise && (
        <div className="champ champ--photo">
          {photoId === null ? (
            <>
              <p className="champ__consigne" role="status">
                Une contamination se documente par une photo. C’est la seule saisie obligatoire de
                l’application : c’est elle qui permettra de trancher plus tard.
              </p>
              <button
                type="button"
                className="bouton--secondaire"
                onClick={() => {
                  // La photo est prise avec l'appareil photo du téléphone. On
                  // enregistre sa **référence horodatée** : le stockage des images
                  // n'est pas dans la tranche verticale, seul le `photoId` l'est.
                  setPhotoId(`photo-${nowIso}`);
                }}
              >
                J’ai pris la photo
              </button>
            </>
          ) : (
            // La consigne a fait son travail : elle cède la place plutôt que
            // d'allonger un formulaire qu'on lit à bout de bras.
            <p className="champ__confirme" role="status">
              Photo référencée. L’image reste sur le téléphone ; l’observation garde sa référence.
            </p>
          )}
        </div>
      )}

      <div className="champ">
        <label htmlFor="observation-note">Précision (facultatif)</label>
        <textarea
          id="observation-note"
          rows={2}
          value={note}
          placeholder="Point vert en bordure, côté gauche"
          onChange={(event) => {
            setNote(event.target.value);
          }}
        />
      </div>

      <div className="saisie__actions">
        <button type="submit" disabled={busy || photoManquante}>
          Enregistrer l’observation
        </button>
        <button type="button" className="bouton--secondaire" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  );
}
