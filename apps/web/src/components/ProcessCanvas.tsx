import type { ProcessGraph } from '@champi/contracts';
import { autoLayout, canvasBounds, edgePaths, layoutGraph } from '../lib/process-layout.js';

/**
 * Canvas du graphe de process.
 *
 * SVG écrit à la main plutôt qu'une bibliothèque de graphe : le process du
 * cultivateur fait six étapes, une mise en page sophistiquée n'y apporterait
 * rien, et le rendu reste entièrement testable sans simuler d'internes.
 *
 * ⚠️ Deux pièges déjà rencontrés sur l'atlas Mermaid (`CLAUDE.md`), à ne pas
 * réintroduire :
 *
 * 1. **Ne jamais animer `transform` sur un nœud** — cela écrase son
 *    positionnement et renvoie tout en haut à gauche ;
 * 2. **Pas de `setPointerCapture`** — il vole le clic des nœuds. Le
 *    déplacement passe donc par les gestionnaires du SVG parent.
 */

const NODE_WIDTH = 170;
const NODE_HEIGHT = 70;

export interface ProcessCanvasProps {
  readonly graph: ProcessGraph;
  readonly selectedStepId: string | null;
  readonly onSelectStep: (stepId: string) => void;
  /** Étape source d'un lien en cours de tracé, s'il y en a un. */
  readonly linkingFrom?: string | null;
}

/** Classe de nœud selon son stade — la couleur suit le stade, pas le hasard. */
function stageClass(stage: ProcessGraph['steps'][number]['stage']): string {
  return `node node--${stage}`;
}

export function ProcessCanvas({
  graph,
  selectedStepId,
  onSelectStep,
  linkingFrom = null,
}: ProcessCanvasProps): React.JSX.Element {
  // `layoutGraph` rend les étapes et leurs positions ensemble : pas de
  // recherche, donc pas de position de repli à inventer.
  const positioned = layoutGraph(graph);
  const layout = autoLayout(graph);
  const bounds = canvasBounds(layout, NODE_WIDTH, NODE_HEIGHT);
  const edges = edgePaths(graph, layout, NODE_WIDTH, NODE_HEIGHT);

  if (graph.steps.length === 0) {
    return (
      <p className="canvas__empty" role="status">
        Ce process ne contient aucune étape. Ajoute-en une pour commencer.
      </p>
    );
  }

  return (
    <svg
      className="canvas"
      role="img"
      aria-label={`Graphe du process : ${String(graph.steps.length)} étapes`}
      viewBox={`0 0 ${String(bounds.width)} ${String(bounds.height)}`}
      width="100%"
    >
      <defs>
        <marker
          id="fleche"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" className="edge__head" />
        </marker>
      </defs>

      <g className="edges">
        {edges.map((edge) => (
          <g key={`${edge.from}-${edge.to}`}>
            <path d={edge.d} className="edge" markerEnd="url(#fleche)" />
            {edge.label !== undefined && (
              <text className="edge__label" x={0} y={0}>
                <textPath href={`#${edge.from}-${edge.to}`}>{edge.label}</textPath>
              </text>
            )}
          </g>
        ))}
      </g>

      <g className="nodes">
        {positioned.map(({ step, x, y }) => {
          const selected = step.id === selectedStepId;
          const linking = step.id === linkingFrom;

          return (
            <g
              key={step.id}
              className={[
                stageClass(step.stage),
                selected ? 'node--selected' : '',
                linking ? 'node--linking' : '',
                step.optional ? 'node--optional' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              transform={`translate(${String(x)}, ${String(y)})`}
            >
              {/* Un bouton dans le SVG : cliquable au doigt et atteignable au clavier. */}
              <foreignObject width={NODE_WIDTH} height={NODE_HEIGHT}>
                <button
                  type="button"
                  className="node__button"
                  aria-pressed={selected}
                  onClick={() => {
                    onSelectStep(step.id);
                  }}
                >
                  <span className="node__name">{step.name}</span>
                  <span className="node__meta">
                    {step.optional ? 'optionnelle · ' : ''}
                    {step.targetDurationDays === undefined
                      ? 'sans durée'
                      : `${String(step.targetDurationDays)} j`}
                  </span>
                  {step.provenance === 'invented' && (
                    // Les valeurs inventées n'engagent rien : le dire à l'écran
                    // évite qu'elles soient prises pour des recommandations.
                    <span className="node__invented">valeurs inventées</span>
                  )}
                </button>
              </foreignObject>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
