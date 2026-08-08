import { expect, test } from '@playwright/test';
import { createPublishedProcess, createUnit, uniqueName } from './helpers.js';

/**
 * Scénario n°1 de `docs/22` §6.2 — parcours nominal complet.
 *
 * Contre une vraie pile : serveur Node, MongoDB en replica set, aucun mock.
 * C'est le seul niveau qui prouve que les couches tiennent ensemble.
 */

test.describe('parcours nominal', () => {
  test('crée un process, une unité, imprime, avance et vérifie la trace', async ({ request }) => {
    const process = await createPublishedProcess(request);

    const version = await request.get(`/api/process-versions/${process.versionId}`);
    expect(version.ok()).toBe(true);
    const versionBody = (await version.json()) as {
      data: { status: string; graph: { steps: unknown[] } };
    };
    expect(versionBody.data.status).toBe('published');
    // Le process réel du cultivateur : six étapes plus la fin de cycle, pas treize.
    expect(versionBody.data.graph.steps).toHaveLength(7);

    const unit = await createUnit(request, process.versionId);
    expect(unit.publicCode).toMatch(/^SUB-\d{4}-\d{4,6}$/);

    const qr = await request.post(`/api/units/${unit.publicCode}/qr`);
    const qrBody = (await qr.json()) as { data: { token: string }; alreadyExisted: boolean };
    expect(qrBody.alreadyExisted).toBe(false);
    expect(qrBody.data.token).toHaveLength(22);

    const print = await request.post(`/api/units/${unit.publicCode}/label/print`, { data: {} });
    const printBody = (await print.json()) as {
      data: { status: string; label: { publicCode: string; qrToken: string } };
    };
    expect(printBody.data.status).toBe('printed');
    expect(printBody.data.label.publicCode).toBe(unit.publicCode);
    expect(printBody.data.label.qrToken).toBe(qrBody.data.token);

    // Après un scan, la fiche arrive directement : pas de second appel.
    const scanned = await request.get(`/api/qr/${qrBody.data.token}`);
    const scannedBody = (await scanned.json()) as {
      data: { target: { publicCode: string } | null };
    };
    expect(scannedBody.data.target?.publicCode).toBe(unit.publicCode);

    let expectedVersion = unit.version;
    for (const stepId of ['incubation', 'fructification', 'flush_1']) {
      const advance = await request.post(`/api/units/${unit.publicCode}/advance`, {
        headers: { 'Idempotency-Key': `${unit.publicCode}-${stepId}` },
        data: { toStepId: stepId, expectedVersion },
      });
      expect(advance.status()).toBe(200);
      const body = (await advance.json()) as {
        data: { unit: { currentStepId: string; version: number }; event: { type: string } };
      };
      expect(body.data.unit.currentStepId).toBe(stepId);
      expect(body.data.event.type).toBe('unit.step_advanced');
      expectedVersion = body.data.unit.version;
    }

    const timeline = await request.get(`/api/units/${unit.publicCode}/timeline`);
    const events = ((await timeline.json()) as { data: { type: string }[] }).data;
    expect(events.map((e) => e.type)).toEqual([
      'unit.created',
      'unit.step_advanced',
      'unit.step_advanced',
      'unit.step_advanced',
    ]);
  });

  test('le chemin nominal proposé correspond au graphe publié', async ({ request }) => {
    const process = await createPublishedProcess(request);
    const unit = await createUnit(request, process.versionId);

    const response = await request.get(`/api/units/${unit.publicCode}/next-steps`);
    const body = (await response.json()) as {
      data: { nominal: { id: string }[]; note: string; allSteps: string[] };
    };

    expect(body.data.nominal.map((s) => s.id)).toEqual(['incubation']);
    expect(body.data.allSteps).toHaveLength(7);
    // Le graphe conseille, il n'interdit pas : la réponse le rappelle.
    expect(body.data.note).toContain('confirmOffNominal');
  });

  /** Réimprimer reproduit la même étiquette à l'identique (`q17_5`). */
  test('la réimpression réutilise le même token', async ({ request }) => {
    const process = await createPublishedProcess(request);
    const unit = await createUnit(request, process.versionId);

    const qr = await request.post(`/api/units/${unit.publicCode}/qr`);
    const token = ((await qr.json()) as { data: { token: string } }).data.token;

    const first = await request.post(`/api/units/${unit.publicCode}/label/print`, { data: {} });
    const second = await request.post(`/api/units/${unit.publicCode}/label/print`, { data: {} });

    const firstBody = (await first.json()) as {
      data: { isReprint: boolean; label: { qrToken: string } };
    };
    const secondBody = (await second.json()) as {
      data: { isReprint: boolean; label: { qrToken: string } };
    };

    expect(firstBody.data.isReprint).toBe(false);
    expect(secondBody.data.isReprint).toBe(true);
    expect(firstBody.data.label.qrToken).toBe(token);
    expect(secondBody.data.label.qrToken).toBe(token);
  });

  test('redemander le QR d’une unité rend le sien', async ({ request }) => {
    const process = await createPublishedProcess(request);
    const unit = await createUnit(request, process.versionId);

    const first = await request.post(`/api/units/${unit.publicCode}/qr`);
    const second = await request.post(`/api/units/${unit.publicCode}/qr`);

    const firstBody = (await first.json()) as { data: { token: string } };
    const secondBody = (await second.json()) as {
      data: { token: string };
      alreadyExisted: boolean;
    };

    expect(secondBody.alreadyExisted).toBe(true);
    expect(secondBody.data.token).toBe(firstBody.data.token);
  });
});

