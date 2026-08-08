/**
 * Durées, telles qu'on les lit en chambre.
 *
 * « Depuis 12 jours » se comprend d'un coup d'œil ; un horodatage ISO demande un
 * calcul mental que personne ne fait avec les mains occupées. Ces fonctions sont
 * **pures** : l'horloge est passée en paramètre, jamais lue ici.
 */

/** Jours entiers écoulés entre deux instants ISO. Négatif si l'ordre est inversé. */
export function joursEcoules(depuisIso: string, jusquIso: string): number | null {
  const depuis = Date.parse(depuisIso);
  const jusqu = Date.parse(jusquIso);
  if (Number.isNaN(depuis) || Number.isNaN(jusqu)) {
    return null;
  }
  return Math.floor((jusqu - depuis) / 86_400_000);
}

/**
 * Formule lisible d'une ancienneté.
 *
 * On ne descend pas sous la journée : à l'échelle d'une culture, « 3 heures »
 * n'apprend rien, et une précision affichée est une précision promise.
 */
export function formatAnciennete(depuisIso: string, maintenantIso: string): string | null {
  const jours = joursEcoules(depuisIso, maintenantIso);
  if (jours === null || jours < 0) {
    return null;
  }
  if (jours === 0) {
    return "depuis aujourd'hui";
  }
  if (jours === 1) {
    return 'depuis hier';
  }
  return `depuis ${String(jours)} jours`;
}

/**
 * Rend lisible un identifiant d'étape.
 *
 * L'unité ne porte que le `stepId` de son étape courante — « fin_de_cycle » —
 * et le nom, lui, vit dans la version de process. Plutôt que d'afficher un
 * identifiant à quelqu'un qui a les mains dans le substrat, on le met en forme.
 * C'est une **présentation**, pas une traduction : les identifiants du modèle
 * par défaut dérivent des noms, la mise en forme les restitue fidèlement.
 */
export function libelleEtape(stepId: string): string {
  const mots = stepId.replace(/[_-]+/g, ' ').trim();
  if (mots === '') {
    return stepId;
  }
  return mots.charAt(0).toUpperCase() + mots.slice(1);
}
