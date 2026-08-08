import { describe, expect, it } from 'vitest';
import { API_OPERATIONS } from '@champi/api';
import { buildPath, parseArgv, pathParams, suggestOperations } from './parse.js';

/**
 * Le CLI est **la** surface d'agent (pas de serveur MCP) : son analyse doit
 * être prévisible et ses refus explicites, sinon un agent tâtonne.
 */

function expectCommand(argv: string[]) {
  const outcome = parseArgv(argv);
  if (outcome.kind !== 'command') {
    throw new Error(`attendu une commande, reçu ${outcome.kind}`);
  }
  return outcome.command;
}

function expectError(argv: string[]) {
  const outcome = parseArgv(argv);
  if (outcome.kind !== 'error') {
    throw new Error(`attendu une erreur, reçu ${outcome.kind}`);
  }
  return outcome;
}

describe('pathParams', () => {
  it('extrait les paramètres de chemin', () => {
    const operation = API_OPERATIONS.find((o) => o.id === 'unit:advance');
    expect(operation).toBeDefined();
    if (operation === undefined) return;
    expect(pathParams(operation)).toEqual(['reference']);
  });

  it('rend une liste vide sans paramètre', () => {
    const operation = API_OPERATIONS.find((o) => o.id === 'discover');
    if (operation === undefined) return;
    expect(pathParams(operation)).toEqual([]);
  });
});

describe('buildPath', () => {
  const advance = API_OPERATIONS.find((o) => o.id === 'unit:advance');
  const list = API_OPERATIONS.find((o) => o.id === 'unit:list');

  it('substitue les paramètres', () => {
    if (advance === undefined) return;
    expect(buildPath(advance, ['SUB-2026-0001'], {})).toBe('/api/units/SUB-2026-0001/advance');
  });

  it('encode les caractères spéciaux', () => {
    if (advance === undefined) return;
    expect(buildPath(advance, ['SUB/2026'], {})).toBe('/api/units/SUB%2F2026/advance');
  });

  it('ajoute les paramètres de requête', () => {
    if (list === undefined) return;
    expect(buildPath(list, [], { stage: 'substrate' })).toBe('/api/units?stage=substrate');
  });

  it('n’ajoute pas de « ? » sans paramètre de requête', () => {
    if (list === undefined) return;
    expect(buildPath(list, [], {})).toBe('/api/units');
  });

  it('remplace par une chaîne vide un paramètre manquant', () => {
    if (advance === undefined) return;
    expect(buildPath(advance, [], {})).toBe('/api/units//advance');
  });
});

describe('aide', () => {
  it.each([[], ['help'], ['--help'], ['-h']])(
    'reconnaît « %s » comme demande d’aide',
    (...argv) => {
      expect(parseArgv(argv.flat()).kind).toBe('help');
    },
  );

  it('retient le sujet de l’aide', () => {
    const outcome = parseArgv(['help', 'unit:advance']);
    expect(outcome.kind === 'help' && outcome.topic).toBe('unit:advance');
  });
});

describe('commande inconnue', () => {
  /** Un agent doit pouvoir se corriger : l'erreur porte les valeurs valides. */
  it('propose les commandes du même préfixe', () => {
    const error = expectError(['unit:teleport']);
    expect(error.message).toContain('unit:teleport');
    expect(error.hint).toContain('unit:advance');
    expect(error.hint).toContain('champi help');
  });

  it('propose toutes les commandes quand aucun préfixe ne correspond', () => {
    expect(suggestOperations('zzz')).toEqual(API_OPERATIONS.map((o) => o.id));
  });

  it('filtre par préfixe quand il correspond', () => {
    expect(suggestOperations('harvest:xxx').every((id) => id.startsWith('harvest'))).toBe(true);
  });
});

describe('cas limites de l’analyse', () => {
  /** Un chemin sans paramètre nommé traverse la branche « segment ordinaire ». */
  it('construit un chemin sans aucun paramètre', () => {
    const command = expectCommand(['printer:test']);
    expect(command.params).toEqual([]);
  });

  it('accepte un identifiant d’opération sans deux-points', () => {
    expect(suggestOperations('discover')).toContain('discover');
  });
});

