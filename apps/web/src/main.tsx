import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { ApiClient, createQueueSender } from './lib/api-client.js';
import { LocalStorageQueueStorage, OfflineQueue } from './lib/offline-queue.js';
import { readScanEnvironment } from './lib/scanner.js';
import './styles.css';

/**
 * Point d'entrée.
 *
 * C'est ici — et seulement ici — que le code touche aux API du navigateur :
 * horloge, aléa, stockage, réseau. Tout le reste les reçoit en paramètre, ce
 * qui rend l'application testable sans navigateur.
 */

const baseUrl = window.location.origin;
const storage = new LocalStorageQueueStorage(window.localStorage);
const queue = new OfflineQueue(storage, createQueueSender(baseUrl, window.fetch.bind(window)));

const client = new ApiClient({
  baseUrl,
  fetch: window.fetch.bind(window),
  queue,
  newIdempotencyKey: () => crypto.randomUUID(),
  now: () => new Date().toISOString(),
});

const container = document.getElementById('root');
if (container !== null) {
  createRoot(container).render(
    <StrictMode>
      <App
        client={client}
        queue={queue}
        environment={readScanEnvironment(window)}
        online={window.navigator.onLine}
      />
    </StrictMode>,
  );
}
