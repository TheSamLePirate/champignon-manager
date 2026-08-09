import { useCallback, useEffect, useState } from 'react';
import type { CultureUnit } from '@champi/contracts';
import type { ApiClient, HarvestRecord } from '../lib/api-client.js';

/**
 * Onglet Récoltes : ce qui sort de la ferme.
 *
 * Deux choses s'y font, et une seule y est possible :
 *
 * - **voir les récoltes** de chaque unité en fructification, avec le rendement
 *   biologique quand il est calculable ;
 * - **composer un produit final** à partir de plusieurs récoltes, avec leurs
 *   proportions exactes (`q14_5`). C'est ce qui rend la remontée « barquette →
 *   blocs » exacte plutôt qu'approchée.
 *
 * Enregistrer une récolte, en revanche, se fait **depuis la fiche de l'unité** :
 * on pèse un bloc précis devant soi, pas une liste.
 */

export interface HarvestViewProps {
  readonly client: ApiClient;
  readonly onMessage: (message: string | null) => void;
}

interface Ligne {
  readonly unit: CultureUnit;
  readonly harvests: readonly HarvestRecord[];
  readonly rendementPct: number | null;
  readonly raisonAbsence: string | null;
}

/** Part de chaque récolte dans un mélange, au prorata des poids. */
export function partsAuProrata(poids: readonly number[]): { share: number; weight: number }[] {
  const total = poids.reduce((somme, valeur) => somme + valeur, 0);
  if (total === 0) {
    return [];
  }
  return poids.map((valeur) => ({ share: valeur / total, weight: valeur }));
}

export function HarvestView({ client, onMessage }: HarvestViewProps): React.JSX.Element {
  const [lignes, setLignes] = useState<readonly Ligne[]>([]);
  const [chargement, setChargement] = useState(true);
  const [selection, setSelection] = useState<readonly string[]>([]);
  const [nom, setNom] = useState('');
  const [busy, setBusy] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    // Les récoltes viennent des unités en fructification : c'est le seul stade
    // qui produit, et interroger les autres serait du bruit.
    const unites = await client.listUnits('fruiting');
    if (!unites.ok) {
      onMessage(unites.error.hint ?? unites.error.message);
      setChargement(false);
      return;
    }

    const chargees = await Promise.all(
      unites.data.map(async (unit) => {
        const detail = await client.listHarvests(unit.publicCode);
        return {
          unit,
          harvests: detail.ok ? detail.data.harvests : [],
          rendementPct: detail.ok ? detail.data.biologicalEfficiencyPct : null,
          raisonAbsence: detail.ok ? detail.data.yieldUnavailableReason : null,
        };
      }),
    );
    setLignes(chargees.filter((ligne) => ligne.harvests.length > 0));
    setChargement(false);
  }, [client, onMessage]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const toutes = lignes.flatMap((ligne) => ligne.harvests);
  const choisies = toutes.filter((harvest) => selection.includes(harvest.id));
  const parts = partsAuProrata(choisies.map((harvest) => harvest.weight.value));
  const poidsTotal = choisies.reduce((somme, harvest) => somme + harvest.weight.value, 0);

  const composer = useCallback(async () => {
    setBusy(true);
    try {
      const result = await client.createProduct({
        name: nom.trim(),
        quantity: { value: poidsTotal, unit: 'g', kind: 'product' },
        // La part se calcule ici même, à partir du poids : passer par un
        // tableau indexé imposait un repli `?? 0` qu'aucun chemin n'atteignait.
        origins: choisies.map((harvest) => ({
          harvestId: harvest.id,
          weight: { value: harvest.weight.value, unit: 'g', kind: 'harvest' },
          share: harvest.weight.value / poidsTotal,
        })),
      });
      if ('queued' in result) {
        onMessage('Composition impossible hors ligne — les parts se calculent côté serveur.');
        return;
      }
      if (!result.ok) {
        onMessage(result.error.hint ?? result.error.message);
        return;
      }
      onMessage(
        `Produit « ${result.data.product.name} » créé (${result.data.product.publicCode}) — il remonte à ${String(choisies.length)} récolte(s).`,
      );
      setSelection([]);
      setNom('');
    } finally {
      setBusy(false);
    }
  }, [client, nom, poidsTotal, choisies, onMessage]);

  if (chargement) {
    return (
      <p className="liste__attente" role="status">
        Chargement des récoltes…
      </p>
    );
  }

  return (
    <section className="recoltes" aria-labelledby="recoltes-titre">
      <h2 id="recoltes-titre">Récoltes</h2>

      {lignes.length === 0 ? (
        <p className="liste__vide" role="status">
          Aucune récolte enregistrée. Ouvre la fiche d’une unité en fructification pour peser un
          flush.
        </p>
      ) : (
        <>
          <div className="liste">
            {lignes.map((ligne) => (
              <section
                key={ligne.unit.id}
                aria-label={ligne.unit.name}
                aria-labelledby={`recolte-${ligne.unit.id}`}
              >
                <h3 id={`recolte-${ligne.unit.id}`} className="liste__stade">
                  {ligne.unit.name}
                  <span className="liste__compte">{ligne.harvests.length}</span>
                </h3>
                <p className="unit__hint">
                  {ligne.rendementPct === null
                    ? (ligne.raisonAbsence ?? 'Rendement non calculable.')
                    : `Rendement biologique : ${String(ligne.rendementPct)} %`}
                </p>
                <ul className="liste__unites">
                  {ligne.harvests.map((harvest) => (
                    <li key={harvest.id}>
                      <label className="carte carte--choix">
                        <input
                          type="checkbox"
                          checked={selection.includes(harvest.id)}
                          onChange={(event) => {
                            setSelection((actuelle) =>
                              event.target.checked
                                ? [...actuelle, harvest.id]
                                : actuelle.filter((id) => id !== harvest.id),
                            );
                          }}
                        />
                        <span className="carte__nom">
                          Flush {harvest.flushNumber} — {harvest.weight.value} g
                        </span>
                        <span className="carte__etape">
                          Qualité {harvest.quality}
                          {harvest.losses.length > 0 && <> · {harvest.losses.length} perte(s)</>}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <section className="saisie" aria-labelledby="produit-titre">
            <h3 id="produit-titre" className="saisie__titre">
              Composer un produit final
            </h3>

            {choisies.length === 0 ? (
              <p className="champ__consigne" role="status">
                Coche les récoltes à mélanger. Les proportions se calculent au prorata des poids —
                c’est ce qui permettra de remonter d’une barquette aux blocs exacts.
              </p>
            ) : (
              <>
                <div className="champ">
                  <label htmlFor="produit-nom">Nom du produit</label>
                  <input
                    id="produit-nom"
                    type="text"
                    value={nom}
                    placeholder="Barquette pleurote 500 g"
                    onChange={(event) => {
                      setNom(event.target.value);
                    }}
                  />
                </div>
                <p className="unit__hint">
                  {choisies.length} récolte(s), {poidsTotal} g au total —{' '}
                  {parts.map((part) => `${String(Math.round(part.share * 100))} %`).join(' / ')}
                </p>
                <div className="saisie__actions">
                  <button
                    type="button"
                    disabled={busy || nom.trim() === ''}
                    onClick={() => void composer()}
                  >
                    Créer le produit
                  </button>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </section>
  );
}
