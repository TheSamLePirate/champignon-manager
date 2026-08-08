import { defineConfig, devices } from '@playwright/test';

/**
 * Configuration end-to-end.
 *
 * Les scénarios obligatoires de `docs/22` §6.2 tournent contre une **vraie
 * pile** : serveur Node réel, MongoDB en replica set réel, aucun mock. C'est le
 * seul niveau où l'on vérifie que les couches tiennent ensemble — notamment
 * que le double-write état/événement reste cohérent de bout en bout.
 *
 * ⚠️ Le serveur tourne sous **Node** et non sous Bun : le driver MongoDB ne
 * charge pas sous Bun 1.3 (voir la déviation D-13 du suivi).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env['CI']),
  retries: process.env['CI'] === undefined ? 0 : 1,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/e2e', open: 'never' }],
    ['json', { outputFile: 'reports/e2e/results.json' }],
  ],
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'api',
      testMatch: /.*\.api\.spec\.ts/,
    },
    {
      name: 'desktop',
      testMatch: /.*\.web\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // WebKit + émulation iPhone : c'est le moteur de Safari iOS. Ce n'est pas
      // un iPhone réel — la validation caméra reste à faire — mais cela attrape
      // les régressions de mise en page et de tactile.
      name: 'iphone',
      testMatch: /.*\.web\.spec\.ts/,
      use: { ...devices['iPhone 14'] },
    },
  ],
  webServer: [
    {
      // Le nettoyage fait partie de la **commande du serveur**, pas d'un
      // `globalSetup` : Playwright lance le serveur avant le setup global, et
      // le serveur amorce son modèle de process au démarrage. Vider la base
      // après lui aurait effacé ce que le scénario de premier démarrage vient
      // vérifier.
      command:
        'node scripts/reinitialiser-base-e2e.mjs && bun run build && node packages/api/dist/server.mjs',
      port: 3100,
      env: {
        PORT: '3100',
        CHAMPI_DB_NAME: 'champignon_e2e',
      },
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 60_000,
    },
  ],
});
