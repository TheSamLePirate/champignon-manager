import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AppError, CultureUnit, DomainEvent } from '@champi/contracts';
import { App } from './App.js';
import type { ApiClient } from './lib/api-client.js';
import { OfflineQueue, type QueuedMutation, type QueueStorage } from './lib/offline-queue.js';
import type { ScanEnvironment } from './lib/scanner.js';

const capable: ScanEnvironment = {
  isSecureContext: true,
  hasMediaDevices: true,
  hasBarcodeDetector: true,
};

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
  currentStepEnteredAt: '2026-08-01T08:00:00.000Z',
  createdAt: '2026-08-01T08:00:00.000Z',
  updatedAt: '2026-08-01T08:00:00.000Z',
  version: 0,
};

class MemoryStorage implements QueueStorage {
  items: QueuedMutation[] = [];
  read(): QueuedMutation[] {
    return this.items.map((i) => ({ ...i }));
  }
  write(items: readonly QueuedMutation[]): void {
    this.items = items.map((i) => ({ ...i }));
  }
}

function makeQueue(): OfflineQueue {
  return new OfflineQueue(new MemoryStorage(), () =>
    Promise.resolve({ ok: true, retryable: false }),
  );
}

function fakeClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    getUnit: () => Promise.resolve({ ok: true, data: unit }),
    getTimeline: () => Promise.resolve({ ok: true, data: [] }),
    nextSteps: () =>
      Promise.resolve({
        ok: true,
        data: {
          currentStepId: 'incubation',
          nominal: [{ id: 'fructification', name: 'Fructification' }],
        },
      }),
    resolveQr: () => Promise.resolve({ ok: true, data: { qr: {}, target: unit } }),
    advance: mutationOk,
    observe: mutationOk,
    measure: mutationOk,
    flushQueue: () => Promise.resolve({ sent: 0, remaining: 0, stoppedOnNetwork: false }),
    ...overrides,
  } as unknown as ApiClient;
}

/** Événement complet et typé — un `{}` ne satisfait pas `DomainEvent`. */
const someEvent: DomainEvent = {
  id: 'e-1',
  type: 'unit.observed',
  occurredAt: '2026-08-02T08:00:00.000Z',
  recordedAt: '2026-08-02T08:00:00.000Z',
  source: 'manual',
  unitId: 'u-1',
  payload: { kind: 'colonisation', severity: 'low' },
};

/** Succès de mutation, correctement typé. */
function mutationOk() {
  return Promise.resolve({ ok: true as const, data: { unit, event: someEvent } });
}

/** Échec métier, correctement typé — le code d'erreur est une union, pas `string`. */
function mutationFailed(error: AppError) {
  return Promise.resolve({ ok: false as const, error, offline: false });
}

async function scan(value: string): Promise<void> {
  await userEvent.type(screen.getByLabelText(/saisis le code/i), `${value}{Enter}`);
}

