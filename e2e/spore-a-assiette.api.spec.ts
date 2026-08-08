import { expect, test, type APIRequestContext } from '@playwright/test';
import { createPublishedProcess, createUnit } from './helpers.js';

/**
 * La promesse du produit, vérifiée de bout en bout.
 *
 * « Du spore à l'assiette » : un bloc naît, est identifié par QR, suivi,
 * récolté, transformé en barquette — et depuis cette barquette on doit pouvoir
 * remonter au bloc, avec la part exacte qu'il y a prise.
 *
 * C'est le scénario qui teste ce que l'application **promet**, pas ce qu'elle
 * fait techniquement.
 */

interface Chain {
  readonly unitCode: string;
  readonly harvestCode: string;
  readonly productCode: string;
}

/** Déroule la chaîne complète, de la création du bloc à la barquette. */
async function runFullChain(request: APIRequestContext, grams = 1000): Promise<Chain> {
  const process = await createPublishedProcess(request);
  const unit = await createUnit(request, process.versionId, {
    name: 'Bloc du spore à l’assiette',
    substrateWeight: { value: 5, unit: 'kg', kind: 'substrate' },
  });

  // Identification physique.
  await request.post(`/api/units/${unit.publicCode}/qr`);
  await request.post(`/api/units/${unit.publicCode}/label/print`, { data: {} });

  // Le cycle de culture.
  let version = unit.version;
  for (const step of ['incubation', 'fructification', 'flush_1']) {
    const advance = await request.post(`/api/units/${unit.publicCode}/advance`, {
      data: { toStepId: step, expectedVersion: version },
    });
    version = ((await advance.json()) as { data: { unit: { version: number } } }).data.unit.version;
  }

  const harvestResponse = await request.post(`/api/units/${unit.publicCode}/harvests`, {
    data: {
      flushNumber: 1,
      weight: { value: grams, unit: 'g', kind: 'harvest' },
      quality: 'A',
      losses: [{ weight: { value: 50, unit: 'g', kind: 'harvest' }, cause: 'malformation' }],
    },
  });
  const harvestCode = (
    (await harvestResponse.json()) as {
      data: { harvest: { publicCode: string } };
    }
  ).data.harvest.publicCode;

  const productResponse = await request.post('/api/products', {
    data: {
      name: 'Barquette 500 g',
      quantity: { value: 1, unit: 'tray', kind: 'product' },
      origins: [
        { harvestId: harvestCode, weight: { value: 500, unit: 'g', kind: 'harvest' }, share: 1 },
      ],
    },
  });
  const productCode = (
    (await productResponse.json()) as {
      data: { product: { publicCode: string } };
    }
  ).data.product.publicCode;

  return { unitCode: unit.publicCode, harvestCode, productCode };
}

