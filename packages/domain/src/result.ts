import type { AppError } from '@champi/contracts';

/**
 * Résultat explicite.
 *
 * Le domaine ne lève jamais d'exception pour du contrôle de flux métier
 * (docs/22 §2.4) : un échec attendu est une valeur, pas un `throw`. Cela rend
 * chaque branche d'erreur testable sans `expect().toThrow()`, ce qui compte
 * quand on vise 100 % de couverture avec un score de mutation exigeant.
 */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}
export interface Err {
  readonly ok: false;
  readonly error: AppError;
}
export type Result<T> = Ok<T> | Err;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err(error: AppError): Err {
  return { ok: false, error };
}

export function isOk<T>(result: Result<T>): result is Ok<T> {
  return result.ok;
}

export function isErr<T>(result: Result<T>): result is Err {
  return !result.ok;
}

/** Applique `fn` à la valeur d'un succès, laisse l'échec intact. */
export function mapResult<T, U>(result: Result<T>, fn: (value: T) => U): Result<U> {
  return result.ok ? ok(fn(result.value)) : result;
}

/**
 * Rassemble une liste de résultats.
 *
 * Renvoie le **premier** échec rencontré, ou la liste des valeurs si tout
 * réussit.
 */
export function collectResults<T>(results: readonly Result<T>[]): Result<T[]> {
  const values: T[] = [];
  for (const result of results) {
    if (!result.ok) {
      return result;
    }
    values.push(result.value);
  }
  return ok(values);
}
