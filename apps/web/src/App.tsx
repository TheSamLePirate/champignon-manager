import { useCallback, useEffect, useState } from 'react';
import type { CultureUnit, DomainEvent } from '@champi/contracts';
import { StatusBanner } from './components/StatusBanner.js';
import { ScanPanel, type RecognisedScan } from './components/ScanPanel.js';
import { UnitSheet, type NextStep } from './components/UnitSheet.js';
import { ProcessWorkbench } from './components/ProcessWorkbench.js';
import { ObservationForm, type ObservationDraft } from './components/ObservationForm.js';
import { MeasureForm, type MeasureDraft } from './components/MeasureForm.js';
import type { ApiClient, MutationResult } from './lib/api-client.js';
import type { OfflineQueue } from './lib/offline-queue.js';
import type { ScanEnvironment } from './lib/scanner.js';

/**
 * Écran principal.
 *
 * Pas d'écran de connexion (docs/21 §6) : l'application s'ouvre directement sur
 * le travail. Le scan est la navigation principale — en chambre, on arrive
 * toujours par une étiquette, jamais par une liste.
 *
 * Deux vues seulement, et « Terrain » est celle par défaut : configurer un
 * process est rare, scanner une unité est le geste de tous les jours. La
 * configuration reste néanmoins **atteignable depuis l'application**, et pas
 * seulement par l'API — l'éditeur graphique est resté un temps orphelin,
 * construit et testé mais monté nulle part (déviation D-28).
 */

export interface AppProps {
  readonly client: ApiClient;
  readonly queue: OfflineQueue;
  readonly environment: ScanEnvironment;
  readonly online: boolean;
  /** Horloge. Elle n'existe qu'ici : le reste de l'interface la reçoit. */
  readonly now: () => string;
  /** Accès caméra et décodage QR, injectés depuis le point d'entrée. */
  readonly ouvrirCamera: () => Promise<MediaStream>;
  readonly detecter: (source: HTMLVideoElement) => Promise<readonly string[]>;
}

interface LoadedUnit {
  readonly unit: CultureUnit;
  readonly events: readonly DomainEvent[];
  readonly nominalNext: readonly NextStep[];
}

/** Les deux vues de l'application. */
type Vue = 'terrain' | 'process';

/** Formulaire ouvert sous la fiche. Un seul à la fois : l'écran reste lisible. */
type Saisie = 'aucune' | 'observation' | 'mesure';

