import { expect, test, type Page } from '@playwright/test';
import { createPublishedProcess, createUnit } from './helpers.js';

/**
 * Lignée, traçabilité et création de process, depuis l'écran.
 *
 * C'est le cœur du modèle métier — « du spore à l'assiette » — et il n'avait
 * aucune interface : une unité fille ne pouvait naître que par l'API, et la
 * remontée ne se lisait qu'en ligne de commande.
 */

async function ouvrirFiche(page: Page, code: string): Promise<void> {
  await page.goto('/');
  await page.getByLabel(/code de l/i).fill(code);
  await page.getByRole('button', { name: 'Ouvrir la fiche' }).click();
}

test.describe('lignée', () => {
  test('crée une unité fille depuis la fiche du parent', async ({ page, request }) => {
    const process = await createPublishedProcess(request);
    const parent = await createUnit(request, process.versionId, { name: 'Souche mère' });

    await ouvrirFiche(page, parent.publicCode);
    await page.getByRole('button', { name: 'Repiquer ou cloner' }).click();

    // Le formulaire annonce de quelle unité il part : on ne repique pas à l'aveugle.
    await expect(page.getByRole('heading', { name: new RegExp(parent.publicCode) })).toBeVisible();
    await page.getByRole('button', { name: 'Créer l’unité' }).click();

    // La création enchaîne sur la fiche de la fille : on attend que le code
    // affiché change avant de le lire, sinon on relit celui du parent.
    await expect(page.locator('.etiquette__code')).not.toHaveText(parent.publicCode);
    const fille = await page.locator('.etiquette__code').innerText();

    // Le lien de parenté est réellement enregistré, pas seulement affiché.
    const reponse = await request.get(`/api/units/${fille.trim()}`);
    const body = (await reponse.json()) as { data: { parentUnitId: string; generation: number } };
    expect(body.data.parentUnitId).toBe(parent.id);
    expect(body.data.generation).toBe(1);
  });
});

test.describe('traçabilité', () => {
  test('remonte ce qu’une unité a produit, et contrôle son journal', async ({ page, request }) => {
    const process = await createPublishedProcess(request);
    const unit = await createUnit(request, process.versionId, { name: 'Bloc à tracer' });

    await ouvrirFiche(page, unit.publicCode);
    await page.getByRole('button', { name: 'Remonter la trace' }).click();

    await expect(page.getByText(/n’a encore rien produit/)).toBeVisible();
    // Le contrôle d'audit est la promesse centrale du projet : il doit être
    // vérifiable par le cultivateur, pas seulement en CI.
    await expect(page.getByText(/événements rejoués, l’état stocké concorde/)).toBeVisible();
  });

  test('montre la part exacte d’un bloc dans un produit', async ({ page, request }) => {
    const process = await createPublishedProcess(request);
    const unit = await createUnit(request, process.versionId, { name: 'Bloc contributeur' });

    let version = unit.version;
    for (const etape of ['incubation', 'fructification']) {
      const r = await request.post(`/api/units/${unit.publicCode}/advance`, {
        data: { toStepId: etape, expectedVersion: version },
      });
      version = ((await r.json()) as { data: { unit: { version: number } } }).data.unit.version;
    }
    const recolte = await request.post(`/api/units/${unit.publicCode}/harvests`, {
      data: {
        flushNumber: 1,
        weight: { value: 600, unit: 'g', kind: 'harvest' },
        quality: 'A',
        losses: [],
      },
    });
    const { data } = (await recolte.json()) as { data: { harvest: { id: string } } };
    await request.post('/api/products', {
      data: {
        name: 'Barquette tracée',
        quantity: { value: 600, unit: 'g', kind: 'product' },
        origins: [
          {
            harvestId: data.harvest.id,
            weight: { value: 600, unit: 'g', kind: 'harvest' },
            share: 1,
          },
        ],
      },
    });

    await ouvrirFiche(page, unit.publicCode);
    await page.getByRole('button', { name: 'Remonter la trace' }).click();

    await expect(page.getByText(/1 récolte\(s\), 600 g au total/)).toBeVisible();
    // Seule origine du produit : 100 %, calculé et non estimé.
    await expect(page.getByText('100 % de ce produit')).toBeVisible();
  });
});

test.describe('création de process', () => {
  test('crée un process à partir du modèle par défaut, en brouillon', async ({ page }) => {
    const nom = `Shiitake ${String(Date.now())}`;

    await page.goto('/');
    await page.getByRole('button', { name: 'Process' }).click();
    await page.getByLabel('Nouveau process').fill(nom);
    await page.getByRole('button', { name: /Créer à partir du modèle/ }).click();

    await expect(page.getByText(/en brouillon/)).toBeVisible();

    // Il apparaît dans la liste, et son graphe n'est pas vide : on part du
    // modèle de docs/20 plutôt que d'une page blanche.
    await page.getByLabel('Process à configurer').selectOption({ label: nom });
    await expect(page.getByText(/Version 1 — brouillon/)).toBeVisible();
    await expect(page.getByText('Inoculation substrat', { exact: true }).first()).toBeAttached();
  });
});
