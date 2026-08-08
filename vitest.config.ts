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
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/*.d.ts',
        '**/index.ts',
        '**/__fixtures__/**',
        '**/__testing__/**',
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
