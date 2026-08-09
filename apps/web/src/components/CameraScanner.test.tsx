import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CameraScanner, choisirCode } from './CameraScanner.js';

/**
 * Le viseur.
 *
 * La caméra et le décodeur sont injectés : ces tests vérifient **tout sauf le
 * matériel** — l'ouverture, la lecture, le refus d'autorisation, et surtout la
 * libération de la caméra. Une caméra laissée ouverte chauffe le téléphone et
 * vide la batterie en pleine tournée.
 */

const TOKEN = 'ZBAKASUB2THMWYV7PUNGJF';

/**
 * Un vrai `MediaStream`, dont on remplace les pistes.
 *
 * Un objet quelconque ne suffit pas : `video.srcObject` vérifie le type, dans
 * le navigateur comme dans happy-dom. Le double doit donc être un vrai flux —
 * ce qui, au passage, rapproche le test du comportement réel.
 */
function fauxFlux() {
  const stop = vi.fn();
  const stream = new MediaStream();
  Object.defineProperty(stream, 'getTracks', { value: () => [{ stop }] });
  return { stream, stop };
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('choisirCode', () => {
  it('retient le token opaque', () => {
    expect(choisirCode([TOKEN])).toEqual({ kind: 'token', value: TOKEN });
  });

  it('retient un code public lisible', () => {
    expect(choisirCode(['SUB-2026-0042'])).toEqual({ kind: 'public-code', value: 'SUB-2026-0042' });
  });

  /** Des sacs voisins entrent dans le cadre : on ne prend pas une fiche au hasard. */
  it('ignore ce qu’il ne reconnaît pas et retient le premier code valide', () => {
    expect(choisirCode(['bonjour', 'https://exemple.fr', TOKEN])).toEqual({
      kind: 'token',
      value: TOKEN,
    });
  });

  it('ne retient rien quand aucun code n’est exploitable', () => {
    expect(choisirCode(['bonjour', ''])).toBeNull();
  });

  it('ne retient rien d’une image vide', () => {
    expect(choisirCode([])).toBeNull();
  });
});

describe('viseur', () => {
  it('ouvre la caméra et invite à cadrer', async () => {
    const { stream } = fauxFlux();
    render(
      <CameraScanner
        ouvrirCamera={() => Promise.resolve(stream)}
        detecter={() => Promise.resolve([])}
        onScan={vi.fn()}
        onFermer={vi.fn()}
      />,
    );

    expect(await screen.findByText(/Cadre le QR/)).toBeInTheDocument();
    expect(screen.getByLabelText('Viseur de la caméra')).toBeInTheDocument();
  });

  it('remonte le premier code reconnu', async () => {
    const { stream } = fauxFlux();
    const onScan = vi.fn();
    render(
      <CameraScanner
        ouvrirCamera={() => Promise.resolve(stream)}
        detecter={() => Promise.resolve([TOKEN])}
        intervalleMs={10}
        onScan={onScan}
        onFermer={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(onScan).toHaveBeenCalledWith({ kind: 'token', value: TOKEN });
    });
  });

  it('continue de lire tant que rien n’est reconnu', async () => {
    const { stream } = fauxFlux();
    const detecter = vi.fn(() => Promise.resolve(['rien du tout']));
    const onScan = vi.fn();
    render(
      <CameraScanner
        ouvrirCamera={() => Promise.resolve(stream)}
        detecter={detecter}
        intervalleMs={10}
        onScan={onScan}
        onFermer={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(detecter.mock.calls.length).toBeGreaterThan(1);
    });
    expect(onScan).not.toHaveBeenCalled();
  });

  /** Un décodeur qui lève ne doit pas figer le viseur. */
  it('survit à une lecture qui échoue', async () => {
    const { stream } = fauxFlux();
    const detecter = vi.fn(() => Promise.reject(new Error('image illisible')));
    render(
      <CameraScanner
        ouvrirCamera={() => Promise.resolve(stream)}
        detecter={detecter}
        intervalleMs={10}
        onScan={vi.fn()}
        onFermer={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(detecter.mock.calls.length).toBeGreaterThan(1);
    });
    expect(screen.getByText(/Cadre le QR/)).toBeInTheDocument();
  });

  it('explique un refus d’autorisation plutôt que d’afficher un écran noir', async () => {
    const refus = new Error('refusé');
    refus.name = 'NotAllowedError';
    render(
      <CameraScanner
        ouvrirCamera={() => Promise.reject(refus)}
        detecter={() => Promise.resolve([])}
        onScan={vi.fn()}
        onFermer={vi.fn()}
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/Accès à la caméra refusé/);
  });

  it('reste compréhensible quand la caméra échoue pour une autre raison', async () => {
    render(
      <CameraScanner
        ouvrirCamera={() => Promise.reject(new Error('caméra occupée'))}
        detecter={() => Promise.resolve([])}
        onScan={vi.fn()}
        onFermer={vi.fn()}
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(/n’a pas pu s’ouvrir/);
  });

  it('libère la caméra à la fermeture', async () => {
    const { stream, stop } = fauxFlux();
    const { unmount } = render(
      <CameraScanner
        ouvrirCamera={() => Promise.resolve(stream)}
        detecter={() => Promise.resolve([])}
        onScan={vi.fn()}
        onFermer={vi.fn()}
      />,
    );
    await screen.findByText(/Cadre le QR/);

    unmount();

    expect(stop).toHaveBeenCalledOnce();
  });

  /**
   * L'autorisation peut arriver après la fermeture de l'écran : on rend alors
   * la caméra au système plutôt que de la garder ouverte pour personne.
   */
  it('rend une caméra accordée trop tard', async () => {
    const { stream, stop } = fauxFlux();
    let accorder: (flux: MediaStream) => void = () => undefined;
    const { unmount } = render(
      <CameraScanner
        ouvrirCamera={() =>
          new Promise<MediaStream>((resolve) => {
            accorder = resolve;
          })
        }
        detecter={() => Promise.resolve([])}
        onScan={vi.fn()}
        onFermer={vi.fn()}
      />,
    );

    unmount();
    accorder(stream);

    await waitFor(() => {
      expect(stop).toHaveBeenCalledOnce();
    });
  });

  it('se referme sur demande', async () => {
    const { stream } = fauxFlux();
    const onFermer = vi.fn();
    render(
      <CameraScanner
        ouvrirCamera={() => Promise.resolve(stream)}
        detecter={() => Promise.resolve([])}
        onScan={vi.fn()}
        onFermer={onFermer}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Fermer la caméra' }));

    expect(onFermer).toHaveBeenCalledOnce();
  });
});
