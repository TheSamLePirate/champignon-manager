import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CultureUnit } from '@champi/contracts';
import { HarvestForm } from './HarvestForm.js';
import { HarvestView, partsAuProrata } from './HarvestView.js';
import type { ApiClient, HarvestRecord } from '../lib/api-client.js';

/**
 * Récoltes et produits finaux.
 *
 * Deux règles du cultivateur sont vérifiées ici, parce qu'elles conditionnent
 * toute l'analyse a posteriori : **le poids se pèse par unité**, et **un
 * mélange porte les proportions exactes** de ce qui le compose.
 */

describe('formulaire de récolte', () => {
  function afficher(overrides: Partial<Parameters<typeof HarvestForm>[0]> = {}) {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    render(
      <HarvestForm
        prochainFlush={1}
        busy={false}
        onSubmit={onSubmit}
        onCancel={onCancel}
        {...overrides}
      />,
    );
    return { onSubmit, onCancel };
  }

  it('propose le prochain flush sans le faire deviner', () => {
    afficher({ prochainFlush: 3 });
    expect(screen.getByLabelText('Flush')).toHaveValue('3');
  });

  it('refuse une récolte sans poids — une pesée vide n’apprend rien', () => {
    afficher();
    expect(screen.getByRole('button', { name: 'Enregistrer la récolte' })).toBeDisabled();
  });

  it('refuse un poids nul ou négatif', async () => {
    afficher();
    await userEvent.type(screen.getByLabelText(/Poids récolté/), '0');
    expect(screen.getByRole('button', { name: 'Enregistrer la récolte' })).toBeDisabled();
  });

  it('enregistre poids, qualité et flush', async () => {
    const { onSubmit } = afficher();

    await userEvent.type(screen.getByLabelText(/Poids récolté/), '820');
    await userEvent.click(screen.getByRole('radio', { name: /B — second choix/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer la récolte' }));

    expect(onSubmit).toHaveBeenCalledWith({
      flushNumber: 1,
      weight: { value: 820, unit: 'g', kind: 'harvest' },
      quality: 'B',
      losses: [],
    });
  });

  /** Une perte sans cause n'apprend rien : la cause apparaît dès qu'un poids est saisi. */
  it('demande la cause dès qu’une perte est renseignée', async () => {
    const { onSubmit } = afficher();

    expect(screen.queryByLabelText('Cause de la perte')).toBeNull();
    await userEvent.type(screen.getByLabelText(/Poids récolté/), '820');
    await userEvent.type(screen.getByLabelText(/Pertes en g/), '40');

    await userEvent.selectOptions(screen.getByLabelText('Cause de la perte'), 'overripe');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer la récolte' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        losses: [{ weight: { value: 40, unit: 'g', kind: 'harvest' }, cause: 'overripe' }],
      }),
    );
  });

  it('refuse une perte qui n’est pas un nombre', async () => {
    afficher();
    await userEvent.type(screen.getByLabelText(/Poids récolté/), '820');
    await userEvent.type(screen.getByLabelText(/Pertes en g/), 'beaucoup');

    expect(screen.getByRole('button', { name: 'Enregistrer la récolte' })).toBeDisabled();
  });

  it('refuse un flush qui n’est pas un entier positif', async () => {
    afficher();
    await userEvent.clear(screen.getByLabelText('Flush'));
    await userEvent.type(screen.getByLabelText('Flush'), '0');
    await userEvent.type(screen.getByLabelText(/Poids récolté/), '820');

    expect(screen.getByRole('button', { name: 'Enregistrer la récolte' })).toBeDisabled();
  });

  it('ne soumet rien d’incomplet, même en contournant le bouton', () => {
    const { onSubmit } = afficher();

    fireEvent.submit(screen.getByRole('button', { name: 'Annuler' }).closest('form') as Element);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('désactive l’enregistrement pendant un envoi', async () => {
    afficher({ busy: true });
    await userEvent.type(screen.getByLabelText(/Poids récolté/), '820');
    expect(screen.getByRole('button', { name: 'Enregistrer la récolte' })).toBeDisabled();
  });

  it('annule sans rien envoyer', async () => {
    const { onSubmit, onCancel } = afficher();
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('parts au prorata', () => {
  it('répartit selon les poids', () => {
    expect(partsAuProrata([300, 100]).map((part) => part.share)).toEqual([0.75, 0.25]);
  });

  it('rend une liste vide quand il n’y a rien à répartir', () => {
    expect(partsAuProrata([])).toEqual([]);
    // Un total nul ne se divise pas : mieux vaut rien que NaN.
    expect(partsAuProrata([0, 0])).toEqual([]);
  });
});

const unite: CultureUnit = {
  id: 'u-1',
  publicCode: 'FRU-2026-0001',
  name: 'Bloc en fructification',
  stage: 'fruiting',
  status: 'active',
  parentUnitId: null,
  lineageRelation: 'origin',
  generation: 0,
  processVersionId: 'pv-1',
  currentStepId: 'flush_1',
  currentStepEnteredAt: '2026-08-01T08:00:00.000Z',
  createdAt: '2026-08-01T08:00:00.000Z',
  updatedAt: '2026-08-01T08:00:00.000Z',
  version: 0,
};

function recolte(id: string, poids: number, flush: number): HarvestRecord {
  return {
    id,
    unitId: 'u-1',
    flushNumber: flush,
    weight: { value: poids, unit: 'g', kind: 'harvest' },
    quality: 'A',
    losses: [],
    harvestedAt: '2026-08-10T08:00:00.000Z',
  };
}

function clientRecoltes(overrides: Record<string, unknown> = {}): ApiClient {
  return {
    listUnits: () => Promise.resolve({ ok: true, data: [unite] }),
    listHarvests: () =>
      Promise.resolve({
        ok: true,
        data: {
          harvests: [recolte('h-1', 300, 1), recolte('h-2', 100, 2)],
          biologicalEfficiencyPct: 62.5,
          yieldUnavailableReason: null,
        },
      }),
    createProduct: () =>
      Promise.resolve({
        ok: true,
        data: { product: { id: 'p-1', publicCode: 'PRD-2026-0001', name: 'Barquette' } },
      }),
    ...overrides,
  } as unknown as ApiClient;
}

describe('onglet récoltes', () => {
  it('affiche les récoltes et le rendement biologique', async () => {
    render(<HarvestView client={clientRecoltes()} onMessage={vi.fn()} />);

    expect(await screen.findByText(/Flush 1 — 300 g/)).toBeInTheDocument();
    expect(screen.getByText(/Rendement biologique : 62.5 %/)).toBeInTheDocument();
  });

  /** Le rendement exige le poids de substrat : on dit pourquoi il manque. */
  it('explique un rendement non calculable au lieu d’afficher zéro', async () => {
    render(
      <HarvestView
        client={clientRecoltes({
          listHarvests: () =>
            Promise.resolve({
              ok: true,
              data: {
                harvests: [recolte('h-1', 300, 1)],
                biologicalEfficiencyPct: null,
                yieldUnavailableReason: 'Poids de substrat non saisi à l’inoculation.',
              },
            }),
        })}
        onMessage={vi.fn()}
      />,
    );

    expect(await screen.findByText(/Poids de substrat non saisi/)).toBeInTheDocument();
  });

  it('reste sobre quand le serveur ne dit pas pourquoi le rendement manque', async () => {
    render(
      <HarvestView
        client={clientRecoltes({
          listHarvests: () =>
            Promise.resolve({
              ok: true,
              data: {
                harvests: [recolte('h-1', 300, 1)],
                biologicalEfficiencyPct: null,
                yieldUnavailableReason: null,
              },
            }),
        })}
        onMessage={vi.fn()}
      />,
    );

    expect(await screen.findByText('Rendement non calculable.')).toBeInTheDocument();
  });

  it('signale les pertes d’une récolte', async () => {
    const avecPertes: HarvestRecord = {
      ...recolte('h-1', 300, 1),
      losses: [{ weight: { value: 40, unit: 'g' }, cause: 'overripe' }],
    };
    render(
      <HarvestView
        client={clientRecoltes({
          listHarvests: () =>
            Promise.resolve({
              ok: true,
              data: {
                harvests: [avecPertes],
                biologicalEfficiencyPct: 60,
                yieldUnavailableReason: null,
              },
            }),
        })}
        onMessage={vi.fn()}
      />,
    );

    expect(await screen.findByText(/1 perte\(s\)/)).toBeInTheDocument();
  });

  it('se rabat sur le message quand l’indisponibilité n’a pas d’indice', async () => {
    const onMessage = vi.fn();
    render(
      <HarvestView
        client={clientRecoltes({
          listUnits: () =>
            Promise.resolve({
              ok: false,
              error: { code: 'CONFLICT', message: 'base muette' },
              offline: false,
            }),
        })}
        onMessage={onMessage}
      />,
    );

    await waitFor(() => {
      expect(onMessage).toHaveBeenCalledWith('base muette');
    });
  });

  it('invite à peser depuis la fiche quand rien n’a été récolté', async () => {
    render(
      <HarvestView
        client={clientRecoltes({
          listHarvests: () =>
            Promise.resolve({
              ok: true,
              data: { harvests: [], biologicalEfficiencyPct: null, yieldUnavailableReason: null },
            }),
        })}
        onMessage={vi.fn()}
      />,
    );

    expect(
      await screen.findByText(/Ouvre la fiche d’une unité en fructification/),
    ).toBeInTheDocument();
  });

  it('compose un produit avec les proportions exactes des récoltes cochées', async () => {
    const createProduct = vi.fn(() =>
      Promise.resolve({
        ok: true,
        data: { product: { id: 'p-1', publicCode: 'PRD-2026-0001', name: 'Barquette' } },
      }),
    );
    const onMessage = vi.fn();
    render(<HarvestView client={clientRecoltes({ createProduct })} onMessage={onMessage} />);

    await userEvent.click(await screen.findByRole('checkbox', { name: /Flush 1/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Flush 2/ }));
    await userEvent.type(screen.getByLabelText('Nom du produit'), 'Barquette');
    await userEvent.click(screen.getByRole('button', { name: 'Créer le produit' }));

    await waitFor(() => {
      expect(createProduct).toHaveBeenCalledWith({
        name: 'Barquette',
        quantity: { value: 400, unit: 'g', kind: 'product' },
        origins: [
          { harvestId: 'h-1', weight: { value: 300, unit: 'g', kind: 'harvest' }, share: 0.75 },
          { harvestId: 'h-2', weight: { value: 100, unit: 'g', kind: 'harvest' }, share: 0.25 },
        ],
      });
    });
    expect(onMessage).toHaveBeenCalledWith(expect.stringContaining('PRD-2026-0001'));
  });

  it('affiche les proportions avant de composer', async () => {
    render(<HarvestView client={clientRecoltes()} onMessage={vi.fn()} />);

    await userEvent.click(await screen.findByRole('checkbox', { name: /Flush 1/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Flush 2/ }));

    expect(screen.getByText(/400 g au total — 75 % \/ 25 %/)).toBeInTheDocument();
  });

  it('décoche une récolte retirée du mélange', async () => {
    render(<HarvestView client={clientRecoltes()} onMessage={vi.fn()} />);

    const case1 = await screen.findByRole('checkbox', { name: /Flush 1/ });
    await userEvent.click(case1);
    await userEvent.click(case1);

    expect(screen.getByText(/Coche les récoltes à mélanger/)).toBeInTheDocument();
  });

  it('exige un nom avant de composer', async () => {
    render(<HarvestView client={clientRecoltes()} onMessage={vi.fn()} />);

    await userEvent.click(await screen.findByRole('checkbox', { name: /Flush 1/ }));

    expect(screen.getByRole('button', { name: 'Créer le produit' })).toBeDisabled();
  });

  it('remonte le refus du serveur à la composition', async () => {
    const onMessage = vi.fn();
    render(
      <HarvestView
        client={clientRecoltes({
          createProduct: () =>
            Promise.resolve({
              ok: false,
              error: { code: 'SHARES_DO_NOT_SUM_TO_ONE', message: 'Parts incohérentes.' },
              offline: false,
            }),
        })}
        onMessage={onMessage}
      />,
    );

    await userEvent.click(await screen.findByRole('checkbox', { name: /Flush 1/ }));
    await userEvent.type(screen.getByLabelText('Nom du produit'), 'Barquette');
    await userEvent.click(screen.getByRole('button', { name: 'Créer le produit' }));

    await waitFor(() => {
      expect(onMessage).toHaveBeenCalledWith('Parts incohérentes.');
    });
  });

  it('refuse de composer hors ligne — les parts se calculent côté serveur', async () => {
    const onMessage = vi.fn();
    render(
      <HarvestView
        client={clientRecoltes({
          createProduct: () => Promise.resolve({ ok: true, queued: true, pendingCount: 1 }),
        })}
        onMessage={onMessage}
      />,
    );

    await userEvent.click(await screen.findByRole('checkbox', { name: /Flush 1/ }));
    await userEvent.type(screen.getByLabelText('Nom du produit'), 'Barquette');
    await userEvent.click(screen.getByRole('button', { name: 'Créer le produit' }));

    await waitFor(() => {
      expect(onMessage).toHaveBeenCalledWith(expect.stringContaining('hors ligne'));
    });
  });

  it('remonte l’indisponibilité de la liste', async () => {
    const onMessage = vi.fn();
    render(
      <HarvestView
        client={clientRecoltes({
          listUnits: () =>
            Promise.resolve({
              ok: false,
              error: { code: 'CONFLICT', message: 'base muette', hint: 'Réessaie.' },
              offline: false,
            }),
        })}
        onMessage={onMessage}
      />,
    );

    await waitFor(() => {
      expect(onMessage).toHaveBeenCalledWith('Réessaie.');
    });
  });

  it('ignore une unité dont les récoltes sont illisibles', async () => {
    render(
      <HarvestView
        client={clientRecoltes({
          listHarvests: () =>
            Promise.resolve({
              ok: false,
              error: { code: 'CONFLICT', message: 'illisible' },
              offline: false,
            }),
        })}
        onMessage={vi.fn()}
      />,
    );

    // Pas d'écran blanc : l'unité disparaît de la liste, le reste tient.
    expect(await screen.findByText(/Aucune récolte enregistrée/)).toBeInTheDocument();
  });
});
