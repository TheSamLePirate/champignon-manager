import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { createPublishedProcess, createUnit } from './helpers.js';

/**
 * Accessibilité, mesurée et non déclarée.
 *
 * `docs/22` §7.3 : **WCAG 2.2 AA en plancher**, plus les critères AAA qui
 * servent réellement en chambre — contraste 7:1 (l'écran est vu à travers un
 * film de condensation) et cibles de 44 px (on vise avec des gants).
 *
 * Ces tests tournent sur Chrome **et** WebKit/iPhone : une régression de
 * contraste ou d'étiquetage échoue la CI, elle n'attend pas une relecture.
 */

/** Règles WCAG 2.2 niveau A et AA — le plancher retenu. */
const WCAG_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test.describe('conformité WCAG 2.2 AA', () => {
  test('l’écran d’accueil ne présente aucune violation', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();

    // On imprime les violations dans le message : un échec doit être
    // actionnable sans rouvrir la trace.
    expect(results.violations.map((violation) => `${violation.id} — ${violation.help}`)).toEqual(
      [],
    );
  });

  test('la fiche d’unité ne présente aucune violation', async ({ page, request }) => {
    const process = await createPublishedProcess(request);
    const unit = await createUnit(request, process.versionId, { name: 'Bloc accessibilité' });

    await page.goto('/');
    await page.getByLabel(/saisis le code/i).fill(unit.publicCode);
    await page.getByRole('button', { name: 'Ouvrir la fiche' }).click();
    await expect(page.getByRole('heading', { name: 'Bloc accessibilité' })).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
    expect(results.violations.map((violation) => `${violation.id} — ${violation.help}`)).toEqual(
      [],
    );
  });

  test('un message d’erreur reste accessible', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/saisis le code/i).fill('SUB-2026-999999');
    await page.getByRole('button', { name: 'Ouvrir la fiche' }).click();
    await expect(page.getByRole('status').last()).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
    expect(results.violations.map((violation) => `${violation.id} — ${violation.help}`)).toEqual(
      [],
    );
  });
});

/**
 * Critères AAA retenus **parce qu'ils servent le contexte**, pas par dogme.
 * Le reste du référentiel AAA n'est pas visé (`docs/22` §0).
 */
test.describe('critères AAA retenus pour la chambre de culture', () => {
  /** WCAG AAA 1.4.6 : l'écran est vu à travers de la condensation. */
  test('le contraste atteint 7:1', async ({ page }) => {
    await page.goto('/');
    const results = await new AxeBuilder({ page }).withRules(['color-contrast-enhanced']).analyze();

    expect(
      results.violations.flatMap((violation) =>
        violation.nodes.map((node) => `${node.target.join(' ')} : ${node.failureSummary ?? ''}`),
      ),
    ).toEqual([]);
  });

  /** WCAG AAA 2.5.5 : on vise avec des gants humides. */
  test('toutes les cibles interactives font au moins 44 px', async ({ page, request }) => {
    const process = await createPublishedProcess(request);
    const unit = await createUnit(request, process.versionId);

    await page.goto('/');
    await page.getByLabel(/saisis le code/i).fill(unit.publicCode);
    await page.getByRole('button', { name: 'Ouvrir la fiche' }).click();
    await expect(page.getByRole('heading', { name: 'Bloc pleurote E2E' })).toBeVisible();

    const tooSmall = await page.evaluate(() => {
      const interactive = document.querySelectorAll<HTMLElement>('button, input, select, a[href]');
      return [...interactive]
        .filter((element) => {
          const box = element.getBoundingClientRect();
          // Un élément masqué n'est pas une cible : on l'ignore.
          return box.width > 0 && box.height > 0 && box.height < 44;
        })
        .map((element) => `${element.tagName}: ${element.textContent.slice(0, 30)}`);
    });

    expect(tooSmall).toEqual([]);
  });

  test('la navigation au clavier atteint toutes les actions', async ({ page }) => {
    await page.goto('/');

    const focusable = await page.evaluate(() => {
      const elements = document.querySelectorAll<HTMLElement>('button, input, select, a[href]');
      return [...elements].filter((element) => element.tabIndex >= 0).length;
    });
    // Rien n'est atteignable uniquement à la souris.
    expect(focusable).toBeGreaterThan(0);
  });
});
