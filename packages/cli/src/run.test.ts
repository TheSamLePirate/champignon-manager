import { describe, expect, it, vi } from 'vitest';
import { renderHelp, runCli, type CliEnvironment } from './run.js';

/**
 * Exécution du CLI, sans réseau.
 *
 * Ce qui compte pour un agent : le code de sortie est fiable, la sortie est du
 * JSON, et la réponse de l'API est rendue **telle quelle** — sans
 * interprétation qui pourrait diverger.
 */

const BASE = 'http://localhost:3000';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeEnvironment(
  impl: (input: string | URL | Request, init?: RequestInit) => Promise<Response>,
): CliEnvironment & { calls: ReturnType<typeof vi.fn<typeof globalThis.fetch>> } {
  const fetchImpl = vi.fn<typeof globalThis.fetch>(impl as typeof globalThis.fetch);
  // `typeof fetch` porte aussi `preconnect` sous Bun : on complète le mock
  // plutôt que d'affaiblir le type de l'environnement.
  const complete = Object.assign(fetchImpl, { preconnect: () => undefined });
  return {
    baseUrl: BASE,
    fetch: complete,
    newIdempotencyKey: () => 'clé-générée',
    calls: fetchImpl,
  };
}

describe('aide', () => {
  it('décrit les conventions et toutes les commandes', async () => {
    const result = await runCli(
      ['help'],
      makeEnvironment(() => Promise.resolve(jsonResponse({}))),
    );
    const help = JSON.parse(result.stdout) as {
      usage: string;
      conventions: Record<string, string>;
      commands: { id: string; usage: string }[];
      recipes: Record<string, string>;
    };

    expect(result.exitCode).toBe(0);
    expect(help.usage).toContain('champi <commande>');
    expect(help.conventions['exitCode']).toContain('0 en cas de succès');
    expect(help.conventions['baseUrl']).toContain('CHAMPI_URL');
    expect(help.commands.length).toBeGreaterThan(20);
    expect(Object.keys(help.recipes)).toContain('du spore à l’assiette');
  });

  it('montre l’usage complet de chaque commande', async () => {
    const result = await runCli(
      [],
      makeEnvironment(() => Promise.resolve(jsonResponse({}))),
    );
    const help = JSON.parse(result.stdout) as { commands: { id: string; usage: string }[] };
    const advance = help.commands.find((c) => c.id === 'unit:advance');
    expect(advance?.usage).toBe('champi unit:advance <reference>');
  });

  it('détaille une commande précise', () => {
    const result = renderHelp('unit:advance', false);
    const detail = JSON.parse(result.stdout) as {
      method: string;
      path: string;
      supportsDryRun: boolean;
      supportsIdempotency: boolean;
    };

    expect(result.exitCode).toBe(0);
    expect(detail.method).toBe('POST');
    expect(detail.path).toBe('/api/units/:reference/advance');
    expect(detail.supportsDryRun).toBe(true);
    expect(detail.supportsIdempotency).toBe(true);
  });

  it('refuse une aide sur une commande inconnue', () => {
    const result = renderHelp('jamais', false);
    const body = JSON.parse(result.stderr) as { error: { code: string; hint: string } };
    expect(result.exitCode).toBe(1);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.hint).toContain('champi help');
  });

  it('met en forme sur demande', () => {
    expect(renderHelp('unit:advance', true).stdout).toContain('\n  ');
  });
});

describe('exécution', () => {
  it('appelle la bonne URL en lecture', async () => {
    const environment = makeEnvironment(() => Promise.resolve(jsonResponse({ data: {} })));
    await runCli(['unit:get', 'SUB-2026-0001'], environment);
    expect(environment.calls.mock.calls[0]?.[0]).toBe(`${BASE}/api/units/SUB-2026-0001`);
  });

  it('transmet les paramètres de requête', async () => {
    const environment = makeEnvironment(() => Promise.resolve(jsonResponse({ data: [] })));
    await runCli(['unit:list', '--stage', 'substrate'], environment);
    expect(environment.calls.mock.calls[0]?.[0]).toBe(`${BASE}/api/units?stage=substrate`);
  });

  it('ajoute dryRun à la requête', async () => {
    const environment = makeEnvironment(() => Promise.resolve(jsonResponse({ dryRun: true })));
    await runCli(['unit:create', '--dry-run'], environment);
    expect(environment.calls.mock.calls[0]?.[0]).toContain('dryRun=true');
  });

  it('envoie le corps JSON sur une mutation', async () => {
    const environment = makeEnvironment(() => Promise.resolve(jsonResponse({ data: {} })));
    await runCli(
      ['unit:advance', 'SUB-2026-0001', '--json', '{"toStepId":"incubation"}'],
      environment,
    );

    const init = environment.calls.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({ toStepId: 'incubation' });
  });

  it('envoie un corps vide quand aucun n’est fourni', async () => {
    const environment = makeEnvironment(() => Promise.resolve(jsonResponse({ data: {} })));
    await runCli(['qr:assign', 'SUB-2026-0001'], environment);
    expect(JSON.parse(environment.calls.mock.calls[0]?.[1]?.body as string)).toEqual({});
  });

  it('n’envoie pas de corps sur une lecture', async () => {
    const environment = makeEnvironment(() => Promise.resolve(jsonResponse({ data: {} })));
    await runCli(['unit:get', 'SUB-2026-0001'], environment);
    expect(environment.calls.mock.calls[0]?.[1]?.body).toBeUndefined();
  });

  /**
   * Un agent qui réessaie est protégé **même s'il n'y a pas pensé** : la clé
   * est générée par défaut.
   */
  it('génère une clé d’idempotence quand elle n’est pas fournie', async () => {
    const environment = makeEnvironment(() => Promise.resolve(jsonResponse({ data: {} })));
    await runCli(['unit:create'], environment);

    const headers = environment.calls.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('clé-générée');
  });

  it('respecte une clé d’idempotence fournie', async () => {
    const environment = makeEnvironment(() => Promise.resolve(jsonResponse({ data: {} })));
    await runCli(['unit:create', '--idempotency-key', 'terrain-7'], environment);

    const headers = environment.calls.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('terrain-7');
  });

  it('n’ajoute pas de clé sur une mutation qui n’en accepte pas', async () => {
    const environment = makeEnvironment(() => Promise.resolve(jsonResponse({ data: {} })));
    await runCli(['qr:assign', 'SUB-2026-0001'], environment);

    const headers = environment.calls.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBeUndefined();
  });
});

