import type { ProcessGraph, ProcessVersion } from '@champi/contracts';
import { DEFAULT_MODEL_DISCLAIMER, defaultProcessGraph, publishVersion } from '@champi/domain';
import type { ProcessRepository } from '@champi/persistence';

/**
 * Amorçage du premier démarrage.
 *
 * Sans process, l'application ne sait rien faire : on ne peut pas créer
 * d'unité sans version épinglée. Or **aucune valeur chiffrée n'a été fournie
 * par le cultivateur** (durées, températures, humidités — arbitrage du
 * 31/07/2026), donc une base neuve serait vide, et le premier écran de la mise
 * en service serait un formulaire de création de process. C'est le scénario
 * que `CLAUDE.md` désigne comme « l'écran vide à la mise en service ».
 *
 * On livre donc le modèle de `docs/20`, **publié**, prêt à être utilisé ou
 * modifié. Deux garde-fous :
 *
 * - l'amorçage est **inerte dès qu'un process existe** — il ne réécrit jamais
 *   le travail du cultivateur, même partiel ;
 * - chaque étape porte sa `provenance`, et le modèle porte son avertissement :
 *   les valeurs inventées ne se font pas passer pour des recommandations.
 */

export interface SeedDependencies {
  readonly processes: ProcessRepository;
  readonly newId: () => string;
  readonly now: () => string;
}

export type SeedOutcome =
  | {
      readonly seeded: true;
      readonly templateId: string;
      readonly versionId: string;
      readonly disclaimer: string;
      readonly reason: string;
    }
  | { readonly seeded: false; readonly reason: string }
  | { readonly seeded: false; readonly reason: string; readonly failure: string };

/** Nom du modèle livré. Il dit ce qu'il est : un point de départ. */
export const SEED_TEMPLATE_NAME = 'Modèle par défaut (à ajuster)';

/**
 * Installe le modèle par défaut si — et seulement si — la base n'a aucun
 * process. Idempotent : rejouable sans risque à chaque démarrage.
 *
 * Le graphe est un **paramètre**, pas une constante refermée dans la fonction :
 * l'amorçage valide ce qu'on lui donne. Cela permet d'amorcer une ferme avec un
 * modèle importé, et cela garde la garde de publication vivante — un graphe
 * invalide doit être refusé, pas installé.
 */
export async function seedDefaultProcess(
  deps: SeedDependencies,
  graph: ProcessGraph = defaultProcessGraph(),
): Promise<SeedOutcome> {
  const existing = await deps.processes.listTemplates();
  if (existing.length > 0) {
    return {
      seeded: false,
      reason: `La base contient déjà ${String(existing.length)} process : rien n'a été touché.`,
    };
  }

  const templateId = deps.newId();
  const versionId = deps.newId();

  const draft: ProcessVersion = {
    id: versionId,
    templateId,
    versionNumber: 1,
    status: 'draft',
    graph,
  };

  // On publie via le domaine plutôt qu'en écrivant `status: 'published'` :
  // l'amorçage emprunte le même chemin de validation que l'interface, sinon il
  // pourrait installer une version que l'application refuserait elle-même.
  const published = publishVersion(draft, deps.now());
  if (!published.ok) {
    return {
      seeded: false,
      reason: "Le modèle par défaut n'a pas pu être publié.",
      failure: published.error.message,
    };
  }

  // La version d'abord : si l'enregistrement du modèle échoue ensuite, on
  // laisse une version orpheline — invisible — plutôt qu'un modèle pointant
  // vers une version inexistante, que l'interface afficherait en erreur.
  const savedVersion = await deps.processes.saveVersion(published.value);
  if (!savedVersion.ok) {
    return {
      seeded: false,
      reason: "Le modèle par défaut n'a pas pu être enregistré.",
      failure: savedVersion.error.message,
    };
  }

  const savedTemplate = await deps.processes.saveTemplate({
    id: templateId,
    name: SEED_TEMPLATE_NAME,
    speciesScope: 'any',
    currentVersionId: versionId,
  });
  if (!savedTemplate.ok) {
    return {
      seeded: false,
      reason: "Le modèle par défaut n'a pas pu être enregistré.",
      failure: savedTemplate.error.message,
    };
  }

  return {
    seeded: true,
    templateId,
    versionId,
    disclaimer: DEFAULT_MODEL_DISCLAIMER,
    reason: `Modèle « ${SEED_TEMPLATE_NAME} » installé et publié : l'application est utilisable immédiatement.`,
  };
}
