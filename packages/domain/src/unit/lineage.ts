import { appError, type CultureUnit, type LineageRelation, type Stage } from '@champi/contracts';
import { err, ok, type Result } from '../result.js';

/**
 * Lignée d'une unité : d'où elle vient, et à quelle génération.
 *
 * Le cultivateur a décrit **trois** relations, et elles ne se valent pas
 * (`docs/03`, `docs/05`) :
 *
 * - **clone** — multiplication au *même* stade, gélose→gélose par exemple. La
 *   mère survit, et il n'y a **aucune limite de génération** ;
 * - **transfert** — passage au *stade suivant*, une unité amont donnant N
 *   unités aval ;
 * - **division** — séparation physique d'une même unité, surtout au substrat.
 *
 * L'API déduisait « transfert » dans tous les cas et laissait la génération à
 * zéro. Conséquence : un clone de cinquième génération était indiscernable
 * d'une souche d'origine — précisément ce que la traçabilité doit distinguer.
 */

export interface LineageRequest {
  /** Unité mère. Absente pour une unité qui naît sans ascendant. */
  readonly parent?: CultureUnit;
  /** Stade de l'unité créée. */
  readonly stage: Stage;
  /** Relation choisie. Déduite du stade si elle n'est pas fournie. */
  readonly relation?: LineageRelation;
}

export interface Lineage {
  readonly lineageRelation: LineageRelation;
  readonly generation: number;
}

/**
 * Déduit la relation et la génération.
 *
 * La relation se **déduit** du stade quand elle n'est pas dite : même stade,
 * c'est un clone ; stade différent, un transfert. La division, elle, ne se
 * devine pas — deux sacs issus d'un même bloc restent au même stade qu'un
 * clone — donc elle doit être déclarée.
 */
export function deriveLineage(request: LineageRequest): Result<Lineage> {
  if (request.parent === undefined) {
    if (request.relation !== undefined && request.relation !== 'origin') {
      return err(
        appError(
          'VALIDATION_FAILED',
          `Une unité sans ascendant ne peut pas être « ${request.relation} ».`,
          {
            hint: 'Indique `parentUnitId` pour un clone, un transfert ou une division.',
            path: 'lineageRelation',
          },
        ),
      );
    }
    return ok({ lineageRelation: 'origin', generation: 0 });
  }

  if (request.relation === 'origin') {
    return err(
      appError('VALIDATION_FAILED', 'Une unité issue d’une autre n’est pas une origine.', {
        hint: 'Choisis « clone », « transfer » ou « split », ou laisse l’application déduire.',
        path: 'lineageRelation',
      }),
    );
  }

  const deduite: LineageRelation =
    request.relation ?? (request.parent.stage === request.stage ? 'clone' : 'transfer');

  return ok({
    lineageRelation: deduite,
    // Aucun plafond : le cultivateur clone sans limite de génération (`q7_5`).
    generation: request.parent.generation + 1,
  });
}
