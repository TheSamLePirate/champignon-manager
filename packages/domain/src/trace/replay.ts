import { appError, type CultureUnit, type DomainEvent } from '@champi/contracts';
import { err, ok, type Result } from '../result.js';

/**
 * Rejeu du journal d'événements.
 *
 * ⚠️ Ce module répond à une critique précise du cadrage (`claude-critics.md`
 * P2-3) : la documentation promettait un historique « reconstructible depuis
 * les événements » alors que l'architecture est un **double-write** — on écrit
 * l'événement *et* on met à jour l'état courant. Rien ne garantissait que les
 * deux restent d'accord.
 *
 * Le mécanisme manquant, c'est celui-ci : rejouer le journal, reconstruire
 * l'état, et le **comparer** à l'état stocké. Utilisé par le test d'audit
 * (docs/22 §6.3) et par `GET /api/audit/verify` en production.
 */

/** Champs de l'unité reconstructibles par rejeu. Le reste est immuable ou dérivé. */
export type ReplayedUnitState = Pick<
  CultureUnit,
  'stage' | 'status' | 'currentStepId' | 'currentStepEnteredAt' | 'parentUnitId'
> & {
  readonly location: CultureUnit['location'];
  readonly substrateWeight: CultureUnit['substrateWeight'];
  readonly harvestIds: readonly string[];
  readonly eventCount: number;
};

/** Tout événement sauf une compensation — c'est-à-dire tout ce qui peut porter un état. */
type StateChangingEvent = Exclude<DomainEvent, { type: 'event.compensated' }>;

/** Événements neutralisés par une compensation. */
function compensatedEventIds(events: readonly DomainEvent[]): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const event of events) {
    if (event.type === 'event.compensated') {
      ids.add(event.payload.compensatesEventId);
    }
  }
  return ids;
}

/** Trie les événements par instant de survenue, à identifiant égal par ordre stable. */
export function sortEvents(events: readonly DomainEvent[]): DomainEvent[] {
  return [...events].sort((a, b) => {
    const byTime = Date.parse(a.occurredAt) - Date.parse(b.occurredAt);
    return byTime !== 0 ? byTime : a.id.localeCompare(b.id);
  });
}

/**
 * Reconstruit l'état d'une unité à partir de son seul journal.
 *
 * Le premier événement doit être `unit.created` : une unité sans acte de
 * naissance n'est pas reconstructible, et c'est un défaut d'intégrité qu'il
 * vaut mieux voir échouer bruyamment.
 */
export function replayUnit(events: readonly DomainEvent[]): Result<ReplayedUnitState> {
  const ordered = sortEvents(events);
  const compensated = compensatedEventIds(ordered);
  // Le prédicat de type retire `event.compensated` du type de `effective` :
  // le `switch` plus bas n'a donc aucun cas inatteignable à écrire, et reste
  // exhaustif au sens du compilateur.
  const effective = ordered.filter(
    (event): event is StateChangingEvent =>
      event.type !== 'event.compensated' && !compensated.has(event.id),
  );

  const birth = effective[0];
  if (birth?.type !== 'unit.created') {
    return err(
      appError(
        'VALIDATION_FAILED',
        "Le journal ne commence pas par un événement « unit.created » : l'unité n'est pas reconstructible.",
        {
          hint: 'Toute unité doit avoir un acte de naissance dans le journal. Vérifie que les événements fournis appartiennent bien à une seule unité.',
        },
      ),
    );
  }

  let state: ReplayedUnitState = {
    stage: birth.payload.stage,
    status: 'active',
    currentStepId: birth.payload.stepId,
    currentStepEnteredAt: birth.occurredAt,
    parentUnitId: birth.payload.parentUnitId,
    location: undefined,
    substrateWeight: birth.payload.substrateWeight,
    harvestIds: [],
    eventCount: effective.length,
  };

  for (const event of effective.slice(1)) {
    switch (event.type) {
      case 'unit.created':
        return err(
          appError(
            'VALIDATION_FAILED',
            'Le journal contient plusieurs événements « unit.created ».',
            { hint: 'Une unité ne naît qu’une fois. Vérifie le filtrage par unité.' },
          ),
        );
      case 'unit.step_advanced':
        state = {
          ...state,
          currentStepId: event.payload.toStepId,
          // Le stade suit l'étape : sans cette ligne, une unité passée en
          // fructification resterait « substrate » au rejeu, et l'audit
          // signalerait — à juste titre — une divergence.
          stage: event.payload.toStage,
          currentStepEnteredAt: event.occurredAt,
        };
        break;
      case 'unit.moved':
        state = { ...state, location: event.payload.to };
        break;
      case 'unit.status_changed':
        state = { ...state, status: event.payload.to };
        break;
      case 'harvest.recorded':
        state = { ...state, harvestIds: [...state.harvestIds, event.payload.harvestId] };
        break;
      case 'unit.observed':
      case 'unit.measured':
      case 'product.created':
        // Observations, mesures et produits enrichissent l'historique mais ne
        // modifient pas l'état courant de l'unité.
        break;
    }
  }

  return ok(state);
}

