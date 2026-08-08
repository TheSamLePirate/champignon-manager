import { appError, listHint, type CultureUnit, type Severity } from '@champi/contracts';
import { err, ok, type Result } from '../result.js';

/**
 * Observations et mesures terrain.
 *
 * Deux règles issues des réponses du cultivateur :
 *
 * 1. **Photo obligatoire en cas de contamination** (`q12_4`). C'est la seule
 *    obligation de saisie de toute l'application — parce qu'une contamination
 *    déclarée sans preuve visuelle ne permet ni de trancher plus tard, ni de
 *    comparer entre lots.
 * 2. **Pas de liste d'observations par étape** (`q12_2`) : la liste complète
 *    existe partout, l'application masque simplement ce qui n'a pas de sens au
 *    stade courant.
 */

/** Observations rapides citées par le cultivateur (`q12_1`). */
export const OBSERVATION_KINDS = [
  'contamination',
  'colonisation',
  'odeur',
  'couleur_suspecte',
  'humidite_visuelle',
  'taille',
  'couleur',
  'autre',
] as const;

export type ObservationKind = (typeof OBSERVATION_KINDS)[number];

/**
 * Observations sans objet à un stade donné.
 *
 * L'application **masque** ce qui n'a pas de sens plutôt que de configurer une
 * liste par étape : « taille » sur une gélose n'apprend rien.
 */
const HIDDEN_BY_STAGE: Readonly<Partial<Record<CultureUnit['stage'], readonly ObservationKind[]>>> =
  {
    gelose: ['taille', 'humidite_visuelle'],
    liquid_culture: ['taille', 'humidite_visuelle', 'couleur'],
  };

/** Observations pertinentes au stade courant. */
export function relevantObservationKinds(stage: CultureUnit['stage']): ObservationKind[] {
  const hidden = HIDDEN_BY_STAGE[stage] ?? [];
  return OBSERVATION_KINDS.filter((kind) => !hidden.includes(kind));
}

export interface ObservationRequest {
  readonly unit: CultureUnit;
  readonly kind: string;
  readonly severity: Severity;
  readonly note?: string;
  readonly photoId?: string;
}

export interface ValidatedObservation {
  readonly kind: ObservationKind;
  readonly severity: Severity;
  readonly note?: string;
  readonly photoId?: string;
}

/** Valide une observation avant de la journaliser. */
export function validateObservation(request: ObservationRequest): Result<ValidatedObservation> {
  const kinds = relevantObservationKinds(request.unit.stage);
  if (!kinds.includes(request.kind as ObservationKind)) {
    return err(
      appError(
        'VALIDATION_FAILED',
        `L'observation « ${request.kind} » n'a pas de sens au stade « ${request.unit.stage} ».`,
        {
          hint: listHint('Observations pertinentes à ce stade', kinds),
          path: 'kind',
        },
      ),
    );
  }

  // La seule obligation de saisie de l'application (`q12_4`).
  if (request.kind === 'contamination' && request.photoId === undefined) {
    return err(
      appError('PHOTO_REQUIRED', 'Une contamination doit être documentée par une photo.', {
        hint: "Prends une photo avant d'enregistrer : c'est la seule saisie obligatoire de l'application, et elle sert à trancher plus tard.",
        path: 'photoId',
      }),
    );
  }

  return ok({
    kind: request.kind as ObservationKind,
    severity: request.severity,
    ...(request.note !== undefined ? { note: request.note } : {}),
    ...(request.photoId !== undefined ? { photoId: request.photoId } : {}),
  });
}

/**
 * Une observation critique doit-elle changer le statut de l'unité ?
 *
 * Non : le statut se change **explicitement**. Une contamination observée n'est
 * pas encore une unité rebutée — le cultivateur peut mettre en quarantaine,
 * nettoyer ou poursuivre (`q18_1`, « configurable »). Décider à sa place
 * fermerait des options qu'il a demandé de garder ouvertes.
 */
export function observationChangesStatus(): false {
  return false;
}
