import { API_OPERATIONS, type ApiOperation } from '@champi/api';

/**
 * Analyse de la ligne de commande.
 *
 * Le CLI est **la** surface d'agent de l'application (décision du 08/08/2026 :
 * pas de serveur MCP). Il doit donc être aussi lisible pour un LLM que pour un
 * humain :
 *
 * - une commande par opération d'API, nommée à l'identique ;
 * - JSON en entrée et en sortie, sans mise en forme parasite ;
 * - des erreurs qui portent les valeurs valides, comme celles de l'API.
 *
 * Ce module est **pur** : il ne fait aucune I/O, il traduit `argv` en intention.
 */

export interface ParsedCommand {
  readonly operation: ApiOperation;
  /** Segments de chemin fournis, dans l'ordre des `:paramètres`. */
  readonly params: readonly string[];
  /** Corps JSON, pour les opérations POST. */
  readonly body: unknown;
  /** Paramètres de requête (`--stage substrate` → `?stage=substrate`). */
  readonly query: Readonly<Record<string, string>>;
  readonly dryRun: boolean;
  readonly idempotencyKey: string | undefined;
  readonly pretty: boolean;
}

export type ParseOutcome =
  | { readonly kind: 'command'; readonly command: ParsedCommand }
  | { readonly kind: 'help'; readonly topic: string | undefined }
  | { readonly kind: 'error'; readonly message: string; readonly hint: string };

/** Noms des paramètres de chemin d'une opération, dans l'ordre. */
export function pathParams(operation: ApiOperation): string[] {
  return operation.path
    .split('/')
    .filter((segment) => segment.startsWith(':'))
    .map((segment) => segment.slice(1));
}

/** Construit le chemin final en substituant les paramètres. */
export function buildPath(
  operation: ApiOperation,
  params: readonly string[],
  query: Readonly<Record<string, string>>,
): string {
  let index = 0;
  const path = operation.path
    .split('/')
    .map((segment) => {
      if (!segment.startsWith(':')) {
        return segment;
      }
      const value = params[index] ?? '';
      index += 1;
      return encodeURIComponent(value);
    })
    .join('/');

  const search = new URLSearchParams(query).toString();
  return search === '' ? path : `${path}?${search}`;
}

function findOperation(id: string): ApiOperation | undefined {
  return API_OPERATIONS.find((operation) => operation.id === id);
}

/** Suggestions proches d'un identifiant inconnu — préfixe commun. */
export function suggestOperations(unknown: string): string[] {
  // `indexOf` plutôt que `split()[0] ?? ''` : cette dernière forme portait un
  // repli que rien ne pouvait atteindre.
  const separator = unknown.indexOf(':');
  const prefix = separator === -1 ? unknown : unknown.slice(0, separator);
  const byPrefix = API_OPERATIONS.filter((operation) => operation.id.startsWith(prefix)).map(
    (operation) => operation.id,
  );
  return byPrefix.length > 0 ? byPrefix : API_OPERATIONS.map((operation) => operation.id);
}

/**
 * Traduit `argv` en intention.
 *
 * Forme générale : `champi <opération> [params…] [--clé valeur] [--json '…']`
 */
export function parseArgv(argv: readonly string[]): ParseOutcome {
  const [first, ...rest] = argv;

  if (first === undefined || first === 'help' || first === '--help' || first === '-h') {
    return { kind: 'help', topic: rest[0] };
  }

  const operation = findOperation(first);
  if (operation === undefined) {
    return {
      kind: 'error',
      message: `Commande inconnue : « ${first} ».`,
      hint: `Commandes proches : ${suggestOperations(first).join(', ')}. « champi help » les liste toutes.`,
    };
  }

  const params: string[] = [];
  const query: Record<string, string> = {};
  let body: unknown;
  let dryRun = false;
  let idempotencyKey: string | undefined;
  let pretty = false;

  // `entries()` rend le jeton **total** : pas de valeur de repli à inventer
  // pour un index qui ne peut pas sortir des bornes.
  let skipNext = false;
  for (const [index, token] of rest.entries()) {
    if (skipNext) {
      skipNext = false;
      continue;
    }

    if (!token.startsWith('--')) {
      params.push(token);
      continue;
    }

    const flag = token.slice(2);

    if (flag === 'dry-run') {
      dryRun = true;
      continue;
    }
    if (flag === 'pretty') {
      pretty = true;
      continue;
    }

    // Ici, en revanche, l'absence est réelle : l'option peut clore la ligne.
    const value = rest[index + 1];
    if (value === undefined || value.startsWith('--')) {
      return {
        kind: 'error',
        message: `L'option « --${flag} » attend une valeur.`,
        hint: `Exemple : champi ${operation.id} --${flag} <valeur>.`,
      };
    }
    skipNext = true;

    if (flag === 'json') {
      try {
        body = JSON.parse(value);
      } catch {
        return {
          kind: 'error',
          message: "L'option « --json » n'a pas reçu un JSON valide.",
          hint: 'Passe le corps entre apostrophes simples : --json \'{"toStepId":"incubation"}\'.',
        };
      }
      continue;
    }
    if (flag === 'idempotency-key') {
      idempotencyKey = value;
      continue;
    }

    query[flag] = value;
  }

  const expected = pathParams(operation);
  if (params.length !== expected.length) {
    return {
      kind: 'error',
      message: `« ${operation.id} » attend ${String(expected.length)} paramètre(s), ${String(params.length)} fourni(s).`,
      hint:
        expected.length === 0
          ? `Usage : champi ${operation.id}`
          : `Usage : champi ${operation.id} <${expected.join('> <')}>`,
    };
  }

  if (dryRun && operation.supportsDryRun !== true) {
    return {
      kind: 'error',
      message: `« ${operation.id} » n'accepte pas --dry-run.`,
      hint: `Les commandes qui l'acceptent : ${API_OPERATIONS.filter(
        (o) => o.supportsDryRun === true,
      )
        .map((o) => o.id)
        .join(', ')}.`,
    };
  }

  return {
    kind: 'command',
    command: { operation, params, body, query, dryRun, idempotencyKey, pretty },
  };
}
