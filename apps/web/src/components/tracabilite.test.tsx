import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TracePanel } from './TracePanel.js';
import type { ApiClient } from '../lib/api-client.js';

/**
 * Traçabilité vue depuis la fiche.
 *
 * Deux promesses y sont rendues vérifiables **par le cultivateur**, et pas
 * seulement en CI : où est parti un bloc, et si son histoire est intacte.
 */

const trace = {
  unitId: 'u-1',
  unitPublicCode: 'SUB-2026-0042',
  harvestCount: 2,
  totalHarvestedGrams: 1200,
  products: [{ productId: 'p-1', publicCode: 'PRD-2026-0001', sharePct: 62.5 }],
};

function client(overrides: Record<string, unknown> = {}): ApiClient {
  return {
    traceUnit: () => Promise.resolve({ ok: true, data: trace }),
    auditUnit: () =>
      Promise.resolve({ ok: true, data: { verified: true, divergences: [], eventCount: 7 } }),
    ...overrides,
  } as unknown as ApiClient;
}

describe('panneau de traçabilité', () => {
  /** Une remontée coûte plusieurs requêtes : la fiche s'ouvre trop souvent. */
  it('ne charge rien tant qu’on ne le demande pas', () => {
    const traceUnit = vi.fn();
    render(
      <TracePanel client={client({ traceUnit })} reference="SUB-2026-0042" onMessage={vi.fn()} />,
    );

    expect(traceUnit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Remonter la trace' })).toBeInTheDocument();
  });

  it('montre les récoltes et la part dans chaque produit', async () => {
    render(<TracePanel client={client()} reference="SUB-2026-0042" onMessage={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Remonter la trace' }));

    expect(await screen.findByText(/2 récolte\(s\), 1200 g au total/)).toBeInTheDocument();
    expect(screen.getByText('PRD-2026-0001')).toBeInTheDocument();
    // La part exacte : c'est elle qui rend la remontée opposable.
    expect(screen.getByText('62.5 % de ce produit')).toBeInTheDocument();
  });

  it('dit qu’un bloc n’a rien produit plutôt que d’afficher un vide', async () => {
    render(
      <TracePanel
        client={client({
          traceUnit: () =>
            Promise.resolve({
              ok: true,
              data: { ...trace, harvestCount: 0, totalHarvestedGrams: 0, products: [] },
            }),
        })}
        reference="SUB-2026-0042"
        onMessage={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Remonter la trace' }));

    expect(await screen.findByText(/n’a encore rien produit/)).toBeInTheDocument();
  });

  /** La promesse centrale du projet, rendue vérifiable sur le terrain. */
  it('annonce un journal vérifié, avec le nombre d’événements rejoués', async () => {
    render(<TracePanel client={client()} reference="SUB-2026-0042" onMessage={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: 'Remonter la trace' }));

    expect(await screen.findByText(/7 événements rejoués/)).toBeInTheDocument();
  });

  it('signale bruyamment une divergence entre journal et état', async () => {
    render(
      <TracePanel
        client={client({
          auditUnit: () =>
            Promise.resolve({
              ok: true,
              data: { verified: false, divergences: [{ field: 'stage' }], eventCount: 7 },
            }),
        })}
        reference="SUB-2026-0042"
        onMessage={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Remonter la trace' }));

    expect(await screen.findByText(/1 divergence\(s\)/)).toBeInTheDocument();
  });

  it('affiche la trace même si le contrôle d’audit est indisponible', async () => {
    render(
      <TracePanel
        client={client({
          auditUnit: () =>
            Promise.resolve({
              ok: false,
              error: { code: 'CONFLICT', message: 'audit muet' },
              offline: false,
            }),
        })}
        reference="SUB-2026-0042"
        onMessage={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Remonter la trace' }));

    // La descendance vaut d'être lue même sans contrôle : on n'efface pas tout.
    expect(await screen.findByText(/2 récolte\(s\)/)).toBeInTheDocument();
    expect(screen.queryByText(/rejoués/)).toBeNull();
  });

  it('remonte l’indice du serveur quand la trace échoue', async () => {
    const onMessage = vi.fn();
    render(
      <TracePanel
        client={client({
          traceUnit: () =>
            Promise.resolve({
              ok: false,
              error: { code: 'NOT_FOUND', message: 'inconnue', hint: 'Vérifie le code.' },
              offline: false,
            }),
        })}
        reference="SUB-2026-0042"
        onMessage={onMessage}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Remonter la trace' }));

    await waitFor(() => {
      expect(onMessage).toHaveBeenCalledWith('Vérifie le code.');
    });
  });

  it('se rabat sur le message quand l’échec n’a pas d’indice', async () => {
    const onMessage = vi.fn();
    render(
      <TracePanel
        client={client({
          traceUnit: () =>
            Promise.resolve({
              ok: false,
              error: { code: 'NOT_FOUND', message: 'inconnue' },
              offline: false,
            }),
        })}
        reference="SUB-2026-0042"
        onMessage={onMessage}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Remonter la trace' }));

    await waitFor(() => {
      expect(onMessage).toHaveBeenCalledWith('inconnue');
    });
  });
});
