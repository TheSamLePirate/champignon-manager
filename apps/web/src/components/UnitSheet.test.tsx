import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CultureUnit, DomainEvent } from '@champi/contracts';
import { describeEvent, UnitSheet } from './UnitSheet.js';

const unit: CultureUnit = {
  id: 'u-1',
  publicCode: 'SUB-2026-0042',
  name: 'Pleurote bloc 1',
  stage: 'substrate',
  status: 'active',
  parentUnitId: null,
  lineageRelation: 'origin',
  generation: 0,
  processVersionId: 'pv-1',
  currentStepId: 'incubation',
  currentStepEnteredAt: '2026-08-02T08:00:00.000Z',
  createdAt: '2026-08-01T08:00:00.000Z',
  updatedAt: '2026-08-02T08:00:00.000Z',
  version: 1,
};

const envelope = {
  occurredAt: '2026-08-02T14:30:00.000Z',
  recordedAt: '2026-08-02T14:30:00.000Z',
  source: 'manual',
  unitId: 'u-1',
} as const;

/** Horloge fixe : l'ancienneté affichée ne doit pas dépendre du jour du test. */
const MAINTENANT = '2026-08-13T09:00:00.000Z';

const created: DomainEvent = {
  ...envelope,
  id: 'e-1',
  type: 'unit.created',
  occurredAt: '2026-08-01T08:00:00.000Z',
  payload: {
    stage: 'substrate',
    processVersionId: 'pv-1',
    stepId: 'inoculation',
    parentUnitId: null,
  },
};

function renderSheet(overrides: Partial<Parameters<typeof UnitSheet>[0]> = {}) {
  return render(
    <UnitSheet
      unit={unit}
      events={[created]}
      nominalNext={[{ id: 'fructification', name: 'Fructification' }]}
      nowIso={MAINTENANT}
      onAdvance={vi.fn()}
      onObserve={vi.fn()}
      onMeasure={vi.fn()}
      {...overrides}
    />,
  );
}

describe('identité de l’unité', () => {
  it('affiche les quatre faits que l’opérateur cherche', () => {
    renderSheet();
    expect(screen.getByRole('heading', { name: 'Pleurote bloc 1' })).toBeInTheDocument();
    expect(screen.getByText('SUB-2026-0042')).toBeInTheDocument();
    expect(screen.getByText('Ballot de substrat')).toBeInTheDocument();
    // L'étape s'affiche en clair, jamais sous sa forme d'identifiant.
    expect(screen.getByText('Incubation')).toBeInTheDocument();
    expect(screen.getByText('En cours')).toBeInTheDocument();
    // Et l'ancienneté, parce que « depuis quand » vaut autant que « où ».
    expect(screen.getByText('depuis 11 jours')).toBeInTheDocument();
  });

  it('traduit chaque stade dans le vocabulaire du cultivateur', () => {
    const labels: [CultureUnit['stage'], string][] = [
      ['gelose', 'Gélose'],
      ['liquid_culture', 'Culture liquide'],
      ['grain', 'Ballot de grain'],
      ['substrate', 'Ballot de substrat'],
      ['fruiting', 'Fructification'],
    ];
    for (const [stage, label] of labels) {
      const { unmount } = renderSheet({ unit: { ...unit, stage } });
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
      unmount();
    }
  });
});

describe('actions', () => {
  it('propose le passage à l’étape nominale suivante', async () => {
    const onAdvance = vi.fn();
    renderSheet({ onAdvance });

    await userEvent.click(screen.getByRole('button', { name: /Passer à « Fructification »/ }));
    expect(onAdvance).toHaveBeenCalledWith('fructification');
  });

  it('propose plusieurs suites en cas de bifurcation', () => {
    renderSheet({
      nominalNext: [
        { id: 'flush_3', name: 'Flush 3' },
        { id: 'fin_de_cycle', name: 'Fin de cycle' },
      ],
    });
    expect(screen.getByRole('button', { name: /Flush 3/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fin de cycle/ })).toBeInTheDocument();
  });

  /**
   * Le graphe conseille, il n'interdit pas : sans suite nominale, on le dit
   * plutôt que de laisser l'opérateur croire qu'il est bloqué.
   */
  it('rappelle que tout reste atteignable quand aucune suite n’est prévue', () => {
    renderSheet({ nominalNext: [] });
    expect(screen.getByText(/Toute étape reste atteignable/)).toBeInTheDocument();
  });

  it('déclenche l’observation et la mesure', async () => {
    const onObserve = vi.fn();
    const onMeasure = vi.fn();
    renderSheet({ onObserve, onMeasure });

    await userEvent.click(screen.getByRole('button', { name: 'Noter une observation' }));
    await userEvent.click(screen.getByRole('button', { name: 'Relever une mesure' }));
    expect(onObserve).toHaveBeenCalledOnce();
    expect(onMeasure).toHaveBeenCalledOnce();
  });

  it('désactive les actions pendant un envoi', () => {
    renderSheet({ busy: true });
    expect(screen.getByRole('button', { name: 'Noter une observation' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Passer à/ })).toBeDisabled();
  });

  it('laisse une unité archivée agir — l’archivage est réversible', () => {
    renderSheet({ unit: { ...unit, status: 'archived' } });
    expect(screen.getByRole('button', { name: /Passer à/ })).toBeInTheDocument();
  });

  it.each<[CultureUnit['status'], string]>([
    ['contaminated', 'contaminée'],
    ['completed', 'terminée'],
    ['composted', 'compostée'],
    ['discarded', 'rebutée'],
  ])('retire les actions d’une unité « %s » sans masquer son historique', (status, label) => {
    renderSheet({ unit: { ...unit, status } });

    expect(screen.queryByRole('button', { name: /Passer à/ })).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent(label);
    expect(screen.getByRole('status')).toHaveTextContent('historique reste consultable');
    expect(screen.getByRole('heading', { name: 'Historique' })).toBeInTheDocument();
  });
});

