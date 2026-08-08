import { expect, test, type Page } from '@playwright/test';

/**
 * L'éditeur de process, vu depuis le navigateur.
 *
 * Ces scénarios existent à cause d'un défaut réel : l'éditeur graphique était
 * entièrement construit et testé unitairement, mais **monté nulle part**. Aucune
 * barrière ne l'avait vu — la couverture mesure les lignes exécutées, pas
 * l'accessibilité depuis l'application, et les E2E web ne cherchaient que le
 * parcours terrain (déviation D-28).
 *
 * Le premier test ci-dessous est le garde-fou : il échoue si l'éditeur
 * redevient inatteignable, quelle que soit la raison.
 */

/** Nom du process installé au premier démarrage. */
const MODELE_AMORCE = 'Modèle par défaut (à ajuster)';

/**
 * Ouvre l'onglet de configuration sur le modèle amorcé.
 *
 * On le choisit explicitement : la base des E2E contient les process créés par
 * les autres scénarios, et la liste est triée par nom — le premier élément
 * n'est donc pas prévisible.
 */
async function ouvrirProcess(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Process' }).click();
  await expect(page.getByRole('heading', { name: 'Éditeur de process' })).toBeVisible();
  await page.getByLabel('Process à configurer').selectOption({ label: MODELE_AMORCE });
  await expect(page.getByText(/Version \d+ —/)).toBeVisible();
}

/** Passe la version affichée en brouillon si elle est publiée. */
async function rendreModifiable(page: Page): Promise<void> {
  const modifier = page.getByRole('button', { name: /^Modifier/ });
  if (await modifier.isVisible()) {
    await modifier.click();
  }
  await expect(page.getByLabel('Nouvelle étape', { exact: true })).toBeVisible();
}

test.describe('accès à l’éditeur', () => {
  test('l’éditeur est atteignable depuis l’application, sans passer par l’API', async ({
    page,
  }) => {
    await page.goto('/');

    // L'onglet existe et n'est pas l'écran par défaut : on ouvre sur le terrain.
    const terrain = page.getByRole('button', { name: 'Terrain' });
    await expect(terrain).toHaveAttribute('aria-current', 'page');

    await page.getByRole('button', { name: 'Process' }).click();

    await expect(page.getByRole('heading', { name: 'Éditeur de process' })).toBeVisible();
    // Le canvas est bien rendu, pas seulement le titre.
    await expect(page.locator('svg').first()).toBeVisible();
  });

  test('le modèle amorcé s’ouvre dans le canvas, avec ses étapes', async ({ page }) => {
    await ouvrirProcess(page);

    // Les étapes du modèle par défaut sont dessinées, pas seulement listées.
    // `toBeAttached` et non `toBeVisible` : sur iPhone, un process de dix
    // étapes dépasse l'écran et se lit en faisant défiler le cadre — c'est le
    // comportement voulu, pas un défaut.
    for (const nom of ['Inoculation substrat', 'Incubation', 'Fructification']) {
      await expect(page.getByText(nom, { exact: true }).first()).toBeAttached();
    }
  });

  test('on revient au terrain sans perdre le scanner', async ({ page }) => {
    await ouvrirProcess(page);
    await page.getByRole('button', { name: 'Terrain' }).click();

    await expect(page.getByLabel(/code de l/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Éditeur de process' })).toBeHidden();
  });
});

test.describe('édition graphique', () => {
  test('ajoute une étape, la relie, et la voit apparaître dans le canvas', async ({ page }) => {
    await ouvrirProcess(page);

    // Une version publiée est en lecture seule : on ouvre d'abord un brouillon.
    await rendreModifiable(page);

    await page.getByLabel('Nouvelle étape', { exact: true }).fill('Séchage');
    await page.getByLabel('Stade de la nouvelle étape').selectOption('fruiting');
    await page.getByRole('button', { name: 'Ajouter' }).click();

    // Attachée, pas forcément à l'écran : la nouvelle étape se place au bout
    // d'un process de dix étapes, donc hors du cadre visible sur iPhone.
    await expect(page.getByText('Séchage', { exact: true }).first()).toBeAttached();

    // Et l'éditeur signale qu'elle n'est reliée à rien — un graphe incomplet ne
    // doit pas se publier en silence.
    await expect(page.getByText(/« Séchage » n'est reliée à aucune autre/)).toBeVisible();
  });

  test('sélectionner une étape ouvre ses propriétés', async ({ page }) => {
    await ouvrirProcess(page);

    await rendreModifiable(page);

    await page
      .getByRole('button', { name: /Incubation/ })
      .first()
      .click();

    // Le panneau de propriétés porte le nom de l'étape sélectionnée.
    await expect(page.getByLabel('Nom', { exact: true })).toHaveValue(/Incubation/);
  });

  test('une version publiée s’affiche en lecture seule', async ({ page }) => {
    await ouvrirProcess(page);

    const verrou = page.getByText('Version publiée — lecture seule.');
    // Immuable : aucun formulaire d'édition, et un chemin explicite pour
    // repartir — qui crée une version, jamais ne réécrit celle-ci.
    if (await verrou.isVisible()) {
      await expect(page.getByLabel('Nouvelle étape', { exact: true })).toBeHidden();
      await expect(page.getByRole('button', { name: /^Modifier/ })).toBeVisible();
    }
  });
});

test.describe('utilisabilité en chambre', () => {
  /** Même exigence que le reste : on configure parfois avec des gants. */
  test('les commandes de l’éditeur respectent la cible de 44 px', async ({ page }) => {
    await ouvrirProcess(page);

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

  test('la page de configuration ne déborde jamais horizontalement', async ({ page }) => {
    await ouvrirProcess(page);

    const debordement = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(debordement).toBe(false);
  });
});
