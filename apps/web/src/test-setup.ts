/**
 * Configuration des tests d'interface.
 *
 * Charge les matchers `jest-dom` (`toBeInTheDocument`, `toHaveTextContent`…)
 * et nettoie le DOM entre deux tests : sans cela, un rendu fuiterait sur le
 * suivant et les assertions deviendraient dépendantes de l'ordre.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
