import { expect, test, type APIRequestContext } from '@playwright/test';
import { sixStepGraph, uniqueName } from './helpers.js';

/**
 * L'éditeur de process, vu par l'API.
 *
 * Le principe structurant de `docs/22` §3.1 : **le canvas et l'API éditent
 * exactement le même JSON**. Ces scénarios le vérifient depuis l'API — donc
 * depuis la position d'un agent : un process écrit en JSON doit être accepté,
 * relu à l'identique, et publiable.
 */

test.describe('un process écrit en JSON par un agent', () => {
  test('est accepté, relu à l’identique et publiable', async ({ request }) => {
    const graph = sixStepGraph();

    const created = await request.post('/api/process-templates', {
      data: { name: uniqueName('Process agent'), graph },
    });
    expect(created.status()).toBe(200);
    const versionId = ((await created.json()) as { data: { version: { id: string } } }).data.version
      .id;

    const reread = await request.get(`/api/process-versions/${versionId}`);
    const body = (await reread.json()) as {
      data: { graph: { steps: { id: string }[]; transitions: unknown[] } };
    };

    // Le graphe rendu porte les mêmes étapes, dans le même ordre : aucune
    // conversion, aucune perte.
    expect(body.data.graph.steps.map((s) => s.id)).toEqual([
      'inoculation',
      'incubation',
      'fructification',
      'flush_1',
      'flush_2',
      'flush_3',
      'fin_de_cycle',
    ]);
    expect(body.data.graph.transitions).toHaveLength(7);

    const published = await request.post(`/api/process-versions/${versionId}/publish`);
    expect(published.status()).toBe(200);
  });

  /** Le layout est optionnel et jetable : un agent n'a pas à en fournir. */
  test('n’exige aucune disposition', async ({ request }) => {
    const created = await request.post('/api/process-templates', {
      data: {
        name: uniqueName('Sans layout'),
        graph: {
          steps: [{ id: 'a', name: 'A', stage: 'substrate' }],
          transitions: [],
        },
      },
    });
    expect(created.status()).toBe(200);

    const versionId = ((await created.json()) as { data: { version: { id: string } } }).data.version
      .id;
    const reread = await request.get(`/api/process-versions/${versionId}`);
    const body = (await reread.json()) as { data: { graph: { layout?: unknown } } };
    expect(body.data.graph.layout).toBeUndefined();
  });

  test('accepte et conserve une disposition fournie', async ({ request }) => {
    const created = await request.post('/api/process-templates', {
      data: {
        name: uniqueName('Avec layout'),
        graph: {
          steps: [{ id: 'a', name: 'A', stage: 'substrate' }],
          transitions: [],
          layout: { a: { x: 120, y: 40 } },
        },
      },
    });
    const versionId = ((await created.json()) as { data: { version: { id: string } } }).data.version
      .id;

    const reread = await request.get(`/api/process-versions/${versionId}`);
    const body = (await reread.json()) as {
      data: { graph: { layout?: Record<string, { x: number; y: number }> } };
    };
    expect(body.data.graph.layout?.['a']).toEqual({ x: 120, y: 40 });
  });

  /**
   * Le graphe décrit le chemin nominal, pas le chemin autorisé : un cycle est
   * une pratique valide — les étapes sont réversibles et refaisables.
   */
  test('accepte un graphe cyclique', async ({ request }) => {
    const response = await request.post('/api/process-templates', {
      data: {
        name: uniqueName('Cyclique'),
        graph: {
          steps: [
            { id: 'a', name: 'A', stage: 'substrate' },
            { id: 'b', name: 'B', stage: 'substrate' },
          ],
          transitions: [
            { from: 'a', to: 'b' },
            { from: 'b', to: 'a' },
          ],
        },
      },
    });
    expect(response.status()).toBe(200);
  });

  test('accepte plusieurs points d’entrée — une unité naît à tout stade', async ({ request }) => {
    const response = await request.post('/api/process-templates', {
      data: {
        name: uniqueName('Multi-entrée'),
        graph: {
          steps: [
            { id: 'gelose', name: 'Gélose', stage: 'gelose' },
            { id: 'substrat', name: 'Substrat', stage: 'substrate' },
            { id: 'fruct', name: 'Fructification', stage: 'fruiting' },
          ],
          transitions: [
            { from: 'gelose', to: 'fruct' },
            { from: 'substrat', to: 'fruct' },
          ],
        },
      },
    });
    expect(response.status()).toBe(200);
  });
});