/**
 * Scénario n°5 — audit de traçabilité.
 *
 * C'est le test qui vérifie la **promesse du produit**, pas seulement le code.
 * Il exécute les assertions de `docs/22` §6.3 contre une base réelle.
 */
test.describe('audit de traçabilité', () => {
  test('le journal rejoué concorde avec l’état stocké', async ({ request }) => {
    const process = await createPublishedProcess(request);
    const unit = await createUnit(request, process.versionId);

    await request.post(`/api/units/${unit.publicCode}/advance`, {
      data: { toStepId: 'incubation', expectedVersion: 0 },
    });
    await request.post(`/api/units/${unit.publicCode}/advance`, {
      data: { toStepId: 'fructification', expectedVersion: 1 },
    });

    const audit = await request.get(`/api/units/${unit.publicCode}/audit`);
    const body = (await audit.json()) as {
      data: {
        verified: boolean;
        divergences: unknown[];
        integrityIssues: unknown[];
        eventCount: number;
      };
    };

    // Assertion n°3 : l'état reconstruit par rejeu === l'état courant en base.
    expect(body.data.divergences).toEqual([]);
    // Assertions n°4 et 5 : pas d'événement orphelin ni de doublon.
    expect(body.data.integrityIssues).toEqual([]);
    // Assertion n°4 : une mutation d'état = un événement.
    expect(body.data.eventCount).toBe(3);
    expect(body.data.verified).toBe(true);
  });

  test('la version de process reste épinglée à l’unité après publication d’une autre', async ({
    request,
  }) => {
    const process = await createPublishedProcess(request);
    const unit = await createUnit(request, process.versionId);

    const draft = await request.post(`/api/process-versions/${process.versionId}/draft`);
    const draftBody = (await draft.json()) as { data: { id: string } };
    await request.post(`/api/process-versions/${draftBody.data.id}/graph`, {
      data: {
        steps: [{ id: 'tout_autre', name: 'Tout autre', stage: 'substrate' }],
        transitions: [],
      },
    });
    const published = await request.post(`/api/process-versions/${draftBody.data.id}/publish`);
    const publishedBody = (await published.json()) as { note: string };

    // Décision docs/21 §2 : publier ne déplace aucune unité en cours.
    expect(publishedBody.note).toContain('Aucune unité en cours');

    const after = await request.get(`/api/units/${unit.publicCode}`);
    const afterBody = (await after.json()) as { data: { processVersionId: string } };
    expect(afterBody.data.processVersionId).toBe(process.versionId);

    const nextSteps = await request.get(`/api/units/${unit.publicCode}/next-steps`);
    const nextBody = (await nextSteps.json()) as { data: { nominal: { id: string }[] } };
    expect(nextBody.data.nominal.map((s) => s.id)).toEqual(['incubation']);
  });

  test('une version publiée ne peut plus être modifiée', async ({ request }) => {
    const process = await createPublishedProcess(request);

    const response = await request.post(`/api/process-versions/${process.versionId}/graph`, {
      data: { steps: [{ id: 'x', name: 'X', stage: 'substrate' }], transitions: [] },
    });
    const body = (await response.json()) as { error: { code: string; hint: string } };

    expect(response.status()).toBe(409);
    expect(body.error.code).toBe('VERSION_PUBLISHED_IMMUTABLE');
    expect(body.error.hint).toContain('comparer');
  });

  test('un graphe invalide est refusé à la création, avec le détail', async ({ request }) => {
    const response = await request.post('/api/process-templates', {
      data: {
        name: uniqueName('Process cassé'),
        graph: {
          steps: [{ id: 'a', name: 'A', stage: 'substrate' }],
          transitions: [{ from: 'a', to: 'fantome' }],
        },
      },
    });
    const body = (await response.json()) as { error: { code: string; message: string } };

    expect(response.status()).toBe(422);
    expect(body.error.code).toBe('PROCESS_GRAPH_INVALID');
    expect(body.error.message).toContain('fantome');
  });
});