describe('App', () => {
  it('s’ouvre directement sur le travail, sans écran de connexion', () => {
    render(<App client={fakeClient()} queue={makeQueue()} environment={capable} online={true} />);
    expect(screen.getByRole('heading', { name: 'Champignon Manager' })).toBeInTheDocument();
    // Décision docs/21 §6 : il n'y a pas d'authentification du tout.
    expect(screen.queryByLabelText(/mot de passe/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /connexion/i })).toBeNull();
  });

  it('affiche la fiche après une saisie de code public', async () => {
    render(<App client={fakeClient()} queue={makeQueue()} environment={capable} online={true} />);
    await scan('SUB-2026-0042');

    expect(await screen.findByRole('heading', { name: 'Pleurote bloc 1' })).toBeInTheDocument();
    expect(screen.getByText('SUB-2026-0042')).toBeInTheDocument();
    expect(screen.getByText('incubation')).toBeInTheDocument();
  });

  /**
   * Un token passe par la route de QR, puis la fiche complète est chargée par
   * son code public : après un scan, l'opérateur voit l'unité, son historique
   * et ses suites possibles — pas un identifiant à ré-interroger.
   */
  it('résout un token par la route de QR puis charge la fiche complète', async () => {
    const resolveQr = vi.fn(() =>
      Promise.resolve({ ok: true as const, data: { qr: {}, target: unit } }),
    );
    const getUnit = vi.fn(() => Promise.resolve({ ok: true as const, data: unit }));
    render(
      <App
        client={fakeClient({ resolveQr, getUnit })}
        queue={makeQueue()}
        environment={capable}
        online={true}
      />,
    );
    await scan('ABCDEFGHJKMNPQRSTUVWXY');

    expect(resolveQr).toHaveBeenCalledWith('ABCDEFGHJKMNPQRSTUVWXY');
    expect(getUnit).toHaveBeenCalledWith('SUB-2026-0042');
    expect(await screen.findByRole('heading', { name: 'Pleurote bloc 1' })).toBeInTheDocument();
  });

  it('n’appelle pas la route de QR pour un code public', async () => {
    const resolveQr = vi.fn(() =>
      Promise.resolve({ ok: true as const, data: { qr: {}, target: unit } }),
    );
    render(
      <App
        client={fakeClient({ resolveQr })}
        queue={makeQueue()}
        environment={capable}
        online={true}
      />,
    );
    await scan('SUB-2026-0042');

    expect(resolveQr).not.toHaveBeenCalled();
  });

  /** L'indice du serveur contient les valeurs valides : c'est lui qu'on montre. */
  it('affiche l’indice du serveur plutôt que le code d’erreur', async () => {
    const client = fakeClient({
      getUnit: () =>
        mutationFailed({
          code: 'NOT_FOUND',
          message: 'introuvable',
          hint: 'Vérifie le code public.',
        }),
    });

    render(<App client={client} queue={makeQueue()} environment={capable} online={true} />);
    await scan('SUB-2026-9999');

    expect(await screen.findByText('Vérifie le code public.')).toBeInTheDocument();
  });

  it('se rabat sur le message quand l’erreur n’a pas d’indice', async () => {
    const client = fakeClient({
      getUnit: () => mutationFailed({ code: 'NOT_FOUND', message: 'Rien à cet endroit.' }),
    });

    render(<App client={client} queue={makeQueue()} environment={capable} online={true} />);
    await scan('SUB-2026-9999');

    expect(await screen.findByText('Rien à cet endroit.')).toBeInTheDocument();
  });

  it('signale un QR valide mais sans unité rattachée', async () => {
    const client = fakeClient({
      resolveQr: () => Promise.resolve({ ok: true as const, data: { qr: {}, target: null } }),
    });

    render(<App client={client} queue={makeQueue()} environment={capable} online={true} />);
    await scan('ABCDEFGHJKMNPQRSTUVWXY');

    expect(await screen.findByText(/aucune unité connue/)).toBeInTheDocument();
  });

  it('annonce les saisies en attente', () => {
    const queue = makeQueue();
    queue.enqueue({
      id: 'k-1',
      method: 'POST',
      path: '/api/units/u-1/advance',
      body: {},
      idempotencyKey: 'k-1',
      queuedAt: '2026-08-08T10:00:00.000Z',
    });

    render(<App client={fakeClient()} queue={queue} environment={capable} online={true} />);
    // Le panneau de scan porte lui aussi un `status` : on cible le bandeau.
    const banners = screen.getAllByRole('status');
    expect(banners.some((b) => b.textContent.includes('en attente d’envoi'))).toBe(true);
  });

  /**
   * L'opérateur ne doit pas avoir à penser à renvoyer ses saisies : le retour
   * du réseau suffit.
   */
  it('vide la file dès que le réseau revient', () => {
    const flushQueue = vi.fn(() =>
      Promise.resolve({ sent: 2, remaining: 0, stoppedOnNetwork: false }),
    );
    render(
      <App
        client={fakeClient({ flushQueue })}
        queue={makeQueue()}
        environment={capable}
        online={true}
      />,
    );
    expect(flushQueue).toHaveBeenCalled();
  });

  it('ne tente pas de vider la file hors réseau', () => {
    const flushQueue = vi.fn(() =>
      Promise.resolve({ sent: 0, remaining: 0, stoppedOnNetwork: true }),
    );
    render(
      <App
        client={fakeClient({ flushQueue })}
        queue={makeQueue()}
        environment={capable}
        online={false}
      />,
    );
    expect(flushQueue).not.toHaveBeenCalled();
  });

  it('refuse un code non reconnu sans appeler le serveur', async () => {
    const getUnit = vi.fn(() => Promise.resolve({ ok: true as const, data: unit }));
    render(
      <App
        client={fakeClient({ getUnit })}
        queue={makeQueue()}
        environment={capable}
        online={true}
      />,
    );

    const input = screen.getByLabelText(/saisis le code/i);
    await userEvent.type(input, 'bonjour');
    // Le bouton reste désactivé : rien ne part.
    expect(screen.getByRole('button', { name: 'Ouvrir la fiche' })).toBeDisabled();
    expect(getUnit).not.toHaveBeenCalled();
  });
});

