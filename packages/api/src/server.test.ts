import { afterEach, describe, expect, it } from 'vitest';
import { InMemoryTransport } from '@champi/printing';
import { assembleServer, type AssembledServer } from './server.js';

/**
 * Tests d'assemblage.
 *
 * `server.ts` est la couture entre toutes les couches : c'est le seul endroit
 * qui lit l'horloge, tire de l'aléa et ouvre une connexion. Un assemblage cassé
 * ne se voit dans aucun test unitaire — mais rend l'application inutilisable.
 */

const TEST_DB = `champignon_server_${String(Date.now())}`;

let server: AssembledServer | undefined;

afterEach(async () => {
  if (server !== undefined) {
    await server.connection.db.dropDatabase();
    await server.close();
    server = undefined;
  }
});

describe('assembleServer', () => {
  it('monte une application qui répond', async () => {
    server = await assembleServer({ dbName: TEST_DB });

    const response = await server.app.request('/api/health');
    const body = (await response.json()) as { status: string; now: string };

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    // L'horloge réelle est branchée ici, et nulle part ailleurs.
    expect(Date.parse(body.now)).not.toBeNaN();
  });

  it('prépare les index de toutes les collections', async () => {
    server = await assembleServer({ dbName: TEST_DB });

    const collections = ['lots', 'events', 'qrRegistry', 'processTemplates', 'processVersions'];
    for (const name of collections) {
      const indexes = await server.connection.db.collection(name).indexes();
      // Au moins l'index `_id` plus les nôtres : une collection sans index
      // métier n'aurait qu'une entrée.
      expect(indexes.length).toBeGreaterThan(1);
    }
  });

  it('accepte un transport d’impression fourni', async () => {
    const transport = new InMemoryTransport();
    server = await assembleServer({ dbName: TEST_DB, transport });
    expect(server.transport).toBe(transport);
  });

  it('fournit un transport par défaut quand aucun n’est donné', async () => {
    server = await assembleServer({ dbName: TEST_DB });
    expect(server.transport.name).toBe('memoire');
  });

  /**
   * Mise en service. Sans amorçage, une base neuve ne permet **aucune** action :
   * pas de process, donc pas d'unité. Avec, l'application est utilisable dès le
   * premier démarrage — c'est l'objet du lot 12.
   */
  it('n’amorce rien par défaut : un test pose ses propres données', async () => {
    server = await assembleServer({ dbName: TEST_DB });

    expect(server.seed).toBeUndefined();
    const response = await server.app.request('/api/process-templates');
    expect(((await response.json()) as { data: unknown[] }).data).toEqual([]);
  });

  it('installe le modèle par défaut quand on le demande', async () => {
    server = await assembleServer({ dbName: TEST_DB, seed: true });

    expect(server.seed?.seeded).toBe(true);
    const response = await server.app.request('/api/process-templates');
    const templates = ((await response.json()) as { data: { name: string }[] }).data;
    expect(templates).toHaveLength(1);
    expect(templates[0]?.name).toMatch(/à ajuster/);
  });

  /**
   * Le point le plus important de l'assemblage : le graphe vient de la version
   * **épinglée** à l'unité, jamais de la version courante du modèle. C'est ce
   * qui garantit qu'une publication ne déplace aucune unité en cours.
   */
  it('résout le graphe depuis la version épinglée', async () => {
    server = await assembleServer({ dbName: TEST_DB });

    const created = await server.app.request('/api/process-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Process assemblé',
        graph: {
          steps: [
            { id: 'a', name: 'A', stage: 'substrate' },
            { id: 'b', name: 'B', stage: 'fruiting' },
          ],
          transitions: [{ from: 'a', to: 'b' }],
        },
      }),
    });
    const versionId = ((await created.json()) as { data: { version: { id: string } } }).data.version
      .id;
    await server.app.request(`/api/process-versions/${versionId}/publish`, { method: 'POST' });

    const unit = await server.app.request('/api/units', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Unité assemblée',
        stage: 'substrate',
        processVersionId: versionId,
        stepId: 'a',
      }),
    });
    const publicCode = ((await unit.json()) as { data: { unit: { publicCode: string } } }).data.unit
      .publicCode;

    const nextSteps = await server.app.request(`/api/units/${publicCode}/next-steps`);
    const body = (await nextSteps.json()) as { data: { nominal: { id: string }[] } };
    expect(body.data.nominal.map((s) => s.id)).toEqual(['b']);
  });

  it('rend null pour une version de process inexistante', async () => {
    server = await assembleServer({ dbName: TEST_DB });

    const response = await server.app.request('/api/units', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Orpheline',
        stage: 'substrate',
        processVersionId: 'jamais-creee',
        stepId: 'a',
      }),
    });
    expect(response.status).toBe(404);
  });

  /** L'aléa réel est branché ici : deux tokens successifs doivent différer. */
  it('branche une source d’aléa cryptographique', async () => {
    server = await assembleServer({ dbName: TEST_DB });

    const created = await server.app.request('/api/process-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Process aléa',
        graph: { steps: [{ id: 'a', name: 'A', stage: 'substrate' }], transitions: [] },
      }),
    });
    const versionId = ((await created.json()) as { data: { version: { id: string } } }).data.version
      .id;
    await server.app.request(`/api/process-versions/${versionId}/publish`, { method: 'POST' });

    const tokens: string[] = [];
    for (const name of ['Un', 'Deux']) {
      const unit = await server.app.request('/api/units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          stage: 'substrate',
          processVersionId: versionId,
          stepId: 'a',
        }),
      });
      const code = ((await unit.json()) as { data: { unit: { publicCode: string } } }).data.unit
        .publicCode;
      const qr = await server.app.request(`/api/units/${code}/qr`, { method: 'POST' });
      tokens.push(((await qr.json()) as { data: { token: string } }).data.token);
    }

    expect(tokens[0]).not.toBe(tokens[1]);
    expect(tokens[0]).toHaveLength(22);
  });
});