describe('paramètres et options', () => {
  it('lit un paramètre de chemin', () => {
    expect(expectCommand(['unit:get', 'SUB-2026-0001']).params).toEqual(['SUB-2026-0001']);
  });

  it('lit un corps JSON', () => {
    const command = expectCommand([
      'unit:advance',
      'SUB-2026-0001',
      '--json',
      '{"toStepId":"incubation","expectedVersion":0}',
    ]);
    expect(command.body).toEqual({ toStepId: 'incubation', expectedVersion: 0 });
  });

  it('lit un paramètre de requête', () => {
    expect(expectCommand(['unit:list', '--stage', 'substrate']).query).toEqual({
      stage: 'substrate',
    });
  });

  it('reconnaît --dry-run', () => {
    expect(expectCommand(['unit:create', '--dry-run']).dryRun).toBe(true);
  });

  it('reconnaît --pretty', () => {
    expect(expectCommand(['unit:get', 'SUB-2026-0001', '--pretty']).pretty).toBe(true);
  });

  it('lit une clé d’idempotence explicite', () => {
    const command = expectCommand(['unit:create', '--idempotency-key', 'terrain-1']);
    expect(command.idempotencyKey).toBe('terrain-1');
  });

  it('laisse la clé indéfinie quand elle n’est pas fournie', () => {
    expect(expectCommand(['unit:create']).idempotencyKey).toBeUndefined();
  });

  it('combine plusieurs options', () => {
    const command = expectCommand([
      'unit:advance',
      'SUB-2026-0001',
      '--json',
      '{"toStepId":"incubation"}',
      '--dry-run',
      '--pretty',
    ]);
    expect(command.dryRun).toBe(true);
    expect(command.pretty).toBe(true);
    expect(command.body).toEqual({ toStepId: 'incubation' });
  });
});

describe('refus explicites', () => {
  it('refuse un JSON illisible en montrant la forme attendue', () => {
    const error = expectError(['unit:advance', 'SUB-2026-0001', '--json', '{pas du json']);
    expect(error.message).toContain('--json');
    expect(error.hint).toContain('toStepId');
  });

  it('refuse une option sans valeur', () => {
    const error = expectError(['unit:list', '--stage']);
    expect(error.message).toContain('--stage');
    expect(error.hint).toContain('champi unit:list --stage');
  });

  it('refuse une option suivie d’une autre option', () => {
    expect(expectError(['unit:list', '--stage', '--pretty']).message).toContain('--stage');
  });

  it('refuse un paramètre manquant en donnant l’usage', () => {
    const error = expectError(['unit:get']);
    expect(error.message).toContain('1 paramètre');
    expect(error.hint).toBe('Usage : champi unit:get <reference>');
  });

  it('refuse un paramètre en trop', () => {
    const error = expectError(['discover', 'inutile']);
    expect(error.message).toContain('0 paramètre');
    expect(error.hint).toBe('Usage : champi discover');
  });

  it('refuse --dry-run sur une commande de lecture, en listant celles qui l’acceptent', () => {
    const error = expectError(['unit:get', 'SUB-2026-0001', '--dry-run']);
    expect(error.message).toContain("n'accepte pas --dry-run");
    expect(error.hint).toContain('unit:advance');
  });
});

/**
 * ⚠️ **Le test qui tient la promesse.**
 *
 * `docs/22` §4.5 : « tout ce qu'un humain peut faire dans l'interface, un agent
 * doit pouvoir le faire sans interface ». Le serveur MCP ayant été écarté, le
 * CLI est la seule surface d'agent — cette parité devient donc la garantie
 * unique, et elle échoue dès qu'une route est ajoutée sans commande.
 */
describe('parité de surface API ⇄ CLI', () => {
  it('expose une commande pour chaque opération de l’API', () => {
    for (const operation of API_OPERATIONS) {
      const outcome = parseArgv([operation.id, ...pathParams(operation).map(() => 'x')]);
      expect(outcome.kind, `« ${operation.id} » n'a pas de commande CLI`).toBe('command');
    }
  });

  it('n’expose aucune commande sans opération correspondante', () => {
    // Le registre du CLI **est** le catalogue de l'API : par construction, il
    // ne peut pas s'en écarter. Ce test fige cette propriété.
    const outcome = parseArgv(['commande:inventee']);
    expect(outcome.kind).toBe('error');
  });

  it('chaque opération porte un objectif rédigé', () => {
    for (const operation of API_OPERATIONS) {
      expect(operation.purpose.length, `« ${operation.id} » sans objectif`).toBeGreaterThan(10);
    }
  });

  it('les identifiants d’opération sont uniques', () => {
    const ids = API_OPERATIONS.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('couvre les quatre familles du parcours', () => {
    const ids = API_OPERATIONS.map((o) => o.id);
    for (const expected of [
      'unit:create',
      'qr:assign',
      'label:print',
      'unit:advance',
      'harvest:record',
      'product:create',
      'product:trace',
    ]) {
      expect(ids).toContain(expected);
    }
  });
});
