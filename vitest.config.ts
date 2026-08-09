import { defineConfig } from 'vitest/config';

/**
 * Configuration de test racine.
 *
 * Le seuil de couverture est à 100 % sur toutes les métriques : c'est une
 * contrainte d'architecture, pas une cible à atteindre après coup
 * (voir docs/22 §2.3). Une ligne non couverte se supprime, elle ne se masque
 * pas — les exclusions `c8 ignore` sont interdites par le linter.
 */
export default defineConfig({
  test: {
    globals: false,
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts', 'apps/*/src/**/*.test.tsx'],
    // Les tests d'interface ont besoin d'un DOM ; le reste tourne sans, ce qui
    // garde la suite du domaine sous la seconde.
    environmentMatchGlobs: [['apps/**/*.test.tsx', 'happy-dom']],
    setupFiles: ['apps/web/src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.ts', 'apps/*/src/**/*.tsx'],
      exclude: [
        '**/*.test.ts',
        '**/*.d.ts',
        '**/index.ts',
        '**/__fixtures__/**',
        '**/__testing__/**',
        '**/main.tsx',
        '**/main.ts',
        /*
         * Le pilote Bluetooth de l'imprimante.
         *
         * Même catégorie que `main.ts` : c'est une racine d'assemblage qui
         * touche du matériel. On ne peut pas l'éprouver sans imprimante, et le
         * simuler produirait des tests verts pendant que la radio décroche —
         * exactement ce que la règle « jamais de mock de MongoDB » interdit
         * ailleurs. La logique d'impression, elle, vit dans `@champi/printing`
         * et reste couverte à 100 %. Voir la déviation D-31 du suivi.
         */
        '**/b21-driver.ts',
        '**/test-setup.ts',
      ],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
