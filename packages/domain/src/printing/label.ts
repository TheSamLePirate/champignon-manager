import { appError, type CultureUnit, type Stage } from '@champi/contracts';
import { err, ok, type Result } from '../result.js';

/**
 * Contenu d'une étiquette.
 *
 * Réponse du cultivateur (`q17_4`) : **nom de l'unité, type, date, code QR**.
 * Rien de plus — une étiquette de chambre de culture se lit à travers de la
 * condensation, avec des gants, en trois secondes.
 *
 * Le module est pur : il compose le **contenu**, jamais les octets envoyés à
 * l'imprimante. Le rendu physique appartient à l'adaptateur B21.
 */

/** Libellé de stade, dans le vocabulaire du cultivateur (`docs/01`). */
const STAGE_LABEL: Readonly<Record<Stage, string>> = {
  gelose: 'Gélose',
  liquid_culture: 'Culture liquide',
  grain: 'Ballot de grain',
  substrate: 'Ballot de substrat',
  fruiting: 'Fructification',
};

export function stageLabel(stage: Stage): string {
  return STAGE_LABEL[stage];
}

export interface LabelContent {
  /** Nom donné par le cultivateur. */
  readonly name: string;
  /** Type d'unité, en clair. */
  readonly type: string;
  /** Date de création, au format jour/mois/année. */
  readonly date: string;
  /** Code public, lisible et prononçable. */
  readonly publicCode: string;
  /** Token opaque — le contenu réel du QR, sans URL ni donnée métier. */
  readonly qrToken: string;
}

/** Formate une date ISO en `JJ/MM/AAAA`. */
export function formatLabelDate(iso: string): Result<string> {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (match === null) {
    return err(
      appError('VALIDATION_FAILED', `« ${iso} » n'est pas une date ISO exploitable.`, {
        hint: 'Attendu : un horodatage ISO 8601, par exemple 2026-08-01T08:00:00.000Z.',
        path: 'date',
      }),
    );
  }
  // L'expression n'a servi qu'à valider la forme : on découpe ensuite par
  // position. Les groupes capturés se lisent `string | undefined` et
  // imposaient des replis (`year = ''`) qu'aucun chemin ne peut atteindre.
  return ok(`${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`);
}

/**
 * Compose l'étiquette d'une unité.
 *
 * Le token est **fourni** : il vient du registre QR et ne change jamais, y
 * compris à la réimpression (`q17_5`). Le regénérer casserait le lien entre
 * l'étiquette et l'objet physique déjà en chambre.
 */
export function buildUnitLabel(unit: CultureUnit, qrToken: string): Result<LabelContent> {
  const date = formatLabelDate(unit.createdAt);
  if (!date.ok) {
    return date;
  }
  return ok({
    name: unit.name,
    type: stageLabel(unit.stage),
    date: date.value,
    publicCode: unit.publicCode,
    qrToken,
  });
}

/**
 * Rendu texte de l'étiquette, indépendant de l'imprimante.
 *
 * Sert au repli d'impression, à la prévisualisation et aux tests. Le pilote
 * B21 consomme `LabelContent`, pas ce texte.
 */
export function renderLabelText(label: LabelContent): string {
  return [label.name, label.type, label.date, label.publicCode].join('\n');
}
