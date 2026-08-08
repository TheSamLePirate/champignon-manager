import { expect, test, type APIRequestContext } from '@playwright/test';

/**
 * Mise en service — le premier démarrage chez le cultivateur.
 *
 * Le problème que ce lot résout : **aucune valeur chiffrée n'a été fournie**
 * (durées, températures, humidités — arbitrage du 31/07/2026). Une base neuve
 * serait donc vide, et le premier écran serait un éditeur de process à
 * remplir. Ces scénarios vérifient qu'il n'en est rien : le serveur amorce son
 * modèle au démarrage, et l'application est utilisable **sans rien configurer**.
 *
 * Ils tournent contre le serveur réel lancé par Playwright, celui-là même qui
 * tournera sur le Raspberry Pi.
 */

/**
 * Nom du modèle amorcé, écrit **en dur** et non importé du code applicatif.
 *
 * Les scénarios end-to-end parlent à l'API comme un client externe (voir
 * `helpers.ts`) : ils ne connaissent que le contrat public. Renommer le modèle
 * côté serveur doit donc casser ce scénario — c'est un changement visible pour
 * quiconque lit la liste des process.
 */
const NOM_MODELE_AMORCE = 'Modèle par défaut (à ajuster)';

interface Template {
  readonly id: string;
  readonly name: string;
  readonly currentVersionId: string;
}

async function seededTemplate(request: APIRequestContext) {
  const response = await request.get('/api/process-templates');
  const templates = ((await response.json()) as { data: Template[] }).data;
  return templates.find((template) => template.name === NOM_MODELE_AMORCE);
}

test.describe('premier démarrage', () => {
  test('le serveur a installé un modèle de process utilisable', async ({ request }) => {
    const template = await seededTemplate(request);
    expect(template, "le modèle par défaut n'a pas été amorcé").toBeDefined();

    const version = await request.get(`/api/process-versions/${template?.currentVersionId ?? ''}`);
    const body = (await version.json()) as {
      data: { status: string; graph: { steps: unknown[] } };
    };

    // Publié : un brouillon ne permettrait pas de créer la première unité, et
    // l'amorçage n'aurait rien résolu.
    expect(body.data.status).toBe('published');
    expect(body.data.graph.steps.length).toBeGreaterThan(0);
  });

  test('on peut lancer une culture sur le modèle amorcé sans rien configurer', async ({
    request,
  }) => {
    const template = await seededTemplate(request);

    const created = await request.post('/api/units', {
      data: {
        name: 'Première unité de la ferme',
        stage: 'substrate',
        processVersionId: template?.currentVersionId,
        stepId: 'inoculation',
        substrateWeight: { value: 5, unit: 'kg', kind: 'substrate' },
      },
    });
    expect(created.ok()).toBe(true);

    const unit = (await created.json()) as {
      data: { unit: { publicCode: string; version: number } };
    };

    // Et elle avance : le graphe amorcé est un vrai process, pas une coquille.
    const advanced = await request.post(`/api/units/${unit.data.unit.publicCode}/advance`, {
      data: { toStepId: 'incubation', expectedVersion: unit.data.unit.version },
    });
    expect(advanced.ok()).toBe(true);
  });

  test('l’amorçage n’écrase pas les process du cultivateur', async ({ request }) => {
    // La base des E2E est déjà pleine de process créés par les autres
    // scénarios. Si l'amorçage était destructeur, il l'aurait vidée.
    const response = await request.get('/api/process-templates');
    const templates = ((await response.json()) as { data: Template[] }).data;

    expect(templates.length).toBeGreaterThan(1);
    // Un seul modèle amorcé, quel que soit le nombre de redémarrages.
    expect(templates.filter((template) => template.name === NOM_MODELE_AMORCE)).toHaveLength(1);
  });

  test('les étapes amorcées portent leur provenance', async ({ request }) => {
    const template = await seededTemplate(request);
    const version = await request.get(`/api/process-versions/${template?.currentVersionId ?? ''}`);
    const graph = (
      (await version.json()) as { data: { graph: { steps: { id: string; provenance: string }[] } } }
    ).data.graph;

    // Chaque étape dit d'où vient sa valeur. Sans cela, une durée inventée pour
    // éviter un champ vide se lirait comme une recommandation agronomique.
    for (const step of graph.steps) {
      expect(['cultivator', 'invented']).toContain(step.provenance);
    }
    // Et il y en a bien des deux sortes : le modèle ne se prétend pas
    // entièrement fondé sur les réponses du cultivateur.
    const provenances = new Set(graph.steps.map((step) => step.provenance));
    expect(provenances.has('invented')).toBe(true);
    expect(provenances.has('cultivator')).toBe(true);
  });
});