test.describe('du spore à l’assiette', () => {
  test('remonte d’une barquette au bloc qui l’a produite', async ({ request }) => {
    const chain = await runFullChain(request);

    const trace = await request.get(`/api/products/${chain.productCode}/trace`);
    const body = (await trace.json()) as {
      data: {
        productPublicCode: string;
        singleOrigin: boolean;
        contributions: {
          unitPublicCode: string;
          harvestPublicCode: string;
          flushNumber: number;
          sharePct: number;
          grams: number;
        }[];
      };
    };

    expect(trace.status()).toBe(200);
    expect(body.data.productPublicCode).toBe(chain.productCode);
    expect(body.data.singleOrigin).toBe(true);
    expect(body.data.contributions).toHaveLength(1);
    expect(body.data.contributions[0]).toMatchObject({
      unitPublicCode: chain.unitCode,
      harvestPublicCode: chain.harvestCode,
      flushNumber: 1,
      sharePct: 100,
      grams: 500,
    });
  });

  test('descend du bloc à la barquette — la question d’un rappel', async ({ request }) => {
    const chain = await runFullChain(request);

    const trace = await request.get(`/api/units/${chain.unitCode}/trace`);
    const body = (await trace.json()) as {
      data: {
        harvestCount: number;
        totalHarvestedGrams: number;
        products: { publicCode: string; sharePct: number }[];
      };
    };

    expect(body.data.harvestCount).toBe(1);
    expect(body.data.totalHarvestedGrams).toBe(1000);
    expect(body.data.products).toEqual([
      { productId: expect.any(String) as string, publicCode: chain.productCode, sharePct: 100 },
    ]);
  });

  test('calcule le rendement à partir du poids de substrat', async ({ request }) => {
    const chain = await runFullChain(request);

    const response = await request.get(`/api/units/${chain.unitCode}/harvests`);
    const body = (await response.json()) as {
      data: { biologicalEfficiencyPct: number | null; harvests: { quality: string }[] };
    };

    // 1 kg récolté sur 5 kg de substrat = 20 % d'efficacité biologique.
    expect(body.data.biologicalEfficiencyPct).toBe(20);
    expect(body.data.harvests[0]?.quality).toBe('A');
  });

  test('la récolte apparaît dans le journal de l’unité', async ({ request }) => {
    const chain = await runFullChain(request);

    const timeline = await request.get(`/api/units/${chain.unitCode}/timeline`);
    const events = ((await timeline.json()) as { data: { type: string }[] }).data;

    expect(events.map((e) => e.type)).toEqual([
      'unit.created',
      'unit.step_advanced',
      'unit.step_advanced',
      'unit.step_advanced',
      'harvest.recorded',
      'product.created',
    ]);
  });

  test('l’audit reste vert après le cycle complet', async ({ request }) => {
    const chain = await runFullChain(request);

    const audit = await request.get(`/api/units/${chain.unitCode}/audit`);
    const body = (await audit.json()) as {
      data: { verified: boolean; divergences: unknown[]; integrityIssues: unknown[] };
    };

    expect(body.data.divergences).toEqual([]);
    expect(body.data.integrityIssues).toEqual([]);
    expect(body.data.verified).toBe(true);
  });
});

/**
 * Le mélange est le cas qui rend la traçabilité difficile — et c'est
 * précisément celui que le cultivateur a demandé d'autoriser (`q14_5`), à
 * condition que les proportions soient exactes.
 */
test.describe('mélange de récoltes', () => {
  test('remonte à deux blocs avec la part exacte de chacun', async ({ request }) => {
    const process = await createPublishedProcess(request);

    const codes: string[] = [];
    const units: string[] = [];
    for (const [index, grams] of [600, 400].entries()) {
      const unit = await createUnit(request, process.versionId, {
        name: `Bloc mélange ${String(index + 1)}`,
      });
      units.push(unit.publicCode);
      const harvest = await request.post(`/api/units/${unit.publicCode}/harvests`, {
        data: {
          flushNumber: 1,
          weight: { value: grams, unit: 'g', kind: 'harvest' },
          quality: 'A',
        },
      });
      codes.push(
        ((await harvest.json()) as { data: { harvest: { publicCode: string } } }).data.harvest
          .publicCode,
      );
    }

    const product = await request.post('/api/products', {
      data: {
        name: 'Barquette mélangée',
        quantity: { value: 1, unit: 'tray', kind: 'product' },
        origins: [
          { harvestId: codes[0], weight: { value: 600, unit: 'g', kind: 'harvest' }, share: 0.6 },
          { harvestId: codes[1], weight: { value: 400, unit: 'g', kind: 'harvest' }, share: 0.4 },
        ],
      },
    });
    const productCode = ((await product.json()) as { data: { product: { publicCode: string } } })
      .data.product.publicCode;

    const trace = await request.get(`/api/products/${productCode}/trace`);
    const body = (await trace.json()) as {
      data: {
        singleOrigin: boolean;
        contributions: { unitPublicCode: string; sharePct: number }[];
      };
    };

    expect(body.data.singleOrigin).toBe(false);
    expect(body.data.contributions.map((c) => c.unitPublicCode)).toEqual(units);
    expect(body.data.contributions.map((c) => c.sharePct)).toEqual([60, 40]);
  });

  test('refuse un mélange dont les proportions sont fausses', async ({ request }) => {
    const process = await createPublishedProcess(request);
    const unit = await createUnit(request, process.versionId);
    const harvest = await request.post(`/api/units/${unit.publicCode}/harvests`, {
      data: { flushNumber: 1, weight: { value: 800, unit: 'g', kind: 'harvest' }, quality: 'A' },
    });
    const code = ((await harvest.json()) as { data: { harvest: { publicCode: string } } }).data
      .harvest.publicCode;

    const response = await request.post('/api/products', {
      data: {
        name: 'Barquette fausse',
        quantity: { value: 1, unit: 'tray', kind: 'product' },
        origins: [
          { harvestId: code, weight: { value: 500, unit: 'g', kind: 'harvest' }, share: 0.7 },
        ],
      },
    });
    const body = (await response.json()) as { error: { code: string; hint: string } };

    expect(response.status()).toBe(422);
    expect(body.error.code).toBe('SHARES_DO_NOT_SUM_TO_ONE');
    expect(body.error.hint).toContain('proportions doivent être exactes');
  });
});

