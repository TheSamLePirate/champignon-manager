import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ProcessGraph } from '@champi/contracts';
import { ProcessWorkbench } from './ProcessWorkbench.js';
import type { ApiClient } from '../lib/api-client.js';

/**
 * L'écran de configuration des process.
 *
 * Ce que ces tests protègent avant tout : **l'éditeur reste atteignable et
 * relié à l'API**. Les composants du canvas étaient entièrement testés alors
 * qu'aucun écran ne les montait (D-28) — une couverture à 100 % ne dit rien de
 * l'accessibilité depuis l'application.
 */

function step(id: string, name: string) {
  return {
    id,
    name,
    stage: 'substrate',
    conditions: {},
    alarms: { enabled: false },
    optional: false,
    provenance: 'cultivator',
  } as const;
}

const graph: ProcessGraph = {
  steps: [step('inoculation', 'Inoculation'), step('incubation', 'Incubation')],
  transitions: [{ from: 'inoculation', to: 'incubation' }],
};

const template = { id: 't-1', name: 'Pleurote', currentVersionId: 'v-1' };
const brouillon = { id: 'v-1', versionNumber: 1, status: 'draft', graph };
const publiee = { id: 'v-1', versionNumber: 1, status: 'published', graph };
const brouillonV2 = { id: 'v-2', versionNumber: 2, status: 'draft', graph };

function fakeClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    listProcessTemplates: () => Promise.resolve({ ok: true, data: [template] }),
    listProcessVersions: () => Promise.resolve({ ok: true, data: [brouillon] }),
    saveProcessGraph: () => Promise.resolve({ ok: true, data: { id: 'v-1' } }),
    publishProcessVersion: () => Promise.resolve({ ok: true, data: { status: 'published' } }),
    draftProcessVersion: () => Promise.resolve({ ok: true, data: { id: 'v-2', versionNumber: 2 } }),
    ...overrides,
  } as unknown as ApiClient;
}

function renderWorkbench(client: ApiClient = fakeClient()) {
  const onMessage = vi.fn();
  render(<ProcessWorkbench client={client} onMessage={onMessage} />);
  return { onMessage };
}

/** Rend une liste de versions différente à chaque appel — pour suivre un cycle. */
function versionsSuccessives(...lots: (typeof brouillon)[][]) {
  let appel = -1;
  return () => {
    appel = Math.min(appel + 1, lots.length - 1);
    return Promise.resolve({ ok: true, data: lots[appel] });
  };
}

