import type { AppError, CultureUnit, DomainEvent } from '@champi/contracts';

/** Récolte, telle que l'API la rend. */
export interface HarvestRecord {
  readonly id: string;
  readonly unitId: string;
  readonly flushNumber: number;
  readonly weight: { value: number; unit: string; kind: string };
  readonly quality: 'A' | 'B' | 'C';
  readonly losses: readonly { weight: { value: number; unit: string }; cause: string }[];
  readonly harvestedAt: string;
}

/** Remontée d'un produit vers les unités qui l'ont produit. */
export interface ProductTrace {
  readonly product: { id: string; publicCode: string; name: string };
  readonly origins: readonly {
    readonly harvestId: string;
    readonly unitId: string;
    readonly share: number;
  }[];
  readonly units?: readonly CultureUnit[];
}

/** Lignée d'une unité : ses ascendants et ses descendants. */
export interface UnitTrace {
  readonly upstream?: readonly CultureUnit[];
  readonly downstream?: readonly CultureUnit[];
  readonly complete?: boolean;
}
import type { OfflineQueue, SendOutcome } from './offline-queue.js';

/**
 * Client d'API typé.
 *
 * Deux comportements portent des décisions du cadrage :
 *
 * 1. **Aucune authentification** (docs/21 §6) : pas d'en-tête, pas de session,
 *    pas de rafraîchissement de jeton. Le tailnet est la seule frontière.
 * 2. **Bascule vers la file locale** dès qu'une mutation échoue pour cause de
 *    réseau. La saisie n'est jamais perdue, et l'interface le dit franchement
 *    (docs/22 §7.2).
 */

export interface ApiSuccess<T> {
  readonly ok: true;
  readonly data: T;
}

export interface ApiFailure {
  readonly ok: false;
  readonly error: AppError;
  /** `true` quand l'échec vient du réseau, donc rejouable. */
  readonly offline: boolean;
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

/** Saisie acceptée localement, à envoyer plus tard. */
export interface QueuedResult {
  readonly ok: true;
  readonly queued: true;
  readonly pendingCount: number;
}

export type MutationResult<T> = ApiSuccess<T> | QueuedResult | ApiFailure;

export interface ApiClientOptions {
  readonly baseUrl: string;
  readonly fetch: typeof globalThis.fetch;
  readonly queue: OfflineQueue;
  /** Clé d'idempotence — la même au premier envoi et à tous les rejeux. */
  readonly newIdempotencyKey: () => string;
  readonly now: () => string;
}

interface ApiEnvelope<T> {
  data?: T;
  error?: AppError;
}

const NETWORK_ERROR: AppError = {
  code: 'CONFLICT',
  message: "L'application n'a pas pu joindre le serveur.",
  hint: 'La saisie est conservée sur l’appareil et sera envoyée automatiquement dès que le réseau revient.',
};

export class ApiClient {
  constructor(private readonly options: ApiClientOptions) {}

  private url(path: string): string {
    return `${this.options.baseUrl}${path}`;
  }

  /** Lecture. En cas de coupure, on ne met rien en file : lire n'a pas d'effet. */
  async get<T>(path: string): Promise<ApiResult<T>> {
    let response: Response;
    try {
      response = await this.options.fetch(this.url(path));
    } catch {
      return { ok: false, error: NETWORK_ERROR, offline: true };
    }
    return readEnvelope<T>(response);
  }

  /**
   * Mutation.
   *
   * Toujours accompagnée d'une clé d'idempotence : c'est elle qui rend le rejeu
   * sûr, que ce soit le navigateur ou la file locale qui réessaie.
   */
  async post<T>(path: string, body: unknown): Promise<MutationResult<T>> {
    const idempotencyKey = this.options.newIdempotencyKey();

    let response: Response;
    try {
      response = await this.options.fetch(this.url(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(body),
      });
    } catch {
      // Réseau tombé : on met en file plutôt que d'échouer devant l'opérateur.
      this.options.queue.enqueue({
        id: idempotencyKey,
        method: 'POST',
        path,
        body,
        idempotencyKey,
        queuedAt: this.options.now(),
      });
      return { ok: true, queued: true, pendingCount: this.options.queue.pendingCount() };
    }

    return readEnvelope<T>(response);
  }

  /** Vide la file locale. Appelé au retour du réseau et à l'ouverture de l'app. */
  flushQueue(): ReturnType<OfflineQueue['flush']> {
    return this.options.queue.flush();
  }

  // --- Opérations métier ---

  getUnit(reference: string): Promise<ApiResult<CultureUnit>> {
    return this.get<CultureUnit>(`/api/units/${encodeURIComponent(reference)}`);
  }

  getTimeline(reference: string): Promise<ApiResult<DomainEvent[]>> {
    return this.get<DomainEvent[]>(`/api/units/${encodeURIComponent(reference)}/timeline`);
  }

  resolveQr(token: string): Promise<ApiResult<{ qr: unknown; target: CultureUnit | null }>> {
    return this.get(`/api/qr/${encodeURIComponent(token)}`);
  }

