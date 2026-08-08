import type { ProcessStep, Stage } from '@champi/contracts';

/**
 * Panneau de propriétés d'une étape.
 *
 * ⚠️ Ce panneau ne configure **ni actions ni observations par étape** : la
 * liste est globale et filtrée par pertinence de stade (`q12_2`). C'est
 * l'allègement qui a rendu l'éditeur tenable — ne pas le réintroduire.
 *
 * La durée cible sert **uniquement aux alarmes** : elle ne déclenche jamais un
 * passage d'étape (`q9_7_1`). Le libellé le dit à l'écran, parce que c'est
 * exactement l'attente qu'un formulaire de « durée » crée par défaut.
 */

const STAGES: readonly { value: Stage; label: string }[] = [
  { value: 'gelose', label: 'Gélose' },
  { value: 'liquid_culture', label: 'Culture liquide' },
  { value: 'grain', label: 'Ballot de grain' },
  { value: 'substrate', label: 'Ballot de substrat' },
  { value: 'fruiting', label: 'Fructification' },
];

export interface StepPropertiesProps {
  readonly step: ProcessStep;
  readonly onChange: (patch: Partial<Omit<ProcessStep, 'id'>>) => void;
  readonly onDelete: () => void;
  readonly onStartLink: () => void;
  readonly readOnly: boolean;
}

/**
 * Lit un nombre saisi ; rend `undefined` pour un champ vidé ou illisible.
 *
 * Exportée pour être testée directement : c'est une fonction pure, et son
 * comportement sur une saisie invalide décide si une consigne de culture est
 * modifiée ou laissée intacte.
 */
export function parseOptionalNumber(raw: string): number | undefined {
  const trimmed = raw.trim().replace(',', '.');
  if (trimmed === '') {
    return undefined;
  }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
}

export function StepProperties({
  step,
  onChange,
  onDelete,
  onStartLink,
  readOnly,
}: StepPropertiesProps): React.JSX.Element {
  return (
    <section className="properties" aria-labelledby="properties-title">
      <h3 id="properties-title">Étape « {step.name} »</h3>

      {readOnly && (
        <p className="properties__locked" role="status">
          Cette version est publiée : elle ne peut plus être modifiée. Crée une nouvelle version
          pour la faire évoluer — les unités déjà lancées resteront sur la leur.
        </p>
      )}

      {step.provenance === 'invented' && (
        <p className="properties__invented" role="status">
          Les valeurs de cette étape sont <strong>inventées</strong> : elles évitent un champ vide,
          elles n’ont aucune base agronomique. À ajuster.
        </p>
      )}

      <div className="properties__field">
        <label htmlFor="step-name">Nom</label>
        <input
          id="step-name"
          type="text"
          value={step.name}
          disabled={readOnly}
          onChange={(event) => {
            onChange({ name: event.target.value });
          }}
        />
      </div>

      <div className="properties__field">
        <label htmlFor="step-stage">Stade</label>
        <select
          id="step-stage"
          value={step.stage}
          disabled={readOnly}
          onChange={(event) => {
            onChange({ stage: event.target.value as Stage });
          }}
        >
          {STAGES.map((stage) => (
            <option key={stage.value} value={stage.value}>
              {stage.label}
            </option>
          ))}
        </select>
      </div>

      <div className="properties__field">
        <label htmlFor="step-duration">Durée cible (jours)</label>
        <input
          id="step-duration"
          type="number"
          min="0"
          step="0.5"
          value={step.targetDurationDays ?? ''}
          disabled={readOnly}
          aria-describedby="step-duration-help"
          onChange={(event) => {
            onChange({ targetDurationDays: parseOptionalNumber(event.target.value) });
          }}
        />
        <p id="step-duration-help" className="properties__help">
          Sert uniquement aux rappels. Le passage à l’étape suivante se décide à l’observation, par
          une personne — jamais à l’échéance.
        </p>
      </div>

      <fieldset className="properties__field" disabled={readOnly}>
        <legend>Conditions visées</legend>

        <label htmlFor="step-temp-min">Température min (°C)</label>
        <input
          id="step-temp-min"
          type="number"
          value={step.conditions.temperatureC?.min ?? ''}
          onChange={(event) => {
            // Une saisie illisible ne devient pas 0 : on ne touche à rien tant
            // que la valeur n'a pas de sens. Transformer « abc » en 0 °C serait
            // un mensonge silencieux sur une consigne de culture.
            const min = parseOptionalNumber(event.target.value);
            if (min === undefined) {
              return;
            }
            const max = step.conditions.temperatureC?.max ?? min;
            onChange({
              conditions: { ...step.conditions, temperatureC: { min, max: Math.max(min, max) } },
            });
          }}
        />

        <label htmlFor="step-temp-max">Température max (°C)</label>
        <input
          id="step-temp-max"
          type="number"
          value={step.conditions.temperatureC?.max ?? ''}
          onChange={(event) => {
            const max = parseOptionalNumber(event.target.value);
            if (max === undefined) {
              return;
            }
            const min = step.conditions.temperatureC?.min ?? max;
            onChange({
              conditions: { ...step.conditions, temperatureC: { min: Math.min(min, max), max } },
            });
          }}
        />

        <label htmlFor="step-humidity">Humidité visée (%)</label>
        <input
          id="step-humidity"
          type="number"
          min="0"
          max="100"
          value={step.conditions.humidityPct?.min ?? ''}
          onChange={(event) => {
            const value = parseOptionalNumber(event.target.value);
            if (value === undefined) {
              return;
            }
            onChange({
              conditions: { ...step.conditions, humidityPct: { min: value, max: value } },
            });
          }}
        />

        <label htmlFor="step-light">Lumière</label>
        <select
          id="step-light"
          value={step.conditions.light ?? 'indifferent'}
          onChange={(event) => {
            onChange({
              conditions: {
                ...step.conditions,
                light: event.target.value as 'darkness' | 'light' | 'indifferent',
              },
            });
          }}
        >
          <option value="indifferent">Indifférente</option>
          <option value="darkness">Obscurité</option>
          <option value="light">Lumière</option>
        </select>
      </fieldset>

      <div className="properties__field properties__field--inline">
        <input
          id="step-optional"
          type="checkbox"
          checked={step.optional}
          disabled={readOnly}
          onChange={(event) => {
            onChange({ optional: event.target.checked });
          }}
        />
        <label htmlFor="step-optional">Étape optionnelle</label>
      </div>

      <div className="properties__field properties__field--inline">
        <input
          id="step-alarm"
          type="checkbox"
          checked={step.alarms.enabled}
          disabled={readOnly}
          onChange={(event) => {
            onChange({
              alarms: event.target.checked
                ? { enabled: true, reminderDaysBefore: 1, criticalOverduePct: 50 }
                : { enabled: false },
            });
          }}
        />
        <label htmlFor="step-alarm">Alarmes de durée</label>
      </div>

      {!readOnly && (
        <div className="properties__actions">
          <button type="button" onClick={onStartLink}>
            Relier à une autre étape
          </button>
          <button type="button" className="danger" onClick={onDelete}>
            Supprimer l’étape
          </button>
        </div>
      )}
    </section>
  );
}