describe('historique', () => {
  it('annonce un historique vide plutôt que de ne rien montrer', () => {
    renderSheet({ events: [] });
    expect(screen.getByText('Aucun événement enregistré.')).toBeInTheDocument();
  });

  it('affiche la date au format jour/mois/année et heure', () => {
    renderSheet();
    expect(screen.getByText('01/08/2026 à 08:00')).toBeInTheDocument();
  });

  it('liste les événements dans l’ordre reçu', () => {
    const advanced: DomainEvent = {
      ...envelope,
      id: 'e-2',
      type: 'unit.step_advanced',
      payload: {
        fromStepId: 'inoculation',
        toStepId: 'incubation',
        toStage: 'substrate',
        followedNominalPath: true,
      },
    };
    renderSheet({ events: [created, advanced] });

    // On cible la liste de l'historique : la chaîne de propagation est
    // elle aussi une liste, et elle vient avant dans le document.
    const items = within(screen.getByRole('list', { name: /Historique/ })).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Créée');
    expect(items[1]).toHaveTextContent('Changement d’étape');
  });

  it('rend une date illisible telle quelle plutôt que de mentir', () => {
    renderSheet({ events: [{ ...created, occurredAt: 'hier' }] });
    expect(screen.getByText('hier')).toBeInTheDocument();
  });
});

describe('describeEvent', () => {
  it('résume un avancement nominal', () => {
    const event: DomainEvent = {
      ...envelope,
      id: 'e',
      type: 'unit.step_advanced',
      payload: {
        fromStepId: 'inoculation',
        toStepId: 'incubation',
        toStage: 'substrate',
        followedNominalPath: true,
      },
    };
    expect(describeEvent(event)).toBe('Inoculation → Incubation');
  });

  /** L'écart au process est enregistré : il doit aussi se voir. */
  it('signale un écart au process', () => {
    const event: DomainEvent = {
      ...envelope,
      id: 'e',
      type: 'unit.step_advanced',
      payload: {
        fromStepId: 'inoculation',
        toStepId: 'flush_1',
        toStage: 'fruiting',
        followedNominalPath: false,
      },
    };
    expect(describeEvent(event)).toContain('écart au process');
  });

  it('résume une observation avec sa gravité', () => {
    const event: DomainEvent = {
      ...envelope,
      id: 'e',
      type: 'unit.observed',
      payload: { kind: 'contamination', severity: 'critical', photoId: 'f-1' },
    };
    expect(describeEvent(event)).toBe('Contamination — gravité critique');
  });

  it('résume une mesure numérique', () => {
    const event: DomainEvent = {
      ...envelope,
      id: 'e',
      type: 'unit.measured',
      payload: { metric: 'temperature_c', numericValue: 24 },
    };
    expect(describeEvent(event)).toBe('Température : 24 °C');
  });

  it('résume une mesure de poids avec son unité', () => {
    const event: DomainEvent = {
      ...envelope,
      id: 'e',
      type: 'unit.measured',
      payload: { metric: 'weight', quantity: { value: 4.8, unit: 'kg', kind: 'substrate' } },
    };
    expect(describeEvent(event)).toBe('Poids : 4.8 kg');
  });

  it('tolère une mesure sans valeur', () => {
    const event: DomainEvent = {
      ...envelope,
      id: 'e',
      type: 'unit.measured',
      payload: { metric: 'humidity_pct' },
    };
    expect(describeEvent(event)).toBe('Humidité');
  });

  /** Le contrat laisse le type d'observation libre : l'inconnu s'affiche tel quel. */
  it('affiche tel quel un type d’observation qu’il ne connaît pas', () => {
    const event: DomainEvent = {
      ...envelope,
      id: 'e',
      type: 'unit.observed',
      payload: { kind: 'mycogone', severity: 'medium' },
    };
    expect(describeEvent(event)).toBe('mycogone — gravité moyenne');
  });

  it('résume un déplacement', () => {
    const event: DomainEvent = {
      ...envelope,
      id: 'e',
      type: 'unit.moved',
      payload: { to: { roomId: 'chambre-1', shelf: 'A' } },
    };
    expect(describeEvent(event)).toBe('vers chambre-1');
  });

  it('résume un changement de statut', () => {
    const event: DomainEvent = {
      ...envelope,
      id: 'e',
      type: 'unit.status_changed',
      payload: { from: 'active', to: 'completed' },
    };
    expect(describeEvent(event)).toBe('active → completed');
  });

  it('résume une récolte avec son flush et son poids', () => {
    const event: DomainEvent = {
      ...envelope,
      id: 'e',
      type: 'harvest.recorded',
      payload: {
        harvestId: 'h-1',
        flushNumber: 2,
        weight: { value: 800, unit: 'g', kind: 'harvest' },
      },
    };
    expect(describeEvent(event)).toBe('flush 2 — 800 g');
  });

  it('ne détaille pas les événements qui se suffisent à eux-mêmes', () => {
    expect(describeEvent(created)).toBe('');
    expect(
      describeEvent({
        ...envelope,
        id: 'e',
        type: 'product.created',
        payload: { productId: 'p-1', harvestIds: ['h-1'] },
      }),
    ).toBe('');
    expect(
      describeEvent({
        ...envelope,
        id: 'e',
        type: 'event.compensated',
        payload: { compensatesEventId: 'e-0', reason: 'erreur' },
      }),
    ).toBe('');
  });
});
