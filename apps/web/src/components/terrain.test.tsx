import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CultureUnit, DomainEvent, ProcessGraph } from '@champi/contracts';
import { UnitList, grouperParStade } from './UnitList.js';
import { UnitForm } from './UnitForm.js';
import { LabelPanel } from './LabelPanel.js';
import { PhotoPanel, photosDuJournal } from './PhotoPanel.js';

/**
 * Les écrans de la vague 1 : liste, création, étiquette, photos.
 *
 * Ce qu'ils comblent : jusqu'ici on ne pouvait ni voir ce qui tournait, ni
 * démarrer une culture, ni imprimer une étiquette, ni photographier une unité
 * depuis l'application. Tout cela n'existait qu'en ligne de commande.
 */

const NOW = '2026-08-13T09:00:00.000Z';

function unite(overrides: Partial<CultureUnit> = {}): CultureUnit {
  return {
    id: 'u-1',
    publicCode: 'SUB-2026-0042',
    name: 'Bloc pleurote 12',
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
    ...overrides,
  };
}

describe('liste des unités', () => {
  it('groupe par stade dans l’ordre de la chaîne, et ignore les stades vides', () => {
    const groupes = grouperParStade([
      unite({ id: 'a', stage: 'fruiting' }),
      unite({ id: 'b', stage: 'gelose' }),
      unite({ id: 'c', stage: 'fruiting' }),
    ]);

    // Gélose avant fructification : l'ordre est celui de la propagation, pas
    // celui d'arrivée des données.
    expect(groupes.map((groupe) => groupe.stage)).toEqual(['gelose', 'fruiting']);
    expect(groupes[1]?.unites).toHaveLength(2);
  });

  it('affiche nom, code et ancienneté de chaque unité', () => {
    render(<UnitList unites={[unite()]} nowIso={NOW} chargement={false} onOuvrir={vi.fn()} />);

    expect(screen.getByText('Bloc pleurote 12')).toBeInTheDocument();
    expect(screen.getByText('SUB-2026-0042')).toBeInTheDocument();
    // L'étape en clair, jamais son identifiant, et depuis quand.
    expect(screen.getByText(/Incubation · depuis 12 jours/)).toBeInTheDocument();
  });

  it('compte les unités de chaque stade', () => {
    render(
      <UnitList
        unites={[unite({ id: 'a' }), unite({ id: 'b' })]}
        nowIso={NOW}
        chargement={false}
        onOuvrir={vi.fn()}
      />,
    );

    const titre = screen.getByRole('heading', { name: /Ballot de substrat/ });
    expect(within(titre).getByText('2')).toBeInTheDocument();
  });

  it('invite à créer la première unité quand la ferme est vide', () => {
    render(<UnitList unites={[]} nowIso={NOW} chargement={false} onOuvrir={vi.fn()} />);

    // Un écran vide est une invitation à agir, pas un constat d'échec.
    expect(screen.getByText(/Crée la première/)).toBeInTheDocument();
  });

  it('annonce le chargement plutôt que de laisser croire à une ferme vide', () => {
    render(<UnitList unites={[]} nowIso={NOW} chargement onOuvrir={vi.fn()} />);

    expect(screen.getByText(/Chargement des unités/)).toBeInTheDocument();
    expect(screen.queryByText(/Crée la première/)).toBeNull();
  });

  it('ouvre l’unité sur laquelle on appuie', async () => {
    const onOuvrir = vi.fn();
    render(<UnitList unites={[unite()]} nowIso={NOW} chargement={false} onOuvrir={onOuvrir} />);

    await userEvent.click(screen.getByRole('button', { name: /Bloc pleurote 12/ }));

    expect(onOuvrir).toHaveBeenCalledWith(expect.objectContaining({ publicCode: 'SUB-2026-0042' }));
  });

  it('n’affiche pas d’ancienneté quand la date est incohérente', () => {
    render(
      <UnitList
        unites={[unite({ currentStepEnteredAt: '2026-12-01T08:00:00.000Z' })]}
        nowIso={NOW}
        chargement={false}
        onOuvrir={vi.fn()}
      />,
    );

    // Mieux vaut ne rien dire qu'annoncer « depuis -110 jours ».
    expect(screen.getByText('Incubation')).toBeInTheDocument();
  });
});

