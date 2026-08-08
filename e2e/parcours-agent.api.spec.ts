import { expect, test } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

/**
 * Scénario n°3 de `docs/22` §6.2 — parcours agent.
 *
 * ⚠️ **Adapté à la décision du 08/08/2026** : il n'y a pas de serveur MCP, le
 * CLI est la surface d'agent. Ce scénario rejoue donc tout le parcours
 * **uniquement par le CLI**, en sous-processus, sans ouvrir de navigateur.
 *
 * S'il passe, la promesse « pilotable par un LLM » tient : un agent n'a besoin
 * ni de l'interface, ni de connaître le HTTP.
 */

const run = promisify(execFile);
const CLI = 'packages/cli/dist/champi.mjs';

interface CliRun {
  readonly stdout: unknown;
  readonly stderr: unknown;
  readonly exitCode: number;
}

/** Appelle le CLI comme le ferait un agent : arguments, JSON, code de sortie. */
async function champi(...args: string[]): Promise<CliRun> {
  try {
    const { stdout } = await run('node', [CLI, ...args], {
      env: { ...process.env, CHAMPI_URL: 'http://127.0.0.1:3100' },
    });
    return { stdout: JSON.parse(stdout) as unknown, stderr: null, exitCode: 0 };
  } catch (cause) {
    const error = cause as { stderr?: string; code?: number };
    return {
      stdout: null,
      stderr: error.stderr === undefined ? null : (JSON.parse(error.stderr) as unknown),
      exitCode: error.code ?? 1,
    };
  }
}

/**
 * Extrait la charge utile d'une réponse réussie.
 *
 * C'est assumé comme un transtypage : un test end-to-end ne connaît le contrat
 * que par ce que le serveur renvoie, il n'a pas les types du code applicatif —
 * et c'est précisément ce qui en fait un test de bout en bout.
 */
// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
function data<T>(result: CliRun): T {
  const payload = result.stdout as { data: T } | null;
  if (payload === null) {
    throw new Error(`la commande a échoué : ${JSON.stringify(result.stderr)}`);
  }
  return payload.data;
}

test.describe('découverte par un agent', () => {
  test('une seule commande suffit à comprendre l’application', async () => {
    const result = await champi('help');
    const help = result.stdout as {
      conventions: Record<string, string>;
      commands: { id: string }[];
      recipes: Record<string, string>;
    };

    expect(result.exitCode).toBe(0);
    expect(help.commands.length).toBeGreaterThan(20);
    expect(Object.values(help.conventions).join(' ')).toContain('dry-run');
    expect(Object.keys(help.recipes)).toContain('du spore à l’assiette');
  });

  /**
   * ⚠️ **Le test de parité, vérifié sur le système qui tourne.**
   *
   * Il compare le catalogue servi par l'API à la liste des commandes du CLI —
   * pas deux constantes compilées ensemble, mais ce que le serveur annonce
   * réellement et ce que le binaire sait faire. Il échoue dès qu'une route est
   * ajoutée sans commande (`docs/22` §4.5).
   */
  test('chaque opération annoncée par le serveur a une commande CLI', async () => {
    // `discover` rend sa charge à la racine, pas sous `data` : c'est le seul
    // point d'entrée qui déroge, parce qu'il décrit l'application elle-même.
    const discovered = (await champi('discover')).stdout as {
      operations: { id: string }[];
      authentication: string;
    };
    expect(discovered.authentication).toContain('aucune');

    const help = (await champi('help')).stdout as { commands: { id: string }[] };
    const cliCommands = new Set(help.commands.map((command) => command.id));

    for (const operation of discovered.operations) {
      expect(cliCommands.has(operation.id), `« ${operation.id} » n'a pas de commande CLI`).toBe(
        true,
      );
    }
    expect(cliCommands.size).toBe(discovered.operations.length);
  });

  /** Un agent qui se trompe doit pouvoir se corriger sans documentation. */
  test('une commande inconnue propose les commandes proches', async () => {
    const result = await champi('unit:teleport');
    const body = result.stderr as { error: { hint: string } };

    expect(result.exitCode).toBe(1);
    expect(body.error.hint).toContain('unit:advance');
  });

  test('un paramètre manquant donne l’usage exact', async () => {
    const result = await champi('unit:get');
    const body = result.stderr as { error: { hint: string } };
    expect(body.error.hint).toBe('Usage : champi unit:get <reference>');
  });
});

/**
 * Le parcours complet, piloté **uniquement par le CLI** : c'est le test qui
 * tient la promesse « pilotable par un LLM ».
 */
