import type { CultureUnit, DomainEvent } from '@champi/contracts';

/**
 * Fiche d'unité.
 *
 * Ce que l'opérateur regarde en chambre, une unité devant lui : où elle en est,
 * ce qu'elle a vécu, et ce qu'il peut faire ensuite. Les actions les plus
 * fréquentes — avancer, observer, peser — sont en haut ; le reste attend
 * (docs/22 §7.1).
 */

export interface NextStep {
  readonly id: string;
  readonly name: string;
}

export interface UnitSheetProps {
  readonly unit: CultureUnit;
  readonly events: readonly DomainEvent[];
  readonly nominalNext: readonly NextStep[];
  readonly onAdvance: (stepId: string) => void;
  readonly onObserve: () => void;
  readonly onMeasure: () => void;
  readonly busy?: boolean;
}

const STAGE_LABEL: Readonly<Record<CultureUnit['stage'], string>> = {
  gelose: 'Gélose',
  liquid_culture: 'Culture liquide',
  grain: 'Ballot de grain',
  substrate: 'Ballot de substrat',
  fruiting: 'Fructification',
};

const STATUS_LABEL: Readonly<Record<CultureUnit['status'], string>> = {
  active: 'En cours',
  contaminated: 'Contaminée',
  completed: 'Terminée',
  composted: 'Compostée',
  discarded: 'Rebutée',
  archived: 'Archivée',
};

const EVENT_LABEL: Readonly<Record<DomainEvent['type'], string>> = {
  'unit.created': 'Créée',
  'unit.step_advanced': 'Changement d’étape',
  'unit.moved': 'Déplacée',
  'unit.observed': 'Observation',
  'unit.measured': 'Mesure',
  'unit.status_changed': 'Changement de statut',
  'harvest.recorded': 'Récolte',
  'product.created': 'Produit final',
  'event.compensated': 'Correction',
};

/** Date lisible : le jour et l'heure suffisent en chambre. */
function formatMoment(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (match === null) {
    return iso;
  }
  const [, year = '', month = '', day = '', hour = '', minute = ''] = match;
  return `${day}/${month}/${year} à ${hour}:${minute}`;
}

/** Résumé d'un événement, en une ligne lisible. */
export function describeEvent(event: DomainEvent): string {
  switch (event.type) {
    case 'unit.step_advanced':
      return event.payload.followedNominalPath
        ? `${event.payload.fromStepId} → ${event.payload.toStepId}`
        : `${event.payload.fromStepId} → ${event.payload.toStepId} (écart au process)`;
    case 'unit.observed':
      return `${event.payload.kind} — gravité ${event.payload.severity}`;
    case 'unit.measured':
      return event.payload.quantity !== undefined
        ? `${event.payload.metric} : ${String(event.payload.quantity.value)} ${event.payload.quantity.unit}`
        : `${event.payload.metric} : ${String(event.payload.numericValue ?? '')}`;
    case 'unit.moved':
      return `vers ${event.payload.to.roomId}`;
    case 'unit.status_changed':
      return `${event.payload.from} → ${event.payload.to}`;
    case 'harvest.recorded':
      return `flush ${String(event.payload.flushNumber)} — ${String(event.payload.weight.value)} ${event.payload.weight.unit}`;
    case 'unit.created':
    case 'product.created':
    case 'event.compensated':
      return '';
  }
}

export function UnitSheet({
  unit,
  events,
  nominalNext,
  onAdvance,
  onObserve,
  onMeasure,
  busy = false,
}: UnitSheetProps): React.JSX.Element {
  const terminal = unit.status !== 'active' && unit.status !== 'archived';

  return (
    <section className="unit" aria-labelledby="unit-title">
      <h2 id="unit-title">{unit.name}</h2>

      <dl className="unit__facts">
        <div>
          <dt>Code</dt>
          <dd>{unit.publicCode}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{STAGE_LABEL[unit.stage]}</dd>
        </div>
        <div>
          <dt>Étape</dt>
          <dd>{unit.currentStepId}</dd>
        </div>
        <div>
          <dt>Statut</dt>
          <dd>{STATUS_LABEL[unit.status]}</dd>
        </div>
      </dl>

      {terminal ? (
        <p className="unit__closed" role="status">
          Cette unité est {STATUS_LABEL[unit.status].toLowerCase()} : elle ne progresse plus. Son
          historique reste consultable.
        </p>
      ) : (
        <div className="unit__actions">
          <h3>Actions</h3>
          {nominalNext.map((step) => (
            <button
              key={step.id}
              type="button"
              disabled={busy}
              onClick={() => {
                onAdvance(step.id);
              }}
            >
              Passer à « {step.name} »
            </button>
          ))}
          <button type="button" disabled={busy} onClick={onObserve}>
            Ajouter une observation
          </button>
          <button type="button" disabled={busy} onClick={onMeasure}>
            Ajouter une mesure
          </button>
          {nominalNext.length === 0 && (
            <p className="unit__hint">
              Aucune suite prévue par le process. Toute étape reste atteignable, avec confirmation.
            </p>
          )}
        </div>
      )}

      <h3>Historique</h3>
      {events.length === 0 ? (
        <p>Aucun événement enregistré.</p>
      ) : (
        <ol className="unit__timeline">
          {events.map((event) => {
            const detail = describeEvent(event);
            return (
              <li key={event.id}>
                <time dateTime={event.occurredAt}>{formatMoment(event.occurredAt)}</time>{' '}
                <strong>{EVENT_LABEL[event.type]}</strong>
                {detail !== '' && <span> — {detail}</span>}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
