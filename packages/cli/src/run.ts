import { API_OPERATIONS, API_RECIPES } from '@champi/api';
import { buildPath, parseArgv, pathParams, type ParsedCommand } from './parse.js';

/**
 * Exécution d'une commande.
 *
 * Le CLI ne contient **aucune logique métier** : il traduit une intention en
 * requête HTTP et rend la réponse telle quelle. Toute règle vit dans le
 * domaine, et le CLI ne peut donc pas diverger de l'API.
 *
 * `fetch` et le générateur de clés sont injectés : l'exécution est testable
 * sans réseau.
 */

export interface CliEnvironment {
  readonly baseUrl: string;
  readonly fetch: typeof globalThis.fetch;
  readonly newIdempotencyKey: () => string;
}

export interface CliResult {
  /** 0 en cas de succès, 1 sinon — un agent peut s'y fier. */
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

function render(value: unknown, pretty: boolean): string {
  return pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
}

/** Aide générale, ou détail d'une commande. */
export function renderHelp(topic: string | undefined, pretty: boolean): CliResult {
  if (topic === undefined) {
    return {
      exitCode: 0,
      stdout: render(
        {
          usage: 'champi <commande> [paramètres] [--options]',
          conventions: {
            output: 'JSON sur la sortie standard. Erreurs en JSON sur la sortie d’erreur.',
            exitCode: '0 en cas de succès, 1 sinon.',
            dryRun: '--dry-run décrit l’effet sans l’appliquer.',
            idempotency:
              '--idempotency-key <clé> rend un rejeu sûr. Une clé est générée si tu n’en fournis pas.',
            body: "--json '<corps>' passe le corps d'une mutation.",
            baseUrl: 'CHAMPI_URL fixe l’adresse du serveur (par défaut http://localhost:3000).',
          },
          commands: API_OPERATIONS.map((operation) => ({
            id: operation.id,
            usage: `champi ${operation.id}${pathParams(operation)
              .map((param) => ` <${param}>`)
              .join('')}`,
            purpose: operation.purpose,
            dryRun: operation.supportsDryRun === true,
          })),
          recipes: API_RECIPES,
        },
        pretty,
      ),
      stderr: '',
    };
  }

  const operation = API_OPERATIONS.find((candidate) => candidate.id === topic);
  if (operation === undefined) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: render(
        {
          error: {
            code: 'NOT_FOUND',
            message: `Aucune commande « ${topic} ».`,
            hint: '« champi help » liste toutes les commandes.',
          },
        },
        pretty,
      ),
    };
  }

  return {
    exitCode: 0,
    stdout: render(
      {
        id: operation.id,
        usage: `champi ${operation.id}${pathParams(operation)
          .map((param) => ` <${param}>`)
          .join('')}`,
        purpose: operation.purpose,
        method: operation.method,
        path: operation.path,
        supportsDryRun: operation.supportsDryRun === true,
        supportsIdempotency: operation.supportsIdempotency === true,
      },
      pretty,
    ),
    stderr: '',
  };
}

/** Exécute une commande déjà analysée. */
export async function runCommand(
  command: ParsedCommand,
  environment: CliEnvironment,
): Promise<CliResult> {
  const query = command.dryRun ? { ...command.query, dryRun: 'true' } : command.query;
  const url = `${environment.baseUrl}${buildPath(command.operation, command.params, query)}`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (command.operation.method === 'POST' && command.operation.supportsIdempotency === true) {
    // Une clé est générée par défaut : un agent qui réessaie est protégé même
    // s'il n'y a pas pensé.
    headers['Idempotency-Key'] = command.idempotencyKey ?? environment.newIdempotencyKey();
  }

  let response: Response;
  try {
    response = await environment.fetch(url, {
      method: command.operation.method,
      headers,
      ...(command.operation.method === 'POST' ? { body: JSON.stringify(command.body ?? {}) } : {}),
    });
  } catch (cause) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: render(
        {
          error: {
            code: 'CONFLICT',
            message: "Le serveur n'a pas répondu.",
            hint: `Vérifie que l'application tourne et que CHAMPI_URL pointe au bon endroit (actuellement ${environment.baseUrl}). Cause : ${cause instanceof Error ? cause.message : 'inconnue'}`,
          },
        },
        command.pretty,
      ),
    };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return {
      exitCode: 1,
      stdout: '',
      stderr: render(
        {
          error: {
            code: 'VALIDATION_FAILED',
            message: `Réponse illisible du serveur (statut ${String(response.status)}).`,
            hint: "Ce n'est pas un refus métier : signale-le si cela se reproduit.",
          },
        },
        command.pretty,
      ),
    };
  }

  // La réponse est rendue **telle quelle** : le CLI n'interprète rien, un agent
  // lit exactement ce que l'API a dit.
  return response.ok
    ? { exitCode: 0, stdout: render(payload, command.pretty), stderr: '' }
    : { exitCode: 1, stdout: '', stderr: render(payload, command.pretty) };
}

/** Point d'entrée logique : analyse puis exécute. */
export async function runCli(
  argv: readonly string[],
  environment: CliEnvironment,
): Promise<CliResult> {
  const outcome = parseArgv(argv);

  if (outcome.kind === 'help') {
    return renderHelp(outcome.topic, argv.includes('--pretty'));
  }
  if (outcome.kind === 'error') {
    return {
      exitCode: 1,
      stdout: '',
      stderr: render(
        { error: { code: 'VALIDATION_FAILED', message: outcome.message, hint: outcome.hint } },
        argv.includes('--pretty'),
      ),
    };
  }
  return runCommand(outcome.command, environment);
}
