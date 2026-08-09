/* eslint-disable no-console -- point d'entrée : la console est la seule sortie disponible avant que quoi que ce soit ne tourne. */
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { B21Transport } from '@champi/printing';
import { createB21Driver } from './b21-driver.js';
import { assembleServer } from './server.js';

/**
 * Démarrage du serveur.
 *
 * ⚠️ **Tourne sous Node, pas sous Bun.** Bun 1.3 ne peut pas charger le driver
 * MongoDB au runtime : `bson` appelle `node:v8 isBuildingSnapshot`, non
 * implémenté. C'est le risque P2-10 (« maturité de l'écosystème Bun ») qui se
 * matérialise — et la mitigation prévue de longue date : isoler l'exécution
 * dans un process Node. Bun reste l'outil de build, de workspaces et de tests.
 *
 * Le serveur écoute sur toutes les interfaces : c'est par là que l'iPhone
 * atteint l'application via le tailnet. Il n'y a **aucune authentification** —
 * la frontière est le réseau, pas l'application (docs/21 §6).
 */
const port = Number(process.env['PORT'] ?? 3000);
const webRoot = process.env['CHAMPI_WEB_ROOT'] ?? './apps/web/dist';

// Amorçage : sans process, l'application ne peut créer aucune unité, et aucune
// valeur chiffrée n'a été fournie par le cultivateur. On installe donc le
// modèle de `docs/20` à la première mise en service — et jamais ensuite, dès
// qu'un process existe. `CHAMPI_SEED=false` désactive pour une base pilotée
// entièrement par import.
/*
 * Imprimante.
 *
 * Sans `CHAMPI_PRINTER_ADDRESS`, l'application garde le transport en mémoire :
 * les étiquettes sont composées et journalisées, mais rien ne sort. C'est le
 * bon défaut — un poste de développement n'a pas d'imprimante, et une erreur
 * BLE au démarrage ne doit pas empêcher de travailler.
 *
 * Avec l'adresse, le pilote Nimbot B21 Pro prend la main. Le nom BLE annoncé
 * par l'imprimante (`B21_Pro-…`) marche mieux que l'adresse matérielle.
 */
const printerAddress = process.env['CHAMPI_PRINTER_ADDRESS'];
const { app, seed } = await assembleServer({
  seed: process.env['CHAMPI_SEED'] !== 'false',
  ...(process.env['CHAMPI_FILES_DIR'] === undefined
    ? {}
    : { filesDir: process.env['CHAMPI_FILES_DIR'] }),
  ...(printerAddress === undefined
    ? {}
    : { transport: new B21Transport(createB21Driver({ address: printerAddress })) }),
});

// Le front est servi par le même serveur que l'API : une seule origine, donc
// pas de CORS, un seul certificat Tailscale, et le contexte sécurisé exigé par
// la caméra iOS vaut pour les deux.
app.use('/assets/*', serveStatic({ root: webRoot }));
app.get('*', serveStatic({ path: `${webRoot}/index.html` }));

serve({ fetch: app.fetch, port, hostname: '0.0.0.0' });

console.log(`Champignon Manager écoute sur http://0.0.0.0:${String(port)}`);
console.log(`Découverte de l'API : http://0.0.0.0:${String(port)}/api/_discover`);
console.log(
  printerAddress === undefined
    ? 'Imprimante : transport en mémoire (pose CHAMPI_PRINTER_ADDRESS pour brancher la B21).'
    : `Imprimante : Nimbot B21 sur « ${printerAddress} ».`,
);

if (seed !== undefined) {
  console.log(`Amorçage : ${seed.reason}`);
  if (seed.seeded) {
    console.log(`⚠️  ${seed.disclaimer}`);
  }
}