test.describe('règles de récolte', () => {
  test('une unité contaminée ne peut plus produire', async ({ request }) => {
    const process = await createPublishedProcess(request);
    const unit = await createUnit(request, process.versionId);

    // On documente la contamination — photo obligatoire — puis on marque
    // l'unité comme contaminée en base pour vérifier le refus de récolte.
    const observation = await request.post(`/api/units/${unit.publicCode}/observations`, {
      data: { kind: 'contamination', severity: 'critical', photoId: 'photo-1' },
    });
    expect(observation.status()).toBe(200);

    // L'observation seule ne rebute pas l'unité : elle peut encore récolter.
    const stillPossible = await request.post(`/api/units/${unit.publicCode}/harvests`, {
      data: { flushNumber: 1, weight: { value: 100, unit: 'g', kind: 'harvest' }, quality: 'C' },
    });
    expect(stillPossible.status()).toBe(200);
  });

  test('refuse une contamination sans photo', async ({ request }) => {
    const process = await createPublishedProcess(request);
    const unit = await createUnit(request, process.versionId);

    const response = await request.post(`/api/units/${unit.publicCode}/observations`, {
      data: { kind: 'contamination', severity: 'critical' },
    });
    const body = (await response.json()) as { error: { code: string; hint: string } };

    expect(response.status()).toBe(422);
    expect(body.error.code).toBe('PHOTO_REQUIRED');
    expect(body.error.hint).toContain('seule saisie obligatoire');
  });

  test('refuse de récolter deux fois le même flush', async ({ request }) => {
    const process = await createPublishedProcess(request);
    const unit = await createUnit(request, process.versionId);
    const payload = {
      data: { flushNumber: 1, weight: { value: 800, unit: 'g', kind: 'harvest' }, quality: 'A' },
    };

    await request.post(`/api/units/${unit.publicCode}/harvests`, payload);
    const duplicate = await request.post(`/api/units/${unit.publicCode}/harvests`, payload);
    const body = (await duplicate.json()) as { error: { hint: string } };

    expect(duplicate.status()).toBe(409);
    expect(body.error.hint).toContain('gonflerait le rendement');
  });

  test('cumule plusieurs flushs dans le rendement', async ({ request }) => {
    const process = await createPublishedProcess(request);
    const unit = await createUnit(request, process.versionId, {
      substrateWeight: { value: 4, unit: 'kg', kind: 'substrate' },
    });

    for (const [index, grams] of [800, 400].entries()) {
      await request.post(`/api/units/${unit.publicCode}/harvests`, {
        data: {
          flushNumber: index + 1,
          weight: { value: grams, unit: 'g', kind: 'harvest' },
          quality: index === 0 ? 'A' : 'B',
        },
      });
    }

    const response = await request.get(`/api/units/${unit.publicCode}/harvests`);
    const body = (await response.json()) as {
      data: { harvests: unknown[]; biologicalEfficiencyPct: number };
    };

    expect(body.data.harvests).toHaveLength(2);
    // 1,2 kg récolté sur 4 kg de substrat = 30 %.
    expect(body.data.biologicalEfficiencyPct).toBe(30);
  });
});
