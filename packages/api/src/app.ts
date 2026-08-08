import { Hono } from 'hono';
import { z } from 'zod';
import {
  appError,
  domainEventSchema,
  listHint,
  processGraphSchema,
  stageSchema,
  type CultureUnit,
  type DomainEvent,
  type ProcessGraph,
  type ProcessVersion,
} from '@champi/contracts';
import {
  advanceUnit,
  buildUnitLabel,
  checkJournalIntegrity,
  diffReplayAgainstStored,
  draftFromVersion,
  editVersionGraph,
  nominalNextSteps,
  prefixForStage,
  publishVersion,
  replayUnit,
  validateProcessGraph,
  validateTokenFormat,
} from '@champi/domain';
import type {
  MongoConnection,
  ProcessRepository,
  QrRepository,
  UnitRepository,
} from '@champi/persistence';
import type { PrintQueue } from '@champi/printing';
import { errorBody, statusForError } from './errors.js';
import { IdempotencyStore } from './idempotency.js';

/**
 * API HTTP.
 *
 * **Aucune authentification** (docs/21 §6) : la seule frontière d'accès est le
 * tailnet Tailscale. L'API est donc directement pilotable par un agent, ce qui
 * est ici un avantage assumé — il ne lui faut qu'une URL de base.
 *
 * Trois propriétés rendent cette API réellement utilisable par un LLM :
 * `?dryRun=true` partout, `Idempotency-Key` sur les mutations, et des erreurs
 * qui contiennent les valeurs valides (docs/22 §4.3).
 */

export interface AppDependencies {
  readonly connection: MongoConnection;
  readonly units: UnitRepository;
  readonly qr: QrRepository;
  readonly processes: ProcessRepository;
  readonly printQueue: PrintQueue;
  /** Horloge injectée : aucune lecture d'horloge ambiante dans la logique. */
  readonly now: () => string;
  readonly newId: () => string;
  /** Source d'aléa injectée — `crypto.getRandomValues` en production. */
  readonly randomBytes: (length: number) => Uint8Array;
  /** Résout le graphe de la version de process épinglée à une unité. */
  readonly graphForVersion: (versionId: string) => Promise<ProcessGraph | null>;
}

const advanceBodySchema = z.object({
  toStepId: z.string().min(1),
  confirmOffNominal: z.boolean().optional(),
  expectedVersion: z.number().int().nonnegative(),
});

const printBodySchema = z.object({
  copies: z.number().optional(),
});

const createProcessBodySchema = z.object({
  name: z.string().min(1),
  speciesScope: z.union([z.literal('any'), z.string().min(1)]).default('any'),
  graph: processGraphSchema,
});

const createUnitBodySchema = z.object({
  name: z.string().min(1),
  stage: stageSchema,
  processVersionId: z.string().min(1),
  stepId: z.string().min(1),
  parentUnitId: z.string().min(1).nullable().default(null),
  substrateWeight: z
    .object({
      value: z.number().finite().nonnegative(),
      unit: z.enum(['g', 'kg', 'piece', 'tray', 'L', 'mL']),
      kind: z.literal('substrate'),
    })
    .optional(),
});

/** `?dryRun=true` — décrit l'effet sans l'appliquer. */
function isDryRun(url: string): boolean {
  return new URL(url).searchParams.get('dryRun') === 'true';
}

/**
 * Chemin du premier problème de validation, en notation pointée.
 *
 * Rend `body` quand l'erreur porte sur la racine — corps absent, ou qui n'est
 * pas un objet. Pointer une chaîne vide n'aiderait personne.
 */
export function firstIssuePath(issues: readonly { path: PropertyKey[] }[]): string {
  const path = issues[0]?.path.join('.');
  return path === undefined || path === '' ? 'body' : path;
}

