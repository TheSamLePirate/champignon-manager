import type { CultureUnit } from '@champi/contracts';
import { STAGE_LABEL, STAGE_ORDER } from './StageRail.js';
import { formatAnciennete, libelleEtape } from '../lib/duree.js';

/**
 * Liste des unités en cours, groupée par stade.
 *
 * En chambre, on arrive par une étiquette — le scan reste le geste principal.
 * Mais depuis le bureau, la question est « qu'est-ce qui tourne, et depuis
 * combien de temps ? », et jusqu'ici l'application ne savait pas y répondre :
 * on ne pouvait atteindre une unité qu'en connaissant son code.
 *
 * Le groupement suit la **chaîne de propagation**, dans son ordre : c'est le
 * même repère que sur la fiche, et il se lit comme la ferme est organisée.
 * Les stades vides ne s'affichent pas — une ferme qui ne fait pas de gélose n'a
 * pas à voir une rubrique gélose toute l'année.
 */

export interface UnitListProps {
  readonly unites: readonly CultureUnit[];
  readonly nowIso: string;
  readonly chargement: boolean;
  readonly onOuvrir: (unit: CultureUnit) => void;
}

/** Groupe les unités par stade, dans l'ordre de la chaîne. */
export function grouperParStade(
  unites: readonly CultureUnit[],
): { stage: CultureUnit['stage']; unites: CultureUnit[] }[] {
  return STAGE_ORDER.map((stage) => ({
    stage,
    unites: unites.filter((unite) => unite.stage === stage),
  })).filter((groupe) => groupe.unites.length > 0);
}

export function UnitList({
  unites,
  nowIso,
  chargement,
  onOuvrir,
}: UnitListProps): React.JSX.Element {
  const groupes = grouperParStade(unites);

  if (chargement) {
    return (
      <p className="liste__attente" role="status">
        Chargement des unités…
      </p>
    );
  }

  if (groupes.length === 0) {
    return (
      <p className="liste__vide" role="status">
        Aucune unité en cours. Crée la première avec « Nouvelle unité », ou scanne une étiquette
        existante.
      </p>
    );
  }

  return (
    <div className="liste">
      {groupes.map((groupe) => (
        <section key={groupe.stage} aria-labelledby={`stade-${groupe.stage}`}>
          <h3 id={`stade-${groupe.stage}`} className="liste__stade">
            {STAGE_LABEL[groupe.stage]}
            <span className="liste__compte">{groupe.unites.length}</span>
          </h3>
          <ul className="liste__unites">
            {groupe.unites.map((unite) => {
              const anciennete = formatAnciennete(unite.currentStepEnteredAt, nowIso);
              return (
                <li key={unite.id}>
                  <button
                    type="button"
                    className="carte"
                    onClick={() => {
                      onOuvrir(unite);
                    }}
                  >
                    <span className="carte__nom">{unite.name}</span>
                    <span className="carte__code">{unite.publicCode}</span>
                    <span className="carte__etape">
                      {libelleEtape(unite.currentStepId)}
                      {anciennete !== null && <> · {anciennete}</>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
