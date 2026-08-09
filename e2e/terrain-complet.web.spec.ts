import { expect, test, type Page } from '@playwright/test';

/**
 * Le parcours terrain complet, sans jamais toucher au CLI.
 *
 * C'est ce que la vague 1 rend possible et qui ne l'était pas : voir ce qui
 * tourne, démarrer une culture, l'étiqueter, l'imprimer, la photographier.
 * Auparavant, une unité ne pouvait naître que par l'API.
 *
 * Ces scénarios partent de l'écran d'accueil, comme le cultivateur.
 */

/** Nom du process installé au premier démarrage. */
const MODELE_AMORCE = 'Modèle par défaut (à ajuster)';

/** Sélectionne l'option dont le texte contient `extrait`. */
async function choisirOption(
  select: ReturnType<Page['getByLabel']>,
  extrait: string,
): Promise<void> {
  const valeur = await select.locator('option', { hasText: extrait }).first().getAttribute('value');
  await select.selectOption(valeur ?? '');
}

/** Crée une unité depuis l'interface et rend son code public. */
async function creerUnite(page: Page, nom: string): Promise<string> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nouvelle unité' }).click();

  await page.getByLabel('Nom de l’unité').fill(nom);
  // On choisit par **valeur** : le libellé porte des parenthèses, et
  // `selectOption` n'accepte pas d'expression régulière sur le label.
  await choisirOption(page.getByLabel('Process'), MODELE_AMORCE);
  await choisirOption(page.getByLabel('Étape de départ'), 'Inoculation substrat');
  await page.getByRole('button', { name: 'Créer l’unité' }).click();

  // La création enchaîne sur la fiche : c'est la suite du geste.
  await expect(page.getByRole('heading', { name: nom })).toBeVisible();
  const code = await page.locator('.etiquette__code').innerText();
  return code.trim();
}

test.describe('démarrer une culture depuis l’écran', () => {
  test('crée une unité et ouvre sa fiche', async ({ page }) => {
    const code = await creerUnite(page, `Bloc E2E ${String(Date.now())}`);

    expect(code).toMatch(/^SUB-\d{4}-\d{4,6}$/);
    // L'unité démarre à l'étape choisie, pas à une étape devinée. La fiche
    // affiche l'identifiant mis en forme — « inoculation » → « Inoculation » —
    // car l'unité porte le `stepId`, et le nom vit dans la version de process.
    await expect(page.locator('.etat__etape')).toHaveText('Inoculation');
  });

  test('la nouvelle unité apparaît dans la liste, à son stade', async ({ page }) => {
    const nom = `Bloc listé ${String(Date.now())}`;
    await creerUnite(page, nom);

    await page.getByRole('button', { name: 'Retour à la liste' }).click();

    await expect(page.getByRole('heading', { name: /Ballot de substrat/ })).toBeVisible();
    await expect(page.getByRole('button', { name: new RegExp(nom) })).toBeVisible();
  });

  test('on rouvre une unité depuis la liste', async ({ page }) => {
    const nom = `Bloc rouvert ${String(Date.now())}`;
    await creerUnite(page, nom);
    await page.getByRole('button', { name: 'Retour à la liste' }).click();

    await page.getByRole('button', { name: new RegExp(nom) }).click();

    await expect(page.getByRole('heading', { name: nom })).toBeVisible();
  });
});

