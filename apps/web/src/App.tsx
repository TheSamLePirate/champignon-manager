import { useCallback, useEffect, useState } from 'react';
import type { CultureUnit, DomainEvent } from '@champi/contracts';
import { StatusBanner } from './components/StatusBanner.js';
import { ScanPanel, type RecognisedScan } from './components/ScanPanel.js';
import { UnitSheet, type NextStep } from './components/UnitSheet.js';
import type { ApiClient, MutationResult } from './lib/api-client.js';
import type { OfflineQueue } from './lib/offline-queue.js';
import type { ScanEnvironment } from './lib/scanner.js';

/**
 * Écran principal.
 *
 * Pas d'écran de connexion (docs/21 §6) : l'application s'ouvre directement sur
 * le travail. Le scan est la navigation principale — en chambre, on arrive
 * toujours par une étiquette, jamais par une liste.
 */

export interface AppProps {
  readonly client: ApiClient;
  readonly queue: OfflineQueue;
  readonly environment: ScanEnvironment;
  readonly online: boolean;
}

interface LoadedUnit {
  readonly unit: CultureUnit;
  readonly events: readonly DomainEvent[];
  readonly nominalNext: readonly NextStep[];
}

export function App({ client, queue, environment, online }: AppProps): React.JSX.Element {
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
        refreshQueueCounts();
        return;
      }
      if (!result.ok) {
        setMessage(result.error.hint ?? result.error.message);
        return;
      }
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

      <ScanPanel
        environment={environment}
        onScan={(input) => {
          void openUnit(input);
        }}
      />

      {message !== null && (
        <p className="message" role="status">
          {message}
        </p>
      )}

      {loaded !== null && (
        <UnitSheet
          unit={loaded.unit}
          events={loaded.events}
          nominalNext={loaded.nominalNext}
          busy={busy}
          onAdvance={(stepId) => {
            void runAction(
              () => client.advance(loaded.unit.publicCode, stepId, loaded.unit.version),
              loaded.unit.publicCode,
            );
          }}
          onObserve={() => {
            void runAction(
              () =>
                client.observe(loaded.unit.publicCode, { kind: 'colonisation', severity: 'low' }),
              loaded.unit.publicCode,
            );
          }}
          onMeasure={() => {
            void runAction(
              () =>
                client.measure(loaded.unit.publicCode, {
                  metric: 'temperature_c',
                  numericValue: 24,
                }),
              loaded.unit.publicCode,
            );
          }}
        />
      )}
    </main>
  );
}
