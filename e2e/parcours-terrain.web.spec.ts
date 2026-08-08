import { expect, test } from '@playwright/test';
import { createPublishedProcess, createUnit } from './helpers.js';

/**
 * Scénarios n°1 et n°2 de `docs/22` §6.2 — parcours navigateur.
 *
 * Tournent deux fois : Chrome desktop et **WebKit en émulation iPhone 14**.
 * WebKit est le moteur de Safari iOS : ce n'est pas un iPhone réel — la
 * validation caméra reste à faire — mais cela attrape les régressions de mise
 * en page, de tactile et de compatibilité moteur.
 */

test.describe('ouverture de l’application', () => {
  test('s’ouvre directement sur le travail, sans écran de connexion', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Champignon Manager' })).toBeVisible();
    // Décision docs/21 §6 : il n'y a aucune authentification.
    await expect(page.getByLabel(/mot de passe/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /connexion|se connecter/i })).toHaveCount(0);
  });

  test('propose immédiatement la saisie du code', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByLabel(/saisis le code/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ouvrir la fiche' })).toBeDisabled();
  });
});

test.describe('consultation d’une unité', () => {
  test('affiche la fiche après saisie du code public', async ({ page, request }) => {
    const process = await createPublishedProcess(request);
    const unit = await createUnit(request, process.versionId, { name: 'Bloc du test web' });

    await page.goto('/');
    await page.getByLabel(/saisis le code/i).fill(unit.publicCode);
    await page.getByRole('button', { name: 'Ouvrir la fiche' }).click();

    await expect(page.getByRole('heading', { name: 'Bloc du test web' })).toBeVisible();
    await expect(page.getByText(unit.publicCode)).toBeVisible();
    await expect(page.getByText('inoculation')).toBeVisible();
  });

  /** Gants humides, clavier tactile : la casse ne doit pas faire échouer. */
  test('tolère une saisie en minuscules avec des espaces', async ({ page, request }) => {
    const process = await createPublishedProcess(request);
    const unit = await createUnit(request, process.versionId);

    await page.goto('/');
    await page.getByLabel(/saisis le code/i).fill(`  ${unit.publicCode.toLowerCase()} `);
    await page.getByRole('button', { name: 'Ouvrir la fiche' }).click();

    await expect(page.getByText(unit.publicCode)).toBeVisible();
  });

  test('ouvre la fiche depuis un token de QR saisi à la main', async ({ page, request }) => {
    const process = await createPublishedProcess(request);
    const unit = await createUnit(request, process.versionId, { name: 'Bloc scanné' });
    const qr = await request.post(`/api/units/${unit.publicCode}/qr`);
    const token = ((await qr.json()) as { data: { token: string } }).data.token;

    await page.goto('/');
    await page.getByLabel(/saisis le code/i).fill(token);
    await page.getByRole('button', { name: 'Ouvrir la fiche' }).click();

    // Le repli manuel mène exactement au même endroit que le scan.
    await expect(page.getByRole('heading', { name: 'Bloc scanné' })).toBeVisible();
  });

  test('affiche l’indice du serveur pour un code inconnu', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/saisis le code/i).fill('SUB-2026-999999');
    await page.getByRole('button', { name: 'Ouvrir la fiche' }).click();

    await expect(page.getByText(/code public|identifiant technique/i).first()).toBeVisible();
  });

  test('refuse un code non reconnu sans appeler le serveur', async ({ page }) => {
    let apiCalls = 0;
    await page.route('**/api/units/**', (route) => {
      apiCalls += 1;
      return route.continue();
    });

    await page.goto('/');
    await page.getByLabel(/saisis le code/i).fill('bonjour');

    await expect(page.getByText(/Code non reconnu/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ouvrir la fiche' })).toBeDisabled();
    expect(apiCalls).toBe(0);
  });
});

/**
 * Le contexte réel : iPhone à une main, gants humides, 90 % d'humidité, écran
 * vu à travers de la condensation (docs/22 §7.1 et §7.3).
 */
test.describe('utilisabilité en chambre', () => {
  test('les cibles tactiles font au moins 44 px', async ({ page }) => {
    await page.goto('/');

    const input = page.getByLabel(/saisis le code/i);
    const button = page.getByRole('button', { name: 'Ouvrir la fiche' });

    const inputBox = await input.boundingBox();
    const buttonBox = await button.boundingBox();

    expect(inputBox?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(buttonBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  });

  test('la page ne déborde jamais horizontalement', async ({ page }) => {
    await page.goto('/');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    // Un défilement horizontal sur un téléphone tenu d'une main rend la saisie
    // pénible — et c'est la régression de mise en page la plus fréquente.
    expect(overflow).toBe(false);
  });

  test('le focus reste visible au clavier', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel(/saisis le code/i).focus();

    const outline = await page
      .getByLabel(/saisis le code/i)
      .evaluate((element) => getComputedStyle(element).outlineStyle);
    expect(outline).not.toBe('none');
  });

  test('la langue de la page est déclarée en français', async ({ page }) => {
    await page.goto('/');
    // Sans `lang`, un lecteur d'écran prononce le français avec une voix anglaise.
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  });

  test('chaque champ porte une étiquette associée', async ({ page }) => {
    await page.goto('/');

    const unlabelled = await page.evaluate(() => {
      const fields = document.querySelectorAll<HTMLElement>('input, select, textarea');
      return [...fields].filter((element) => {
        const id = element.getAttribute('id');
        const hasLabel = id !== null && document.querySelector(`label[for="${id}"]`) !== null;
        return !hasLabel && element.getAttribute('aria-label') === null;
      }).length;
    });
    expect(unlabelled).toBe(0);
  });

  test('la hiérarchie des titres commence par un h1 unique', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveCount(1);
  });
});

