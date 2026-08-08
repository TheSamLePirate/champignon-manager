import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ProcessGraph, ProcessStep } from '@champi/contracts';
import { ProcessEditor } from './ProcessEditor.js';
import { ProcessCanvas } from './ProcessCanvas.js';

function step(id: string, overrides: Partial<ProcessStep> = {}): ProcessStep {
  return {
    id,
    name: id,
    stage: 'substrate',
    conditions: {},
    alarms: { enabled: false },
    optional: false,
    provenance: 'cultivator',
    ...overrides,
  };
}

const graph: ProcessGraph = {
  steps: [
    step('inoculation', { name: 'Inoculation' }),
    step('incubation', { name: 'Incubation', targetDurationDays: 21 }),
  ],
  transitions: [{ from: 'inoculation', to: 'incubation' }],
};

function renderEditor(overrides: Partial<Parameters<typeof ProcessEditor>[0]> = {}) {
  const onChange = vi.fn();
  const onPublish = vi.fn();
  const result = render(
    <ProcessEditor
      graph={graph}
      readOnly={false}
      onChange={onChange}
      onPublish={onPublish}
      {...overrides}
    />,
  );
  return { ...result, onChange, onPublish };
}

describe('ProcessCanvas', () => {
  it('rend une étape par nœud, atteignable au clavier', () => {
    render(<ProcessCanvas graph={graph} selectedStepId={null} onSelectStep={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Inoculation/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Incubation/ })).toBeInTheDocument();
  });

  it('décrit le graphe pour les lecteurs d’écran', () => {
    render(<ProcessCanvas graph={graph} selectedStepId={null} onSelectStep={vi.fn()} />);
    expect(screen.getByRole('img', { name: /2 étapes/ })).toBeInTheDocument();
  });

  it('annonce un canvas vide plutôt que de ne rien montrer', () => {
    render(
      <ProcessCanvas
        graph={{ steps: [], transitions: [] }}
        selectedStepId={null}
        onSelectStep={vi.fn()}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('aucune étape');
  });

  it('marque l’étape sélectionnée', () => {
    render(<ProcessCanvas graph={graph} selectedStepId="incubation" onSelectStep={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Incubation/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('affiche la durée, ou son absence', () => {
    render(<ProcessCanvas graph={graph} selectedStepId={null} onSelectStep={vi.fn()} />);
    expect(screen.getByText('21 j')).toBeInTheDocument();
    expect(screen.getByText('sans durée')).toBeInTheDocument();
  });

  it('signale une étape optionnelle', () => {
    const withOptional: ProcessGraph = {
      steps: [step('flush_3', { name: 'Flush 3', optional: true })],
      transitions: [],
    };
    render(<ProcessCanvas graph={withOptional} selectedStepId={null} onSelectStep={vi.fn()} />);
    expect(screen.getByText(/optionnelle/)).toBeInTheDocument();
  });

  /**
   * Les valeurs inventées n'engagent rien : le dire à l'écran évite qu'elles
   * soient prises pour des recommandations agronomiques.
   */
  it('signale les valeurs inventées sur le nœud', () => {
    const invented: ProcessGraph = {
      steps: [step('gelose', { name: 'Gélose', provenance: 'invented' })],
      transitions: [],
    };
    render(<ProcessCanvas graph={invented} selectedStepId={null} onSelectStep={vi.fn()} />);
    expect(screen.getByText('valeurs inventées')).toBeInTheDocument();
  });

  it('prévient au clic sur un nœud', async () => {
    const onSelectStep = vi.fn();
    render(<ProcessCanvas graph={graph} selectedStepId={null} onSelectStep={onSelectStep} />);
    await userEvent.click(screen.getByRole('button', { name: /Incubation/ }));
    expect(onSelectStep).toHaveBeenCalledWith('incubation');
  });

  it('affiche le libellé d’une arête', () => {
    const labelled: ProcessGraph = {
      ...graph,
      transitions: [{ from: 'inoculation', to: 'incubation', label: 'sans flush 3' }],
    };
    render(<ProcessCanvas graph={labelled} selectedStepId={null} onSelectStep={vi.fn()} />);
    expect(screen.getByText('sans flush 3')).toBeInTheDocument();
  });
});

describe('ajout d’étape', () => {
  it('ajoute une étape au stade choisi', async () => {
    const { onChange } = renderEditor();

    await userEvent.type(screen.getByLabelText('Nouvelle étape'), 'Fructification');
    await userEvent.selectOptions(screen.getByLabelText('Stade de la nouvelle étape'), 'fruiting');
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

    const next = onChange.mock.calls[0]?.[0] as ProcessGraph;
    expect(next.steps).toHaveLength(3);
    expect(next.steps[2]).toMatchObject({ id: 'fructification', stage: 'fruiting' });
  });

  it('n’ajoute rien sans nom', () => {
    renderEditor();
    expect(screen.getByRole('button', { name: 'Ajouter' })).toBeDisabled();
  });

  /**
   * Le bouton est désactivé, mais un formulaire peut aussi être soumis
   * autrement : on vérifie que le garde-fou tient même dans ce cas.
   */
  it('ignore une soumission dont le nom n’est fait que d’espaces', async () => {
    const { onChange, container } = renderEditor();
    await userEvent.type(screen.getByLabelText('Nouvelle étape'), '   ');

    const form = container.querySelector('form.editor__add');
    expect(form).not.toBeNull();
    if (form !== null) {
      fireEvent.submit(form);
    }
    expect(onChange).not.toHaveBeenCalled();
  });

  it('vide le champ après ajout', async () => {
    renderEditor();
    const input = screen.getByLabelText('Nouvelle étape');
    await userEvent.type(input, 'Fructification{Enter}');
    expect(input).toHaveValue('');
  });
});

describe('sélection et propriétés', () => {
  it('ouvre le panneau au clic sur un nœud', async () => {
    renderEditor();
    await userEvent.click(screen.getByRole('button', { name: /Incubation/ }));
    expect(screen.getByRole('heading', { name: /Étape « Incubation »/ })).toBeInTheDocument();
  });

  it('modifie le nom sans changer l’identifiant', async () => {
    const { onChange } = renderEditor();
    await userEvent.click(screen.getByRole('button', { name: /Incubation/ }));
    await userEvent.type(screen.getByLabelText('Nom'), '!');

    const next = onChange.mock.calls[0]?.[0] as ProcessGraph;
    expect(next.steps[1]?.id).toBe('incubation');
    expect(next.steps[1]?.name).toBe('Incubation!');
  });

  it('modifie la durée cible', async () => {
    const { onChange } = renderEditor();
    await userEvent.click(screen.getByRole('button', { name: /Incubation/ }));
    await userEvent.clear(screen.getByLabelText(/Durée cible/));

    const next = onChange.mock.calls.at(-1)?.[0] as ProcessGraph;
    expect(next.steps[1]?.targetDurationDays).toBeUndefined();
  });

  /**
   * La durée ne déclenche rien : le formulaire doit le dire, parce que c'est
   * exactement l'attente qu'un champ « durée » crée par défaut.
   */
  it('rappelle que la durée ne déclenche aucun passage', async () => {
    renderEditor();
    await userEvent.click(screen.getByRole('button', { name: /Incubation/ }));
    expect(screen.getByText(/se décide à l’observation/)).toBeInTheDocument();
  });

  it('bascule le caractère optionnel', async () => {
    const { onChange } = renderEditor();
    await userEvent.click(screen.getByRole('button', { name: /Incubation/ }));
    await userEvent.click(screen.getByLabelText('Étape optionnelle'));

    const next = onChange.mock.calls[0]?.[0] as ProcessGraph;
    expect(next.steps[1]?.optional).toBe(true);
  });

  it('active les alarmes avec des seuils par défaut', async () => {
    const { onChange } = renderEditor();
    await userEvent.click(screen.getByRole('button', { name: /Incubation/ }));
    await userEvent.click(screen.getByLabelText('Alarmes de durée'));

    const next = onChange.mock.calls[0]?.[0] as ProcessGraph;
    expect(next.steps[1]?.alarms).toEqual({
      enabled: true,
      reminderDaysBefore: 1,
      criticalOverduePct: 50,
    });
  });

  it('désactive les alarmes', async () => {
    const withAlarm: ProcessGraph = {
      ...graph,
      steps: [
        graph.steps[0]!,
        step('incubation', { name: 'Incubation', alarms: { enabled: true } }),
      ],
    };
    const { onChange } = renderEditor({ graph: withAlarm });
    await userEvent.click(screen.getByRole('button', { name: /Incubation/ }));
    await userEvent.click(screen.getByLabelText('Alarmes de durée'));

    const next = onChange.mock.calls[0]?.[0] as ProcessGraph;
    expect(next.steps[1]?.alarms).toEqual({ enabled: false });
  });

  it('change le stade', async () => {
    const { onChange } = renderEditor();
    await userEvent.click(screen.getByRole('button', { name: /Incubation/ }));
    await userEvent.selectOptions(screen.getByLabelText('Stade'), 'fruiting');

    const next = onChange.mock.calls[0]?.[0] as ProcessGraph;
    expect(next.steps[1]?.stage).toBe('fruiting');
  });

  it('modifie les conditions de température', async () => {
    const { onChange } = renderEditor();
    await userEvent.click(screen.getByRole('button', { name: /Incubation/ }));
    await userEvent.type(screen.getByLabelText(/Température min/), '24');

    const next = onChange.mock.calls.at(-1)?.[0] as ProcessGraph;
    expect(next.steps[1]?.conditions.temperatureC).toBeDefined();
  });

  it('modifie la température maximale', async () => {
    const { onChange } = renderEditor();
    await userEvent.click(screen.getByRole('button', { name: /Incubation/ }));
    await userEvent.type(screen.getByLabelText(/Température max/), '8');

    const next = onChange.mock.calls.at(-1)?.[0] as ProcessGraph;
    expect(next.steps[1]?.conditions.temperatureC).toEqual({ min: 8, max: 8 });
  });

  it('conserve la borne haute quand on ne change que la basse', async () => {
    const warm: ProcessGraph = {
      ...graph,
      steps: [
        step('inoculation', { name: 'Inoculation' }),
        step('incubation', {
          name: 'Incubation',
          conditions: { temperatureC: { min: 18, max: 24 } },
        }),
      ],
    };
    const { onChange } = renderEditor({ graph: warm });
    await userEvent.click(screen.getByRole('button', { name: /Incubation/ }));
    fireEvent.change(screen.getByLabelText(/Température min/), { target: { value: '20' } });

    const next = onChange.mock.calls.at(-1)?.[0] as ProcessGraph;
    expect(next.steps[1]?.conditions.temperatureC).toEqual({ min: 20, max: 24 });
  });

  /** Une fourchette inversée n'a pas de sens : la borne basse suit. */
  it('garde min ≤ max quand la borne haute passe sous la basse', async () => {
    const warm: ProcessGraph = {
      ...graph,
      steps: [
        step('inoculation', { name: 'Inoculation' }),
        step('incubation', {
          name: 'Incubation',
          conditions: { temperatureC: { min: 20, max: 24 } },
        }),
      ],
    };
    const { onChange } = renderEditor({ graph: warm });
    await userEvent.click(screen.getByRole('button', { name: /Incubation/ }));

    // `fireEvent.change` pose la valeur entière : sur un champ contrôlé,
    // `type` la concaténerait à celle déjà affichée.
    fireEvent.change(screen.getByLabelText(/Température max/), { target: { value: '8' } });

    const next = onChange.mock.calls.at(-1)?.[0] as ProcessGraph;
    expect(next.steps[1]?.conditions.temperatureC).toEqual({ min: 8, max: 8 });
  });

  /**
   * Vider un champ ne remet pas la consigne à zéro : transformer un champ vide
   * en 0 °C serait un mensonge silencieux sur une consigne de culture.
   */
  it.each([/Température min/, /Température max/, /Humidité visée/])(
    'ignore un champ « %s » vidé plutôt que de le ramener à zéro',
    async (label) => {
      const withValues: ProcessGraph = {
        ...graph,
        steps: [
          step('inoculation', { name: 'Inoculation' }),
          step('incubation', {
            name: 'Incubation',
            conditions: { temperatureC: { min: 18, max: 24 }, humidityPct: { min: 90, max: 90 } },
          }),
        ],
      };
      const { onChange } = renderEditor({ graph: withValues });
      await userEvent.click(screen.getByRole('button', { name: /Incubation/ }));
      await userEvent.clear(screen.getByLabelText(label));
      expect(onChange).not.toHaveBeenCalled();
    },
  );

  it('affiche les conditions déjà enregistrées', async () => {
    const warm: ProcessGraph = {
      ...graph,
      steps: [
        step('inoculation', { name: 'Inoculation' }),
        step('incubation', {
          name: 'Incubation',
          conditions: { temperatureC: { min: 18, max: 24 }, humidityPct: { min: 90, max: 90 } },
        }),
      ],
    };
    renderEditor({ graph: warm });
    await userEvent.click(screen.getByRole('button', { name: /Incubation/ }));

    expect(screen.getByLabelText(/Température min/)).toHaveValue(18);
    expect(screen.getByLabelText(/Température max/)).toHaveValue(24);
    expect(screen.getByLabelText(/Humidité visée/)).toHaveValue(90);
  });

  it('modifie l’humidité visée', async () => {
    const { onChange } = renderEditor();
    await userEvent.click(screen.getByRole('button', { name: /Incubation/ }));
    // Le champ est contrôlé par le parent, qui ne se met pas à jour ici : on
    // saisit un seul caractère pour que l'assertion reste lisible.
    await userEvent.type(screen.getByLabelText(/Humidité visée/), '9');

    const next = onChange.mock.calls.at(-1)?.[0] as ProcessGraph;
    expect(next.steps[1]?.conditions.humidityPct).toEqual({ min: 9, max: 9 });
  });

  it('modifie le régime de lumière', async () => {
    const { onChange } = renderEditor();
    await userEvent.click(screen.getByRole('button', { name: /Incubation/ }));
    await userEvent.selectOptions(screen.getByLabelText('Lumière'), 'darkness');

    const next = onChange.mock.calls[0]?.[0] as ProcessGraph;
    expect(next.steps[1]?.conditions.light).toBe('darkness');
  });

  it('supprime une étape et referme le panneau', async () => {
    const { onChange } = renderEditor();
    await userEvent.click(screen.getByRole('button', { name: /Incubation/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer l’étape' }));

    const next = onChange.mock.calls[0]?.[0] as ProcessGraph;
    expect(next.steps).toHaveLength(1);
    expect(next.transitions).toEqual([]);
    expect(screen.queryByRole('heading', { name: /Étape «/ })).toBeNull();
  });

  it('signale une étape aux valeurs inventées', async () => {
    const invented: ProcessGraph = {
      steps: [step('gelose', { name: 'Gélose', provenance: 'invented' })],
      transitions: [],
    };
    renderEditor({ graph: invented });
    await userEvent.click(screen.getByRole('button', { name: /Gélose/ }));
    expect(screen.getByText(/aucune base agronomique/)).toBeInTheDocument();
  });
});

/**
 * Relier se fait en deux gestes plutôt qu'en glisser-déposer : nettement plus
 * fiable avec des gants humides sur un écran couvert de condensation.
 */
describe('liens entre étapes', () => {
  it('relie deux étapes en deux clics', async () => {
    const three: ProcessGraph = {
      steps: [...graph.steps, step('fructification', { name: 'Fructification' })],
      transitions: graph.transitions,
    };
    const { onChange } = renderEditor({ graph: three });

    await userEvent.click(screen.getByRole('button', { name: /Incubation/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Relier à une autre étape' }));
    await userEvent.click(screen.getByRole('button', { name: /Fructification/ }));

    const next = onChange.mock.calls[0]?.[0] as ProcessGraph;
    expect(next.transitions).toContainEqual({ from: 'incubation', to: 'fructification' });
  });

  it('annonce le lien en cours', async () => {
    renderEditor();
    await userEvent.click(screen.getByRole('button', { name: /Inoculation/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Relier à une autre étape' }));
    expect(screen.getByText(/Clique l’étape à relier/)).toBeInTheDocument();
  });

  it('annule un lien en cours', async () => {
    const { onChange } = renderEditor();
    await userEvent.click(screen.getByRole('button', { name: /Inoculation/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Relier à une autre étape' }));
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(screen.queryByText(/Clique l’étape à relier/)).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('cliquer la même étape annule le lien au lieu de boucler', async () => {
    const { onChange } = renderEditor();
    await userEvent.click(screen.getByRole('button', { name: /Inoculation/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Relier à une autre étape' }));
    await userEvent.click(screen.getByRole('button', { name: /Inoculation/ }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('liste les suites nominales et permet de les retirer', async () => {
    const { onChange } = renderEditor();
    await userEvent.click(screen.getByRole('button', { name: /Inoculation/ }));

    expect(screen.getByRole('heading', { name: 'Suites nominales' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retirer le lien' }));

    const next = onChange.mock.calls[0]?.[0] as ProcessGraph;
    expect(next.transitions).toEqual([]);
  });

  /** Un lien vers une étape disparue s'affiche par son identifiant, pas vide. */
  it('affiche l’identifiant quand l’étape cible est introuvable', async () => {
    const dangling: ProcessGraph = {
      steps: [step('inoculation', { name: 'Inoculation' })],
      transitions: [{ from: 'inoculation', to: 'fantome' }],
    };
    const { container } = renderEditor({ graph: dangling });
    await userEvent.click(screen.getByRole('button', { name: /Inoculation/ }));

    // On cible la liste des suites, pas le message d'erreur du graphe.
    const links = container.querySelector('.editor__links');
    expect(links?.textContent).toContain('fantome');
  });

  it('ne montre pas de suites pour une étape terminale', async () => {
    renderEditor();
    await userEvent.click(screen.getByRole('button', { name: /Incubation/ }));
    expect(screen.queryByRole('heading', { name: 'Suites nominales' })).toBeNull();
  });
});

describe('validation et publication', () => {
  it('publie un graphe valide', async () => {
    const { onPublish } = renderEditor();
    await userEvent.click(screen.getByRole('button', { name: 'Publier cette version' }));
    expect(onPublish).toHaveBeenCalledOnce();
  });

  /** Le rappel le plus contre-intuitif du produit, placé là où il compte. */
  it('rappelle que les unités en cours ne changent pas de version', () => {
    renderEditor();
    expect(screen.getByText(/ne changent pas de version/)).toBeInTheDocument();
  });

  it('bloque la publication d’un graphe en erreur, en listant les problèmes', () => {
    renderEditor({ graph: { steps: [], transitions: [] } });
    expect(screen.getByRole('alert')).toHaveTextContent('aucune étape');
    expect(screen.getByRole('button', { name: 'Publier cette version' })).toBeDisabled();
  });

  it('bloque la publication sur une arête pendante', () => {
    renderEditor({
      graph: { steps: [step('a')], transitions: [{ from: 'a', to: 'fantome' }] },
    });
    expect(screen.getByRole('alert')).toHaveTextContent('fantome');
  });

  it('affiche un avertissement portant sur le graphe entier', () => {
    renderEditor({
      graph: {
        steps: [step('a'), step('b'), step('seule')],
        transitions: [{ from: 'a', to: 'b' }],
      },
    });
    expect(screen.getByRole('heading', { name: 'Remarques' })).toBeInTheDocument();
  });

  /** Un avertissement n'empêche pas de publier : plusieurs entrées sont légitimes. */
  it('n’empêche pas de publier sur un simple avertissement', () => {
    renderEditor({
      graph: {
        steps: [step('a'), step('b'), step('orpheline')],
        transitions: [{ from: 'a', to: 'b' }],
      },
    });
    expect(screen.getByRole('status')).toHaveTextContent('orpheline');
    expect(screen.getByRole('button', { name: 'Publier cette version' })).toBeEnabled();
  });

  it('désactive la publication pendant un envoi', () => {
    renderEditor({ busy: true });
    expect(screen.getByRole('button', { name: 'Publier cette version' })).toBeDisabled();
  });
});

describe('version publiée', () => {
  it('passe en lecture seule', () => {
    renderEditor({ readOnly: true });
    expect(screen.getByRole('status')).toHaveTextContent('lecture seule');
    expect(screen.queryByLabelText('Nouvelle étape')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Publier cette version' })).toBeNull();
  });

  it('désactive les champs de propriétés', async () => {
    renderEditor({ readOnly: true });
    await userEvent.click(screen.getByRole('button', { name: /Incubation/ }));

    expect(screen.getByLabelText('Nom')).toBeDisabled();
    expect(screen.getByText(/Crée une nouvelle version/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Supprimer l’étape' })).toBeNull();
  });
});

describe('comparaison de versions', () => {
  it('résume les différences avec la version publiée', () => {
    const modified: ProcessGraph = {
      steps: [...graph.steps, step('fructification', { name: 'Fructification' })],
      transitions: graph.transitions,
    };
    renderEditor({ graph: modified, publishedGraph: graph });
    expect(screen.getByText(/1 étape ajoutée/)).toBeInTheDocument();
  });

  it('annonce l’absence de différence', () => {
    renderEditor({ publishedGraph: graph });
    expect(screen.getByText('Aucune différence avec la version publiée.')).toBeInTheDocument();
  });

  it('ne montre rien sans version de référence', () => {
    renderEditor();
    expect(screen.queryByText(/différence avec la version publiée/)).toBeNull();
  });
});