  nextSteps(
    reference: string,
  ): Promise<ApiResult<{ currentStepId: string; nominal: { id: string; name: string }[] }>> {
    return this.get(`/api/units/${encodeURIComponent(reference)}/next-steps`);
  }

  observe(
    reference: string,
    body: { kind: string; severity: string; note?: string; photoId?: string },
  ): Promise<MutationResult<{ unit: CultureUnit; event: DomainEvent }>> {
    return this.post(`/api/units/${encodeURIComponent(reference)}/observations`, body);
  }

  measure(
    reference: string,
    body: { metric: string; numericValue?: number },
  ): Promise<MutationResult<{ unit: CultureUnit; event: DomainEvent }>> {
    return this.post(`/api/units/${encodeURIComponent(reference)}/measurements`, body);
  }

  /**
   * Unités d'un stade.
   *
   * L'écran de terrain s'ouvre là-dessus : en chambre on arrive par une
   * étiquette, mais depuis le bureau on veut voir ce qui tourne.
   */
  listUnits(stage: CultureUnit['stage']): Promise<ApiResult<CultureUnit[]>> {
    return this.get(`/api/units?stage=${encodeURIComponent(stage)}`);
  }

  createUnit(body: {
    name: string;
    stage: CultureUnit['stage'];
    processVersionId: string;
    stepId: string;
    parentUnitId?: string | null;
    substrateWeight?: { value: number; unit: string; kind: 'substrate' };
  }): Promise<MutationResult<{ unit: CultureUnit; event: DomainEvent }>> {
    return this.post('/api/units', body);
  }

  /** Lit le QR d'une unité, sans en créer. `null` quand elle n'en a pas encore. */
  getQr(reference: string): Promise<ApiResult<{ token: string; printCount: number }>> {
    return this.get(`/api/units/${encodeURIComponent(reference)}/qr`);
  }

  /** Attribue un QR, ou rend celui qui existe déjà — le token ne change jamais. */
  assignQr(
    reference: string,
  ): Promise<MutationResult<{ token: string; printCount: number } & Record<string, unknown>>> {
    return this.post(`/api/units/${encodeURIComponent(reference)}/qr`, {});
  }

  printLabel(
    reference: string,
    copies = 1,
  ): Promise<MutationResult<{ status: string; isReprint: boolean; attempts: number }>> {
    return this.post(`/api/units/${encodeURIComponent(reference)}/label/print`, { copies });
  }

  testPrinter(): Promise<ApiResult<{ transport: string; reachable: boolean }>> {
    return this.get('/api/printer/test');
  }

  /**
   * Attache une photo.
   *
   * L'image part en base64 dans du JSON, comme le reste de l'API : c'est ce que
   * produit un canvas, et cela évite un envoi multipart qu'un agent ne saurait
   * pas former.
   */
  addPhoto(
    reference: string,
    body: { data: string; contentType?: string; note?: string },
  ): Promise<MutationResult<{ photo: { photoId: string }; event: DomainEvent }>> {
    return this.post(`/api/units/${encodeURIComponent(reference)}/photos`, body);
  }

  /** Adresse d'affichage d'une photo. Le navigateur la met en cache pour toujours. */
  photoUrl(photoId: string): string {
    return `${this.options.baseUrl}/api/photos/${encodeURIComponent(photoId)}`;
  }

  /**
   * Récoltes d'une unité, avec son rendement biologique.
   *
   * Le rendement n'est calculable que si le poids de substrat a été saisi à
   * l'inoculation : le serveur dit **pourquoi** il manque plutôt que de rendre
   * un zéro trompeur.
   */
  listHarvests(reference: string): Promise<
    ApiResult<{
      harvests: HarvestRecord[];
      biologicalEfficiencyPct: number | null;
      yieldUnavailableReason: string | null;
    }>
  > {
    return this.get(`/api/units/${encodeURIComponent(reference)}/harvests`);
  }

  recordHarvest(
    reference: string,
    body: {
      flushNumber: number;
      weight: { value: number; unit: string; kind: 'harvest' };
      quality: 'A' | 'B' | 'C';
      losses: { weight: { value: number; unit: string; kind: 'harvest' }; cause: string }[];
    },
  ): Promise<MutationResult<{ harvest: HarvestRecord; netWeight: { value: number } }>> {
    return this.post(`/api/units/${encodeURIComponent(reference)}/harvests`, body);
  }

  /**
   * Crée un produit final à partir d'une ou plusieurs récoltes.
   *
   * Les parts doivent totaliser 1 — c'est le domaine qui le vérifie, et c'est
   * ce qui rend la remontée « barquette → blocs » exacte plutôt qu'approchée.
   */
  createProduct(body: {
    name: string;
    quantity: { value: number; unit: string; kind: 'product' };
    origins: {
      harvestId: string;
      weight: { value: number; unit: string; kind: 'harvest' };
      share: number;
    }[];
  }): Promise<MutationResult<{ product: { id: string; publicCode: string; name: string } }>> {
    return this.post('/api/products', body);
  }

