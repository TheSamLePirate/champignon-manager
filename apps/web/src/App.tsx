import { useCallback, useEffect, useState } from 'react';
import type { CultureUnit } from '@champi/contracts';
import { StatusBanner } from './components/StatusBanner.js';
import { ScanPanel } from './components/ScanPanel.js';
import type { ApiClient } from './lib/api-client.js';
import type { OfflineQueue } from './lib/offline-queue.js';
import type { ScanEnvironment } from './lib/scanner.js';
import type { RecognisedScan } from './components/ScanPanel.js';

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

export function App({ client, queue, environment, online }: AppProps): React.JSX.Element {
  const [unit, setUnit] = useState<CultureUnit | null>(null);
  const [message, setMessage] = useState<string | null>(null);
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

  // `input` ne peut pas être « inconnu » : le panneau de scan ne remonte que
  // ce qu'il a su interpréter. Il n'y a donc pas de cas d'erreur à traiter ici.
  const openUnit = useCallback(
    async (input: RecognisedScan) => {
      const result =
        input.kind === 'token'
          ? await client.resolveQr(input.value)
          : await client.getUnit(input.value);

      if (!result.ok) {
        setUnit(null);
        // On affiche l'indice du serveur : il contient les valeurs valides.
        setMessage(result.error.hint ?? result.error.message);
        return;
      }

      const found = 'target' in result.data ? result.data.target : result.data;
      setUnit(found);
      setMessage(found === null ? 'Ce QR ne correspond à aucune unité connue.' : null);
    },
    [client],
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

      {unit !== null && (
        <section aria-labelledby="unit-title">
          <h2 id="unit-title">{unit.name}</h2>
          <dl>
            <dt>Code</dt>
            <dd>{unit.publicCode}</dd>
            <dt>Stade</dt>
            <dd>{unit.stage}</dd>
            <dt>Étape courante</dt>
            <dd>{unit.currentStepId}</dd>
            <dt>Statut</dt>
            <dd>{unit.status}</dd>
          </dl>
        </section>
      )}
    </main>
  );
}
