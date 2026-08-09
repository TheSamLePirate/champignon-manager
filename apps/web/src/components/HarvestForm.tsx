import { useState } from 'react';

/**
 * Enregistrement d'une récolte.
 *
 * Ce que le cultivateur a demandé (`q14_1`, `q9_7_2`→`5`) : **poids par unité,
 * qualité, et pertes avec leur cause**. Pas une pesée globale en fin de
 * journée — c'est unité par unité que le rendement se compare.
 *
 * Les pertes sont facultatives mais leur **cause ne l'est pas** dès qu'un poids
 * est saisi : une perte sans cause n'apprend rien et fausse l'analyse d'un
 * flush faible.
 */

export type Qualite = 'A' | 'B' | 'C';
export type CausePerte = 'contamination' | 'malformation' | 'overripe' | 'damage' | 'other';

export interface HarvestDraft {
  readonly flushNumber: number;
  readonly weight: { value: number; unit: 'g'; kind: 'harvest' };
  readonly quality: Qualite;
  readonly losses: { weight: { value: number; unit: 'g'; kind: 'harvest' }; cause: CausePerte }[];
}

export interface HarvestFormProps {
  /** Numéro du prochain flush, déduit des récoltes déjà enregistrées. */
  readonly prochainFlush: number;
  readonly busy: boolean;
  readonly onSubmit: (draft: HarvestDraft) => void;
  readonly onCancel: () => void;
}

const QUALITES: readonly { value: Qualite; label: string }[] = [
  { value: 'A', label: 'A — vente' },
  { value: 'B', label: 'B — second choix' },
  { value: 'C', label: 'C — transformation' },
];

const CAUSES: Readonly<Record<CausePerte, string>> = {
  contamination: 'Contamination',
  malformation: 'Malformation',
  overripe: 'Trop mûr',
  damage: 'Abîmé',
  other: 'Autre',
};

export function HarvestForm({
  prochainFlush,
  busy,
  onSubmit,
  onCancel,
}: HarvestFormProps): React.JSX.Element {
  const [flush, setFlush] = useState(String(prochainFlush));
  const [poids, setPoids] = useState('');
  const [quality, setQuality] = useState<Qualite>('A');
  const [perte, setPerte] = useState('');
  const [cause, setCause] = useState<CausePerte>('contamination');

  const nombre = (texte: string): number => Number(texte.replace(',', '.'));
  const poidsValide = poids.trim() !== '' && Number.isFinite(nombre(poids)) && nombre(poids) > 0;
  const flushValide = Number.isInteger(nombre(flush)) && nombre(flush) > 0;
  const perteValide = perte.trim() === '' || (Number.isFinite(nombre(perte)) && nombre(perte) > 0);

  return (
    <form
      className="saisie"
      aria-labelledby="recolte-titre"
      onSubmit={(event) => {
        event.preventDefault();
        if (!poidsValide || !flushValide || !perteValide) {
          return;
        }
        onSubmit({
          flushNumber: nombre(flush),
          weight: { value: nombre(poids), unit: 'g', kind: 'harvest' },
          quality,
          losses:
            perte.trim() === ''
              ? []
              : [{ weight: { value: nombre(perte), unit: 'g', kind: 'harvest' }, cause }],
        });
      }}
    >
      <h3 id="recolte-titre" className="saisie__titre">
        Enregistrer une récolte
      </h3>

      <div className="champ">
        <label htmlFor="recolte-flush">Flush</label>
        <input
          id="recolte-flush"
          type="text"
          inputMode="numeric"
          value={flush}
          onChange={(event) => {
            setFlush(event.target.value);
          }}
        />
      </div>

      <div className="champ">
        <label htmlFor="recolte-poids">Poids récolté en g</label>
        <input
          id="recolte-poids"
          type="text"
          inputMode="decimal"
          value={poids}
          placeholder="820"
          onChange={(event) => {
            setPoids(event.target.value);
          }}
        />
      </div>

      <fieldset className="champ">
        <legend>Qualité</legend>
        <div className="puces">
          {QUALITES.map((niveau) => (
            <label key={niveau.value} className="puce">
              <input
                type="radio"
                name="quality"
                value={niveau.value}
                checked={quality === niveau.value}
                onChange={() => {
                  setQuality(niveau.value);
                }}
              />
              <span>{niveau.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="champ">
        <label htmlFor="recolte-perte">Pertes en g (facultatif)</label>
        <input
          id="recolte-perte"
          type="text"
          inputMode="decimal"
          value={perte}
          placeholder="40"
          onChange={(event) => {
            setPerte(event.target.value);
          }}
        />
      </div>

      {perte.trim() !== '' && (
        <div className="champ">
          <label htmlFor="recolte-cause">Cause de la perte</label>
          <select
            id="recolte-cause"
            value={cause}
            onChange={(event) => {
              setCause(event.target.value as CausePerte);
            }}
          >
            {Object.entries(CAUSES).map(([valeur, label]) => (
              <option key={valeur} value={valeur}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="saisie__actions">
        <button type="submit" disabled={busy || !poidsValide || !flushValide || !perteValide}>
          Enregistrer la récolte
        </button>
        <button type="button" className="bouton--secondaire" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  );
}
