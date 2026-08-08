import { useState } from 'react';

/**
 * Relevé d'une mesure.
 *
 * Trois grandeurs seulement — température, humidité, poids — parce que ce sont
 * les trois que le cultivateur relève réellement. Le clavier s'ouvre en mode
 * numérique et l'unité est affichée à côté du champ : avec des gants, on ne
 * tape pas « °C ».
 */

export type Metric = 'temperature_c' | 'humidity_pct' | 'weight';

export interface MeasureDraft {
  readonly metric: Metric;
  readonly numericValue: number;
}

export interface MeasureFormProps {
  readonly busy: boolean;
  readonly onSubmit: (draft: MeasureDraft) => void;
  readonly onCancel: () => void;
}

/**
 * Les trois grandeurs, indexées par leur métrique.
 *
 * Un enregistrement plutôt qu'un tableau parcouru : `METRIQUES[metric]` est
 * **total**, là où `find(...) ?? [0]` portait un repli qu'aucun chemin ne
 * pouvait atteindre.
 */
const METRIQUES: Readonly<Record<Metric, { label: string; unite: string }>> = {
  temperature_c: { label: 'Température', unite: '°C' },
  humidity_pct: { label: 'Humidité', unite: '%' },
  weight: { label: 'Poids', unite: 'g' },
};

export function MeasureForm({ busy, onSubmit, onCancel }: MeasureFormProps): React.JSX.Element {
  const [metric, setMetric] = useState<Metric>('temperature_c');
  const [valeur, setValeur] = useState('');

  const choisie = METRIQUES[metric];
  const nombre = Number(valeur.replace(',', '.'));
  // Une mesure sans valeur ne veut rien dire — le serveur le refuse, l'écran
  // l'empêche avant.
  const valide = valeur.trim() !== '' && Number.isFinite(nombre);

  return (
    <form
      className="saisie"
      aria-labelledby="mesure-titre"
      onSubmit={(event) => {
        event.preventDefault();
        if (valide) {
          onSubmit({ metric, numericValue: nombre });
        }
      }}
    >
      <h3 id="mesure-titre" className="saisie__titre">
        Relever une mesure
      </h3>

      <fieldset className="champ">
        <legend>Grandeur</legend>
        <div className="puces">
          {Object.entries(METRIQUES).map(([cle, definition]) => (
            <label key={cle} className="puce">
              <input
                type="radio"
                name="metric"
                value={cle}
                checked={metric === cle}
                onChange={() => {
                  setMetric(cle as Metric);
                }}
              />
              <span>{definition.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="champ">
        <label htmlFor="mesure-valeur">Valeur en {choisie.unite}</label>
        <div className="champ__unite">
          <input
            id="mesure-valeur"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={valeur}
            placeholder="24"
            onChange={(event) => {
              setValeur(event.target.value);
            }}
          />
          <span aria-hidden="true">{choisie.unite}</span>
        </div>
      </div>

      <div className="saisie__actions">
        <button type="submit" disabled={busy || !valide}>
          Enregistrer la mesure
        </button>
        <button type="button" className="bouton--secondaire" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  );
}
