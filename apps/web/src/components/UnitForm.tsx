import { useEffect, useState } from 'react';
import type { CultureUnit, ProcessGraph, Stage } from '@champi/contracts';
import { STAGE_LABEL, STAGE_ORDER } from './StageRail.js';

/**
 * Création d'une unité.
 *
 * C'était le trou le plus béant de l'interface : **on ne pouvait pas démarrer
 * une culture** sans passer par le CLI. Tout le reste — scanner, avancer,
 * récolter — suppose qu'une unité existe.
 *
 * Deux règles du cadrage sont portées ici :
 *
 * - une unité peut **naître à n'importe quel stade** (`q7_2`) : on ne force
 *   personne à partir de la gélose pour créer un bloc de substrat ;
 * - l'étape de départ se choisit **dans le graphe de la version**, pas au
 *   clavier : une étape inventée serait refusée par le serveur, et l'opérateur
 *   n'a pas à deviner des identifiants.
 */

export interface UnitDraft {
  readonly name: string;
  readonly stage: Stage;
  readonly processVersionId: string;
  readonly stepId: string;
  readonly parentUnitId?: string;
  readonly substrateWeight?: { value: number; unit: 'kg'; kind: 'substrate' };
}

export interface ProcessChoice {
  readonly versionId: string;
  readonly label: string;
  readonly graph: ProcessGraph;
}

export interface UnitFormProps {
  readonly processes: readonly ProcessChoice[];
  /** Unité parente, quand la création part d'un repiquage ou d'un clonage. */
  readonly parent?: CultureUnit;
  readonly busy: boolean;
  readonly onSubmit: (draft: UnitDraft) => void;
  readonly onCancel: () => void;
}

export function UnitForm({
  processes,
  parent,
  busy,
  onSubmit,
  onCancel,
}: UnitFormProps): React.JSX.Element {
  const [name, setName] = useState(parent === undefined ? '' : `${parent.name} — suite`);
  const [stage, setStage] = useState<Stage>(parent?.stage ?? 'substrate');
  const [versionId, setVersionId] = useState(processes[0]?.versionId ?? '');
  const [stepId, setStepId] = useState('');
  const [poids, setPoids] = useState('');

  const choisi = processes.find((candidat) => candidat.versionId === versionId);
  const etapes = choisi?.graph.steps.filter((etape) => etape.stage === stage) ?? [];

  /*
   * L'étape doit rester cohérente avec le stade et le process choisis : dès que
   * l'un change, on repositionne sur la première étape valable plutôt que de
   * garder une sélection absente du graphe, que le serveur refuserait.
   *
   * Les dépendances sont `versionId` et `stage`, **pas** le tableau d'étapes :
   * celui-ci est recalculé à chaque rendu et sa seule identité relancerait
   * l'effet en boucle.
   */
  useEffect(() => {
    const disponibles =
      processes
        .find((candidat) => candidat.versionId === versionId)
        ?.graph.steps.filter((etape) => etape.stage === stage) ?? [];
    const premiere = disponibles[0]?.id ?? '';
    setStepId((actuelle) =>
      disponibles.some((etape) => etape.id === actuelle) ? actuelle : premiere,
    );
  }, [processes, versionId, stage]);

  const poidsNombre = Number(poids.replace(',', '.'));
  const poidsValide = poids.trim() === '' || Number.isFinite(poidsNombre);
  const complet = name.trim() !== '' && versionId !== '' && stepId !== '' && poidsValide;

  return (
    <form
      className="saisie"
      aria-labelledby="unite-titre"
      onSubmit={(event) => {
        event.preventDefault();
        if (!complet) {
          return;
        }
        onSubmit({
          name: name.trim(),
          stage,
          processVersionId: versionId,
          stepId,
          ...(parent === undefined ? {} : { parentUnitId: parent.id }),
          ...(poids.trim() === ''
            ? {}
            : {
                substrateWeight: {
                  value: poidsNombre,
                  unit: 'kg' as const,
                  kind: 'substrate' as const,
                },
              }),
        });
      }}
    >
      <h3 id="unite-titre" className="saisie__titre">
        {parent === undefined ? 'Nouvelle unité' : `Issue de ${parent.publicCode}`}
      </h3>

      {processes.length === 0 ? (
        <p className="champ__consigne" role="status">
          Aucun process publié. Va dans l’onglet Process pour en publier un — une unité est toujours
          épinglée à une version.
        </p>
      ) : (
        <>
          <div className="champ">
            <label htmlFor="unite-nom">Nom de l’unité</label>
            <input
              id="unite-nom"
              type="text"
              value={name}
              placeholder="Bloc pleurote 12"
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
          </div>

          <div className="champ">
            <label htmlFor="unite-stade">Stade</label>
            <select
              id="unite-stade"
              value={stage}
              onChange={(event) => {
                setStage(event.target.value as Stage);
              }}
            >
              {STAGE_ORDER.map((candidat) => (
                <option key={candidat} value={candidat}>
                  {STAGE_LABEL[candidat]}
                </option>
              ))}
            </select>
          </div>

          <div className="champ">
            <label htmlFor="unite-process">Process</label>
            <select
              id="unite-process"
              value={versionId}
              onChange={(event) => {
                setVersionId(event.target.value);
              }}
            >
              {processes.map((candidat) => (
                <option key={candidat.versionId} value={candidat.versionId}>
                  {candidat.label}
                </option>
              ))}
            </select>
          </div>

          <div className="champ">
            <label htmlFor="unite-etape">Étape de départ</label>
            <select
              id="unite-etape"
              value={stepId}
              onChange={(event) => {
                setStepId(event.target.value);
              }}
            >
              {etapes.map((etape) => (
                <option key={etape.id} value={etape.id}>
                  {etape.name}
                </option>
              ))}
            </select>
            {etapes.length === 0 && (
              <p className="champ__consigne" role="status">
                Ce process n’a aucune étape à ce stade. Choisis un autre stade, ou ajoute l’étape
                dans l’éditeur.
              </p>
            )}
          </div>

          <div className="champ">
            <label htmlFor="unite-poids">Poids de substrat en kg (facultatif)</label>
            <input
              id="unite-poids"
              type="text"
              inputMode="decimal"
              value={poids}
              placeholder="5"
              onChange={(event) => {
                setPoids(event.target.value);
              }}
            />
          </div>

          <div className="saisie__actions">
            <button type="submit" disabled={busy || !complet}>
              Créer l’unité
            </button>
            <button type="button" className="bouton--secondaire" onClick={onCancel}>
              Annuler
            </button>
          </div>
        </>
      )}
    </form>
  );
}
