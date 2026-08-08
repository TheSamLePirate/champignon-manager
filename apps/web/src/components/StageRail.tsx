import type { Stage } from '@champi/contracts';

/**
 * La chaîne de propagation, du spore à l'assiette.
 *
 * C'est **le** repère de la fiche : avant de savoir quoi faire d'un sac, il faut
 * savoir où il en est. La chaîne des cinq stades est fixe — c'est une énumération
 * du contrat, pas une configuration — alors que les étapes, elles, se
 * paramètrent. Elle peut donc servir de repère stable.
 *
 * Chaque marque porte la couleur de la matière à ce stade : ivoire de la gélose,
 * ambre de la culture liquide, blé du grain, brun du substrat, gris nacré de la
 * fructification. La couleur ne porte jamais l'information seule (WCAG 1.4.1) :
 * le stade courant est nommé en toutes lettres, les stades franchis sont pleins,
 * les suivants creux, et chaque marque a son intitulé accessible.
 *
 * ⚠️ Une unité peut **naître à n'importe quel stade** et n'a pas à parcourir
 * toute la chaîne. La rampe situe, elle ne prescrit pas — d'où « à ce stade »
 * plutôt qu'un pourcentage d'avancement, qui mentirait.
 */

export const STAGE_ORDER: readonly Stage[] = [
  'gelose',
  'liquid_culture',
  'grain',
  'substrate',
  'fruiting',
];

export const STAGE_LABEL: Readonly<Record<Stage, string>> = {
  gelose: 'Gélose',
  liquid_culture: 'Culture liquide',
  grain: 'Ballot de grain',
  substrate: 'Ballot de substrat',
  fruiting: 'Fructification',
};

/** Intitulé court, pour la rampe : sous la marque, la place est comptée. */
const STAGE_COURT: Readonly<Record<Stage, string>> = {
  gelose: 'Gélose',
  liquid_culture: 'Liquide',
  grain: 'Grain',
  substrate: 'Substrat',
  fruiting: 'Fruct.',
};

export interface StageRailProps {
  readonly stage: Stage;
}

export function StageRail({ stage }: StageRailProps): React.JSX.Element {
  const courant = STAGE_ORDER.indexOf(stage);

  return (
    <nav className="chaine" aria-label="Chaîne de propagation">
      <ol className="chaine__liste">
        {STAGE_ORDER.map((etape, index) => {
          const etat = index < courant ? 'franchi' : index === courant ? 'courant' : 'a-venir';
          return (
            <li
              key={etape}
              className={`chaine__maillon chaine__maillon--${etat} chaine__maillon--${etape}`}
              aria-current={etat === 'courant' ? 'step' : undefined}
            >
              <span className="chaine__marque" aria-hidden="true" />
              <span className="chaine__nom">{STAGE_COURT[etape]}</span>
              {/* Le lecteur d'écran entend l'état ; l'œil le voit à la forme. */}
              <span className="chaine__etat">
                {etat === 'courant'
                  ? ` — stade actuel : ${STAGE_LABEL[etape]}`
                  : etat === 'franchi'
                    ? ' — franchi'
                    : ' — à venir'}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