/**
 * Les libertés accordées par le cultivateur : étapes sautables, refaisables et
 * réversibles. Le graphe décrit le chemin nominal, il n'interdit rien.
 */
test.describe('écarts au chemin nominal', () => {
  test('sauter une étape est refusé sans confirmation, accepté avec', async ({ request }) => {
    const process = await createPublishedProcess(request);
    const unit = await createUnit(request, process.versionId);

    const refused = await request.post(`/api/units/${unit.publicCode}/advance`, {
      data: { toStepId: 'flush_1', expectedVersion: 0 },
    });
    const refusedBody = (await refused.json()) as { error: { hint: string } };
    expect(refused.status()).toBe(400);
    expect(refusedBody.error.hint).toContain('confirmOffNominal');

    const accepted = await request.post(`/api/units/${unit.publicCode}/advance`, {
      data: { toStepId: 'flush_1', expectedVersion: 0, confirmOffNominal: true },
    });
    const acceptedBody = (await accepted.json()) as {
      data: { event: { payload: { followedNominalPath: boolean } } };
    };
    expect(accepted.status()).toBe(200);
    // L'écart est enregistré, pas empêché.
    expect(acceptedBody.data.event.payload.followedNominalPath).toBe(false);
  });

  test('revenir en arrière est possible et laisse la trace cohérente', async ({ request }) => {
    const process = await createPublishedProcess(request);
    const unit = await createUnit(request, process.versionId);

    await request.post(`/api/units/${unit.publicCode}/advance`, {
      data: { toStepId: 'incubation', expectedVersion: 0 },
    });
    const back = await request.post(`/api/units/${unit.publicCode}/advance`, {
      data: { toStepId: 'inoculation', expectedVersion: 1, confirmOffNominal: true },
    });

    expect(back.status()).toBe(200);
    const audit = await request.get(`/api/units/${unit.publicCode}/audit`);
    const auditBody = (await audit.json()) as { data: { verified: boolean } };
    // Un retour en arrière ne casse pas la cohérence journal/état.
    expect(auditBody.data.verified).toBe(true);
  });

  test('une étape inexistante est refusée avec la liste des étapes valides', async ({
    request,
  }) => {
    const process = await createPublishedProcess(request);
    const unit = await createUnit(request, process.versionId);

    const response = await request.post(`/api/units/${unit.publicCode}/advance`, {
      data: { toStepId: 'flush_4', expectedVersion: 0, confirmOffNominal: true },
    });
    const body = (await response.json()) as { error: { code: string; hint: string } };

    expect(response.status()).toBe(422);
    expect(body.error.code).toBe('STEP_NOT_IN_PROCESS');
    expect(body.error.hint).toContain('flush_3');
    expect(body.error.hint).not.toContain('flush_4');
  });

  test('une unité peut naître à un stade amont, sans ascendant', async ({ request }) => {
    const process = await createPublishedProcess(request, {
      steps: [
        { id: 'gelose', name: 'Gélose', stage: 'gelose' },
        { id: 'lc', name: 'Culture liquide', stage: 'liquid_culture' },
      ],
      transitions: [{ from: 'gelose', to: 'lc' }],
    });

    const unit = await createUnit(request, process.versionId, {
      name: 'Boîte de Pétri 1',
      stage: 'gelose',
      stepId: 'gelose',
      substrateWeight: undefined,
    });

    expect(unit.publicCode).toMatch(/^GEL-/);
    const fetched = await request.get(`/api/units/${unit.publicCode}`);
    const body = (await fetched.json()) as {
      data: { parentUnitId: string | null; lineageRelation: string };
    };
    expect(body.data.parentUnitId).toBeNull();
    expect(body.data.lineageRelation).toBe('origin');
  });
});