test.describe('cycle de vie d’une version', () => {
  async function createDraft(request: APIRequestContext): Promise<string> {
    const created = await request.post('/api/process-templates', {
      data: { name: uniqueName('Cycle'), graph: sixStepGraph() },
    });
    return ((await created.json()) as { data: { version: { id: string } } }).data.version.id;
  }

  test('un brouillon se modifie, une version publiée non', async ({ request }) => {
    const versionId = await createDraft(request);

    const edited = await request.post(`/api/process-versions/${versionId}/graph`, {
      data: {
        steps: [{ id: 'unique', name: 'Unique', stage: 'substrate' }],
        transitions: [],
      },
    });
    expect(edited.status()).toBe(200);

    await request.post(`/api/process-versions/${versionId}/publish`);

    const afterPublish = await request.post(`/api/process-versions/${versionId}/graph`, {
      data: { steps: [{ id: 'autre', name: 'Autre', stage: 'substrate' }], transitions: [] },
    });
    const body = (await afterPublish.json()) as { error: { code: string; hint: string } };

    expect(afterPublish.status()).toBe(409);
    expect(body.error.code).toBe('VERSION_PUBLISHED_IMMUTABLE');
    expect(body.error.hint).toContain('comparer');
  });

  test('une nouvelle version repart du contenu de la précédente', async ({ request }) => {
    const versionId = await createDraft(request);
    await request.post(`/api/process-versions/${versionId}/publish`);

    const draft = await request.post(`/api/process-versions/${versionId}/draft`);
    const draftBody = (await draft.json()) as {
      data: { id: string; versionNumber: number; status: string; graph: { steps: unknown[] } };
    };

    expect(draftBody.data.versionNumber).toBe(2);
    expect(draftBody.data.status).toBe('draft');
    // Le contenu est repris : on repart de l'existant, pas d'une page blanche.
    expect(draftBody.data.graph.steps).toHaveLength(7);
  });

  test('publier une version ne déplace aucune unité en cours', async ({ request }) => {
    const versionId = await createDraft(request);
    await request.post(`/api/process-versions/${versionId}/publish`);

    const unit = await request.post('/api/units', {
      data: {
        name: 'Unité épinglée',
        stage: 'substrate',
        processVersionId: versionId,
        stepId: 'inoculation',
      },
    });
    const publicCode = ((await unit.json()) as { data: { unit: { publicCode: string } } }).data.unit
      .publicCode;

    const draft = await request.post(`/api/process-versions/${versionId}/draft`);
    const draftId = ((await draft.json()) as { data: { id: string } }).data.id;
    await request.post(`/api/process-versions/${draftId}/graph`, {
      data: {
        steps: [{ id: 'tout_autre', name: 'Tout autre', stage: 'substrate' }],
        transitions: [],
      },
    });
    const published = await request.post(`/api/process-versions/${draftId}/publish`);
    const publishedBody = (await published.json()) as { note: string };

    expect(publishedBody.note).toContain('Aucune unité en cours');

    const after = await request.get(`/api/units/${publicCode}`);
    const afterBody = (await after.json()) as { data: { processVersionId: string } };
    // C'est ce qui rendra la comparaison entre versions possible.
    expect(afterBody.data.processVersionId).toBe(versionId);
  });
});

test.describe('validation du graphe', () => {
  test('refuse un process sans étape', async ({ request }) => {
    const response = await request.post('/api/process-templates', {
      data: { name: uniqueName('Vide'), graph: { steps: [], transitions: [] } },
    });
    const body = (await response.json()) as { error: { code: string; message: string } };

    expect(response.status()).toBe(422);
    expect(body.error.code).toBe('PROCESS_GRAPH_INVALID');
    expect(body.error.message).toContain('aucune étape');
  });

  test('refuse une arête vers une étape inexistante', async ({ request }) => {
    const response = await request.post('/api/process-templates', {
      data: {
        name: uniqueName('Arête pendante'),
        graph: {
          steps: [{ id: 'a', name: 'A', stage: 'substrate' }],
          transitions: [{ from: 'a', to: 'fantome' }],
        },
      },
    });
    const body = (await response.json()) as { error: { message: string; hint: string } };

    expect(response.status()).toBe(422);
    expect(body.error.message).toContain('fantome');
    expect(body.error.hint).toContain('éditeur');
  });

  test('refuse une durée cible négative', async ({ request }) => {
    const response = await request.post('/api/process-templates', {
      data: {
        name: uniqueName('Durée négative'),
        graph: {
          steps: [{ id: 'a', name: 'A', stage: 'substrate', targetDurationDays: -3 }],
          transitions: [],
        },
      },
    });
    expect(response.status()).toBe(400);
  });

  /** Une étape isolée est un avertissement, pas une erreur : on publie quand même. */
  test('accepte une étape isolée', async ({ request }) => {
    const response = await request.post('/api/process-templates', {
      data: {
        name: uniqueName('Isolée'),
        graph: {
          steps: [
            { id: 'a', name: 'A', stage: 'substrate' },
            { id: 'b', name: 'B', stage: 'substrate' },
            { id: 'orpheline', name: 'Orpheline', stage: 'substrate' },
          ],
          transitions: [{ from: 'a', to: 'b' }],
        },
      },
    });
    expect(response.status()).toBe(200);
  });
});
