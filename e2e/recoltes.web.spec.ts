import { expect, test, type Page } from '@playwright/test';
import { createPublishedProcess, createUnit } from './helpers.js';

/**
 * Récoltes et produits finaux, depuis l'interface.
 *
 * Ce que ces scénarios prouvent : la chaîne « peser un flush → composer une
 * barquette » se fait **sans CLI**, et le produit garde les proportions exactes
 * de ce qui le compose — c'est ce qui rend la remontée « barquette → blocs »
 * vérifiable plus tard.
 */

/** Amène une unité jusqu'à la fructification, prête à être récoltée. */
async function unitéEnFructification(request: Parameters<typeof createUnit>[0], nom: string) {
  const process = await createPublishedProcess(request);
  // ⚠️ `createUnit` ne rend pas le nom : le lire depuis l'objet donnait
  // `new RegExp(undefined)`, une expression vide qui matche **toutes** les
  // sections — et le produit se composait alors depuis la mauvaise unité.
  const unit = await createUnit(request, process.versionId, { name: nom });

  let version = unit.version;
  for (const étape of ['incubation', 'fructification']) {
    const réponse = await request.post(`/api/units/${unit.publicCode}/advance`, {
      data: { toStepId: étape, expectedVersion: version },
    });
    version = ((await réponse.json()) as { data: { unit: { version: number } } }).data.unit.version;
  }
  return { ...unit, name: nom };
}

async function ouvrirFiche(page: Page, code: string): Promise<void> {
  await page.goto('/');
  await page.getByLabel(/code de l/i).fill(code);
  await page.getByRole('button', { name: 'Ouvrir la fiche' }).click();
}

test.describe('peser une récolte', () => {
  test('enregistre un flush depuis la fiche, avec sa qualité', async ({ page, request }) => {
    const unit = await unitéEnFructification(request, `Bloc récolté ${String(Date.now())}`);
    await ouvrirFiche(page, unit.publicCode);

    await page.getByRole('button', { name: 'Peser une récolte' }).click();
    await page.getByLabel(/Poids récolté/).fill('820');
    await page.getByRole('radio', { name: /B — second choix/ }).check();
    await page.getByRole('button', { name: 'Enregistrer la récolte' }).click();

    // La récolte entre au journal, comme tout le reste.
    await expect(page.getByText(/flush 1 — 820 g/)).toBeVisible();
  });

  test('propose le flush suivant après une première pesée', async ({ page, request }) => {
    const unit = await unitéEnFructification(request, `Bloc repesé ${String(Date.now())}`);
    await request.post(`/api/units/${unit.publicCode}/harvests`, {
      data: {
        flushNumber: 1,
        weight: { value: 800, unit: 'g', kind: 'harvest' },
        quality: 'A',
        losses: [],
      },
    });

    await ouvrirFiche(page, unit.publicCode);
    await page.getByRole('button', { name: 'Peser une récolte' }).click();

    // On ne demande pas à l'opérateur de se souvenir du dernier flush.
    await expect(page.getByRole('textbox', { name: 'Flush' })).toHaveValue('2');
  });

  test('une unité qui n’est pas en fructification ne se pèse pas', async ({ page, request }) => {
    const process = await createPublishedProcess(request);
    const unit = await createUnit(request, process.versionId, { name: 'Bloc substrat' });

    await ouvrirFiche(page, unit.publicCode);

    await expect(page.getByRole('button', { name: 'Peser une récolte' })).toBeHidden();
  });
});

test.describe('composer un produit', () => {
  test('mélange deux récoltes avec leurs proportions exactes', async ({ page, request }) => {
    const unit = await unitéEnFructification(request, `Bloc mélangé ${String(Date.now())}`);
    for (const [flush, poids] of [
      [1, 300],
      [2, 100],
    ] as const) {
      await request.post(`/api/units/${unit.publicCode}/harvests`, {
        data: {
          flushNumber: flush,
          weight: { value: poids, unit: 'g', kind: 'harvest' },
          quality: 'A',
          losses: [],
        },
      });
    }

    await page.goto('/');
    await page.getByRole('button', { name: 'Récoltes' }).click();

    // La base des E2E porte les récoltes de tous les scénarios : on se limite
    // à la section de cette unité, sinon les cases sont ambiguës.
    const section = page.getByRole('region', { name: new RegExp(unit.name) });
    await expect(section.getByText(/Flush 1 — 300 g/)).toBeVisible();

    await section.getByRole('checkbox', { name: /Flush 1/ }).check();
    await section.getByRole('checkbox', { name: /Flush 2/ }).check();
    // 300 g et 100 g : trois quarts, un quart. Les parts sont calculées, pas saisies.
    await expect(page.getByText(/400 g au total — 75 % \/ 25 %/)).toBeVisible();

    await page.getByLabel('Nom du produit').fill('Barquette pleurote');
    await page.getByRole('button', { name: 'Créer le produit' }).click();

    await expect(page.getByText(/remonte à 2 récolte/)).toBeVisible();
  });

  test('le produit créé remonte réellement aux unités', async ({ page, request }) => {
    const unit = await unitéEnFructification(request, `Bloc tracé ${String(Date.now())}`);
    await request.post(`/api/units/${unit.publicCode}/harvests`, {
      data: {
        flushNumber: 1,
        weight: { value: 500, unit: 'g', kind: 'harvest' },
        quality: 'A',
        losses: [],
      },
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Récoltes' }).click();
    // Scoper à la section de **cette** unité : la base porte les récoltes de
    // tous les scénarios, et `.first()` cochait celle d'une autre unité.
    await page
      .getByRole('region', { name: new RegExp(unit.name) })
      .getByRole('checkbox', { name: /Flush 1/ })
      .check();
    await page.getByLabel('Nom du produit').fill('Barquette tracée');
    await page.getByRole('button', { name: 'Créer le produit' }).click();

    const message = await page.getByText(/remonte à 1 récolte/).innerText();
    const code = /\(([A-Z]+-\d{4}-\d+)\)/.exec(message)?.[1] ?? '';

    // La promesse centrale du projet, vérifiée depuis l'interface : d'une
    // barquette on remonte au bloc qui l'a produite.
    const trace = await request.get(`/api/products/${code}/trace`);
    expect(trace.status()).toBe(200);
    const body = (await trace.json()) as {
      data: { contributions: { unitId: string; sharePct: number }[]; singleOrigin: boolean };
    };
    expect(body.data.contributions[0]?.unitId).toBe(unit.id);
    // Une seule unité à l'origine : la part est de 100 %.
    expect(body.data.contributions[0]?.sharePct).toBe(100);
    expect(body.data.singleOrigin).toBe(true);
  });

  test('l’onglet dit quoi faire quand rien n’a été récolté', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Récoltes' }).click();

    const vide = page.getByText(/Aucune récolte enregistrée/);
    const liste = page.getByRole('heading', { name: 'Récoltes' });
    await expect(vide.or(liste).first()).toBeVisible();
  });
});
