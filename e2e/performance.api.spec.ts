import { expect, test, type APIRequestContext } from '@playwright/test';
import { createPublishedProcess, createUnit } from './helpers.js';

/**
 * Budgets de performance.
 *
 * ⚠️ **Le point D11 de `claude-critics.md`** : les cibles de `docs/12` §2 —
 * « fiche unité en moins de deux secondes » — n'avaient jamais été reliées au
 * matériel le plus faible. Mesurées sur un Mac, elles ne prouvent rien de la
 * production, qui tourne sur **Raspberry Pi**.
 *
 * Ces tests mesurent réellement, et **échouent** au dépassement. Le budget est
 * réglable par `CHAMPI_PERF_FACTOR` : lancer la suite sur le Pi avec un
 * facteur adapté transforme une intention en vérification.
 *
 * Tant que la suite n'a pas tourné sur un Pi, ces chiffres disent seulement
 * que le code n'est pas absurdement lent — pas que la cible terrain est tenue.
 */

/** Facteur d'échelle du budget. 1 = machine de développement. */
const FACTOR = Number(process.env['CHAMPI_PERF_FACTOR'] ?? '1');

/** Budgets en millisecondes, avant application du facteur (`docs/12` §2). */
const BUDGET = {
  /** Le geste le plus fréquent : scanner puis lire la fiche. */
  unitSheet: 400,
  /** Le journal peut être long : on garde de la marge. */
  timeline: 600,
  /** Une mutation écrit dans une transaction : elle coûte plus cher. */
  advance: 800,
  /** L'audit rejoue tout le journal. */
  audit: 800,
  /** La découverte agrège l'état : c'est la première requête d'un agent. */
  discover: 400,
} as const;

function budget(key: keyof typeof BUDGET): number {
  return BUDGET[key] * FACTOR;
}

/** Mesure une opération, plusieurs fois, et rend la médiane. */
async function median(runs: number, operation: () => Promise<unknown>): Promise<number> {
  const timings: number[] = [];
  for (let index = 0; index < runs; index += 1) {
    const start = performance.now();
    await operation();
    timings.push(performance.now() - start);
  }
  timings.sort((a, b) => a - b);
  // La médiane plutôt que la moyenne : une pause du ramasse-miettes ne doit
  // pas faire échouer un budget qui est par ailleurs tenu.
  return timings[Math.floor(timings.length / 2)] ?? 0;
}

/** Prépare une unité avec un historique réaliste. */
async function unitWithHistory(request: APIRequestContext): Promise<string> {
  const process = await createPublishedProcess(request);
  const unit = await createUnit(request, process.versionId);

  let version = unit.version;
  for (const step of ['incubation', 'fructification', 'flush_1']) {
    const advance = await request.post(`/api/units/${unit.publicCode}/advance`, {
      data: { toStepId: step, expectedVersion: version },
    });
    version = ((await advance.json()) as { data: { unit: { version: number } } }).data.unit.version;
  }
  for (let index = 0; index < 5; index += 1) {
    await request.post(`/api/units/${unit.publicCode}/measurements`, {
      data: { metric: 'temperature_c', numericValue: 20 + index },
    });
  }
  return unit.publicCode;
}

test.describe('budgets de lecture', () => {
  test('la fiche d’unité tient le budget', async ({ request }) => {
    const code = await unitWithHistory(request);
    const elapsed = await median(7, () => request.get(`/api/units/${code}`));

    // eslint-disable-next-line no-console -- la mesure n'a de valeur que si elle est lisible dans le rapport.
    console.log(
      `fiche unité : ${elapsed.toFixed(1)} ms (budget ${String(budget('unitSheet'))} ms)`,
    );
    expect(elapsed).toBeLessThan(budget('unitSheet'));
  });

  test('le journal tient le budget malgré son historique', async ({ request }) => {
    const code = await unitWithHistory(request);
    const elapsed = await median(7, () => request.get(`/api/units/${code}/timeline`));

    // eslint-disable-next-line no-console -- idem.
    console.log(`journal : ${elapsed.toFixed(1)} ms (budget ${String(budget('timeline'))} ms)`);
    expect(elapsed).toBeLessThan(budget('timeline'));
  });

  /** L'audit rejoue l'intégralité du journal : c'est la lecture la plus lourde. */
  test('l’audit tient le budget', async ({ request }) => {
    const code = await unitWithHistory(request);
    const elapsed = await median(5, () => request.get(`/api/units/${code}/audit`));

    // eslint-disable-next-line no-console -- idem.
    console.log(`audit : ${elapsed.toFixed(1)} ms (budget ${String(budget('audit'))} ms)`);
    expect(elapsed).toBeLessThan(budget('audit'));
  });

  test('la découverte tient le budget — c’est la première requête d’un agent', async ({
    request,
  }) => {
    const elapsed = await median(7, () => request.get('/api/_discover'));

    // eslint-disable-next-line no-console -- idem.
    console.log(`découverte : ${elapsed.toFixed(1)} ms (budget ${String(budget('discover'))} ms)`);
    expect(elapsed).toBeLessThan(budget('discover'));
  });
});

test.describe('budgets d’écriture', () => {
  test('un avancement d’étape tient le budget', async ({ request }) => {
    const process = await createPublishedProcess(request);

    // Chaque mesure porte sur une unité neuve : mesurer le même avancement
    // plusieurs fois serait mesurer des conflits de verrou, pas une écriture.
    const timings: number[] = [];
    for (let index = 0; index < 5; index += 1) {
      const unit = await createUnit(request, process.versionId);
      const start = performance.now();
      await request.post(`/api/units/${unit.publicCode}/advance`, {
        data: { toStepId: 'incubation', expectedVersion: 0 },
      });
      timings.push(performance.now() - start);
    }
    timings.sort((a, b) => a - b);
    const elapsed = timings[Math.floor(timings.length / 2)] ?? 0;

    // eslint-disable-next-line no-console -- idem.
    console.log(`avancement : ${elapsed.toFixed(1)} ms (budget ${String(budget('advance'))} ms)`);
    expect(elapsed).toBeLessThan(budget('advance'));
  });
});

test.describe('tenue à la charge', () => {
  /**
   * Une ferme accumule des unités. La liste par stade est l'écran de départ :
   * elle ne doit pas s'écrouler quand le nombre monte.
   */
  test('la liste par stade reste rapide avec cinquante unités', async ({ request }) => {
    const process = await createPublishedProcess(request);
    for (let index = 0; index < 50; index += 1) {
      await createUnit(request, process.versionId, { name: `Bloc charge ${String(index)}` });
    }

    const elapsed = await median(5, () => request.get('/api/units?stage=substrate'));
    // eslint-disable-next-line no-console -- idem.
    console.log(`liste (50+ unités) : ${elapsed.toFixed(1)} ms`);
    expect(elapsed).toBeLessThan(budget('unitSheet') * 3);
  });
});
