import { expect, test } from '@playwright/test';
import { createPublishedProcess, createUnit } from './helpers.js';

/**
 * Scénario n°4 de `docs/22` §6.2 — parcours dégradé.
 *
 * C'est le scénario de perte de données le plus probable de l'application
 * (`claude-critics.md` P2-4) : Wi-Fi de chambre instable, la requête part, la
 * réponse se perd, le client réessaie. Sans idempotence, l'unité avance deux
 * fois — et personne ne s'en aperçoit avant la récolte.
 */

test.describe('rejeu après coupure', () => {
  test('deux envois de la même requête ne produisent qu’un seul avancement', async ({
    request,
  }) => {
    const process = await createPublishedProcess(request);
    const unit = await createUnit(request, process.versionId);
    const key = `terrain-${unit.publicCode}`;

    const first = await request.post(`/api/units/${unit.publicCode}/advance`, {
      headers: { 'Idempotency-Key': key },
      data: { toStepId: 'incubation', expectedVersion: 0 },
    });
    const retry = await request.post(`/api/units/${unit.publicCode}/advance`, {
      headers: { 'Idempotency-Key': key },
      data: { toStepId: 'incubation', expectedVersion: 0 },
    });

    expect(first.status()).toBe(200);
    expect(retry.status()).toBe(200);
    // Le rejeu est signalé, et rend la réponse d'origine à l'identique.
    expect(retry.headers()['idempotent-replay']).toBe('true');
    expect(await retry.json()).toEqual(await first.json());

    const timeline = await request.get(`/api/units/${unit.publicCode}/timeline`);
    const events = ((await timeline.json()) as { data: { type: string }[] }).data;
    expect(events.filter((e) => e.type === 'unit.step_advanced')).toHaveLength(1);
  });

  test('cinq rejeux consécutifs restent sans effet', async ({ request }) => {
    const process = await createPublishedProcess(request);
    const unit = await createUnit(request, process.versionId);
    const key = `insistant-${unit.publicCode}`;
    const payload = { toStepId: 'incubation', expectedVersion: 0 };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request.post(`/api/units/${unit.publicCode}/advance`, {
        headers: { 'Idempotency-Key': key },
        data: payload,
      });
      expect(response.status()).toBe(200);
    }

    const audit = await request.get(`/api/units/${unit.publicCode}/audit`);
    const auditBody = (await audit.json()) as { data: { verified: boolean; eventCount: number } };
    expect(auditBody.data.eventCount).toBe(2);
    expect(auditBody.data.verified).toBe(true);
  });

  test('la création d’unité est idempotente elle aussi', async ({ request }) => {
    const process = await createPublishedProcess(request);
    const key = `creation-${String(Date.now())}`;
    const payload = {
      name: 'Bloc rejoué',
      stage: 'substrate',
      processVersionId: process.versionId,
      stepId: 'inoculation',
    };

    const first = await request.post('/api/units', {
      headers: { 'Idempotency-Key': key },
      data: payload,
    });
    const retry = await request.post('/api/units', {
      headers: { 'Idempotency-Key': key },
      data: payload,
    });

    const firstBody = (await first.json()) as { data: { unit: { publicCode: string } } };
    const retryBody = (await retry.json()) as { data: { unit: { publicCode: string } } };

    // Sans idempotence, un retry créerait une seconde unité physique fantôme —
    // avec un second QR à coller sur un sac qui n'existe pas.
    expect(retryBody.data.unit.publicCode).toBe(firstBody.data.unit.publicCode);
    expect(retry.headers()['idempotent-replay']).toBe('true');
  });

  test('réutiliser une clé pour une autre requête est refusé', async ({ request }) => {
    const process = await createPublishedProcess(request);
    const unit = await createUnit(request, process.versionId);
    const key = `ambigu-${unit.publicCode}`;

    await request.post(`/api/units/${unit.publicCode}/advance`, {
      headers: { 'Idempotency-Key': key },
      data: { toStepId: 'incubation', expectedVersion: 0 },
    });
    const different = await request.post(`/api/units/${unit.publicCode}/advance`, {
      headers: { 'Idempotency-Key': key },
      data: { toStepId: 'fructification', expectedVersion: 1 },
    });
    const body = (await different.json()) as { error: { code: string; hint: string } };

    expect(different.status()).toBe(409);
    expect(body.error.code).toBe('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_BODY');
    expect(body.error.hint).toContain('clé différente');
  });
});

