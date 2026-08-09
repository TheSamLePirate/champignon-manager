import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { ApiClient, createQueueSender } from './lib/api-client.js';
import { LocalStorageQueueStorage, OfflineQueue } from './lib/offline-queue.js';
import { readScanEnvironment } from './lib/scanner.js';
// Safari n'implémente pas `BarcodeDetector` — et c'est le navigateur du
// cultivateur. On embarque donc un décodeur WebAssembly qui expose la même
// interface, servi en local comme le reste.
import { BarcodeDetector } from 'barcode-detector/ponyfill';
// Atkinson Hyperlegible, dessinée par le Braille Institute pour la basse
// vision : ses lettres sont volontairement dissemblables (I/l/1, O/0, b/d).
// Choisie ici pour la raison qui l'a fait naître — un écran lu à bout de bras à
// travers un film de condensation. Servies en local, jamais depuis un CDN : la
// ferme tourne sur son propre réseau.
import '@fontsource/atkinson-hyperlegible/latin-400.css';
import '@fontsource/atkinson-hyperlegible/latin-700.css';
import '@fontsource/atkinson-hyperlegible-mono/latin-400.css';
import '@fontsource/atkinson-hyperlegible-mono/latin-700.css';
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
        now={() => new Date().toISOString()}
        ouvrirCamera={() =>
          // Caméra arrière : à bout de bras au-dessus d'un sac, la frontale
          // filmerait le plafond.
          window.navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
          })
        }
        detecter={async (source) => {
          const codes = await new BarcodeDetector({ formats: ['qr_code'] }).detect(source);
          return codes.map((code) => code.rawValue);
        }}
      />
    </StrictMode>,
  );
}