/**
 * Le scanner attend la validation iOS (déviation D-11) : l'application doit le
 * dire, pas afficher un bouton qui ne ferait rien.
 */
test.describe('scanner', () => {
  test('annonce franchement l’état de la capture caméra', async ({ page }) => {
    await page.goto('/');

    const scanSection = page.getByRole('region', { name: 'Scanner une étiquette' });
    await expect(scanSection).toBeVisible();
    // Aucun bouton « Scanner » tant que la capture n'est pas validée.
    await expect(page.getByRole('button', { name: 'Scanner un QR' })).toHaveCount(0);
    // Mais la saisie manuelle, elle, est toujours là.
    await expect(page.getByLabel(/saisis le code/i)).toBeVisible();
  });
});

/**
 * Le parcours complet de suivi, vu depuis le navigateur : l'opérateur ouvre une
 * fiche, avance d'étape, observe, mesure — et voit l'historique se remplir.
 */
test.describe('suivi d’une unité depuis le navigateur', () => {
  test('affiche l’historique et les suites possibles', async ({ page, request }) => {
    const process = await createPublishedProcess(request);
    const unit = await createUnit(request, process.versionId, { name: 'Bloc suivi' });

    await page.goto('/');
    await page.getByLabel(/saisis le code/i).fill(unit.publicCode);
    await page.getByRole('button', { name: 'Ouvrir la fiche' }).click();

    await expect(page.getByRole('heading', { name: 'Bloc suivi' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Historique' })).toBeVisible();
    // La suite nominale du process à six étapes.
    await expect(page.getByRole('button', { name: /Passer à « Incubation »/ })).toBeVisible();
  });

  test('avance d’étape et voit l’historique se remplir', async ({ page, request }) => {
    const process = await createPublishedProcess(request);
    const unit = await createUnit(request, process.versionId, { name: 'Bloc avancé' });

    await page.goto('/');
    await page.getByLabel(/saisis le code/i).fill(unit.publicCode);
    await page.getByRole('button', { name: 'Ouvrir la fiche' }).click();
    await page.getByRole('button', { name: /Passer à « Incubation »/ }).click();

    await expect(page.getByText('inoculation → incubation')).toBeVisible();
    // La fiche se recharge : la suite proposée est maintenant la fructification.
    await expect(page.getByRole('button', { name: /Passer à « Fructification »/ })).toBeVisible();
  });

  test('enregistre une observation et une mesure', async ({ page, request }) => {
    const process = await createPublishedProcess(request);
    const unit = await createUnit(request, process.versionId, { name: 'Bloc observé' });

    await page.goto('/');
    await page.getByLabel(/saisis le code/i).fill(unit.publicCode);
    await page.getByRole('button', { name: 'Ouvrir la fiche' }).click();

    await page.getByRole('button', { name: 'Ajouter une observation' }).click();
    await expect(page.getByText(/colonisation — gravité low/)).toBeVisible();

    await page.getByRole('button', { name: 'Ajouter une mesure' }).click();
    await expect(page.getByText(/temperature_c : 24/)).toBeVisible();
  });

  /** Une observation enrichit l'historique sans toucher à l'état métier. */
  test('une observation ne change ni l’étape ni le statut', async ({ page, request }) => {
    const process = await createPublishedProcess(request);
    const unit = await createUnit(request, process.versionId);

    await page.goto('/');
    await page.getByLabel(/saisis le code/i).fill(unit.publicCode);
    await page.getByRole('button', { name: 'Ouvrir la fiche' }).click();
    await page.getByRole('button', { name: 'Ajouter une observation' }).click();
    await expect(page.getByText(/colonisation/)).toBeVisible();

    const after = await request.get(`/api/units/${unit.publicCode}`);
    const body = (await after.json()) as { data: { currentStepId: string; status: string } };
    expect(body.data.currentStepId).toBe('inoculation');
    expect(body.data.status).toBe('active');
  });

  test('le journal reste cohérent après une suite d’actions', async ({ page, request }) => {
    const process = await createPublishedProcess(request);
    const unit = await createUnit(request, process.versionId);

    await page.goto('/');
    await page.getByLabel(/saisis le code/i).fill(unit.publicCode);
    await page.getByRole('button', { name: 'Ouvrir la fiche' }).click();
    await page.getByRole('button', { name: 'Ajouter une mesure' }).click();
    await expect(page.getByText(/temperature_c/)).toBeVisible();
    await page.getByRole('button', { name: /Passer à « Incubation »/ }).click();
    await expect(page.getByText('inoculation → incubation')).toBeVisible();

    // L'assertion centrale du rapport d'audit, après un parcours réellement
    // piloté par l'interface.
    const audit = await request.get(`/api/units/${unit.publicCode}/audit`);
    const auditBody = (await audit.json()) as {
      data: { verified: boolean; divergences: unknown[]; eventCount: number };
    };
    expect(auditBody.data.divergences).toEqual([]);
    expect(auditBody.data.verified).toBe(true);
    expect(auditBody.data.eventCount).toBe(3);
  });

  test('les boutons d’action respectent la taille de cible tactile', async ({ page, request }) => {
    const process = await createPublishedProcess(request);
    const unit = await createUnit(request, process.versionId);

    await page.goto('/');
    await page.getByLabel(/saisis le code/i).fill(unit.publicCode);
    await page.getByRole('button', { name: 'Ouvrir la fiche' }).click();

    const action = page.getByRole('button', { name: 'Ajouter une observation' });
    const box = await action.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });
});