describe('ouverture', () => {
  it('charge le premier process et affiche son canvas', async () => {
    renderWorkbench();

    // Le titre de l'éditeur prouve que le canvas est monté, pas seulement la liste.
    expect(await screen.findByRole('heading', { name: 'Éditeur de process' })).toBeTruthy();
    expect(screen.getByText(/Version 1 — brouillon/)).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Pleurote' })).toBeTruthy();
  });

  /**
   * La dernière version, pas celle que désigne le modèle : `currentVersionId`
   * n'est pas déplacé par une publication (D-29).
   */
  it('ouvre la dernière version, pas la version d’origine', async () => {
    renderWorkbench(
      fakeClient({
        listProcessVersions: () => Promise.resolve({ ok: true, data: [publiee, brouillonV2] }),
      }),
    );

    expect(await screen.findByText(/Version 2 — brouillon/)).toBeTruthy();
  });

  it('annonce une base sans aucun process', async () => {
    renderWorkbench(
      fakeClient({ listProcessTemplates: () => Promise.resolve({ ok: true, data: [] }) }),
    );

    expect(await screen.findByText('Aucun process enregistré.')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Éditeur de process' })).toBeNull();
  });

  it('remonte l’indice du serveur quand la liste échoue', async () => {
    const { onMessage } = renderWorkbench(
      fakeClient({
        listProcessTemplates: () =>
          Promise.resolve({
            ok: false,
            error: { code: 'NOT_FOUND', message: 'Aucun process accessible.', hint: 'Réessaie.' },
            offline: false,
          }),
      }),
    );

    await waitFor(() => {
      expect(onMessage).toHaveBeenCalledWith('Réessaie.');
    });
  });

  it('remonte le message quand les versions ne se chargent pas', async () => {
    const { onMessage } = renderWorkbench(
      fakeClient({
        listProcessVersions: () =>
          Promise.resolve({
            ok: false,
            error: { code: 'NOT_FOUND', message: 'Process inconnu.' },
            offline: false,
          }),
      }),
    );

    await waitFor(() => {
      expect(onMessage).toHaveBeenCalledWith('Process inconnu.');
    });
  });

  it('n’affiche aucun éditeur pour un process encore sans version', async () => {
    renderWorkbench(
      fakeClient({ listProcessVersions: () => Promise.resolve({ ok: true, data: [] }) }),
    );

    expect(await screen.findByRole('option', { name: 'Pleurote' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Éditeur de process' })).toBeNull();
  });
});

describe('création d’un process', () => {
  /**
   * Partir d'une page blanche condamnerait à tout ressaisir. On repart du
   * modèle de `docs/20`, que l'éditeur permet ensuite de tailler.
   */
  it('crée un process à partir du modèle par défaut', async () => {
    const createProcessTemplate = vi.fn((_nom: string, _graphe: unknown) =>
      Promise.resolve({ ok: true, data: { template: { id: 't-2' }, version: { id: 'v-9' } } }),
    );
    const { onMessage } = renderWorkbench(
      fakeClient({
        createProcessTemplate:
          createProcessTemplate as unknown as ApiClient['createProcessTemplate'],
      }),
    );

    await userEvent.type(await screen.findByLabelText('Nouveau process'), 'Shiitake sur bûche');
    await userEvent.click(screen.getByRole('button', { name: /Créer à partir du modèle/ }));

    await waitFor(() => {
      const [nom, graphe] = createProcessTemplate.mock.calls[0] ?? [];
      expect(nom).toBe('Shiitake sur bûche');
      // Le graphe livré n'est pas vide : c'est le modèle par défaut, avec ses
      // étapes et leur provenance.
      expect((graphe as { steps: unknown[] }).steps.length).toBeGreaterThan(0);
    });
    expect(onMessage).toHaveBeenCalledWith(expect.stringContaining('en brouillon'));
  });

  it('exige un nom avant de créer', async () => {
    renderWorkbench();

    expect(await screen.findByRole('button', { name: /Créer à partir du modèle/ })).toBeDisabled();
  });

  it('remonte le refus du serveur à la création', async () => {
    const { onMessage } = renderWorkbench(
      fakeClient({
        createProcessTemplate: () =>
          Promise.resolve({
            ok: false,
            error: { code: 'CONFLICT', message: 'Nom déjà pris.' },
            offline: false,
          }),
      }),
    );

    await userEvent.type(await screen.findByLabelText('Nouveau process'), 'Pleurote');
    await userEvent.click(screen.getByRole('button', { name: /Créer à partir du modèle/ }));

    await waitFor(() => {
      expect(onMessage).toHaveBeenCalledWith('Nom déjà pris.');
    });
  });

  it('refuse de créer un process hors ligne', async () => {
    const { onMessage } = renderWorkbench(
      fakeClient({
        createProcessTemplate: () => Promise.resolve({ ok: true, queued: true, pendingCount: 1 }),
      }),
    );

    await userEvent.type(await screen.findByLabelText('Nouveau process'), 'Pleurote');
    await userEvent.click(screen.getByRole('button', { name: /Créer à partir du modèle/ }));

    await waitFor(() => {
      expect(onMessage).toHaveBeenCalledWith(expect.stringContaining('hors ligne'));
    });
  });
});

describe('choix du process', () => {
  it('charge les versions du process sélectionné', async () => {
    const listProcessVersions = vi.fn(() => Promise.resolve({ ok: true, data: [brouillon] }));
    renderWorkbench(
      fakeClient({
        listProcessTemplates: () =>
          Promise.resolve({ ok: true, data: [template, { id: 't-2', name: 'Shiitake' }] }),
        listProcessVersions: listProcessVersions as unknown as ApiClient['listProcessVersions'],
      }),
    );

    await screen.findByRole('heading', { name: 'Éditeur de process' });
    await userEvent.selectOptions(screen.getByLabelText('Process à configurer'), 't-2');

    await waitFor(() => {
      expect(listProcessVersions).toHaveBeenCalledWith('t-2');
    });
  });
});

describe('version publiée', () => {
  const publieClient = (overrides: Partial<ApiClient> = {}) =>
    fakeClient({
      listProcessVersions: () => Promise.resolve({ ok: true, data: [publiee] }),
      ...overrides,
    });

  it('s’affiche en lecture seule — une version publiée est immuable', async () => {
    renderWorkbench(publieClient());

    expect(await screen.findByText('Version publiée — lecture seule.')).toBeTruthy();
    // Ni ajout d'étape, ni enregistrement : les formulaires d'édition sont absents.
    expect(screen.queryByLabelText('Nouvelle étape')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Enregistrer le brouillon' })).toBeNull();
  });

  it('annonce le numéro de la version que « Modifier » créera', async () => {
    renderWorkbench(publieClient());

    expect(
      await screen.findByRole('button', { name: 'Modifier — crée la version 2' }),
    ).toBeTruthy();
  });

  it('ouvre un brouillon et bascule sur la nouvelle version', async () => {
    const draftProcessVersion = vi.fn(() =>
      Promise.resolve({ ok: true, data: { id: 'v-2', versionNumber: 2 } }),
    );

    renderWorkbench(
      fakeClient({
        draftProcessVersion: draftProcessVersion as unknown as ApiClient['draftProcessVersion'],
        listProcessVersions: versionsSuccessives(
          [publiee],
          [publiee, brouillonV2],
        ) as unknown as ApiClient['listProcessVersions'],
      }),
    );

    await userEvent.click(await screen.findByRole('button', { name: /Modifier/ }));

    await waitFor(() => {
      expect(draftProcessVersion).toHaveBeenCalledWith('v-1');
    });
    expect(await screen.findByText(/Version 2 — brouillon/)).toBeTruthy();
  });

  it('montre ce qui change par rapport à la version publiée', async () => {
    renderWorkbench(
      fakeClient({
        listProcessVersions: versionsSuccessives(
          [publiee],
          [publiee, brouillonV2],
        ) as unknown as ApiClient['listProcessVersions'],
      }),
    );

    await userEvent.click(await screen.findByRole('button', { name: /Modifier/ }));
    await screen.findByLabelText('Nouvelle étape');
    await userEvent.type(screen.getByLabelText('Nouvelle étape'), 'Flush 1');
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

    // Le diff se lit par rapport à ce qui tourne, pas au brouillon lui-même.
    expect(await screen.findByText(/1 étape ajoutée/)).toBeTruthy();
  });

  it('remonte le refus du serveur quand le brouillon échoue', async () => {
    const { onMessage } = renderWorkbench(
      publieClient({
        draftProcessVersion: () =>
          Promise.resolve({
            ok: false,
            error: { code: 'CONFLICT', message: 'Brouillon déjà ouvert.' },
            offline: false,
          }),
      }),
    );

    await userEvent.click(await screen.findByRole('button', { name: /Modifier/ }));

    await waitFor(() => {
      expect(onMessage).toHaveBeenCalledWith('Brouillon déjà ouvert.');
    });
  });
});

describe('brouillon', () => {
  it('enregistre le graphe édité', async () => {
    const saveProcessGraph = vi.fn(() => Promise.resolve({ ok: true, data: { id: 'v-1' } }));
    const { onMessage } = renderWorkbench(
      fakeClient({
        saveProcessGraph: saveProcessGraph as unknown as ApiClient['saveProcessGraph'],
      }),
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Enregistrer le brouillon' }));

    await waitFor(() => {
      expect(saveProcessGraph).toHaveBeenCalledWith('v-1', graph);
      expect(onMessage).toHaveBeenCalledWith('Brouillon enregistré.');
    });
  });

  it('enregistre ce qui vient d’être édité, puis publie', async () => {
    const saveProcessGraph = vi.fn((_id: string, _graph: ProcessGraph) =>
      Promise.resolve({ ok: true, data: { id: 'v-1' } }),
    );
    const publishProcessVersion = vi.fn(() =>
      Promise.resolve({ ok: true, data: { status: 'published' } }),
    );
    const { onMessage } = renderWorkbench(
      fakeClient({
        saveProcessGraph: saveProcessGraph as unknown as ApiClient['saveProcessGraph'],
        publishProcessVersion:
          publishProcessVersion as unknown as ApiClient['publishProcessVersion'],
      }),
    );

    // On modifie réellement le graphe avant de publier : c'est le cas qui
    // révélerait un enregistrement oublié.
    await userEvent.type(await screen.findByLabelText('Nouvelle étape'), 'Fructification');
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));
    await userEvent.click(screen.getByRole('button', { name: 'Publier cette version' }));

    await waitFor(() => {
      const envoye = saveProcessGraph.mock.calls[0]?.[1] ?? graph;
      expect(envoye.steps.map((etape) => etape.name)).toContain('Fructification');
      expect(publishProcessVersion).toHaveBeenCalledWith('v-1');
      expect(onMessage).toHaveBeenCalledWith(
        'Version publiée. Aucune unité en cours n’a changé de version.',
      );
    });
  });

  it('ne publie pas si l’enregistrement préalable échoue', async () => {
    const publishProcessVersion = vi.fn();
    const { onMessage } = renderWorkbench(
      fakeClient({
        saveProcessGraph: () =>
          Promise.resolve({
            ok: false,
            error: { code: 'VERSION_PUBLISHED_IMMUTABLE', message: 'Version figée.' },
            offline: false,
          }),
        publishProcessVersion:
          publishProcessVersion as unknown as ApiClient['publishProcessVersion'],
      }),
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Publier cette version' }));

    await waitFor(() => {
      expect(onMessage).toHaveBeenCalledWith('Version figée.');
    });
    expect(publishProcessVersion).not.toHaveBeenCalled();
  });

  it('remonte un refus de publication', async () => {
    const { onMessage } = renderWorkbench(
      fakeClient({
        publishProcessVersion: () =>
          Promise.resolve({
            ok: false,
            error: { code: 'VALIDATION_FAILED', message: 'Graphe invalide.', hint: 'Relie tout.' },
            offline: false,
          }),
      }),
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Publier cette version' }));

    await waitFor(() => {
      expect(onMessage).toHaveBeenCalledWith('Relie tout.');
    });
  });

  /**
   * Hors ligne, la file locale mettrait les écritures de côté. Pour une unité
   * c'est souhaitable ; pour un process ce serait dangereux — deux versions
   * publiées dans un ordre imprévisible.
   */
  it('refuse franchement de configurer hors ligne', async () => {
    const { onMessage } = renderWorkbench(
      fakeClient({
        saveProcessGraph: () => Promise.resolve({ ok: true, queued: true, pendingCount: 1 }),
      }),
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Enregistrer le brouillon' }));

    await waitFor(() => {
      expect(onMessage).toHaveBeenCalledWith(
        'Configuration impossible hors ligne — reconnecte-toi pour modifier un process.',
      );
    });
  });
});