describe('sortie et code de retour', () => {
  /** Le CLI n'interprète rien : un agent lit exactement ce que l'API a dit. */
  it('rend la réponse telle quelle en cas de succès', async () => {
    const payload = { data: { publicCode: 'SUB-2026-0001' } };
    const result = await runCli(
      ['unit:get', 'SUB-2026-0001'],
      makeEnvironment(() => Promise.resolve(jsonResponse(payload))),
    );

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(payload);
    expect(result.stderr).toBe('');
  });

  it('rend l’erreur de l’API sur la sortie d’erreur, avec son indice', async () => {
    const payload = {
      error: { code: 'NOT_FOUND', message: 'introuvable', hint: 'Vérifie le code public.' },
    };
    const result = await runCli(
      ['unit:get', 'SUB-2026-9999'],
      makeEnvironment(() => Promise.resolve(jsonResponse(payload, 404))),
    );

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
    expect(JSON.parse(result.stderr)).toEqual(payload);
  });

  it('met en forme sur --pretty', async () => {
    const result = await runCli(
      ['unit:get', 'SUB-2026-0001', '--pretty'],
      makeEnvironment(() => Promise.resolve(jsonResponse({ data: { a: 1 } }))),
    );
    expect(result.stdout).toContain('\n  ');
  });

  it('signale un serveur injoignable en donnant l’adresse essayée', async () => {
    const result = await runCli(
      ['unit:get', 'SUB-2026-0001'],
      makeEnvironment(() => Promise.reject(new Error('ECONNREFUSED'))),
    );
    const body = JSON.parse(result.stderr) as { error: { hint: string } };

    expect(result.exitCode).toBe(1);
    expect(body.error.hint).toContain('CHAMPI_URL');
    expect(body.error.hint).toContain(BASE);
    expect(body.error.hint).toContain('ECONNREFUSED');
  });

  it('tolère un rejet qui n’est pas une Error', async () => {
    const result = await runCli(
      ['unit:get', 'SUB-2026-0001'],
      // La règle vaut pour du code de production — mais `fetch` peut rejeter
      // avec autre chose qu'une Error, et le CLI doit le supporter.
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      makeEnvironment(() => Promise.reject('panne')),
    );
    const body = JSON.parse(result.stderr) as { error: { hint: string } };
    expect(body.error.hint).toContain('inconnue');
  });

  it('signale une réponse illisible sans prétendre à un refus métier', async () => {
    const result = await runCli(
      ['unit:get', 'SUB-2026-0001'],
      makeEnvironment(() => Promise.resolve(new Response('<html>502</html>', { status: 502 }))),
    );
    const body = JSON.parse(result.stderr) as { error: { message: string; hint: string } };

    expect(result.exitCode).toBe(1);
    expect(body.error.message).toContain('502');
    expect(body.error.hint).toContain('pas un refus métier');
  });

  it('rend une erreur d’analyse en JSON, pas en texte libre', async () => {
    const result = await runCli(
      ['unit:get'],
      makeEnvironment(() => Promise.resolve(jsonResponse({}))),
    );
    const body = JSON.parse(result.stderr) as { error: { code: string; hint: string } };

    expect(result.exitCode).toBe(1);
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(body.error.hint).toContain('Usage');
  });

  it('met en forme aussi les erreurs d’analyse', async () => {
    const result = await runCli(
      ['unit:get', '--pretty'],
      makeEnvironment(() => Promise.resolve(jsonResponse({}))),
    );
    expect(result.stderr).toContain('\n  ');
  });
});