describe('actions depuis la fiche', () => {
  async function openSheet(client: ApiClient): Promise<void> {
    render(<App client={client} queue={makeQueue()} environment={capable} online={true} />);
    await scan('SUB-2026-0042');
    await screen.findByRole('heading', { name: 'Pleurote bloc 1' });
  }

  it('avance d’étape avec la version courante de l’unité', async () => {
    const advance = vi.fn(mutationOk);
    await openSheet(fakeClient({ advance }));

    await userEvent.click(screen.getByRole('button', { name: /Passer à/ }));
    // La version lue est renvoyée telle quelle : c'est le verrou optimiste.
    expect(advance).toHaveBeenCalledWith('SUB-2026-0042', 'fructification', 0);
  });

  it('enregistre une observation', async () => {
    const observe = vi.fn(mutationOk);
    await openSheet(fakeClient({ observe }));

    await userEvent.click(screen.getByRole('button', { name: 'Ajouter une observation' }));
    expect(observe).toHaveBeenCalledWith('SUB-2026-0042', {
      kind: 'colonisation',
      severity: 'low',
    });
  });

  it('enregistre une mesure', async () => {
    const measure = vi.fn(mutationOk);
    await openSheet(fakeClient({ measure }));

    await userEvent.click(screen.getByRole('button', { name: 'Ajouter une mesure' }));
    expect(measure).toHaveBeenCalledWith('SUB-2026-0042', {
      metric: 'temperature_c',
      numericValue: 24,
    });
  });

  /**
   * Les trois issues d'une mutation doivent être distinguables par l'opérateur :
   * envoyée, conservée, ou refusée.
   */
  it('annonce une saisie conservée sans la présenter comme un échec', async () => {
    const advance = vi.fn(() =>
      Promise.resolve({ ok: true as const, queued: true as const, pendingCount: 1 }),
    );
    await openSheet(fakeClient({ advance }));

    await userEvent.click(screen.getByRole('button', { name: /Passer à/ }));
    expect(await screen.findByText(/conservée sur l’appareil/)).toBeInTheDocument();
  });

  it('affiche l’indice du serveur quand l’action est refusée', async () => {
    const advance = vi.fn(() =>
      mutationFailed({
        code: 'CONFLICT',
        message: 'conflit',
        hint: 'Relis l’unité puis réessaie.',
      }),
    );
    await openSheet(fakeClient({ advance }));

    await userEvent.click(screen.getByRole('button', { name: /Passer à/ }));
    expect(await screen.findByText('Relis l’unité puis réessaie.')).toBeInTheDocument();
  });

  it('se rabat sur le message quand le refus n’a pas d’indice', async () => {
    const advance = vi.fn(() => mutationFailed({ code: 'CONFLICT', message: 'Refus sec.' }));
    await openSheet(fakeClient({ advance }));

    await userEvent.click(screen.getByRole('button', { name: /Passer à/ }));
    expect(await screen.findByText('Refus sec.')).toBeInTheDocument();
  });

  it('recharge la fiche après une action réussie', async () => {
    const getUnit = vi.fn(() => Promise.resolve({ ok: true as const, data: unit }));
    await openSheet(fakeClient({ getUnit }));
    const callsBefore = getUnit.mock.calls.length;

    await userEvent.click(screen.getByRole('button', { name: 'Ajouter une mesure' }));
    await vi.waitFor(() => {
      expect(getUnit.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  it('affiche une fiche même si l’historique est indisponible', async () => {
    const getTimeline = vi.fn(() => mutationFailed({ code: 'CONFLICT', message: 'indisponible' }));
    await openSheet(fakeClient({ getTimeline }));
    // La fiche s'affiche quand même : mieux vaut une identité sans historique
    // que rien du tout devant une unité qu'on a dans les mains.
    expect(screen.getByText('Aucun événement enregistré.')).toBeInTheDocument();
  });

  it('affiche une fiche même si les suites sont indisponibles', async () => {
    const nextSteps = vi.fn(() => mutationFailed({ code: 'NOT_FOUND', message: 'introuvable' }));
    await openSheet(fakeClient({ nextSteps }));
    expect(screen.getByText(/Toute étape reste atteignable/)).toBeInTheDocument();
  });
});

describe('résolution de QR — chemins d’échec', () => {
  it('affiche l’indice quand la résolution du QR échoue', async () => {
    const client = fakeClient({
      resolveQr: () =>
        mutationFailed({
          code: 'NOT_FOUND',
          message: 'inconnu',
          hint: 'Étiquette d’une autre installation ?',
        }),
    });
    render(<App client={client} queue={makeQueue()} environment={capable} online={true} />);
    await scan('ABCDEFGHJKMNPQRSTUVWXY');

    expect(await screen.findByText('Étiquette d’une autre installation ?')).toBeInTheDocument();
  });

  it('se rabat sur le message quand la résolution échoue sans indice', async () => {
    const client = fakeClient({
      resolveQr: () => mutationFailed({ code: 'NOT_FOUND', message: 'Token illisible.' }),
    });
    render(<App client={client} queue={makeQueue()} environment={capable} online={true} />);
    await scan('ABCDEFGHJKMNPQRSTUVWXY');

    expect(await screen.findByText('Token illisible.')).toBeInTheDocument();
  });
});