test.describe('étiquette', () => {
  test('attribue un QR puis imprime, et la réimpression garde le même', async ({ page }) => {
    await creerUnite(page, `Bloc étiqueté ${String(Date.now())}`);

    await expect(page.getByText(/n’a pas encore de QR/)).toBeVisible();
    await page.getByRole('button', { name: 'Attribuer un QR' }).click();

    const token = (await page.locator('.etiquette-panneau__token').innerText()).trim();
    expect(token).toHaveLength(22);

    await page.getByRole('button', { name: 'Imprimer l’étiquette' }).click();
    await expect(page.getByText('Étiquette imprimée.')).toBeVisible();

    // Réimprimer ne regénère jamais le token : sinon le lien avec le sac déjà
    // en chambre serait rompu (`q17_5`).
    await page.getByRole('button', { name: 'Réimprimer la même étiquette' }).click();
    await expect(page.getByText(/même QR que la précédente/)).toBeVisible();
    expect((await page.locator('.etiquette-panneau__token').innerText()).trim()).toBe(token);
  });

  test('le QR imprimé ouvre bien la fiche quand on le saisit', async ({ page }) => {
    const nom = `Bloc scanné ${String(Date.now())}`;
    await creerUnite(page, nom);
    await page.getByRole('button', { name: 'Attribuer un QR' }).click();
    const token = (await page.locator('.etiquette-panneau__token').innerText()).trim();

    await page.getByRole('button', { name: 'Retour à la liste' }).click();
    await page.getByLabel(/code de l/i).fill(token);
    await page.getByRole('button', { name: 'Ouvrir la fiche' }).click();

    // Le token opaque mène à la même unité que son code public : c'est tout
    // l'intérêt du registre.
    await expect(page.getByRole('heading', { name: nom })).toBeVisible();
  });

  test('le test imprimante répond sans imprimer', async ({ page }) => {
    await creerUnite(page, `Bloc test ${String(Date.now())}`);
    await page.getByRole('button', { name: 'Attribuer un QR' }).click();

    await page.getByRole('button', { name: 'Tester l’imprimante' }).click();

    // En E2E le transport est le faux : il répond, et le dit franchement.
    await expect(page.getByText(/elle répond/)).toBeVisible();
  });
});

test.describe('photos', () => {
  test('une unité neuve n’a aucune photo, et l’écran le dit', async ({ page }) => {
    await creerUnite(page, `Bloc photo ${String(Date.now())}`);

    await expect(page.getByRole('heading', { name: 'Photos' })).toBeVisible();
    await expect(page.getByText(/Aucune photo/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Prendre une photo' })).toBeVisible();
  });

  /**
   * La capture caméra elle-même se vérifie sur iPhone, pas ici. Ce qu'on
   * vérifie : une photo déposée par l'API remonte bien dans la galerie et
   * l'image est servie — donc que le journal, le disque et l'écran s'accordent.
   */
  test('une photo déposée par l’API apparaît dans la galerie', async ({ page, request }) => {
    const nom = `Bloc galerie ${String(Date.now())}`;
    const code = await creerUnite(page, nom);

    const png =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const posted = await request.post(`/api/units/${code}/photos`, {
      data: { data: png, contentType: 'image/png', note: 'front de colonisation' },
    });
    expect(posted.ok()).toBe(true);

    await page.reload();
    await page.getByLabel(/code de l/i).fill(code);
    await page.getByRole('button', { name: 'Ouvrir la fiche' }).click();

    const image = page.getByRole('img', { name: 'front de colonisation' });
    await expect(image).toBeVisible();

    // L'image est réellement servie, pas seulement référencée.
    const src = await image.getAttribute('src');
    const servie = await request.get(src ?? '');
    expect(servie.status()).toBe(200);
    expect(servie.headers()['content-type']).toBe('image/png');
  });
});

test.describe('utilisabilité en chambre', () => {
  test('les cibles de l’écran d’accueil font au moins 44 px', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Nouvelle unité' })).toBeVisible();

    const tropPetits = await page.evaluate(() => {
      const elements = document.querySelectorAll<HTMLElement>('button, input, select');
      return [...elements]
        .filter((element) => {
          const box = element.getBoundingClientRect();
          return box.width > 0 && box.height > 0 && box.height < 44;
        })
        .map((element) => `${element.tagName}: ${element.textContent.slice(0, 30)}`);
    });

    expect(tropPetits).toEqual([]);
  });

  test('le formulaire de création ne déborde pas horizontalement', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Nouvelle unité' }).click();
    await expect(page.getByLabel('Nom de l’unité')).toBeVisible();

    const debordement = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(debordement).toBe(false);
  });
});