export interface ReplayDivergence {
  readonly field: string;
  readonly replayed: unknown;
  readonly stored: unknown;
}

/**
 * Compare l'état reconstruit par rejeu à l'état stocké.
 *
 * C'est l'assertion n°3 du test d'audit : « l'état reconstruit === l'état
 * courant en base ». Une liste vide signifie que le double-write a tenu.
 */
export function diffReplayAgainstStored(
  replayed: ReplayedUnitState,
  stored: CultureUnit,
): ReplayDivergence[] {
  const divergences: ReplayDivergence[] = [];
  const compare = (field: string, left: unknown, right: unknown): void => {
    if (JSON.stringify(left) !== JSON.stringify(right)) {
      divergences.push({ field, replayed: left, stored: right });
    }
  };

  compare('stage', replayed.stage, stored.stage);
  compare('status', replayed.status, stored.status);
  compare('currentStepId', replayed.currentStepId, stored.currentStepId);
  compare('currentStepEnteredAt', replayed.currentStepEnteredAt, stored.currentStepEnteredAt);
  compare('parentUnitId', replayed.parentUnitId, stored.parentUnitId);
  compare('location', replayed.location, stored.location);
  compare('substrateWeight', replayed.substrateWeight, stored.substrateWeight);

  return divergences;
}

export interface IntegrityIssue {
  readonly code: string;
  readonly message: string;
}

/**
 * Contrôles d'intégrité du journal, indépendants de l'état stocké.
 *
 * Couvre les assertions n°4 et n°5 du test d'audit : pas d'événement orphelin,
 * pas de compensation d'un événement absent, pas de doublon d'identifiant.
 */
export function checkJournalIntegrity(events: readonly DomainEvent[]): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const ids = new Set<string>();

  for (const event of events) {
    if (ids.has(event.id)) {
      issues.push({
        code: 'DUPLICATE_EVENT_ID',
        message: `L'événement « ${event.id} » apparaît plusieurs fois dans le journal.`,
      });
    }
    ids.add(event.id);
  }

  for (const event of events) {
    if (event.type === 'event.compensated' && !ids.has(event.payload.compensatesEventId)) {
      issues.push({
        code: 'ORPHAN_COMPENSATION',
        message: `La compensation « ${event.id} » cible un événement absent du journal : « ${event.payload.compensatesEventId} ».`,
      });
    }
    if (Date.parse(event.recordedAt) < Date.parse(event.occurredAt)) {
      issues.push({
        code: 'RECORDED_BEFORE_OCCURRED',
        message: `L'événement « ${event.id} » a été enregistré avant d'être survenu.`,
      });
    }
  }

  return issues;
}
