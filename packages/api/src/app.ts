import { Hono } from 'hono';
import { z } from 'zod';
import {
  appError,
  domainEventSchema,
  listHint,
  stageSchema,
  type CultureUnit,
  type DomainEvent,
  type ProcessGraph,
} from '@champi/contracts';
import {
  advanceUnit,
  buildUnitLabel,
  checkJournalIntegrity,
  diffReplayAgainstStored,
  nominalNextSteps,
  replayUnit,
  validateTokenFormat,
} from '@champi/domain';
import type { MongoConnection, QrRepository, UnitRepository } from '@champi/persistence';
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
