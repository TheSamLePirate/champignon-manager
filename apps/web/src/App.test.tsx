import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AppError, CultureUnit, DomainEvent } from '@champi/contracts';
import { App } from './App.js';
import type { ApiClient } from './lib/api-client.js';
import { OfflineQueue, type QueuedMutation, type QueueStorage } from './lib/offline-queue.js';
import type { ScanEnvironment } from './lib/scanner.js';

/** Horloge fixe : « depuis 12 jours » ne doit pas dépendre du jour du test. */
const NOW = () => '2026-08-13T09:00:00.000Z';

const capable: ScanEnvironment = {
  isSecureContext: true,
  hasMediaDevices: true,
};

/** Caméra et décodeur factices : aucun test n'ouvre de vraie caméra. */
/**
 * Caméra factice. Un vrai `MediaStream` est nécessaire : `video.srcObject`
 * vérifie le type, dans le navigateur comme dans happy-dom.
 */
const CAMERA = () => {
  const stream = new MediaStream();
  Object.defineProperty(stream, 'getTracks', { value: () => [] });
  return Promise.resolve(stream);
};
const DETECTER = () => Promise.resolve([]);
const CAPTURER = () => 'data:image/jpeg;base64,AAAA';

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
    // Nouveaux appels de l'écran d'accueil : liste, process publiés, étiquette.
    listUnits: () => Promise.resolve({ ok: true, data: [] }),
    listProcessTemplates: () => Promise.resolve({ ok: true, data: [] }),
    listProcessVersions: () => Promise.resolve({ ok: true, data: [] }),
    getQr: () =>
      Promise.resolve({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'pas de QR' },
        offline: false,
      }),
    photoUrl: (photoId: string) => `/api/photos/${photoId}`,
    listHarvests: () =>
      Promise.resolve({
        ok: true,
        data: { harvests: [], biologicalEfficiencyPct: null, yieldUnavailableReason: null },
      }),
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
  await userEvent.type(screen.getByLabelText(/code de l/i), `${value}{Enter}`);
}

describe('App', () => {
  it('s’ouvre directement sur le travail, sans écran de connexion', () => {
    render(
      <App
        client={fakeClient()}
        queue={makeQueue()}
        environment={capable}
        online={true}
        now={NOW}
        ouvrirCamera={CAMERA}
        detecter={DETECTER}
        capturer={CAPTURER}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Champignon Manager' })).toBeInTheDocument();
    // Décision docs/21 §6 : il n'y a pas d'authentification du tout.
    expect(screen.queryByLabelText(/mot de passe/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /connexion/i })).toBeNull();
  });

  it('affiche la fiche après une saisie de code public', async () => {
    render(
      <App
        client={fakeClient()}
        queue={makeQueue()}
        environment={capable}
        online={true}
        now={NOW}
        ouvrirCamera={CAMERA}
        detecter={DETECTER}
        capturer={CAPTURER}
      />,
    );
    await scan('SUB-2026-0042');

    expect(await screen.findByRole('heading', { name: 'Pleurote bloc 1' })).toBeInTheDocument();
    expect(screen.getByText('SUB-2026-0042')).toBeInTheDocument();
    expect(screen.getByText('Incubation')).toBeInTheDocument();
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
        now={NOW}
        ouvrirCamera={CAMERA}
        detecter={DETECTER}
        capturer={CAPTURER}
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
        now={NOW}
        ouvrirCamera={CAMERA}
        detecter={DETECTER}
        capturer={CAPTURER}
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

    render(
      <App
        client={client}
        queue={makeQueue()}
        environment={capable}
        online={true}
        now={NOW}
        ouvrirCamera={CAMERA}
        detecter={DETECTER}
        capturer={CAPTURER}
      />,
    );
    await scan('SUB-2026-9999');

    expect(await screen.findByText('Vérifie le code public.')).toBeInTheDocument();
  });

  it('se rabat sur le message quand l’erreur n’a pas d’indice', async () => {
    const client = fakeClient({
      getUnit: () => mutationFailed({ code: 'NOT_FOUND', message: 'Rien à cet endroit.' }),
    });

    render(
      <App
        client={client}
        queue={makeQueue()}
        environment={capable}
        online={true}
        now={NOW}
        ouvrirCamera={CAMERA}
        detecter={DETECTER}
        capturer={CAPTURER}
      />,
    );
    await scan('SUB-2026-9999');

    expect(await screen.findByText('Rien à cet endroit.')).toBeInTheDocument();
  });

  it('signale un QR valide mais sans unité rattachée', async () => {
    const client = fakeClient({
      resolveQr: () => Promise.resolve({ ok: true as const, data: { qr: {}, target: null } }),
    });

    render(
      <App
        client={client}
        queue={makeQueue()}
        environment={capable}
        online={true}
        now={NOW}
        ouvrirCamera={CAMERA}
        detecter={DETECTER}
        capturer={CAPTURER}
      />,
    );
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

    render(
      <App
        client={fakeClient()}
        queue={queue}
        environment={capable}
        online={true}
        now={NOW}
        ouvrirCamera={CAMERA}
        detecter={DETECTER}
        capturer={CAPTURER}
      />,
    );
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
        now={NOW}
        ouvrirCamera={CAMERA}
        detecter={DETECTER}
        capturer={CAPTURER}
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
        now={NOW}
        ouvrirCamera={CAMERA}
        detecter={DETECTER}
        capturer={CAPTURER}
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
        now={NOW}
        ouvrirCamera={CAMERA}
        detecter={DETECTER}
        capturer={CAPTURER}
      />,
    );

    const input = screen.getByLabelText(/code de l/i);
    await userEvent.type(input, 'bonjour');
    // Le bouton reste désactivé : rien ne part.
    expect(screen.getByRole('button', { name: 'Ouvrir la fiche' })).toBeDisabled();
    expect(getUnit).not.toHaveBeenCalled();
  });
});

