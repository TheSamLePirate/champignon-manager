import { useCallback, useEffect, useState } from 'react';
import type { ProcessGraph } from '@champi/contracts';
import { ProcessEditor } from './ProcessEditor.js';
import type { ApiClient, MutationResult } from '../lib/api-client.js';

/**
 * Écran de configuration des process.
 *
 * Il relie l'éditeur graphique à l'API. Sans lui, les composants du canvas
 * existaient mais n'étaient **atteignables par personne** : seul un agent
 * passant par l'API ou le CLI pouvait configurer un process.
 *
 * Trois règles du cadrage sont portées ici et nulle part ailleurs dans
 * l'interface :
 *
 * - une **version publiée est immuable** : elle s'affiche en lecture seule, et
 *   la modifier ouvre une nouvelle version (`docs/21` §2) ;
 * - publier **ne déplace aucune unité en cours** — l'éditeur le dit à l'écran ;
 * - le graphe édité est **le même JSON** que celui de l'API, donc un process
 *   écrit par un agent s'ouvre ici sans conversion (`docs/22` §3.1).
 */

export interface ProcessWorkbenchProps {
  readonly client: ApiClient;
  /** Remonte les messages à l'écran principal, qui les affiche en un seul endroit. */
  readonly onMessage: (message: string | null) => void;
}

interface Template {
  readonly id: string;
  readonly name: string;
  readonly currentVersionId?: string;
}

interface LoadedVersion {
  readonly id: string;
  readonly versionNumber: number;
  readonly status: string;
  readonly graph: ProcessGraph;
}