  /** Remonte d'un produit aux unités qui l'ont produit. */
  traceProduct(reference: string): Promise<ApiResult<ProductTrace>> {
    return this.get(`/api/products/${encodeURIComponent(reference)}/trace`);
  }

  /** Remonte la lignée d'une unité, de son origine à ses descendants. */
  traceUnit(reference: string): Promise<ApiResult<UnitTrace>> {
    return this.get(`/api/units/${encodeURIComponent(reference)}/trace`);
  }

  /** Contrôle d'audit : l'état stocké est-il reconstructible depuis le journal ? */
  auditUnit(
    reference: string,
  ): Promise<ApiResult<{ verified: boolean; divergences: unknown[]; eventCount: number }>> {
    return this.get(`/api/units/${encodeURIComponent(reference)}/audit`);
  }

  listProcessTemplates(): Promise<
    ApiResult<{ id: string; name: string; currentVersionId?: string }[]>
  > {
    return this.get('/api/process-templates');
  }

  /**
   * Toutes les versions d'un process.
   *
   * C'est la **seule** source fiable de la version courante : le
   * `currentVersionId` du modèle pointe sur la version créée à l'origine et
   * n'est pas déplacé par une publication. Se fier à lui rechargeait la version
   * publiée par-dessus le brouillon qu'on venait d'ouvrir.
   */
  listProcessVersions(
    templateId: string,
  ): Promise<ApiResult<{ id: string; versionNumber: number; status: string; graph: unknown }[]>> {
    return this.get(`/api/process-templates/${encodeURIComponent(templateId)}/versions`);
  }

  getProcessVersion(
    id: string,
  ): Promise<ApiResult<{ id: string; status: string; versionNumber: number; graph: unknown }>> {
    return this.get(`/api/process-versions/${encodeURIComponent(id)}`);
  }

  createProcessTemplate(
    name: string,
    graph: unknown,
  ): Promise<MutationResult<{ template: { id: string }; version: { id: string } }>> {
    return this.post('/api/process-templates', { name, graph });
  }

  saveProcessGraph(versionId: string, graph: unknown): Promise<MutationResult<{ id: string }>> {
    return this.post(`/api/process-versions/${encodeURIComponent(versionId)}/graph`, graph);
  }

  publishProcessVersion(versionId: string): Promise<MutationResult<{ status: string }>> {
    return this.post(`/api/process-versions/${encodeURIComponent(versionId)}/publish`, {});
  }

  /**
   * Ouvre un brouillon à partir d'une version.
   *
   * C'est le **seul** moyen de modifier un process déjà publié : la version
   * publiée reste immuable, et les unités qui y sont épinglées ne bougent pas.
   */
  draftProcessVersion(
    versionId: string,
  ): Promise<MutationResult<{ id: string; versionNumber: number }>> {
    return this.post(`/api/process-versions/${encodeURIComponent(versionId)}/draft`, {});
  }

  advance(
    reference: string,
    toStepId: string,
    expectedVersion: number,
    confirmOffNominal = false,
  ): Promise<MutationResult<{ unit: CultureUnit; event: DomainEvent }>> {
    return this.post(`/api/units/${encodeURIComponent(reference)}/advance`, {
      toStepId,
      expectedVersion,
      confirmOffNominal,
    });
  }
}

/** Lit l'enveloppe standard `{ data }` / `{ error }`. */
async function readEnvelope<T>(response: Response): Promise<ApiResult<T>> {
  let payload: ApiEnvelope<T>;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: `Réponse illisible du serveur (statut ${String(response.status)}).`,
        hint: "Ce n'est pas un refus métier : signale-le si cela se reproduit.",
      },
      offline: false,
    };
  }

  if (response.ok && payload.data !== undefined) {
    return { ok: true, data: payload.data };
  }

  return {
    ok: false,
    error: payload.error ?? {
      code: 'VALIDATION_FAILED',
      message: `Le serveur a répondu ${String(response.status)} sans détail.`,
    },
    offline: false,
  };
}

/**
 * Émetteur utilisé par la file locale au moment du rejeu.
 *
 * Distingue l'échec **réseau** (à rejouer) de l'échec **métier** (inutile
 * d'insister) : sans cette distinction, une saisie refusée pour une bonne
 * raison tournerait en boucle et masquerait les vraies pannes.
 */
export function createQueueSender(
  baseUrl: string,
  fetchImpl: typeof globalThis.fetch,
): (item: { path: string; body: unknown; idempotencyKey: string }) => Promise<SendOutcome> {
  return async (item) => {
    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${item.path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': item.idempotencyKey,
        },
        body: JSON.stringify(item.body),
      });
    } catch {
      return { ok: false, retryable: true, error: 'Réseau indisponible.' };
    }

    if (response.ok) {
      return { ok: true, retryable: false };
    }
    // 5xx : le serveur a un souci passager, on réessaiera.
    // 4xx : c'est la requête qui ne convient pas, insister ne sert à rien.
    return {
      ok: false,
      retryable: response.status >= 500,
      error: `Le serveur a répondu ${String(response.status)}.`,
    };
  };
}