export function App({
  client,
  queue,
  environment,
  online,
  now,
  ouvrirCamera,
  detecter,
}: AppProps): React.JSX.Element {
  const [vue, setVue] = useState<Vue>('terrain');
  const [saisie, setSaisie] = useState<Saisie>('aucune');
  const [loaded, setLoaded] = useState<LoadedUnit | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingCount, setPendingCount] = useState(queue.pendingCount());
  const [failedCount, setFailedCount] = useState(queue.failed().length);

  const refreshQueueCounts = useCallback(() => {
    setPendingCount(queue.pendingCount());
    setFailedCount(queue.failed().length);
  }, [queue]);

  // Au retour du réseau, on vide la file sans que l'opérateur ait à y penser.
  useEffect(() => {
    if (!online) {
      return;
    }
    void client.flushQueue().then(refreshQueueCounts);
  }, [online, client, refreshQueueCounts]);

  /** Charge la fiche complète : identité, historique et suites possibles. */
  const loadUnit = useCallback(
    async (reference: string) => {
      const [unit, timeline, steps] = await Promise.all([
        client.getUnit(reference),
        client.getTimeline(reference),
        client.nextSteps(reference),
      ]);

      if (!unit.ok) {
        setLoaded(null);
        // On affiche l'indice du serveur : il contient les valeurs valides.
        setMessage(unit.error.hint ?? unit.error.message);
        return;
      }

      setLoaded({
        unit: unit.data,
        events: timeline.ok ? timeline.data : [],
        nominalNext: steps.ok ? steps.data.nominal : [],
      });
      setMessage(null);
    },
    [client],
  );

  const openUnit = useCallback(
    async (input: RecognisedScan) => {
      if (input.kind === 'public-code') {
        await loadUnit(input.value);
        return;
      }

      const resolved = await client.resolveQr(input.value);
      if (!resolved.ok) {
        setLoaded(null);
        setMessage(resolved.error.hint ?? resolved.error.message);
        return;
      }
      if (resolved.data.target === null) {
        setLoaded(null);
        setMessage('Ce QR ne correspond à aucune unité connue.');
        return;
      }
      await loadUnit(resolved.data.target.publicCode);
    },
    [client, loadUnit],
  );

  /**
   * Traite le résultat d'une mutation.
   *
   * Trois issues, et l'opérateur doit pouvoir les distinguer : envoyée,
   * conservée pour plus tard, ou refusée pour une raison métier.
   */
  const handleMutation = useCallback(
    async (result: MutationResult<unknown>, reference: string) => {
      if ('queued' in result) {
        setMessage('Saisie conservée sur l’appareil — elle partira au retour du réseau.');
        setSaisie('aucune');
        refreshQueueCounts();
        return;
      }
      if (!result.ok) {
        setMessage(result.error.hint ?? result.error.message);
        return;
      }
      // La saisie a abouti : on referme le formulaire plutôt que de laisser
      // l'opérateur se demander s'il doit le refaire.
      setSaisie('aucune');
      await loadUnit(reference);
    },
    [loadUnit, refreshQueueCounts],
  );

  const runAction = useCallback(
    async (action: () => Promise<MutationResult<unknown>>, reference: string) => {
      setBusy(true);
      try {
        await handleMutation(await action(), reference);
      } finally {
        setBusy(false);
      }
    },
    [handleMutation],
  );

  return (
    <main>
      <h1>Champignon Manager</h1>

      <StatusBanner pendingCount={pendingCount} failedCount={failedCount} online={online} />

      <nav className="onglets" aria-label="Vues de l’application">
        <button
          type="button"
          className="onglet"
          aria-current={vue === 'terrain' ? 'page' : undefined}
          onClick={() => {
            setVue('terrain');
            setMessage(null);
          }}
        >
          Terrain
        </button>
        <button
          type="button"
          className="onglet"
          aria-current={vue === 'process' ? 'page' : undefined}
          onClick={() => {
            setVue('process');
            setMessage(null);
          }}
        >
          Process
        </button>
      </nav>

      {vue === 'process' && <ProcessWorkbench client={client} onMessage={setMessage} />}

      {message !== null && (
        <p className="message" role="status">
          {message}
        </p>
      )}

      {vue === 'terrain' && loaded !== null && (
        <UnitSheet
          unit={loaded.unit}
          events={loaded.events}
          nominalNext={loaded.nominalNext}
          nowIso={now()}
          busy={busy}
          onAdvance={(stepId) => {
            void runAction(
              () => client.advance(loaded.unit.publicCode, stepId, loaded.unit.version),
              loaded.unit.publicCode,
            );
          }}
          onObserve={() => {
            setSaisie(saisie === 'observation' ? 'aucune' : 'observation');
          }}
          onMeasure={() => {
            setSaisie(saisie === 'mesure' ? 'aucune' : 'mesure');
          }}
        >
          {saisie === 'observation' && (
            <ObservationForm
              unit={loaded.unit}
              nowIso={now()}
              busy={busy}
              onCancel={() => {
                setSaisie('aucune');
              }}
              onSubmit={(draft: ObservationDraft) => {
                void runAction(
                  () => client.observe(loaded.unit.publicCode, draft),
                  loaded.unit.publicCode,
                );
              }}
            />
          )}
          {saisie === 'mesure' && (
            <MeasureForm
              busy={busy}
              onCancel={() => {
                setSaisie('aucune');
              }}
              onSubmit={(draft: MeasureDraft) => {
                void runAction(
                  () => client.measure(loaded.unit.publicCode, draft),
                  loaded.unit.publicCode,
                );
              }}
            />
          )}
        </UnitSheet>
      )}

      {/*
       * Le scanner passe **après** la fiche dès qu'une unité est ouverte : en
       * chambre, on arrive par une étiquette et ce qu'on veut lire ensuite est
       * l'unité, pas le champ de saisie qui vient de servir.
       */}
      {vue === 'terrain' && (
        <ScanPanel
          environment={environment}
          ouvrirCamera={ouvrirCamera}
          detecter={detecter}
          compact={loaded !== null}
          onScan={(input) => {
            void openUnit(input);
          }}
        />
      )}
    </main>
  );
}
