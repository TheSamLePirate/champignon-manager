import type { APIRequestContext } from '@playwright/test';

/**
 * Aides partagées par les scénarios end-to-end.
 *
 * Elles parlent à l'API **exactement comme un client externe** : aucune
 * importation du code applicatif, aucun raccourci vers la base. Si un scénario
 * passe, c'est que le contrat public tient.
 */

export interface CreatedProcess {
  readonly templateId: string;
  readonly versionId: string;
}

export interface CreatedUnit {
  readonly id: string;
  readonly publicCode: string;
  readonly version: number;
}

/** Le process réel du cultivateur : six étapes, pas treize (docs/20 §3). */
export function sixStepGraph(): unknown {
  return {
    steps: [
      { id: 'inoculation', name: 'Inoculation substrat', stage: 'substrate' },
      {
        id: 'incubation',
        name: 'Incubation',
        stage: 'substrate',
        targetDurationDays: 21,
        conditions: { temperatureC: { min: 24, max: 24 }, light: 'darkness' },
        alarms: { enabled: true, reminderDaysBefore: 1, criticalOverduePct: 50 },
      },
      {
        id: 'fructification',
        name: 'Fructification',
        stage: 'fruiting',
        targetDurationDays: 6,
        conditions: { temperatureC: { min: 18, max: 24 }, humidityPct: { min: 90, max: 90 } },
      },
      { id: 'flush_1', name: 'Flush 1', stage: 'fruiting', targetDurationDays: 2 },
      { id: 'flush_2', name: 'Flush 2', stage: 'fruiting', targetDurationDays: 2 },
      { id: 'flush_3', name: 'Flush 3', stage: 'fruiting', optional: true },
      { id: 'fin_de_cycle', name: 'Fin de cycle', stage: 'fruiting' },
    ],
    transitions: [
      { from: 'inoculation', to: 'incubation' },
      { from: 'incubation', to: 'fructification' },
      { from: 'fructification', to: 'flush_1' },
      { from: 'flush_1', to: 'flush_2' },
      { from: 'flush_2', to: 'flush_3' },
      { from: 'flush_2', to: 'fin_de_cycle' },
      { from: 'flush_3', to: 'fin_de_cycle' },
    ],
  };
}

let counter = 0;

/** Nom unique : les scénarios partagent une base, les noms de process sont uniques. */
export function uniqueName(prefix: string): string {
  counter += 1;
  return `${prefix} ${String(Date.now())}-${String(counter)}`;
}

export async function createPublishedProcess(
  request: APIRequestContext,
  graph: unknown = sixStepGraph(),
): Promise<CreatedProcess> {
  const created = await request.post('/api/process-templates', {
    data: { name: uniqueName('Process E2E'), graph },
  });
  if (!created.ok()) {
    throw new Error(`création du process échouée : ${await created.text()}`);
  }
  const body = (await created.json()) as {
    data: { template: { id: string }; version: { id: string } };
  };

  const published = await request.post(`/api/process-versions/${body.data.version.id}/publish`);
  if (!published.ok()) {
    throw new Error(`publication échouée : ${await published.text()}`);
  }

  return { templateId: body.data.template.id, versionId: body.data.version.id };
}

export async function createUnit(
  request: APIRequestContext,
  versionId: string,
  overrides: Record<string, unknown> = {},
): Promise<CreatedUnit> {
  const response = await request.post('/api/units', {
    data: {
      name: 'Bloc pleurote E2E',
      stage: 'substrate',
      processVersionId: versionId,
      stepId: 'inoculation',
      substrateWeight: { value: 5, unit: 'kg', kind: 'substrate' },
      ...overrides,
    },
  });
  if (!response.ok()) {
    throw new Error(`création d'unité échouée : ${await response.text()}`);
  }
  const body = (await response.json()) as {
    data: { unit: { id: string; publicCode: string; version: number } };
  };
  return body.data.unit;
}