export function ProcessWorkbench({ client, onMessage }: ProcessWorkbenchProps): React.JSX.Element {
  const [templates, setTemplates] = useState<readonly Template[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [version, setVersion] = useState<LoadedVersion | null>(null);
  const [draftGraph, setDraftGraph] = useState<ProcessGraph | null>(null);
  /**
   * Graphe de la version publiée dont le brouillon est issu.
   *
   * Il ne sert qu'à une chose, mais elle compte : montrer **ce qui change**
   * par rapport à ce qui tourne en production. Nul tant qu'on n'a pas ouvert
   * de brouillon — on ne compare pas une version à elle-même.
   */
  const [publishedRef, setPublishedRef] = useState<ProcessGraph | null>(null);
  const [busy, setBusy] = useState(false);

  /** Traite une écriture : la file locale n'a pas de sens sur un process. */
  const settle = useCallback(
    (result: MutationResult<unknown>): boolean => {
      if ('queued' in result) {
        // Configurer un process hors ligne mènerait à publier des versions dans
        // un ordre imprévisible : on le refuse franchement plutôt qu'en silence.
        onMessage('Configuration impossible hors ligne — reconnecte-toi pour modifier un process.');
        return false;
      }
      if (!result.ok) {
        onMessage(result.error.hint ?? result.error.message);
        return false;
      }
      return true;
    },
    [onMessage],
  );

  /**
   * Charge la **dernière** version d'un process.
   *
   * On lit la liste des versions plutôt que le `currentVersionId` du modèle :
   * celui-ci désigne la version d'origine et n'est pas déplacé par une
   * publication. S'y fier rechargeait la version publiée par-dessus le
   * brouillon qu'on venait d'ouvrir — l'écran repassait en lecture seule sans
   * explication.
   */
  const loadLatest = useCallback(
    async (templateId: string) => {
      const versions = await client.listProcessVersions(templateId);
      if (!versions.ok) {
        onMessage(versions.error.hint ?? versions.error.message);
        return;
      }

      const derniere = [...versions.data].sort((a, b) => a.versionNumber - b.versionNumber).pop();
      if (derniere === undefined) {
        setVersion(null);
        setDraftGraph(null);
        return;
      }

      setVersion({
        id: derniere.id,
        versionNumber: derniere.versionNumber,
        status: derniere.status,
        graph: derniere.graph as ProcessGraph,
      });
      setDraftGraph(derniere.graph as ProcessGraph);
      onMessage(null);
    },
    [client, onMessage],
  );

  const loadTemplates = useCallback(async () => {
    const listed = await client.listProcessTemplates();
    if (!listed.ok) {
      onMessage(listed.error.hint ?? listed.error.message);
      return;
    }
    setTemplates(listed.data);

    const first = listed.data[0];
    if (first !== undefined) {
      setSelectedId(first.id);
      await loadLatest(first.id);
    }
  }, [client, loadLatest, onMessage]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const selectTemplate = useCallback(
    async (templateId: string) => {
      setSelectedId(templateId);
      setPublishedRef(null);
      await loadLatest(templateId);
    },
    [loadLatest],
  );

  /**
   * Ouvre une nouvelle version modifiable à partir de la version publiée.
   *
   * L'identifiant est un **paramètre** : ces actions ne sont rendues que dans
   * la branche où la version existe, donc une garde `version === null` serait
   * du code mort — la barrière à 100 % l'a d'ailleurs signalée aussitôt.
   */
  const openDraft = useCallback(
    async (versionId: string, publie: ProcessGraph, templateId: string) => {
      setBusy(true);
      try {
        const drafted = await client.draftProcessVersion(versionId);
        if (!settle(drafted)) {
          return;
        }
        setPublishedRef(publie);
        await loadLatest(templateId);
      } finally {
        setBusy(false);
      }
    },
    [client, settle, loadLatest],
  );

  const save = useCallback(
    async (versionId: string, graph: ProcessGraph) => {
      setBusy(true);
      try {
        const saved = await client.saveProcessGraph(versionId, graph);
        if (settle(saved)) {
          onMessage('Brouillon enregistré.');
        }
      } finally {
        setBusy(false);
      }
    },
    [client, settle, onMessage],
  );

  const publish = useCallback(
    async (versionId: string, graph: ProcessGraph, templateId: string) => {
      setBusy(true);
      try {
        // On enregistre avant de publier : publier un graphe resté dans le
        // navigateur figerait une version qui ne correspond pas à ce qui est à
        // l'écran — et une version publiée ne se réécrit plus.
        const saved = await client.saveProcessGraph(versionId, graph);
        if (!settle(saved)) {
          return;
        }
        const published = await client.publishProcessVersion(versionId);
        if (!settle(published)) {
          return;
        }
        await loadLatest(templateId);
        onMessage('Version publiée. Aucune unité en cours n’a changé de version.');
      } finally {
        setBusy(false);
      }
    },
    [client, settle, loadLatest, onMessage],
  );

  return (
    <section className="workbench" aria-labelledby="workbench-title">
      <h2 id="workbench-title">Process</h2>

      <div className="workbench__choix">
        <label htmlFor="process-template">Process à configurer</label>
        <select
          id="process-template"
          value={selectedId}
          onChange={(event) => {
            void selectTemplate(event.target.value);
          }}
        >
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </div>

      {templates.length === 0 && (
        <p className="workbench__vide" role="status">
          Aucun process enregistré.
        </p>
      )}

      {version !== null && draftGraph !== null && (
        <>
          <p className="workbench__version" role="status">
            Version {version.versionNumber} —{' '}
            {version.status === 'published' ? 'publiée' : 'brouillon'}
          </p>

          {version.status === 'published' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void openDraft(version.id, version.graph, selectedId)}
            >
              Modifier — crée la version {version.versionNumber + 1}
            </button>
          )}

          <ProcessEditor
            graph={draftGraph}
            {...(publishedRef === null ? {} : { publishedGraph: publishedRef })}
            readOnly={version.status === 'published'}
            busy={busy}
            onChange={setDraftGraph}
            onPublish={() => void publish(version.id, draftGraph, selectedId)}
          />

          {version.status !== 'published' && (
            <button type="button" disabled={busy} onClick={() => void save(version.id, draftGraph)}>
              Enregistrer le brouillon
            </button>
          )}
        </>
      )}
    </section>
  );
}
