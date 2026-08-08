import type { CultureUnit, DomainEvent, Severity } from '@champi/contracts';
import { StageRail, STAGE_LABEL } from './StageRail.js';
import { formatAnciennete, libelleEtape } from '../lib/duree.js';

/**
 * Fiche d'unité.
 *
 * Ce que l'opérateur a sous les yeux, un sac devant lui, à travers un film de
 * condensation. L'écran répond dans cet ordre, parce que c'est l'ordre des
 * questions :
 *
 * 1. **quel objet ?** — l'en-tête reprend l'étiquette imprimée sur le sac :
 *    même code, même casse, même monospace. L'écran et l'objet se répondent ;
 * 2. **où en est-il ?** — la chaîne de propagation, puis l'étape courante et
 *    depuis quand ;
 * 3. **qu'est-ce que je fais ?** — les actions, en pleine largeur.
 *
 * L'historique vient en dernier : on le consulte, on ne le pilote pas.
 */

export interface NextStep {
  readonly id: string;
  readonly name: string;
}

export interface UnitSheetProps {
  readonly unit: CultureUnit;
  readonly events: readonly DomainEvent[];
  readonly nominalNext: readonly NextStep[];
  /** Horloge injectée : « depuis 12 jours » se calcule, il ne se devine pas. */
  readonly nowIso: string;
  readonly onAdvance: (stepId: string) => void;
  readonly onObserve: () => void;
  readonly onMeasure: () => void;
  readonly busy?: boolean;
  /** Formulaire ouvert sous les actions, le cas échéant. */
  readonly children?: React.ReactNode;
}

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

/**
 * Vocabulaire affiché.
 *
 * Le journal montrait jusqu'ici les identifiants du modèle — `temperature_c`,
 * `colonisation`, `low`. Ce sont des noms de champs, pas des mots que le
 * cultivateur emploie. L'écran parle sa langue ; le journal, lui, garde les
 * identifiants, qui restent la vérité stockée.
 */
type Metrique = 'temperature_c' | 'humidity_pct' | 'weight';

/** Exhaustif : la métrique est une énumération fermée, l'indexation est totale. */
const METRIQUE_LABEL: Readonly<Record<Metrique, { nom: string; unite: string }>> = {
  temperature_c: { nom: 'Température', unite: '°C' },
  humidity_pct: { nom: 'Humidité', unite: '%' },
  weight: { nom: 'Poids', unite: 'g' },
};

const OBSERVATION_LABEL: Readonly<Record<string, string>> = {
  contamination: 'Contamination',
  colonisation: 'Colonisation',
  odeur: 'Odeur',
  couleur_suspecte: 'Couleur suspecte',
  humidite_visuelle: 'Humidité visible',
  taille: 'Taille',
  couleur: 'Couleur',
  autre: 'Autre',
};

const GRAVITE_LABEL: Readonly<Record<Severity, string>> = {
  low: 'légère',
  medium: 'moyenne',
  critical: 'critique',
};

/** Date lisible : le jour et l'heure suffisent en chambre. */
function formatMoment(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (match === null) {
    return iso;
  }
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} à ${iso.slice(11, 16)}`;
}

/** Résumé d'un événement, en une ligne lisible. */
export function describeEvent(event: DomainEvent): string {
  switch (event.type) {
    case 'unit.step_advanced': {
      const trajet = `${libelleEtape(event.payload.fromStepId)} → ${libelleEtape(event.payload.toStepId)}`;
      return event.payload.followedNominalPath ? trajet : `${trajet} (écart au process)`;
    }
    case 'unit.observed': {
      // Le type d'observation reste une chaîne libre dans le contrat : un
      // événement peut en porter un que l'interface ne connaît pas. On l'affiche
      // alors tel quel plutôt que de le taire.
      const kind = OBSERVATION_LABEL[event.payload.kind] ?? event.payload.kind;
      return `${kind} — gravité ${GRAVITE_LABEL[event.payload.severity]}`;
    }
    case 'unit.measured': {
      const metrique = METRIQUE_LABEL[event.payload.metric];
      if (event.payload.quantity !== undefined) {
        return `${metrique.nom} : ${String(event.payload.quantity.value)} ${event.payload.quantity.unit}`;
      }
      // Une mesure sans valeur ne devrait pas exister — l'API la refuse. Si
      // l'histoire en contient une, on nomme la grandeur sans inventer de chiffre.
      return event.payload.numericValue === undefined
        ? metrique.nom
        : `${metrique.nom} : ${String(event.payload.numericValue)} ${metrique.unite}`;
    }
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
  nowIso,
  onAdvance,
  onObserve,
  onMeasure,
  busy = false,
  children,
}: UnitSheetProps): React.JSX.Element {
  const terminal = unit.status !== 'active' && unit.status !== 'archived';
  const anciennete = formatAnciennete(unit.currentStepEnteredAt, nowIso);

  return (
    <section className="unit" aria-labelledby="unit-title">
      {/*
       * L'en-tête reprend l'étiquette collée sur le sac : le code d'abord, en
       * monospace espacé, parce que c'est lui qu'on compare à l'objet en main.
       */}
      <header className="etiquette">
        <p className="etiquette__code">{unit.publicCode}</p>
        <h2 id="unit-title" className="etiquette__nom">
          {unit.name}
        </h2>
        <p className="etiquette__type">{STAGE_LABEL[unit.stage]}</p>
      </header>

      <StageRail stage={unit.stage} />

      <div className="etat">
        <p className="etat__etape">{libelleEtape(unit.currentStepId)}</p>
        <p className="etat__meta">
          <span className={`pastille pastille--${unit.status}`}>{STATUS_LABEL[unit.status]}</span>
          {anciennete !== null && <span className="etat__depuis">{anciennete}</span>}
        </p>
      </div>

      {terminal ? (
        <p className="unit__closed" role="status">
          Cette unité est {STATUS_LABEL[unit.status].toLowerCase()} : elle ne progresse plus. Son
          historique reste consultable.
        </p>
      ) : (
        <div className="unit__actions">
          {nominalNext.map((step) => (
            <button
              key={step.id}
              type="button"
              className="bouton--principal"
              disabled={busy}
              onClick={() => {
                onAdvance(step.id);
              }}
            >
              Passer à « {step.name} »
            </button>
          ))}
          <button type="button" className="bouton--secondaire" disabled={busy} onClick={onObserve}>
            Noter une observation
          </button>
          <button type="button" className="bouton--secondaire" disabled={busy} onClick={onMeasure}>
            Relever une mesure
          </button>
          {nominalNext.length === 0 && (
            <p className="unit__hint">
              Aucune suite prévue par le process. Toute étape reste atteignable, avec confirmation.
            </p>
          )}
        </div>
      )}

      {children}

      <h3 className="unit__titre-section">Historique</h3>
      {events.length === 0 ? (
        <p className="unit__hint">Aucun événement enregistré.</p>
      ) : (
        <ol className="unit__timeline" aria-label="Historique de l’unité">
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