test.describe('parcours complet par le CLI', () => {
  const graph = {
    steps: [
      { id: 'inoculation', name: 'Inoculation', stage: 'substrate' },
      { id: 'incubation', name: 'Incubation', stage: 'substrate', targetDurationDays: 21 },
      { id: 'fructification', name: 'Fructification', stage: 'fruiting' },
      { id: 'flush_1', name: 'Flush 1', stage: 'fruiting' },
    ],
    transitions: [
      { from: 'inoculation', to: 'incubation' },
      { from: 'incubation', to: 'fructification' },
      { from: 'fructification', to: 'flush_1' },
    ],
  };

  test('du spore à l’assiette, sans jamais ouvrir l’interface', async () => {
    // 1. Créer et publier un process, en JSON.
    const created = await champi(
      'process:create',
      '--json',
      JSON.stringify({ name: `Agent ${String(Date.now())}`, graph }),
    );
    const versionId = data<{ version: { id: string } }>(created).version.id;
    expect((await champi('version:publish', versionId)).exitCode).toBe(0);

    // 2. Créer une unité.
    const unit = await champi(
      'unit:create',
      '--json',
      JSON.stringify({
        name: 'Bloc piloté par agent',
        stage: 'substrate',
        processVersionId: versionId,
        stepId: 'inoculation',
        substrateWeight: { value: 5, unit: 'kg', kind: 'substrate' },
      }),
    );
    const code = data<{ unit: { publicCode: string } }>(unit).unit.publicCode;
    expect(code).toMatch(/^SUB-/);

    // 3. Identifier physiquement.
    const qr = await champi('qr:assign', code);
    expect(data<{ token: string }>(qr).token).toHaveLength(22);
    expect(data<{ status: string }>(await champi('label:print', code)).status).toBe('printed');

    // 4. Vérifier avant d'agir — le réflexe qu'un agent doit pouvoir avoir.
    const dry = await champi(
      'unit:advance',
      code,
      '--json',
      JSON.stringify({ toStepId: 'incubation', expectedVersion: 0 }),
      '--dry-run',
    );
    expect((dry.stdout as { dryRun: boolean }).dryRun).toBe(true);
    const untouched = data<{ currentStepId: string }>(await champi('unit:get', code));
    expect(untouched.currentStepId).toBe('inoculation');

    // 5. Dérouler le cycle.
    for (const step of ['incubation', 'fructification', 'flush_1']) {
      const current = data<{ version: number }>(await champi('unit:get', code));
      const advanced = await champi(
        'unit:advance',
        code,
        '--json',
        JSON.stringify({ toStepId: step, expectedVersion: current.version }),
      );
      expect(advanced.exitCode).toBe(0);
    }

    // 6. Récolter puis transformer.
    const harvest = await champi(
      'harvest:record',
      code,
      '--json',
      JSON.stringify({
        flushNumber: 1,
        weight: { value: 1000, unit: 'g', kind: 'harvest' },
        quality: 'A',
      }),
    );
    const harvestCode = data<{ harvest: { publicCode: string } }>(harvest).harvest.publicCode;

    const product = await champi(
      'product:create',
      '--json',
      JSON.stringify({
        name: 'Barquette agent',
        quantity: { value: 1, unit: 'tray', kind: 'product' },
        origins: [
          { harvestId: harvestCode, weight: { value: 500, unit: 'g', kind: 'harvest' }, share: 1 },
        ],
      }),
    );
    const productCode = data<{ product: { publicCode: string } }>(product).product.publicCode;

    // 7. Remonter la chaîne — la promesse du produit.
    const trace = await champi('product:trace', productCode);
    const contributions = data<{ contributions: { unitPublicCode: string; sharePct: number }[] }>(
      trace,
    ).contributions;
    expect(contributions[0]?.unitPublicCode).toBe(code);
    expect(contributions[0]?.sharePct).toBe(100);

    // 8. Et vérifier que la trace est cohérente.
    const audit = data<{ verified: boolean; eventCount: number }>(await champi('unit:audit', code));
    expect(audit.verified).toBe(true);
    expect(audit.eventCount).toBe(6);
  });

  /**
   * Le scénario Wi-Fi instable, vu depuis un agent : il réessaie. La clé
   * d'idempotence le protège **même s'il n'y a pas pensé** — le CLI en génère
   * une par défaut, mais c'est une clé explicite qui rend le rejeu sûr.
   */
  test('un rejeu avec la même clé ne produit qu’un seul avancement', async () => {
    const created = await champi(
      'process:create',
      '--json',
      JSON.stringify({ name: `Rejeu ${String(Date.now())}`, graph }),
    );
    const versionId = data<{ version: { id: string } }>(created).version.id;
    await champi('version:publish', versionId);

    const unit = await champi(
      'unit:create',
      '--json',
      JSON.stringify({
        name: 'Bloc rejeu',
        stage: 'substrate',
        processVersionId: versionId,
        stepId: 'inoculation',
      }),
    );
    const code = data<{ unit: { publicCode: string } }>(unit).unit.publicCode;

    const args = [
      'unit:advance',
      code,
      '--json',
      JSON.stringify({ toStepId: 'incubation', expectedVersion: 0 }),
      '--idempotency-key',
      `agent-${code}`,
    ];
    const first = await champi(...args);
    const retry = await champi(...args);

    expect(first.exitCode).toBe(0);
    expect(retry.exitCode).toBe(0);
    expect(retry.stdout).toEqual(first.stdout);

    const timeline = data<{ type: string }[]>(await champi('unit:timeline', code));
    expect(timeline.filter((event) => event.type === 'unit.step_advanced')).toHaveLength(1);
  });

  test('une erreur métier remonte avec son indice et un code de sortie non nul', async () => {
    const created = await champi(
      'process:create',
      '--json',
      JSON.stringify({ name: `Erreur ${String(Date.now())}`, graph }),
    );
    const versionId = data<{ version: { id: string } }>(created).version.id;
    await champi('version:publish', versionId);

    const unit = await champi(
      'unit:create',
      '--json',
      JSON.stringify({
        name: 'Bloc erreur',
        stage: 'substrate',
        processVersionId: versionId,
        stepId: 'inoculation',
      }),
    );
    const code = data<{ unit: { publicCode: string } }>(unit).unit.publicCode;

    const refused = await champi(
      'unit:advance',
      code,
      '--json',
      JSON.stringify({ toStepId: 'flush_1', expectedVersion: 0 }),
    );
    const body = refused.stderr as { error: { hint: string } };

    expect(refused.exitCode).toBe(1);
    // L'indice porte la marche à suivre : un agent peut se corriger seul.
    expect(body.error.hint).toContain('confirmOffNominal');
    expect(body.error.hint).toContain('incubation');
  });
});
