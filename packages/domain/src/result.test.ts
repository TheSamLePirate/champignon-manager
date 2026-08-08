import { describe, expect, it } from 'vitest';
import { appError } from '@champi/contracts';
import { collectResults, err, isErr, isOk, mapResult, ok, type Result } from './result.js';

const boom = appError('VALIDATION_FAILED', 'échec');

describe('ok / err', () => {
  it('emballe une valeur de succès', () => {
    expect(ok(42)).toEqual({ ok: true, value: 42 });
  });

  it('emballe une erreur', () => {
    expect(err(boom)).toEqual({ ok: false, error: boom });
  });
});

describe('isOk / isErr', () => {
  it('reconnaît un succès', () => {
    const result: Result<number> = ok(1);
    expect(isOk(result)).toBe(true);
    expect(isErr(result)).toBe(false);
  });

  it('reconnaît un échec', () => {
    const result: Result<number> = err(boom);
    expect(isOk(result)).toBe(false);
    expect(isErr(result)).toBe(true);
  });
});

describe('mapResult', () => {
  it('transforme la valeur d’un succès', () => {
    expect(mapResult(ok(2), (n) => n * 3)).toEqual(ok(6));
  });

  it('laisse un échec intact', () => {
    const failure = err(boom);
    expect(mapResult<number, number>(failure, (n) => n * 3)).toBe(failure);
  });
});

describe('collectResults', () => {
  it('rassemble les valeurs quand tout réussit', () => {
    expect(collectResults([ok(1), ok(2), ok(3)])).toEqual(ok([1, 2, 3]));
  });

  it('renvoie une liste vide pour une entrée vide', () => {
    expect(collectResults([])).toEqual(ok([]));
  });

  it('renvoie le premier échec rencontré', () => {
    const first = err(appError('NOT_FOUND', 'premier'));
    const second = err(appError('CONFLICT', 'second'));
    expect(collectResults<number>([ok(1), first, second])).toBe(first);
  });
});