test.describe('verrou optimiste', () => {
  /**
   * Deux téléphones sur la même unité — cas réel quand deux personnes passent
   * en chambre à cinq minutes d'intervalle. Le second doit être refusé
   * proprement, pas écraser silencieusement le premier.
   */
  test('une écriture sur une version périmée est refusée', async ({ request }) => {
    const process = await createPublishedProcess(request);
    const unit = await createUnit(request, process.versionId);

    await request.post(`/api/units/${unit.publicCode}/advance`, {
      data: { toStepId: 'incubation', expectedVersion: 0 },
    });
    const stale = await request.post(`/api/units/${unit.publicCode}/advance`, {
      data: { toStepId: 'fructification', expectedVersion: 0 },
    });
    const body = (await stale.json()) as { error: { code: string; message: string; hint: string } };

    expect(stale.status()).toBe(409);
    expect(body.error.code).toBe('CONFLICT');
    expect(body.error.message).toContain('modifiée entre-temps');
    // Le message dit quelle version est en base : de quoi se resynchroniser.
    expect(body.error.message).toContain('version en base est 1');
    expect(body.error.hint).toContain('Relis');
  });

  test('dix avancements concurrents n’en appliquent qu’un', async ({ request }) => {
    const process = await createPublishedProcess(request);
    const unit = await createUnit(request, process.versionId);

    // Tous partent avec la même version attendue : un seul peut gagner.
    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        request.post(`/api/units/${unit.publicCode}/advance`, {
          data: { toStepId: 'incubation', expectedVersion: 0 },
        }),
      ),
    );

    const accepted = responses.filter((r) => r.status() === 200);
    const rejected = responses.filter((r) => r.status() === 409);
    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(9);

    const audit = await request.get(`/api/units/${unit.publicCode}/audit`);
    const auditBody = (await audit.json()) as { data: { verified: boolean; eventCount: number } };
    expect(auditBody.data.eventCount).toBe(2);
    expect(auditBody.data.verified).toBe(true);
  });

  test('un échec de verrou n’écrit aucun événement', async ({ request }) => {
    const process = await createPublishedProcess(request);
    const unit = await createUnit(request, process.versionId);

    const before = await request.get(`/api/units/${unit.publicCode}/timeline`);
    const beforeCount = ((await before.json()) as { data: unknown[] }).data.length;

    await request.post(`/api/units/${unit.publicCode}/advance`, {
      data: { toStepId: 'incubation', expectedVersion: 99 },
    });

    const after = await request.get(`/api/units/${unit.publicCode}/timeline`);
    const afterCount = ((await after.json()) as { data: unknown[] }).data.length;
    expect(afterCount).toBe(beforeCount);
  });
});

test.describe('robustesse des entrées', () => {
  test('un corps illisible produit une erreur structurée, pas une pile', async ({ request }) => {
    const process = await createPublishedProcess(request);
    const unit = await createUnit(request, process.versionId);

    const response = await request.post(`/api/units/${unit.publicCode}/advance`, {
      headers: { 'Content-Type': 'application/json' },
      data: 'ceci n’est pas du JSON',
    });
    const body = (await response.json()) as { error: { code: string; path: string } };

    expect(response.status()).toBe(400);
    expect(body.error.path).toBe('body');
    expect(JSON.stringify(body)).not.toContain('at Object');
  });

  test('un token QR mal formé est distingué d’un token inconnu', async ({ request }) => {
    const malformed = await request.get('/api/qr/pas-un-token');
    const malformedBody = (await malformed.json()) as { error: { hint: string } };
    expect(malformed.status()).toBe(400);
    expect(malformedBody.error.hint).toContain("étiquette de l'application");

    const unknown = await request.get('/api/qr/ZZZZZZZZZZZZZZZZZZZZZZ');
    const unknownBody = (await unknown.json()) as { error: { hint: string } };
    expect(unknown.status()).toBe(404);
    expect(unknownBody.error.hint).toContain('autre installation');
  });

  test('imprimer sans QR indique comment en obtenir un', async ({ request }) => {
    const process = await createPublishedProcess(request);
    const unit = await createUnit(request, process.versionId);

    const response = await request.post(`/api/units/${unit.publicCode}/label/print`, { data: {} });
    const body = (await response.json()) as { error: { hint: string } };

    expect(response.status()).toBe(404);
    expect(body.error.hint).toContain('/qr');
    expect(body.error.hint).toContain(unit.publicCode);
  });
});