describe('actions depuis la fiche', () => {
  async function openSheet(client: ApiClient): Promise<void> {
    render(
      <App
        client={client}
        queue={makeQueue()}
        environment={capable}
        online={true}
        now={NOW}
        ouvrirCamera={CAMERA}
        detecter={DETECTER}
        capturer={CAPTURER}
      />,
    );
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

  /**
   * L'observation n'est plus envoyée en aveugle : l'opérateur choisit ce qu'il
   * a vu et à quelle gravité. C'est le formulaire qui porte la saisie, et non
   * plus des valeurs figées dans le code.
   */
  it('enregistre l’observation saisie dans le formulaire', async () => {
    const observe = vi.fn(mutationOk);
    await openSheet(fakeClient({ observe }));

    await userEvent.click(screen.getByRole('button', { name: 'Noter une observation' }));
    await userEvent.selectOptions(screen.getByLabelText('Ce que tu vois'), 'odeur');
    await userEvent.click(screen.getByRole('radio', { name: 'Moyen' }));
    await userEvent.type(screen.getByLabelText(/Précision/), 'odeur aigre');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer l’observation' }));

    expect(observe).toHaveBeenCalledWith('SUB-2026-0042', {
      kind: 'odeur',
      severity: 'medium',
      note: 'odeur aigre',
    });
  });

  it('referme le formulaire une fois la saisie enregistrée', async () => {
    await openSheet(fakeClient({ observe: vi.fn(mutationOk) }));

    await userEvent.click(screen.getByRole('button', { name: 'Noter une observation' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer l’observation' }));

    await vi.waitFor(() => {
      expect(screen.queryByLabelText('Ce que tu vois')).toBeNull();
    });
  });

  it('referme le formulaire sur « Annuler » sans rien envoyer', async () => {
    const observe = vi.fn(mutationOk);
    await openSheet(fakeClient({ observe }));

    await userEvent.click(screen.getByRole('button', { name: 'Noter une observation' }));
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(screen.queryByLabelText('Ce que tu vois')).toBeNull();
    expect(observe).not.toHaveBeenCalled();
  });

  it('referme le formulaire si l’on rappuie sur le même bouton', async () => {
    await openSheet(fakeClient());

    await userEvent.click(screen.getByRole('button', { name: 'Noter une observation' }));
    expect(screen.getByLabelText('Ce que tu vois')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Noter une observation' }));

    expect(screen.queryByLabelText('Ce que tu vois')).toBeNull();
  });

  it('referme la mesure si l’on rappuie sur le même bouton', async () => {
    await openSheet(fakeClient());

    await userEvent.click(screen.getByRole('button', { name: 'Relever une mesure' }));
    expect(screen.getByLabelText(/Valeur en/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Relever une mesure' }));

    expect(screen.queryByLabelText(/Valeur en/)).toBeNull();
  });

  it('referme la mesure sur « Annuler » sans rien envoyer', async () => {
    const measure = vi.fn(mutationOk);
    await openSheet(fakeClient({ measure }));

    await userEvent.click(screen.getByRole('button', { name: 'Relever une mesure' }));
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(screen.queryByLabelText(/Valeur en/)).toBeNull();
    expect(measure).not.toHaveBeenCalled();
  });

  it('n’ouvre qu’un formulaire à la fois', async () => {
    await openSheet(fakeClient());

    await userEvent.click(screen.getByRole('button', { name: 'Noter une observation' }));
    await userEvent.click(screen.getByRole('button', { name: 'Relever une mesure' }));

    expect(screen.queryByLabelText('Ce que tu vois')).toBeNull();
    expect(screen.getByLabelText(/Valeur en/)).toBeInTheDocument();
  });

  it('enregistre la mesure saisie dans le formulaire', async () => {
    const measure = vi.fn(mutationOk);
    await openSheet(fakeClient({ measure }));

    await userEvent.click(screen.getByRole('button', { name: 'Relever une mesure' }));
    await userEvent.click(screen.getByRole('radio', { name: 'Humidité' }));
    await userEvent.type(screen.getByLabelText(/Valeur en/), '92');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer la mesure' }));

    expect(measure).toHaveBeenCalledWith('SUB-2026-0042', {
      metric: 'humidity_pct',
      numericValue: 92,
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

    await userEvent.click(screen.getByRole('button', { name: 'Relever une mesure' }));
    await userEvent.type(screen.getByLabelText(/Valeur en/), '24');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer la mesure' }));
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
    render(
      <App
        client={client}
        queue={makeQueue()}
        environment={capable}
        online={true}
        now={NOW}
        ouvrirCamera={CAMERA}
        detecter={DETECTER}
        capturer={CAPTURER}
      />,
    );
    await scan('ABCDEFGHJKMNPQRSTUVWXY');

    expect(await screen.findByText('Étiquette d’une autre installation ?')).toBeInTheDocument();
  });

  it('se rabat sur le message quand la résolution échoue sans indice', async () => {
    const client = fakeClient({
      resolveQr: () => mutationFailed({ code: 'NOT_FOUND', message: 'Token illisible.' }),
    });
    render(
      <App
        client={client}
        queue={makeQueue()}
        environment={capable}
        online={true}
        now={NOW}
        ouvrirCamera={CAMERA}
        detecter={DETECTER}
        capturer={CAPTURER}
      />,
    );
    await scan('ABCDEFGHJKMNPQRSTUVWXY');

    expect(await screen.findByText('Token illisible.')).toBeInTheDocument();
  });
});

/**
 * Navigation entre les deux vues.
 *
 * Ces tests existent à cause d'un défaut réel (D-28) : l'éditeur de process
 * était entièrement construit et testé, mais **monté nulle part**. Aucune
 * barrière ne l'avait vu — la couverture mesure les lignes exécutées, pas
 * l'accessibilité depuis l'application.
 */
describe('vues', () => {
  const withProcess = (overrides: Partial<ApiClient> = {}): ApiClient =>
    fakeClient({
      listProcessTemplates: () =>
        Promise.resolve({
          ok: true,
          data: [{ id: 't-1', name: 'Pleurote', currentVersionId: 'v-1' }],
        }),
      listProcessVersions: () =>
        Promise.resolve({
          ok: true,
          data: [
            { id: 'v-1', versionNumber: 1, status: 'draft', graph: { steps: [], transitions: [] } },
          ],
        }),
      ...overrides,
    });

  it('ouvre sur le terrain, pas sur la configuration', () => {
    render(
      <App
        client={withProcess()}
        queue={makeQueue()}
        environment={capable}
        online={true}
        now={NOW}
        ouvrirCamera={CAMERA}
        detecter={DETECTER}
        capturer={CAPTURER}
      />,
    );

    expect(screen.getByRole('button', { name: 'Terrain' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Process' })).not.toHaveAttribute('aria-current');
    expect(screen.queryByRole('heading', { name: 'Process' })).toBeNull();
  });

  it('donne accès à l’éditeur de process depuis l’application', async () => {
    render(
      <App
        client={withProcess()}
        queue={makeQueue()}
        environment={capable}
        online={true}
        now={NOW}
        ouvrirCamera={CAMERA}
        detecter={DETECTER}
        capturer={CAPTURER}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Process' }));

    // Le canvas est monté : c'est très exactement ce qui manquait.
    expect(await screen.findByRole('heading', { name: 'Éditeur de process' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Process' })).toHaveAttribute('aria-current', 'page');
  });

  it('revient au terrain sans perdre le scanner', async () => {
    render(
      <App
        client={withProcess()}
        queue={makeQueue()}
        environment={capable}
        online={true}
        now={NOW}
        ouvrirCamera={CAMERA}
        detecter={DETECTER}
        capturer={CAPTURER}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Process' }));
    await screen.findByRole('heading', { name: 'Éditeur de process' });
    await userEvent.click(screen.getByRole('button', { name: 'Terrain' }));

    expect(screen.getByLabelText(/code de l/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Éditeur de process' })).toBeNull();
  });

  it('efface le message en changeant de vue — il appartenait à l’autre écran', async () => {
    const client = withProcess({
      getUnit: () => mutationFailed({ code: 'NOT_FOUND', message: 'Unité inconnue.' }),
    });
    render(
      <App
        client={client}
        queue={makeQueue()}
        environment={capable}
        online={true}
        now={NOW}
        ouvrirCamera={CAMERA}
        detecter={DETECTER}
        capturer={CAPTURER}
      />,
    );

    await scan('SUB-2026-0042');
    expect(await screen.findByText('Unité inconnue.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Process' }));
    expect(screen.queryByText('Unité inconnue.')).toBeNull();
  });

  it('affiche dans le bandeau les messages venus de la configuration', async () => {
    const client = withProcess({
      listProcessTemplates: () =>
        mutationFailed({ code: 'NOT_FOUND', message: 'Base injoignable.' }),
    });
    render(
      <App
        client={client}
        queue={makeQueue()}
        environment={capable}
        online={true}
        now={NOW}
        ouvrirCamera={CAMERA}
        detecter={DETECTER}
        capturer={CAPTURER}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Process' }));

    expect(await screen.findByText('Base injoignable.')).toBeInTheDocument();
  });
});

/**
 * L'écran de terrain complet : voir ce qui tourne, démarrer une culture,
 * étiqueter, imprimer, photographier. Tout cela n'existait qu'en ligne de
 * commande avant la vague 1.
 */
describe('terrain', () => {
  const graphe = {
    steps: [
      {
        id: 'inoculation',
        name: 'Inoculation',
        stage: 'substrate',
        conditions: {},
        alarms: { enabled: false },
        optional: false,
        provenance: 'cultivator',
      },
    ],
    transitions: [],
  };

  /**
   * Client de terrain.
   *
   * Les surcharges sont typées librement et converties **une seule fois**, ici :
   * un test qui remplace `printLabel` n'a pas à reconstruire la signature
   * complète de la méthode pour rendre deux champs.
   */
  function clientTerrain(overrides: Record<string, unknown> = {}): ApiClient {
    return fakeClient({
      listUnits: (stage: string) =>
        Promise.resolve({ ok: true, data: stage === 'substrate' ? [unit] : [] }),
      listProcessTemplates: () =>
        Promise.resolve({ ok: true, data: [{ id: 't-1', name: 'Pleurote' }] }),
      listProcessVersions: () =>
        Promise.resolve({
          ok: true,
          data: [
            { id: 'pv-1', versionNumber: 1, status: 'published', graph: graphe },
            { id: 'pv-2', versionNumber: 2, status: 'draft', graph: graphe },
          ],
        }),
      ...overrides,
    } as unknown as Partial<ApiClient>);
  }

  function afficher(client: ApiClient = clientTerrain()) {
    render(
      <App
        client={client}
        queue={makeQueue()}
        environment={capable}
        online={true}
        now={NOW}
        ouvrirCamera={CAMERA}
        detecter={DETECTER}
        capturer={CAPTURER}
      />,
    );
  }

  it('ouvre sur la liste de ce qui tourne', async () => {
    afficher();

    expect(await screen.findByText('Pleurote bloc 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nouvelle unité' })).toBeInTheDocument();
  });

  it('ouvre la fiche depuis la liste', async () => {
    afficher();

    await userEvent.click(await screen.findByRole('button', { name: /Pleurote bloc 1/ }));

    expect(await screen.findByRole('heading', { name: 'Pleurote bloc 1' })).toBeInTheDocument();
  });

  it('revient à la liste depuis la fiche', async () => {
    afficher();
    await userEvent.click(await screen.findByRole('button', { name: /Pleurote bloc 1/ }));
    await screen.findByRole('heading', { name: 'Pleurote bloc 1' });

    await userEvent.click(screen.getByRole('button', { name: 'Retour à la liste' }));

    expect(screen.getByRole('button', { name: 'Nouvelle unité' })).toBeInTheDocument();
  });

  /** Une unité épinglée à un brouillon serait rattachée à un graphe mouvant. */
  it('ne propose que les versions publiées à la création', async () => {
    afficher();

    await userEvent.click(await screen.findByRole('button', { name: 'Nouvelle unité' }));

    const choix = within(await screen.findByLabelText('Process'))
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(choix).toEqual(['Pleurote — version 1']);
  });

  it('crée une unité puis ouvre sa fiche', async () => {
    const createUnit = vi.fn(() => Promise.resolve({ ok: true, data: { unit } }));
    afficher(clientTerrain({ createUnit }));

    await userEvent.click(await screen.findByRole('button', { name: 'Nouvelle unité' }));
    await userEvent.type(await screen.findByLabelText('Nom de l’unité'), 'Bloc neuf');
    await userEvent.click(screen.getByRole('button', { name: 'Créer l’unité' }));

    await waitFor(() => {
      expect(createUnit).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Bloc neuf', processVersionId: 'pv-1' }),
      );
    });
    expect(await screen.findByRole('heading', { name: 'Pleurote bloc 1' })).toBeInTheDocument();
  });

  it('remonte le refus du serveur à la création', async () => {
    afficher(
      clientTerrain({
        createUnit: () =>
          mutationFailed({
            code: 'VALIDATION_FAILED',
            message: 'Étape inconnue.',
            hint: 'Corrige.',
          }),
      }),
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Nouvelle unité' }));
    await userEvent.type(await screen.findByLabelText('Nom de l’unité'), 'Bloc neuf');
    await userEvent.click(screen.getByRole('button', { name: 'Créer l’unité' }));

    expect(await screen.findByText('Corrige.')).toBeInTheDocument();
  });

  /** Une unité créée hors ligne n'aurait ni code public ni QR. */
  it('se rabat sur le message quand le refus de création n’a pas d’indice', async () => {
    afficher(
      clientTerrain({
        createUnit: () => mutationFailed({ code: 'CONFLICT', message: 'Nom déjà pris.' }),
      }),
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Nouvelle unité' }));
    await userEvent.type(await screen.findByLabelText('Nom de l’unité'), 'Bloc neuf');
    await userEvent.click(screen.getByRole('button', { name: 'Créer l’unité' }));

    expect(await screen.findByText('Nom déjà pris.')).toBeInTheDocument();
  });

  it('refuse franchement de créer une unité hors ligne', async () => {
    afficher(
      clientTerrain({
        createUnit: () => Promise.resolve({ ok: true, queued: true, pendingCount: 1 }),
      }),
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Nouvelle unité' }));
    await userEvent.type(await screen.findByLabelText('Nom de l’unité'), 'Bloc neuf');
    await userEvent.click(screen.getByRole('button', { name: 'Créer l’unité' }));

    expect(await screen.findByText(/Création impossible hors ligne/)).toBeInTheDocument();
  });

  it('annule la création et revient à la liste', async () => {
    afficher();

    await userEvent.click(await screen.findByRole('button', { name: 'Nouvelle unité' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Annuler' }));

    expect(screen.getByRole('button', { name: 'Nouvelle unité' })).toBeInTheDocument();
  });

  it('attribue un QR puis propose l’impression', async () => {
    const assignQr = vi.fn(() =>
      Promise.resolve({ ok: true, data: { token: 'ZBAKASUB2THMWYV7PUNGJF', printCount: 0 } }),
    );
    afficher(clientTerrain({ assignQr }));

    await userEvent.click(await screen.findByRole('button', { name: /Pleurote bloc 1/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Attribuer un QR' }));

    expect(await screen.findByText('ZBAKASUB2THMWYV7PUNGJF')).toBeInTheDocument();
    expect(assignQr).toHaveBeenCalledWith('SUB-2026-0042');
  });

  it('remonte un refus d’attribution de QR', async () => {
    afficher(
      clientTerrain({
        assignQr: () => mutationFailed({ code: 'CONFLICT', message: 'Registre indisponible.' }),
      }),
    );

    await userEvent.click(await screen.findByRole('button', { name: /Pleurote bloc 1/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Attribuer un QR' }));

    expect(await screen.findByText('Registre indisponible.')).toBeInTheDocument();
  });

  it('refuse d’attribuer un QR hors ligne — il vient du serveur', async () => {
    afficher(
      clientTerrain({
        assignQr: () => Promise.resolve({ ok: true, queued: true, pendingCount: 1 }),
      }),
    );

    await userEvent.click(await screen.findByRole('button', { name: /Pleurote bloc 1/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Attribuer un QR' }));

    expect(await screen.findByText(/Attribution impossible hors ligne/)).toBeInTheDocument();
  });

  it('imprime et annonce une réimpression au même QR', async () => {
    let compte = 0;
    afficher(
      clientTerrain({
        getQr: () => {
          compte += 1;
          return Promise.resolve({ ok: true, data: { token: 'TOKEN', printCount: compte } });
        },
        printLabel: () =>
          Promise.resolve({ ok: true, data: { status: 'printed', isReprint: true } }),
      }),
    );

    await userEvent.click(await screen.findByRole('button', { name: /Pleurote bloc 1/ }));
    await userEvent.click(await screen.findByRole('button', { name: /imprimer/i }));

    expect(await screen.findByText(/même QR que la précédente/)).toBeInTheDocument();
  });

  it('annonce une première impression sans parler de réimpression', async () => {
    afficher(
      clientTerrain({
        getQr: () => Promise.resolve({ ok: true, data: { token: 'TOKEN', printCount: 0 } }),
        printLabel: () =>
          Promise.resolve({ ok: true, data: { status: 'printed', isReprint: false } }),
      }),
    );

    await userEvent.click(await screen.findByRole('button', { name: /Pleurote bloc 1/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Imprimer l’étiquette' }));

    expect(await screen.findByText('Étiquette imprimée.')).toBeInTheDocument();
  });

  it('remonte un refus d’impression', async () => {
    afficher(
      clientTerrain({
        getQr: () => Promise.resolve({ ok: true, data: { token: 'TOKEN', printCount: 0 } }),
        printLabel: () => mutationFailed({ code: 'CONFLICT', message: 'Imprimante injoignable.' }),
      }),
    );

    await userEvent.click(await screen.findByRole('button', { name: /Pleurote bloc 1/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Imprimer l’étiquette' }));

    expect(await screen.findByText('Imprimante injoignable.')).toBeInTheDocument();
  });

  it('refuse d’imprimer hors ligne — l’imprimante est jointe par le serveur', async () => {
    afficher(
      clientTerrain({
        getQr: () => Promise.resolve({ ok: true, data: { token: 'TOKEN', printCount: 0 } }),
        printLabel: () => Promise.resolve({ ok: true, queued: true, pendingCount: 1 }),
      }),
    );

    await userEvent.click(await screen.findByRole('button', { name: /Pleurote bloc 1/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Imprimer l’étiquette' }));

    expect(await screen.findByText(/Impression impossible hors ligne/)).toBeInTheDocument();
  });

  it('dit si l’imprimante répond', async () => {
    afficher(
      clientTerrain({
        getQr: () => Promise.resolve({ ok: true, data: { token: 'TOKEN', printCount: 0 } }),
        testPrinter: () =>
          Promise.resolve({ ok: true, data: { transport: 'nimbot-b21', reachable: true } }),
      }),
    );

    await userEvent.click(await screen.findByRole('button', { name: /Pleurote bloc 1/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Tester l’imprimante' }));

    expect(await screen.findByText(/elle répond/)).toBeInTheDocument();
  });

  it('dit comment réagir quand l’imprimante ne répond pas', async () => {
    afficher(
      clientTerrain({
        getQr: () => Promise.resolve({ ok: true, data: { token: 'TOKEN', printCount: 0 } }),
        testPrinter: () =>
          Promise.resolve({ ok: true, data: { transport: 'nimbot-b21', reachable: false } }),
      }),
    );

    await userEvent.click(await screen.findByRole('button', { name: /Pleurote bloc 1/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Tester l’imprimante' }));

    expect(await screen.findByText(/aucune réponse/)).toBeInTheDocument();
  });

  it('remonte l’échec du test imprimante', async () => {
    afficher(
      clientTerrain({
        getQr: () => Promise.resolve({ ok: true, data: { token: 'TOKEN', printCount: 0 } }),
        testPrinter: () => mutationFailed({ code: 'CONFLICT', message: 'Serveur muet.' }),
      }),
    );

    await userEvent.click(await screen.findByRole('button', { name: /Pleurote bloc 1/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Tester l’imprimante' }));

    expect(await screen.findByText('Serveur muet.')).toBeInTheDocument();
  });

  it('attache une photo prise depuis la fiche', async () => {
    const addPhoto = vi.fn(mutationOk);
    afficher(clientTerrain({ addPhoto }));

    await userEvent.click(await screen.findByRole('button', { name: /Pleurote bloc 1/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Prendre une photo' }));
    await screen.findByLabelText('Viseur de prise de photo');
    await userEvent.click(screen.getByRole('button', { name: 'Prendre la photo' }));

    await waitFor(() => {
      expect(addPhoto).toHaveBeenCalledWith('SUB-2026-0042', {
        data: 'data:image/jpeg;base64,AAAA',
      });
    });
  });

  it('affiche les photos déjà prises, servies par l’API', async () => {
    const photo: DomainEvent = {
      id: 'e-photo',
      type: 'unit.photo_added',
      occurredAt: '2026-08-10T08:00:00.000Z',
      recordedAt: '2026-08-10T08:00:00.000Z',
      source: 'manual',
      unitId: 'u-1',
      payload: { photoId: 'ph-1', contentType: 'image/jpeg', byteSize: 2048, note: 'bordure' },
    };
    afficher(
      clientTerrain({
        getTimeline: () => Promise.resolve({ ok: true, data: [photo] }),
      }),
    );

    await userEvent.click(await screen.findByRole('button', { name: /Pleurote bloc 1/ }));

    // L'image est servie par l'API, pas par une donnée embarquée dans la page.
    expect(await screen.findByRole('img', { name: 'bordure' })).toHaveAttribute(
      'src',
      '/api/photos/ph-1',
    );
  });

  /** Peser un flush se fait devant le bloc, donc depuis sa fiche. */
  it('pèse une récolte depuis la fiche d’une unité en fructification', async () => {
    const fruiting = { ...unit, stage: 'fruiting' as const, publicCode: 'FRU-2026-0001' };
    const recordHarvest = vi.fn(mutationOk);
    afficher(
      clientTerrain({
        listUnits: (stage: string) =>
          Promise.resolve({ ok: true, data: stage === 'fruiting' ? [fruiting] : [] }),
        getUnit: () => Promise.resolve({ ok: true, data: fruiting }),
        recordHarvest,
      }),
    );

    await userEvent.click(await screen.findByRole('button', { name: /Pleurote bloc 1/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Peser une récolte' }));
    await userEvent.type(screen.getByLabelText(/Poids récolté/), '820');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer la récolte' }));

    await waitFor(() => {
      expect(recordHarvest).toHaveBeenCalledWith(
        'FRU-2026-0001',
        expect.objectContaining({ flushNumber: 1, quality: 'A' }),
      );
    });
  });

  it('ne propose pas de peser une unité qui n’est pas en fructification', async () => {
    afficher();

    await userEvent.click(await screen.findByRole('button', { name: /Pleurote bloc 1/ }));

    // Un ballot de substrat ne produit rien : l'action n'a pas lieu d'être.
    expect(screen.queryByRole('button', { name: 'Peser une récolte' })).toBeNull();
  });

  it('déduit le numéro du prochain flush du journal', async () => {
    const fruiting = { ...unit, stage: 'fruiting' as const };
    const recolte: DomainEvent = {
      id: 'e-h1',
      type: 'harvest.recorded',
      occurredAt: '2026-08-10T08:00:00.000Z',
      recordedAt: '2026-08-10T08:00:00.000Z',
      source: 'manual',
      unitId: 'u-1',
      payload: {
        harvestId: 'h-1',
        flushNumber: 1,
        weight: { value: 800, unit: 'g', kind: 'harvest' },
      },
    };
    afficher(
      clientTerrain({
        listUnits: (stage: string) =>
          Promise.resolve({ ok: true, data: stage === 'fruiting' ? [fruiting] : [] }),
        getUnit: () => Promise.resolve({ ok: true, data: fruiting }),
        getTimeline: () => Promise.resolve({ ok: true, data: [recolte] }),
      }),
    );

    await userEvent.click(await screen.findByRole('button', { name: /Pleurote bloc 1/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Peser une récolte' }));

    // Un flush déjà pesé : on propose le suivant plutôt que de le faire deviner.
    expect(screen.getByLabelText('Flush')).toHaveValue('2');
  });

  it('referme le formulaire de récolte sur annulation', async () => {
    const fruiting = { ...unit, stage: 'fruiting' as const };
    afficher(
      clientTerrain({
        listUnits: (stage: string) =>
          Promise.resolve({ ok: true, data: stage === 'fruiting' ? [fruiting] : [] }),
        getUnit: () => Promise.resolve({ ok: true, data: fruiting }),
      }),
    );

    await userEvent.click(await screen.findByRole('button', { name: /Pleurote bloc 1/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Peser une récolte' }));
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(screen.getByRole('button', { name: 'Peser une récolte' })).toBeInTheDocument();
  });

  it('ouvre l’onglet Récoltes', async () => {
    afficher();

    await userEvent.click(screen.getByRole('button', { name: 'Récoltes' }));

    expect(await screen.findByRole('heading', { name: 'Récoltes' })).toBeInTheDocument();
  });

  it('survit à une liste indisponible sans écran blanc', async () => {
    afficher(
      clientTerrain({
        listUnits: () => mutationFailed({ code: 'CONFLICT', message: 'base muette' }),
      }),
    );

    // Pas d'unité, mais l'écran reste utilisable : on peut créer ou scanner.
    expect(await screen.findByText(/Aucune unité en cours/)).toBeInTheDocument();
  });

  it('survit à des process indisponibles', async () => {
    afficher(
      clientTerrain({
        listProcessTemplates: () => mutationFailed({ code: 'CONFLICT', message: 'muet' }),
      }),
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Nouvelle unité' }));

    expect(await screen.findByText(/Aucun process publié/)).toBeInTheDocument();
  });

  it('survit à des versions indisponibles', async () => {
    afficher(
      clientTerrain({
        listProcessVersions: () => mutationFailed({ code: 'CONFLICT', message: 'muet' }),
      }),
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Nouvelle unité' }));

    expect(await screen.findByText(/Aucun process publié/)).toBeInTheDocument();
  });
});