export function createApp(deps: AppDependencies): Hono {
  const app = new Hono();
  const idempotency = new IdempotencyStore(deps.connection.db);

  /**
   * Gestionnaire d'erreurs global.
   *
   * Tout ce qui échappe aux `Result` du domaine est une **panne**, pas un refus
   * métier : base injoignable, document corrompu en base, bug. La réponse garde
   * la même forme que les erreurs métier — un agent n'a pas à traiter deux
   * formats — mais elle ne divulgue ni pile d'appel ni détail interne.
   */
  app.onError((cause, c) => {
    const reference = deps.newId();
    return c.json(
      errorBody(
        appError('VALIDATION_FAILED', "L'application n'a pas pu traiter cette requête.", {
          hint: `Ce n'est pas un refus métier mais une panne. Référence à citer : ${reference}. Cause : ${cause.message}`,
        }),
      ),
      500,
    );
  });

  app.get('/api/health', (c) => c.json({ status: 'ok', now: deps.now() }));

  /**
   * Découverte en un appel.
   *
   * Un agent qui arrive sans contexte sait quoi faire après **une** requête :
   * les opérations disponibles, l'état courant, et les recettes des tâches
   * courantes (docs/22 §4.3, propriété 1).
   */
  app.get('/api/_discover', async (c) => {
    const countByStage = await deps.units.countByStage();
    return c.json({
      application: 'Champignon Manager',
      description:
        "Traçabilité de la culture de champignons, du spore à l'assiette. Chaque objet physique est une « unité de culture » identifiée par QR.",
      authentication: 'aucune — accès borné par le réseau Tailscale',
      conventions: {
        identifiers:
          'Toute route acceptant un identifiant accepte aussi le code public (ex. SUB-2026-0042).',
        dryRun: "Ajoute ?dryRun=true à toute mutation pour en voir l'effet sans l'appliquer.",
        idempotency:
          "Envoie un en-tête Idempotency-Key sur les POST : un rejeu renvoie la réponse d'origine sans réexécuter l'action.",
        optimisticLock:
          'Les mutations exigent expectedVersion. Un décalage renvoie 409 CONFLICT avec la version courante.',
      },
      state: { unitsByStage: countByStage },
      operations: [
        { method: 'GET', path: '/api/units/:reference', purpose: 'Fiche complète d’une unité' },
        {
          method: 'GET',
          path: '/api/units/:reference/timeline',
          purpose: 'Journal d’événements ordonné',
        },
        {
          method: 'GET',
          path: '/api/units/:reference/next-steps',
          purpose: 'Étapes nominales atteignables',
        },
        {
          method: 'POST',
          path: '/api/units/:reference/advance',
          purpose: 'Faire avancer une unité (toute transition possible, écart confirmé)',
        },
        {
          method: 'GET',
          path: '/api/units/:reference/audit',
          purpose: 'Vérifier que le journal et l’état stocké concordent',
        },
        { method: 'GET', path: '/api/units?stage=', purpose: 'Lister par stade' },
      ],
      recipes: {
        'faire avancer une unité':
          '1) GET /api/units/:code pour lire sa version. 2) GET /api/units/:code/next-steps. 3) POST /api/units/:code/advance?dryRun=true pour vérifier. 4) même POST sans dryRun, avec Idempotency-Key.',
        'vérifier la traçabilité':
          'GET /api/units/:code/audit — renvoie les divergences détectées.',
      },
    });
  });

  // --- Process ---

  app.get('/api/process-templates', async (c) =>
    c.json({ data: await deps.processes.listTemplates() }),
  );

  app.get('/api/process-versions/:id', async (c) => {
    const version = await deps.processes.findVersion(c.req.param('id'));
    if (version === null) {
      return c.json(
        errorBody(
          appError('NOT_FOUND', `La version « ${c.req.param('id')} » n'existe pas.`, {
            hint: 'GET /api/process-templates liste les process, puis GET /api/process-templates/:id/versions leurs versions.',
          }),
        ),
        404,
      );
    }
    return c.json({ data: version });
  });

  app.get('/api/process-templates/:id/versions', async (c) =>
    c.json({ data: await deps.processes.listVersions(c.req.param('id')) }),
  );

  /**
   * Crée un process et sa première version, en brouillon.
   *
   * Le graphe est le **même JSON** que celui édité par le canvas graphique
   * (docs/22 §3.1) : un agent peut donc écrire un process complet et le
   * POSTer, l'éditeur l'affichera correctement.
   */
  app.post('/api/process-templates', async (c) => {
    const rawBody: unknown = await c.req.json().catch(() => null);
    const parsed = createProcessBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return c.json(
        errorBody(
          appError('VALIDATION_FAILED', 'Corps de requête invalide.', {
            hint: 'Attendu : { name: string, speciesScope?: "any" | string, graph: { steps: [...], transitions: [...] } }.',
            path: firstIssuePath(parsed.error.issues),
          }),
        ),
        400,
      );
    }

    const validated = validateProcessGraph(parsed.data.graph);
    if (!validated.ok) {
      return c.json(errorBody(validated.error), statusForError(validated.error.code));
    }

    const templateId = deps.newId();
    const versionId = deps.newId();

    if (isDryRun(c.req.url)) {
      return c.json({ dryRun: true, data: { wouldCreate: parsed.data.name } });
    }

    const template = await deps.processes.saveTemplate({
      id: templateId,
      name: parsed.data.name,
      speciesScope: parsed.data.speciesScope,
      currentVersionId: versionId,
    });
    if (!template.ok) {
      return c.json(errorBody(template.error), statusForError(template.error.code));
    }

    const version: ProcessVersion = {
      id: versionId,
      templateId,
      versionNumber: 1,
      status: 'draft',
      graph: parsed.data.graph,
    };
    const saved = await deps.processes.saveVersion(version);
    if (!saved.ok) {
      return c.json(errorBody(saved.error), statusForError(saved.error.code));
    }

    return c.json({ data: { template: template.value, version: saved.value } });
  });

  /**
   * Publie une version. Le gel est définitif.
   *
   * ⚠️ Publier **n'affecte aucune unité en cours** (docs/21 §2) : la réponse le
   * dit explicitement, pour qu'aucun appelant ne construise l'attente inverse.
   */
  app.post('/api/process-versions/:id/publish', async (c) => {
    const version = await deps.processes.findVersion(c.req.param('id'));
    if (version === null) {
      return c.json(
        errorBody(appError('NOT_FOUND', `La version « ${c.req.param('id')} » n'existe pas.`)),
        404,
      );
    }

    const published = publishVersion(version, deps.now());
    if (!published.ok) {
      return c.json(errorBody(published.error), statusForError(published.error.code));
    }

    if (isDryRun(c.req.url)) {
      return c.json({ dryRun: true, data: { wouldPublish: published.value.versionNumber } });
    }

    const saved = await deps.processes.saveVersion(published.value);
    if (!saved.ok) {
      return c.json(errorBody(saved.error), statusForError(saved.error.code));
    }
    return c.json({
      data: saved.value,
      note: 'Aucune unité en cours n’est déplacée : chacune reste épinglée à sa version jusqu’à la fin de son cycle.',
    });
  });

  /** Ouvre un brouillon à partir d'une version existante. */
  app.post('/api/process-versions/:id/draft', async (c) => {
    const version = await deps.processes.findVersion(c.req.param('id'));
    if (version === null) {
      return c.json(
        errorBody(appError('NOT_FOUND', `La version « ${c.req.param('id')} » n'existe pas.`)),
        404,
      );
    }

    const nextNumber = await deps.processes.nextVersionNumber(version.templateId);
    const draft = { ...draftFromVersion(version, deps.newId()), versionNumber: nextNumber };
    const saved = await deps.processes.saveVersion(draft);
    if (!saved.ok) {
      return c.json(errorBody(saved.error), statusForError(saved.error.code));
    }
    return c.json({ data: saved.value });
  });

  /** Modifie le graphe d'un brouillon. Refusé sur une version publiée. */
  app.post('/api/process-versions/:id/graph', async (c) => {
    const version = await deps.processes.findVersion(c.req.param('id'));
    if (version === null) {
      return c.json(
        errorBody(appError('NOT_FOUND', `La version « ${c.req.param('id')} » n'existe pas.`)),
        404,
      );
    }

    const rawBody: unknown = await c.req.json().catch(() => null);
    const parsed = processGraphSchema.safeParse(rawBody);
    if (!parsed.success) {
      return c.json(
        errorBody(
          appError('VALIDATION_FAILED', 'Graphe de process invalide.', {
            hint: 'Attendu : { steps: [...], transitions: [...], layout?: {...} }.',
            path: firstIssuePath(parsed.error.issues),
          }),
        ),
        400,
      );
    }

    const edited = editVersionGraph(version, parsed.data);
    if (!edited.ok) {
      return c.json(errorBody(edited.error), statusForError(edited.error.code));
    }
    const saved = await deps.processes.saveVersion(edited.value);
    if (!saved.ok) {
      return c.json(errorBody(saved.error), statusForError(saved.error.code));
    }
    return c.json({ data: saved.value });
  });

  // --- Unités ---

  /**
   * Crée une unité.
   *
   * `parentUnitId` est **nullable** : une unité peut naître à n'importe quel
   * stade, sans ascendant (docs/14 §18.1). Le code public et le QR sont
   * attribués par le serveur — les laisser au client ouvrirait la porte aux
   * collisions.
   */
  app.post('/api/units', async (c) => {
    const rawBody: unknown = await c.req.json().catch(() => null);
    const parsed = createUnitBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return c.json(
        errorBody(
          appError('VALIDATION_FAILED', 'Corps de requête invalide.', {
            hint: 'Attendu : { name, stage, processVersionId, stepId, parentUnitId?, substrateWeight? }.',
            path: firstIssuePath(parsed.error.issues),
          }),
        ),
        400,
      );
    }

    const graph = await deps.graphForVersion(parsed.data.processVersionId);
    if (graph === null) {
      return c.json(
        errorBody(
          appError(
            'NOT_FOUND',
            `La version de process « ${parsed.data.processVersionId} » n'existe pas.`,
            {
              hint: 'Crée et publie un process avant de créer des unités.',
              path: 'processVersionId',
            },
          ),
        ),
        404,
      );
    }
    if (!graph.steps.some((step) => step.id === parsed.data.stepId)) {
      return c.json(
        errorBody(
          appError('STEP_NOT_IN_PROCESS', `L'étape « ${parsed.data.stepId} » n'existe pas.`, {
            hint: listHint(
              'Étapes disponibles',
              graph.steps.map((s) => s.id),
            ),
            path: 'stepId',
          }),
        ),
        422,
      );
    }

    const key = c.req.header('Idempotency-Key');
    if (key !== undefined) {
      const seen = await idempotency.lookup(key, rawBody);
      if (seen.kind === 'conflict') {
        return c.json(seen.body, 409);
      }
      if (seen.kind === 'replay') {
        c.header('Idempotent-Replay', 'true');
        return c.json(seen.body as object, seen.status as 200);
      }
    }

    const nowIso = deps.now();
    const year = Number(nowIso.slice(0, 4));
    const code = await deps.qr.allocatePublicCode(prefixForStage(parsed.data.stage), year);
    if (!code.ok) {
      return c.json(errorBody(code.error), statusForError(code.error.code));
    }

    const unit: CultureUnit = {
      id: deps.newId(),
      publicCode: code.value,
      name: parsed.data.name,
      stage: parsed.data.stage,
      status: 'active',
      parentUnitId: parsed.data.parentUnitId,
      lineageRelation: parsed.data.parentUnitId === null ? 'origin' : 'transfer',
      generation: 0,
      processVersionId: parsed.data.processVersionId,
      currentStepId: parsed.data.stepId,
      currentStepEnteredAt: nowIso,
      ...(parsed.data.substrateWeight !== undefined
        ? { substrateWeight: parsed.data.substrateWeight }
        : {}),
      createdAt: nowIso,
      updatedAt: nowIso,
      version: 0,
    };

    const event: DomainEvent = domainEventSchema.parse({
      id: deps.newId(),
      type: 'unit.created',
      occurredAt: nowIso,
      recordedAt: nowIso,
      source: 'manual',
      unitId: unit.id,
      payload: {
        stage: unit.stage,
        processVersionId: unit.processVersionId,
        stepId: unit.currentStepId,
        parentUnitId: unit.parentUnitId,
        ...(unit.substrateWeight !== undefined ? { substrateWeight: unit.substrateWeight } : {}),
      },
    });

    if (isDryRun(c.req.url)) {
      return c.json({ dryRun: true, data: { wouldCreate: unit, wouldRecord: event } });
    }

    const created = await deps.units.create(unit, event);
    if (!created.ok) {
      return c.json(errorBody(created.error), statusForError(created.error.code));
    }

    const body = { data: { unit: created.value, event } };
    if (key !== undefined) {
      await idempotency.remember(key, rawBody, 200, body);
    }
    return c.json(body);
  });

  app.get('/api/units', async (c) => {
    const raw = c.req.query('stage');
    if (raw === undefined) {
      return c.json(
        errorBody(
          appError('VALIDATION_FAILED', 'Le paramètre « stage » est requis.', {
            hint: listHint('Stades acceptés', stageSchema.options),
            path: 'stage',
          }),
        ),
        400,
      );
    }
    const parsed = stageSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        errorBody(
          appError('VALIDATION_FAILED', `Le stade « ${raw} » n'existe pas.`, {
            hint: listHint('Stades acceptés', stageSchema.options),
            path: 'stage',
          }),
        ),
        400,
      );
    }
    return c.json({ data: await deps.units.listByStage(parsed.data) });
  });

  app.get('/api/units/:reference', async (c) => {
    const unit = await deps.units.findByIdOrPublicCode(c.req.param('reference'));
    if (unit === null) {
      return notFound(c.req.param('reference'), c);
    }
    return c.json({ data: unit });
  });

  app.get('/api/units/:reference/timeline', async (c) => {
    const unit = await deps.units.findByIdOrPublicCode(c.req.param('reference'));
    if (unit === null) {
      return notFound(c.req.param('reference'), c);
    }
    return c.json({ data: await deps.units.eventsForUnit(unit.id) });
  });

  app.get('/api/units/:reference/next-steps', async (c) => {
    const unit = await deps.units.findByIdOrPublicCode(c.req.param('reference'));
    if (unit === null) {
      return notFound(c.req.param('reference'), c);
    }
    const graph = await deps.graphForVersion(unit.processVersionId);
    if (graph === null) {
      return c.json(
        errorBody(
          appError(
            'NOT_FOUND',
            `La version de process « ${unit.processVersionId} » épinglée à cette unité est introuvable.`,
            {
              hint: 'Une unité reste épinglée à sa version : celle-ci ne doit jamais être supprimée.',
            },
          ),
        ),
        404,
      );
    }
    const nominal = nominalNextSteps(graph, unit.currentStepId);
    return c.json({
      data: {
        currentStepId: unit.currentStepId,
        nominal: nominal.map((step) => ({ id: step.id, name: step.name, stage: step.stage })),
        // Rappel explicite du principe : le graphe conseille, il n'interdit pas.
        note: 'Toute autre étape reste atteignable avec confirmOffNominal: true — sauter, refaire et revenir en arrière sont autorisés.',
        allSteps: graph.steps.map((step) => step.id),
      },
    });
  });

  /**
   * Vérification d'audit à la demande.
   *
   * Exécute en production les mêmes contrôles que le test d'audit
   * (docs/22 §6.3) : rejeu du journal, comparaison à l'état stocké, intégrité.
   */
  app.get('/api/units/:reference/audit', async (c) => {
    const unit = await deps.units.findByIdOrPublicCode(c.req.param('reference'));
    if (unit === null) {
      return notFound(c.req.param('reference'), c);
    }
    const events = await deps.units.eventsForUnit(unit.id);
    const replayed = replayUnit(events);
    const integrity = checkJournalIntegrity(events);

    if (!replayed.ok) {
      return c.json({
        data: {
          verified: false,
          divergences: [],
          integrityIssues: [
            ...integrity,
            { code: replayed.error.code, message: replayed.error.message },
          ],
          eventCount: events.length,
        },
      });
    }

    const divergences = diffReplayAgainstStored(replayed.value, unit);
    return c.json({
      data: {
        verified: divergences.length === 0 && integrity.length === 0,
        divergences,
        integrityIssues: integrity,
        eventCount: events.length,
      },
    });
  });

  /**
   * Résolution d'un QR scanné.
   *
   * Le token ne contient **aucune** donnée métier : c'est cette route qui fait
   * le lien. Un token mal formé et un token inconnu produisent deux messages
   * différents — le premier veut dire « ce QR ne vient pas de l'application »,
   * le second « cette étiquette n'est plus au registre ».
   */
  app.get('/api/qr/:token', async (c) => {
    const token = c.req.param('token');
    const format = validateTokenFormat(token);
    if (!format.ok) {
      return c.json(errorBody(format.error), statusForError(format.error.code));
    }

    const entry = await deps.qr.resolve(token);
    if (entry === null) {
      return c.json(
        errorBody(
          appError('NOT_FOUND', `Le token « ${token} » n'est pas au registre.`, {
            hint: "Le QR est bien formé mais inconnu : étiquette d'une autre installation, ou unité supprimée du registre.",
            path: 'token',
          }),
        ),
        404,
      );
    }

    // Le scan renvoie directement la cible : après un scan, l'opérateur veut
    // la fiche, pas un identifiant à ré-interroger.
    if (entry.targetType === 'unit') {
      const unit = await deps.units.findById(entry.targetId);
      if (unit !== null) {
        return c.json({ data: { qr: entry, target: unit } });
      }
    }
    return c.json({ data: { qr: entry, target: null } });
  });

  /** Attribue un QR à une unité, si elle n'en a pas déjà un. */
  app.post('/api/units/:reference/qr', async (c) => {
    const unit = await deps.units.findByIdOrPublicCode(c.req.param('reference'));
    if (unit === null) {
      return notFound(c.req.param('reference'), c);
    }

    const existing = await deps.qr.findByTarget('unit', unit.id);
    if (existing !== null) {
      // Idempotent par nature : redemander le QR d'une unité rend le sien.
      return c.json({ data: existing, alreadyExisted: true });
    }

    if (isDryRun(c.req.url)) {
      return c.json({ dryRun: true, data: { wouldRegisterFor: unit.publicCode } });
    }

    const registered = await deps.qr.register('unit', unit.id, deps.randomBytes, deps.now());
    if (!registered.ok) {
      return c.json(errorBody(registered.error), statusForError(registered.error.code));
    }
    return c.json({ data: registered.value, alreadyExisted: false });
  });

  /**
   * Imprime — ou réimprime — l'étiquette d'une unité.
   *
   * Une réimpression réutilise **le même token** (`q17_5`) : l'étiquette
   * abîmée est remplacée à l'identique, sans quoi le lien avec l'objet
   * physique déjà en chambre serait rompu.
   */
  app.post('/api/units/:reference/label/print', async (c) => {
    const unit = await deps.units.findByIdOrPublicCode(c.req.param('reference'));
    if (unit === null) {
      return notFound(c.req.param('reference'), c);
    }

    const rawBody: unknown = await c.req.json().catch(() => ({}));
    const parsed = printBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return c.json(
        errorBody(
          appError('VALIDATION_FAILED', 'Corps de requête invalide.', {
            hint: 'Attendu : { copies?: number }.',
            path: firstIssuePath(parsed.error.issues),
          }),
        ),
        400,
      );
    }

    const entry = await deps.qr.findByTarget('unit', unit.id);
    if (entry === null) {
      return c.json(
        errorBody(
          appError('NOT_FOUND', `L'unité ${unit.publicCode} n'a pas encore de QR.`, {
            hint: `Appelle POST /api/units/${unit.publicCode}/qr avant d'imprimer son étiquette.`,
            path: 'reference',
          }),
        ),
        404,
      );
    }

    const label = buildUnitLabel(unit, entry.token);
    if (!label.ok) {
      return c.json(errorBody(label.error), statusForError(label.error.code));
    }

    if (isDryRun(c.req.url)) {
      return c.json({
        dryRun: true,
        data: { wouldPrint: label.value, copies: parsed.data.copies ?? 1 },
      });
    }

    const job = await deps.printQueue.run({
      id: deps.newId(),
      unitId: unit.id,
      label: label.value,
      ...(parsed.data.copies !== undefined ? { copies: parsed.data.copies } : {}),
      isReprint: entry.printCount > 0,
      nowIso: deps.now(),
    });
    if (!job.ok) {
      return c.json(errorBody(job.error), statusForError(job.error.code));
    }

    // Le compteur ne bouge que si l'impression a réellement abouti : sinon on
    // croirait qu'une étiquette circule alors qu'elle n'est jamais sortie.
    if (job.value.status === 'printed') {
      await deps.qr.recordPrint(entry.token);
    }
    return c.json({ data: job.value });
  });

  /** Test imprimante — l'imprimante répond-elle, ici et maintenant ? */
  app.get('/api/printer/test', async (c) => {
    const result = await deps.printQueue.testPrinter();
    if (!result.ok) {
      return c.json(errorBody(result.error), statusForError(result.error.code));
    }
    return c.json({ data: result.value });
  });

  app.post('/api/units/:reference/advance', async (c) => {
    const reference = c.req.param('reference');
    const rawBody: unknown = await c.req.json().catch(() => null);

    const parsed = advanceBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return c.json(
        errorBody(
          appError('VALIDATION_FAILED', 'Corps de requête invalide.', {
            hint: 'Attendu : { toStepId: string, expectedVersion: number, confirmOffNominal?: boolean }.',
            // `join('.')` rend une chaîne vide quand l'erreur porte sur la
            // racine (corps absent ou non-objet) : `??` ne suffirait pas.
            path: firstIssuePath(parsed.error.issues),
          }),
        ),
        400,
      );
    }

    const key = c.req.header('Idempotency-Key');
    if (key !== undefined) {
      const seen = await idempotency.lookup(key, rawBody);
      if (seen.kind === 'conflict') {
        return c.json(seen.body, 409);
      }
      if (seen.kind === 'replay') {
        // Rejeu : on renvoie la réponse d'origine sans réexécuter l'action.
        c.header('Idempotent-Replay', 'true');
        return c.json(seen.body as object, seen.status as 200);
      }
    }

    const unit = await deps.units.findByIdOrPublicCode(reference);
    if (unit === null) {
      return notFound(reference, c);
    }

    const graph = await deps.graphForVersion(unit.processVersionId);
    if (graph === null) {
      return c.json(
        errorBody(
          appError('NOT_FOUND', `Version de process « ${unit.processVersionId} » introuvable.`),
        ),
        404,
      );
    }

    const nowIso = deps.now();
    const outcome = advanceUnit({
      unit,
      graph,
      toStepId: parsed.data.toStepId,
      ...(parsed.data.confirmOffNominal !== undefined
        ? { confirmOffNominal: parsed.data.confirmOffNominal }
        : {}),
      nowIso,
    });

    if (!outcome.ok) {
      return c.json(errorBody(outcome.error), statusForError(outcome.error.code));
    }

    const event: DomainEvent = domainEventSchema.parse({
      id: deps.newId(),
      type: 'unit.step_advanced',
      occurredAt: nowIso,
      recordedAt: nowIso,
      source: 'manual',
      unitId: unit.id,
      payload: {
        fromStepId: outcome.value.fromStepId,
        toStepId: outcome.value.toStepId,
        toStage: outcome.value.step.stage,
        followedNominalPath: outcome.value.followedNominalPath,
      },
    });

    if (isDryRun(c.req.url)) {
      // Rien n'est écrit : on décrit exactement ce qui se passerait.
      return c.json({
        dryRun: true,
        data: {
          wouldBecome: outcome.value.unit,
          wouldRecord: event,
          followedNominalPath: outcome.value.followedNominalPath,
        },
      });
    }

    const saved = await deps.units.saveWithEvent(
      outcome.value.unit,
      event,
      parsed.data.expectedVersion,
    );
    if (!saved.ok) {
      return c.json(errorBody(saved.error), statusForError(saved.error.code));
    }

    // La réponse porte l'objet résultant **et** l'événement : pas de 204 qui
    // obligerait un agent à re-interroger (docs/22 §4.3, propriété 6).
    const body = { data: { unit: saved.value, event } };
    if (key !== undefined) {
      await idempotency.remember(key, rawBody, 200, body);
    }
    return c.json(body);
  });

  return app;
}

function notFound(reference: string, c: { json: JsonResponder }): Response {
  return c.json(
    errorBody(
      appError('NOT_FOUND', `Aucune unité ne correspond à « ${reference} ».`, {
        hint: "Utilise l'identifiant technique ou le code public (ex. SUB-2026-0042). GET /api/units?stage=substrate liste les unités d'un stade.",
        path: 'reference',
      }),
    ),
    404,
  );
}

type JsonResponder = (body: unknown, status?: number) => Response;

export type { CultureUnit };

/** Prépare les index nécessaires au fonctionnement de l'API. */
export async function ensureApiIndexes(connection: MongoConnection): Promise<void> {
  await new IdempotencyStore(connection.db).ensureIndexes();
}
