import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatusBanner } from './StatusBanner.js';
import { ScanPanel } from './ScanPanel.js';
import type { ScanEnvironment } from '../lib/scanner.js';

const capable: ScanEnvironment = {
  isSecureContext: true,
  hasMediaDevices: true,
  hasBarcodeDetector: true,
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
  it('annonce que la capture caméra attend la validation iPhone', () => {
    render(<ScanPanel environment={capable} onScan={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Scanner un QR' })).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('validation sur iPhone');
    expect(screen.getByRole('status')).toHaveTextContent('code imprimé sous le QR');
  });

  /**
   * Dire *pourquoi* ça ne marche pas vaut mieux qu'un bouton qui échoue —
   * surtout que la cause n°1 sous iOS est réparable par l'opérateur lui-même.
   */
  it('diagnostique l’absence de HTTPS plutôt que d’échouer sans expliquer', () => {
    render(<ScanPanel environment={{ ...capable, isSecureContext: false }} onScan={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('.ts.net');
    expect(screen.getByRole('status')).toHaveTextContent('adresse IP');
  });

  it('garde la saisie manuelle disponible même sans caméra', () => {
    render(<ScanPanel environment={{ ...capable, hasMediaDevices: false }} onScan={vi.fn()} />);
    expect(screen.getByLabelText(/saisis le code/i)).toBeInTheDocument();
  });

  it('guide la saisie tant que rien n’est tapé', () => {
    render(<ScanPanel environment={capable} onScan={vi.fn()} />);
    expect(screen.getByText('Le code est imprimé sous le QR.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ouvrir la fiche' })).toBeDisabled();
  });

  it('confirme un code d’unité reconnu', async () => {
    render(<ScanPanel environment={capable} onScan={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/saisis le code/i), 'SUB-2026-0042');
    expect(screen.getByText(/Reconnu : code d’unité/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ouvrir la fiche' })).toBeEnabled();
  });

  it('reconnaît un token de QR saisi à la main', async () => {
    render(<ScanPanel environment={capable} onScan={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/saisis le code/i), 'ABCDEFGHJKMNPQRSTUVWXY');
    expect(screen.getByText(/Reconnu : code QR/)).toBeInTheDocument();
  });

  it('signale une saisie non reconnue sans bloquer le champ', async () => {
    render(<ScanPanel environment={capable} onScan={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/saisis le code/i), 'bonjour');
    expect(screen.getByText(/Code non reconnu/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ouvrir la fiche' })).toBeDisabled();
  });

  /** Gants humides, clavier tactile : la casse ne doit pas faire échouer. */
  it('normalise la saisie avant de l’envoyer', async () => {
    const onScan = vi.fn();
    render(<ScanPanel environment={capable} onScan={onScan} />);
    await userEvent.type(screen.getByLabelText(/saisis le code/i), '  sub-2026-0042 ');
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir la fiche' }));
    expect(onScan).toHaveBeenCalledWith({ kind: 'public-code', value: 'SUB-2026-0042' });
  });

  it('vide le champ après une ouverture réussie', async () => {
    render(<ScanPanel environment={capable} onScan={vi.fn()} />);
    const input = screen.getByLabelText(/saisis le code/i);
    await userEvent.type(input, 'SUB-2026-0042{Enter}');
    expect(input).toHaveValue('');
  });

  it('n’ouvre rien quand le formulaire est validé avec un code invalide', async () => {
    const onScan = vi.fn();
    render(<ScanPanel environment={capable} onScan={onScan} />);
    await userEvent.type(screen.getByLabelText(/saisis le code/i), 'bonjour{Enter}');
    expect(onScan).not.toHaveBeenCalled();
  });
});
