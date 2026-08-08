import { useCallback, useState } from 'react';
import type { ProcessGraph, Stage } from '@champi/contracts';
import { inspectProcessGraph } from '@champi/domain';
import { ProcessCanvas } from './ProcessCanvas.js';
import { StepProperties } from './StepProperties.js';
import {
  addStep,
  connectSteps,
  disconnectSteps,
  findStepById,
  outgoingTransitions,
  removeStep,
  updateStep,
} from '../lib/process-editing.js';
import { diffProcessGraphs, summariseDiff } from '../lib/process-diff.js';

/**
 * Éditeur de process.
 *
 * Le canvas et l'API éditent **exactement le même JSON** (docs/22 §3.1) :
 * l'éditeur n'invente aucune capacité que l'API n'aurait pas, et un process
 * écrit par un agent s'affiche ici sans conversion.
 *
 * Le graphe décrit le chemin **nominal**. Rien de ce qui est édité ici
 * n'interdit une transition à l'exécution : les étapes restent sautables,
 * refaisables et réversibles (docs/22 §3.3).
 */

export interface ProcessEditorProps {
  readonly graph: ProcessGraph;
  /** Version publiée de référence, pour le diff. Absente sur une première version. */
  readonly publishedGraph?: ProcessGraph;
  readonly readOnly: boolean;
  readonly onChange: (graph: ProcessGraph) => void;
  readonly onPublish: () => void;
  readonly busy?: boolean;
}

export function ProcessEditor({
  graph,
  publishedGraph,
  readOnly,
  onChange,
  onPublish,
  busy = false,
}: ProcessEditorProps): React.JSX.Element {
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [linkingFrom, setLinkingFrom] = useState<string | null>(null);
  const [newStepName, setNewStepName] = useState('');
  const [newStepStage, setNewStepStage] = useState<Stage>('substrate');

  const issues = inspectProcessGraph(graph);
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  const selected = selectedStepId === null ? undefined : findStepById(graph, selectedStepId);

  /**
   * Clic sur une étape : sélection, ou fermeture d'un lien en cours.
   *
   * Relier se fait en deux gestes — « relier », puis clic sur la cible — plutôt
   * qu'en glisser-déposer : c'est nettement plus fiable avec des gants humides.
   */
  const handleSelect = useCallback(
    (stepId: string) => {
      if (linkingFrom !== null && linkingFrom !== stepId) {
        onChange(connectSteps(graph, linkingFrom, stepId));
        setLinkingFrom(null);
        return;
      }
      setLinkingFrom(null);
      setSelectedStepId(stepId);
    },
    [graph, linkingFrom, onChange],
  );

  return (
    <section className="editor" aria-labelledby="editor-title">
      <h2 id="editor-title">Éditeur de process</h2>

      {readOnly ? (
        <p className="editor__locked" role="status">
          Version publiée — lecture seule.
        </p>
      ) : (
        <form
          className="editor__add"
          onSubmit={(event) => {
            event.preventDefault();
            if (newStepName.trim() === '') {
              return;
            }
            onChange(addStep(graph, { name: newStepName.trim(), stage: newStepStage }));
            setNewStepName('');
          }}
        >
          <label htmlFor="new-step-name">Nouvelle étape</label>
          <input
            id="new-step-name"
            type="text"
            value={newStepName}
            placeholder="Incubation"
            onChange={(event) => {
              setNewStepName(event.target.value);
            }}
          />
          <label htmlFor="new-step-stage">Stade de la nouvelle étape</label>
          <select
            id="new-step-stage"
            value={newStepStage}
            onChange={(event) => {
              setNewStepStage(event.target.value as Stage);
            }}
          >
            <option value="gelose">Gélose</option>
            <option value="liquid_culture">Culture liquide</option>
            <option value="grain">Ballot de grain</option>
            <option value="substrate">Ballot de substrat</option>
            <option value="fruiting">Fructification</option>
          </select>
          <button type="submit" disabled={newStepName.trim() === ''}>
            Ajouter
          </button>
        </form>
      )}

      {linkingFrom !== null && (
        <p className="editor__linking" role="status">
          Clique l’étape à relier depuis «&nbsp;{findStepById(graph, linkingFrom)?.name}&nbsp;».{' '}
          <button
            type="button"
            onClick={() => {
              setLinkingFrom(null);
            }}
          >
            Annuler
          </button>
        </p>
      )}

      <ProcessCanvas
        graph={graph}
        selectedStepId={selectedStepId}
        onSelectStep={handleSelect}
        linkingFrom={linkingFrom}
      />

      {errors.length > 0 && (
        <div className="editor__issues editor__issues--error" role="alert">
          <h3>À corriger avant publication</h3>
          <ul>
            {errors.map((issue) => (
              <li key={issue.message}>{issue.message}</li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="editor__issues editor__issues--warning" role="status">
          <h3>Remarques</h3>
          <ul>
            {warnings.map((issue) => (
              <li key={issue.message}>{issue.message}</li>
            ))}
          </ul>
        </div>
      )}

      {selected !== undefined && (
        <>
          <StepProperties
            step={selected}
            readOnly={readOnly}
            onChange={(patch) => {
              onChange(updateStep(graph, selected.id, patch));
            }}
            onDelete={() => {
              onChange(removeStep(graph, selected.id));
              setSelectedStepId(null);
            }}
            onStartLink={() => {
              setLinkingFrom(selected.id);
            }}
          />

          {!readOnly && outgoingTransitions(graph, selected.id).length > 0 && (
            <div className="editor__links">
              <h4>Suites nominales</h4>
              <ul>
                {outgoingTransitions(graph, selected.id).map((transition) => (
                  <li key={`${transition.from}-${transition.to}`}>
                    {findStepById(graph, transition.to)?.name ?? transition.to}{' '}
                    <button
                      type="button"
                      onClick={() => {
                        onChange(disconnectSteps(graph, transition.from, transition.to));
                      }}
                    >
                      Retirer le lien
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {publishedGraph !== undefined && (
        <p className="editor__diff" role="status">
          {summariseDiff(diffProcessGraphs(publishedGraph, graph))}
        </p>
      )}

      {!readOnly && (
        <div className="editor__publish">
          <button type="button" disabled={busy || errors.length > 0} onClick={onPublish}>
            Publier cette version
          </button>
          <p className="editor__help">
            Une version publiée devient immuable. Les unités déjà lancées{' '}
            <strong>ne changent pas de version</strong> : c’est ce qui permettra de comparer les
            résultats entre deux versions.
          </p>
        </div>
      )}
    </section>
  );
}
