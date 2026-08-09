import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatusBanner } from './StatusBanner.js';
import { ScanPanel } from './ScanPanel.js';
import type { ScanEnvironment } from '../lib/scanner.js';

/** Caméra et décodeur factices : aucun test n'ouvre de vraie caméra. */
const CAMERA = () => Promise.resolve({ getTracks: () => [] } as unknown as MediaStream);
const DETECTER = () => Promise.resolve([]);

const capable: ScanEnvironment = {
  isSecureContext: true,
  hasMediaDevices: true,
};

describe('StatusBanner', () => {
  it('ne montre rien quand tout est envoyé et le réseau présent', () => {
    const { container } = render(<StatusBanner pendingCount={0} failedCount={0} online={true} />);
    expect(container).toBeEmptyDOMElement();
  });

  /**
   * « Enregistré » et « en attente d'envoi » sont deux choses différentes.
   * L'opérateur doit pouvoir les distinguer sans réfléchir.
   */
  it('annonce les saisies en attente comme conservées, pas comme perdues', () => {
    render(<StatusBanner pendingCount={3} failedCount={0} online={true} />);
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('3');
    expect(banner).toHaveTextContent('en attente d’envoi');
    expect(banner).toHaveTextContent('conservées sur l’appareil');
  });

  it('accorde au singulier', () => {
    render(<StatusBanner pendingCount={1} failedCount={0} online={true} />);
    expect(screen.getByRole('status')).toHaveTextContent('saisie en attente');
  });

  it('signale les échecs en alerte, au-dessus du reste', () => {
    render(<StatusBanner pendingCount={2} failedCount={1} online={true} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('saisie non envoyée');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('accorde les échecs au pluriel', () => {
    render(<StatusBanner pendingCount={0} failedCount={4} online={true} />);
    expect(screen.getByRole('alert')).toHaveTextContent('saisies non envoyées');
  });

  it('annonce la coupure réseau sans dramatiser', () => {
    render(<StatusBanner pendingCount={0} failedCount={0} online={false} />);
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('Hors réseau');
    expect(banner).toHaveTextContent('envoyées au retour');
  });
});

describe('ScanPanel', () => {
  /**
   * On annonce l'attente du spike iOS plutôt que d'afficher un bouton qui ne
   * ferait rien : un affordance cassé coûte plus cher qu'une phrase honnête.
   */
  /** Un vrai flux : `video.srcObject` vérifie le type, même en happy-dom. */
  function fauxFlux(): MediaStream {
    const stream = new MediaStream();
    Object.defineProperty(stream, 'getTracks', { value: () => [] });
    return stream;
  }

  it('ouvre le viseur puis le referme sans rien scanner', async () => {
    const onScan = vi.fn();
    render(
      <ScanPanel
        environment={capable}
        onScan={onScan}
        ouvrirCamera={() => Promise.resolve(fauxFlux())}
        detecter={() => Promise.resolve([])}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Scanner avec la caméra' }));
    expect(await screen.findByLabelText('Viseur de la caméra')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Fermer la caméra' }));

    expect(screen.queryByLabelText('Viseur de la caméra')).toBeNull();
    expect(onScan).not.toHaveBeenCalled();
  });

  it('referme le viseur dès qu’un code est lu et le remonte', async () => {
    const onScan = vi.fn();
    render(
      <ScanPanel
        environment={capable}
        onScan={onScan}
        ouvrirCamera={() => Promise.resolve(fauxFlux())}
        detecter={() => Promise.resolve(['ZBAKASUB2THMWYV7PUNGJF'])}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Scanner avec la caméra' }));

    // La caméra se coupe d'elle-même : garder le viseur ouvert sur une fiche
    // déjà chargée chaufferait le téléphone pour rien.
    await waitFor(() => {
      expect(onScan).toHaveBeenCalledWith({ kind: 'token', value: 'ZBAKASUB2THMWYV7PUNGJF' });
    });
    await waitFor(() => {
      expect(screen.queryByLabelText('Viseur de la caméra')).toBeNull();
    });
  });

  /**
   * Une fiche est ouverte et la caméra est indisponible — typiquement en HTTP.
   * Le panneau réduit ne répète pas le diagnostic : le champ de saisie, lui,
   * reste là, et c'est le seul chemin qui fonctionne.
   */
  it('reste utilisable en mode réduit quand la caméra est indisponible', () => {
    render(
      <ScanPanel
        environment={{ isSecureContext: false, hasMediaDevices: true }}
        onScan={vi.fn()}
        ouvrirCamera={CAMERA}
        detecter={DETECTER}
        compact
      />,
    );

    expect(screen.queryByRole('button', { name: 'Scanner avec la caméra' })).toBeNull();
    expect(screen.queryByText(/HTTPS/)).toBeNull();
    expect(screen.getByLabelText(/code de l/i)).toBeInTheDocument();
  });

  it('propose d’ouvrir la caméra quand l’environnement le permet', () => {
    render(
      <ScanPanel
        environment={capable}
        onScan={vi.fn()}
        ouvrirCamera={CAMERA}
        detecter={DETECTER}
      />,
    );

    // Le geste normal en chambre est le scan ; la saisie reste le repli.
    expect(screen.getByRole('button', { name: 'Scanner avec la caméra' })).toBeInTheDocument();
    expect(screen.getByLabelText(/code de l/i)).toBeInTheDocument();
  });

  /**
   * Dire *pourquoi* ça ne marche pas vaut mieux qu'un bouton qui échoue —
   * surtout que la cause n°1 sous iOS est réparable par l'opérateur lui-même.
   */
  it('diagnostique l’absence de HTTPS plutôt que d’échouer sans expliquer', () => {
    render(
      <ScanPanel
        environment={{ ...capable, isSecureContext: false }}
        onScan={vi.fn()}
        ouvrirCamera={CAMERA}
        detecter={DETECTER}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('.ts.net');
    expect(screen.getByRole('status')).toHaveTextContent('adresse IP');
  });

  it('garde la saisie manuelle disponible même sans caméra', () => {
    render(
      <ScanPanel
        environment={{ ...capable, hasMediaDevices: false }}
        onScan={vi.fn()}
        ouvrirCamera={CAMERA}
        detecter={DETECTER}
      />,
    );
    expect(screen.getByLabelText(/code de l/i)).toBeInTheDocument();
  });

  it('guide la saisie tant que rien n’est tapé', () => {
    render(
      <ScanPanel
        environment={capable}
        onScan={vi.fn()}
        ouvrirCamera={CAMERA}
        detecter={DETECTER}
      />,
    );
    expect(screen.getByText('Le code est imprimé sous le QR.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ouvrir la fiche' })).toBeDisabled();
  });

  it('confirme un code d’unité reconnu', async () => {
    render(
      <ScanPanel
        environment={capable}
        onScan={vi.fn()}
        ouvrirCamera={CAMERA}
        detecter={DETECTER}
      />,
    );
    await userEvent.type(screen.getByLabelText(/code de l/i), 'SUB-2026-0042');
    expect(screen.getByText(/Reconnu : code d’unité/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ouvrir la fiche' })).toBeEnabled();
  });

  it('reconnaît un token de QR saisi à la main', async () => {
    render(
      <ScanPanel
        environment={capable}
        onScan={vi.fn()}
        ouvrirCamera={CAMERA}
        detecter={DETECTER}
      />,
    );
    await userEvent.type(screen.getByLabelText(/code de l/i), 'ABCDEFGHJKMNPQRSTUVWXY');
    expect(screen.getByText(/Reconnu : code QR/)).toBeInTheDocument();
  });

  it('signale une saisie non reconnue sans bloquer le champ', async () => {
    render(
      <ScanPanel
        environment={capable}
        onScan={vi.fn()}
        ouvrirCamera={CAMERA}
        detecter={DETECTER}
      />,
    );
    await userEvent.type(screen.getByLabelText(/code de l/i), 'bonjour');
    expect(screen.getByText(/Code non reconnu/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ouvrir la fiche' })).toBeDisabled();
  });

  /** Gants humides, clavier tactile : la casse ne doit pas faire échouer. */
  it('normalise la saisie avant de l’envoyer', async () => {
    const onScan = vi.fn();
    render(
      <ScanPanel environment={capable} onScan={onScan} ouvrirCamera={CAMERA} detecter={DETECTER} />,
    );
    await userEvent.type(screen.getByLabelText(/code de l/i), '  sub-2026-0042 ');
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir la fiche' }));
    expect(onScan).toHaveBeenCalledWith({ kind: 'public-code', value: 'SUB-2026-0042' });
  });

  it('vide le champ après une ouverture réussie', async () => {
    render(
      <ScanPanel
        environment={capable}
        onScan={vi.fn()}
        ouvrirCamera={CAMERA}
        detecter={DETECTER}
      />,
    );
    const input = screen.getByLabelText(/code de l/i);
    await userEvent.type(input, 'SUB-2026-0042{Enter}');
    expect(input).toHaveValue('');
  });

  it('n’ouvre rien quand le formulaire est validé avec un code invalide', async () => {
    const onScan = vi.fn();
    render(
      <ScanPanel environment={capable} onScan={onScan} ouvrirCamera={CAMERA} detecter={DETECTER} />,
    );
    await userEvent.type(screen.getByLabelText(/code de l/i), 'bonjour{Enter}');
    expect(onScan).not.toHaveBeenCalled();
  });
});