test.describe('découverte par un agent', () => {
  /**
   * La promesse « pilotable par un LLM » (docs/22 §4.3) : un agent qui arrive
   * sans contexte doit savoir quoi faire après **une** requête.
   */
  test('un seul appel suffit à comprendre l’application', async ({ request }) => {
    const response = await request.get('/api/_discover');
    const body = (await response.json()) as {
      authentication: string;
      conventions: Record<string, string>;
      operations: { method: string; path: string }[];
      recipes: Record<string, string>;
      state: { unitsByStage: Record<string, number> };
    };

    expect(response.status()).toBe(200);
    expect(body.authentication).toContain('aucune');
    expect(Object.values(body.conventions).join(' ')).toContain('dryRun');
    expect(Object.values(body.conventions).join(' ')).toContain('Idempotency-Key');
    expect(body.operations.length).toBeGreaterThan(4);
    expect(Object.keys(body.recipes).length).toBeGreaterThan(0);
    expect(body.state.unitsByStage).toBeDefined();
  });

  test('dryRun décrit l’effet sans rien écrire', async ({ request }) => {
    const process = await createPublishedProcess(request);
    const unit = await createUnit(request, process.versionId);

    const dry = await request.post(`/api/units/${unit.publicCode}/advance?dryRun=true`, {
      data: { toStepId: 'incubation', expectedVersion: 0 },
    });
    const dryBody = (await dry.json()) as {
      dryRun: boolean;
      data: { wouldBecome: { currentStepId: string } };
    };
    expect(dryBody.dryRun).toBe(true);
    expect(dryBody.data.wouldBecome.currentStepId).toBe('incubation');

    const after = await request.get(`/api/units/${unit.publicCode}`);
    const afterBody = (await after.json()) as { data: { currentStepId: string; version: number } };
    expect(afterBody.data.currentStepId).toBe('inoculation');
    expect(afterBody.data.version).toBe(0);
  });

  test('les erreurs portent les valeurs valides, pas seulement le constat', async ({ request }) => {
    const response = await request.get('/api/units?stage=compost');
    const body = (await response.json()) as {
      error: { code: string; message: string; hint: string; docsUrl: string };
    };

    expect(response.status()).toBe(400);
    expect(body.error.hint).toContain('substrate');
    expect(body.error.hint).toContain('gelose');
    expect(body.error.docsUrl).toBeTruthy();
  });
});