const graphe: ProcessGraph = {
  steps: [
    {
      id: 'inoculation',
      name: 'Inoculation substrat',
      stage: 'substrate',
      conditions: {},
      alarms: { enabled: false },
      optional: false,
      provenance: 'cultivator',
    },
    {
      id: 'gelose',
      name: 'Gélose',
      stage: 'gelose',
      conditions: {},
      alarms: { enabled: false },
      optional: false,
      provenance: 'cultivator',
    },
  ],
  transitions: [],
};

const process = [{ versionId: 'pv-1', label: 'Pleurote — version 1', graph: graphe }];

describe('création d’une unité', () => {
  it('n’envoie rien tant que le nom est vide', () => {
    render(<UnitForm processes={process} busy={false} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Créer l’unité' })).toBeDisabled();
  });

  it('crée une unité au stade et à l’étape choisis', async () => {
    const onSubmit = vi.fn();
    render(<UnitForm processes={process} busy={false} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText('Nom de l’unité'), 'Bloc 12');
    await userEvent.click(screen.getByRole('button', { name: 'Créer l’unité' }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Bloc 12',
      stage: 'substrate',
      processVersionId: 'pv-1',
      stepId: 'inoculation',
    });
  });

  /** Une unité peut naître à n'importe quel stade (`q7_2`). */
  it('ne propose que les étapes du stade choisi', async () => {
    render(<UnitForm processes={process} busy={false} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.selectOptions(screen.getByLabelText('Stade'), 'gelose');

    const etapes = within(screen.getByLabelText('Étape de départ'))
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(etapes).toEqual(['Gélose']);
  });

  it('signale un stade sans étape au lieu d’un menu vide inexplicable', async () => {
    render(<UnitForm processes={process} busy={false} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.selectOptions(screen.getByLabelText('Stade'), 'grain');

    expect(screen.getByText(/aucune étape à ce stade/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Créer l’unité' })).toBeDisabled();
  });

  it('garde l’étape choisie quand elle reste valable après un changement', async () => {
    const autre = { versionId: 'pv-2', label: 'Pleurote — version 2', graph: graphe };
    render(
      <UnitForm
        processes={[...process, autre]}
        busy={false}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText('Process'), 'pv-2');

    // Les deux versions portent la même étape : la sélection ne doit pas sauter.
    expect(screen.getByLabelText('Étape de départ')).toHaveValue('inoculation');
  });

  it('ne soumet rien d’incomplet, même en contournant le bouton', () => {
    const onSubmit = vi.fn();
    render(<UnitForm processes={process} busy={false} onSubmit={onSubmit} onCancel={vi.fn()} />);

    // Nom vide : la garde est dans le gestionnaire, pas seulement à l'affichage.
    fireEvent.submit(screen.getByRole('button', { name: 'Annuler' }).closest('form') as Element);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('change d’étape de départ à la demande', async () => {
    const onSubmit = vi.fn();
    const deuxEtapes = {
      versionId: 'pv-1',
      label: 'Pleurote — version 1',
      graph: {
        steps: [
          ...graphe.steps,
          {
            id: 'incubation',
            name: 'Incubation',
            stage: 'substrate' as const,
            conditions: {},
            alarms: { enabled: false },
            optional: false,
            provenance: 'cultivator' as const,
          },
        ],
        transitions: [],
      },
    };
    render(
      <UnitForm processes={[deuxEtapes]} busy={false} onSubmit={onSubmit} onCancel={vi.fn()} />,
    );

    await userEvent.type(screen.getByLabelText('Nom de l’unité'), 'Bloc 12');
    await userEvent.selectOptions(screen.getByLabelText('Étape de départ'), 'incubation');
    await userEvent.click(screen.getByRole('button', { name: 'Créer l’unité' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ stepId: 'incubation' }));
  });

  it('joint le poids de substrat quand il est renseigné', async () => {
    const onSubmit = vi.fn();
    render(<UnitForm processes={process} busy={false} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText('Nom de l’unité'), 'Bloc 12');
    await userEvent.type(screen.getByLabelText(/Poids de substrat/), '5,5');
    await userEvent.click(screen.getByRole('button', { name: 'Créer l’unité' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ substrateWeight: { value: 5.5, unit: 'kg', kind: 'substrate' } }),
    );
  });

  it('refuse un poids qui n’est pas un nombre', async () => {
    render(<UnitForm processes={process} busy={false} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText('Nom de l’unité'), 'Bloc 12');
    await userEvent.type(screen.getByLabelText(/Poids de substrat/), 'lourd');

    expect(screen.getByRole('button', { name: 'Créer l’unité' })).toBeDisabled();
  });

  it('rattache l’unité à son parent quand elle en a un', async () => {
    const onSubmit = vi.fn();
    render(
      <UnitForm
        processes={process}
        parent={unite()}
        busy={false}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: /SUB-2026-0042/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Créer l’unité' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ parentUnitId: 'u-1' }));
  });

  /**
   * La division ne se devine pas : deux sacs issus d'un même bloc restent au
   * même stade qu'un clone. Elle se choisit donc explicitement.
   */
  it('permet de déclarer une division plutôt que de la laisser déduire', async () => {
    const onSubmit = vi.fn();
    render(
      <UnitForm
        processes={process}
        parent={unite()}
        busy={false}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText(/Lien avec/), 'split');
    await userEvent.click(screen.getByRole('button', { name: 'Créer l’unité' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ lineageRelation: 'split' }));
  });

  it('laisse l’application déduire la relation par défaut', async () => {
    const onSubmit = vi.fn();
    render(
      <UnitForm
        processes={process}
        parent={unite()}
        busy={false}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText(/Lien avec/), 'clone');
    await userEvent.selectOptions(screen.getByLabelText(/Lien avec/), '');
    await userEvent.click(screen.getByRole('button', { name: 'Créer l’unité' }));

    // Rien n'est envoyé : c'est le serveur qui déduit clone ou transfert.
    const envoye = onSubmit.mock.calls[0]?.[0] as Record<string, unknown>;
    expect('lineageRelation' in envoye).toBe(false);
  });

  it('n’affiche pas de choix de lignée sans parent', () => {
    render(<UnitForm processes={process} busy={false} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByLabelText(/Lien avec/)).toBeNull();
  });

  /** Une unité est toujours épinglée à une version : sans process, rien n'est possible. */
  it('explique l’impasse quand aucun process n’est publié', () => {
    render(<UnitForm processes={[]} busy={false} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText(/Aucun process publié/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Nom de l’unité')).toBeNull();
  });

  it('désactive la création pendant un envoi', async () => {
    render(<UnitForm processes={process} busy onSubmit={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText('Nom de l’unité'), 'Bloc 12');
    expect(screen.getByRole('button', { name: 'Créer l’unité' })).toBeDisabled();
  });

  it('annule sans rien envoyer', async () => {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    render(<UnitForm processes={process} busy={false} onSubmit={onSubmit} onCancel={onCancel} />);

    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('étiquette', () => {
  it('propose d’attribuer un QR quand l’unité n’en a pas', async () => {
    const onAssigner = vi.fn();
    render(
      <LabelPanel
        token={null}
        printCount={0}
        busy={false}
        onAssigner={onAssigner}
        onImprimer={vi.fn()}
        onTester={vi.fn()}
      />,
    );

    expect(screen.getByText(/ne peut pas être scannée/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Attribuer un QR' }));
    expect(onAssigner).toHaveBeenCalledOnce();
  });

  it('affiche le token et propose l’impression', async () => {
    const onImprimer = vi.fn();
    render(
      <LabelPanel
        token="ZBAKASUB2THMWYV7PUNGJF"
        printCount={0}
        busy={false}
        onAssigner={vi.fn()}
        onImprimer={onImprimer}
        onTester={vi.fn()}
      />,
    );

    expect(screen.getByText('ZBAKASUB2THMWYV7PUNGJF')).toBeInTheDocument();
    expect(screen.getByText('Jamais imprimée.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Imprimer l’étiquette' }));
    expect(onImprimer).toHaveBeenCalledOnce();
  });

  /**
   * Une réimpression réutilise le **même** token (`q17_5`) : l'écran le dit,
   * sans quoi on croirait obtenir une nouvelle étiquette pour la même unité.
   */
  it('annonce qu’une réimpression porte le même QR', () => {
    render(
      <LabelPanel
        token="ZBAKASUB2THMWYV7PUNGJF"
        printCount={1}
        busy={false}
        onAssigner={vi.fn()}
        onImprimer={vi.fn()}
        onTester={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/1 étiquette imprimée — une réimpression portera le même QR/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Réimprimer la même étiquette' }),
    ).toBeInTheDocument();
  });

  it('accorde le compteur au pluriel', () => {
    render(
      <LabelPanel
        token="T"
        printCount={3}
        busy={false}
        onAssigner={vi.fn()}
        onImprimer={vi.fn()}
        onTester={vi.fn()}
      />,
    );

    expect(screen.getByText(/3 étiquettes imprimées/)).toBeInTheDocument();
  });

  it('teste l’imprimante sans imprimer', async () => {
    const onTester = vi.fn();
    const onImprimer = vi.fn();
    render(
      <LabelPanel
        token="T"
        printCount={0}
        busy={false}
        onAssigner={vi.fn()}
        onImprimer={onImprimer}
        onTester={onTester}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Tester l’imprimante' }));

    expect(onTester).toHaveBeenCalledOnce();
    expect(onImprimer).not.toHaveBeenCalled();
  });

  it('désactive tout pendant un envoi', () => {
    render(
      <LabelPanel
        token="T"
        printCount={0}
        busy
        onAssigner={vi.fn()}
        onImprimer={vi.fn()}
        onTester={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /Imprimer/ })).toBeDisabled();
  });
});

function photoEvent(photoId: string, note?: string): DomainEvent {
  return {
    id: `e-${photoId}`,
    type: 'unit.photo_added',
    occurredAt: '2026-08-10T08:00:00.000Z',
    recordedAt: '2026-08-10T08:00:00.000Z',
    source: 'manual',
    unitId: 'u-1',
    payload: {
      photoId,
      contentType: 'image/jpeg',
      byteSize: 1024,
      ...(note === undefined ? {} : { note }),
    },
  };
}

function fauxFlux(): { stream: MediaStream; stop: ReturnType<typeof vi.fn> } {
  const stop = vi.fn();
  const stream = new MediaStream();
  Object.defineProperty(stream, 'getTracks', { value: () => [{ stop }] });
  return { stream, stop };
}

describe('photos', () => {
  it('lit les photos dans le journal, les plus récentes d’abord', () => {
    const photos = photosDuJournal([photoEvent('ph-1'), photoEvent('ph-2', 'point vert')]);

    expect(photos.map((photo) => photo.photoId)).toEqual(['ph-2', 'ph-1']);
    expect(photos[0]?.note).toBe('point vert');
  });

  it('invite à photographier quand il n’y a rien', () => {
    render(
      <PhotoPanel
        events={[]}
        urlDe={(id) => `/api/photos/${id}`}
        ouvrirCamera={() => Promise.resolve(fauxFlux().stream)}
        capturer={() => 'data:image/jpeg;base64,AAAA'}
        busy={false}
        onPhoto={vi.fn()}
      />,
    );

    expect(screen.getByText(/Aucune photo/)).toBeInTheDocument();
  });

  it('affiche la galerie, en décrivant chaque image', () => {
    render(
      <PhotoPanel
        events={[photoEvent('ph-1', 'front de colonisation')]}
        urlDe={(id) => `/api/photos/${id}`}
        ouvrirCamera={() => Promise.resolve(fauxFlux().stream)}
        capturer={() => 'data:image/jpeg;base64,AAAA'}
        busy={false}
        onPhoto={vi.fn()}
      />,
    );

    const image = screen.getByRole('img', { name: 'front de colonisation' });
    expect(image).toHaveAttribute('src', '/api/photos/ph-1');
  });

  it('décrit une photo sans note par sa date', () => {
    render(
      <PhotoPanel
        events={[photoEvent('ph-1')]}
        urlDe={(id) => `/api/photos/${id}`}
        ouvrirCamera={() => Promise.resolve(fauxFlux().stream)}
        capturer={() => 'data:image/jpeg;base64,AAAA'}
        busy={false}
        onPhoto={vi.fn()}
      />,
    );

    expect(screen.getByRole('img', { name: /Photo du 2026-08-10/ })).toBeInTheDocument();
  });

  it('prend une photo et rend son image', async () => {
    const onPhoto = vi.fn();
    const { stream, stop } = fauxFlux();
    render(
      <PhotoPanel
        events={[]}
        urlDe={(id) => `/api/photos/${id}`}
        ouvrirCamera={() => Promise.resolve(stream)}
        capturer={() => 'data:image/jpeg;base64,PHOTO'}
        busy={false}
        onPhoto={onPhoto}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Prendre une photo' }));
    await screen.findByLabelText('Viseur de prise de photo');
    await userEvent.click(screen.getByRole('button', { name: 'Prendre la photo' }));

    expect(onPhoto).toHaveBeenCalledWith('data:image/jpeg;base64,PHOTO');
    // La caméra se referme aussitôt : elle n'a plus rien à faire ouverte.
    await waitFor(() => {
      expect(stop).toHaveBeenCalled();
    });
  });

  it('referme le viseur sur annulation, et rend la caméra', async () => {
    const { stream, stop } = fauxFlux();
    const onPhoto = vi.fn();
    render(
      <PhotoPanel
        events={[]}
        urlDe={(id) => `/api/photos/${id}`}
        ouvrirCamera={() => Promise.resolve(stream)}
        capturer={() => 'data:image/jpeg;base64,AAAA'}
        busy={false}
        onPhoto={onPhoto}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Prendre une photo' }));
    await screen.findByLabelText('Viseur de prise de photo');
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(screen.queryByLabelText('Viseur de prise de photo')).toBeNull();
    expect(onPhoto).not.toHaveBeenCalled();
    expect(stop).toHaveBeenCalled();
  });

  it('rend la caméra quand la fiche est quittée viseur ouvert', async () => {
    const { stream, stop } = fauxFlux();
    const { unmount } = render(
      <PhotoPanel
        events={[]}
        urlDe={(id) => `/api/photos/${id}`}
        ouvrirCamera={() => Promise.resolve(stream)}
        capturer={() => 'data:image/jpeg;base64,AAAA'}
        busy={false}
        onPhoto={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Prendre une photo' }));
    await screen.findByLabelText('Viseur de prise de photo');
    unmount();

    // Quitter l'écran doit rendre la caméra, pas la laisser tourner.
    await waitFor(() => {
      expect(stop).toHaveBeenCalled();
    });
  });

  it('explique un refus de caméra au lieu d’un écran noir', async () => {
    render(
      <PhotoPanel
        events={[]}
        urlDe={(id) => `/api/photos/${id}`}
        ouvrirCamera={() => Promise.reject(new Error('refus'))}
        capturer={() => 'data:image/jpeg;base64,AAAA'}
        busy={false}
        onPhoto={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Prendre une photo' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/n’a pas pu s’ouvrir/);
  });

  it('rend une caméra accordée après la fermeture du viseur', async () => {
    const { stream, stop } = fauxFlux();
    let accorder: (flux: MediaStream) => void = () => undefined;
    const { unmount } = render(
      <PhotoPanel
        events={[]}
        urlDe={(id) => `/api/photos/${id}`}
        ouvrirCamera={() =>
          new Promise<MediaStream>((resolve) => {
            accorder = resolve;
          })
        }
        capturer={() => 'data:image/jpeg;base64,AAAA'}
        busy={false}
        onPhoto={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Prendre une photo' }));
    await screen.findByLabelText('Viseur de prise de photo');
    unmount();
    accorder(stream);

    await waitFor(() => {
      expect(stop).toHaveBeenCalled();
    });
  });
});
