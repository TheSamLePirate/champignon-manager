import { describe, expect, it, vi } from 'vitest';
import type { LabelContent } from '@champi/domain';
import { B21_GEOMETRY, B21Transport, composeB21Job, type B21Driver, type B21Job } from './b21.js';

/**
 * Le transport B21.
 *
 * Ce qui se teste ici est ce qui peut se tester sans radio : la composition de
 * l'étiquette et le comportement du transport. L'accès BLE lui-même est un
 * port injecté — il se vérifie imprimante en main, pas ici.
 */

const label: LabelContent = {
  name: 'Bloc pleurote 12',
  type: 'Ballot de substrat',
  date: '08/08/2026',
  publicCode: 'SUB-2026-0042',
  qrToken: 'ABCDEFGHJKMNPQRSTUVWXY',
};

function fakeDriver(overrides: Partial<B21Driver> = {}): B21Driver & { jobs: B21Job[] } {
  const jobs: B21Job[] = [];
  return {
    jobs,
    probe: () => Promise.resolve(true),
    printQr: (job) => {
      jobs.push(job);
      return Promise.resolve();
    },
    ...overrides,
  };
}

describe('composeB21Job', () => {
  it('met le nom en titre et le reste en légende', () => {
    const job = composeB21Job(label, 1);

    expect(job.title).toBe('Bloc pleurote 12');
    // Les quatre éléments demandés par le cultivateur (`q17_4`) sont là.
    expect(job.caption).toBe('Ballot de substrat · 08/08/2026 · SUB-2026-0042');
  });

  /**
   * Le QR ne porte **que** le token opaque. Y mettre une URL ou un code métier
   * rendrait une étiquette photographiée exploitable hors de la ferme.
   */
  it('n’encode que le token opaque dans le QR', () => {
    const job = composeB21Job(label, 1);

    expect(job.data).toBe('ABCDEFGHJKMNPQRSTUVWXY');
    expect(job.data).not.toContain('SUB-2026');
    expect(job.data).not.toContain('http');
  });

  it('reprend la géométrie 50×30 mm de la B21 Pro', () => {
    const job = composeB21Job(label, 1);

    expect(job.widthPx).toBe(584);
    expect(job.heightPx).toBe(354);
    // La largeur doit être un multiple de 8 : l'encodeur NIIMBOT empile les
    // colonnes par octets, et une largeur bancale échoue à l'envoi.
    expect(job.widthPx % 8).toBe(0);
    expect(job.density).toBe(B21_GEOMETRY.density);
  });

  it('transmet le nombre de copies demandé', () => {
    expect(composeB21Job(label, 3).copies).toBe(3);
  });
});

describe('B21Transport', () => {
  it('se nomme, pour que le test imprimante dise sur quoi il porte', () => {
    expect(new B21Transport(fakeDriver()).name).toBe('nimbot-b21');
  });

  it('sonde l’imprimante sans rien imprimer', async () => {
    const printQr = vi.fn(() => Promise.resolve());
    const driver = fakeDriver({ printQr });

    await expect(new B21Transport(driver).probe()).resolves.toBe(true);
    expect(printQr).not.toHaveBeenCalled();
  });

  it('rapporte une imprimante éteinte plutôt que de le taire', async () => {
    const driver = fakeDriver({ probe: () => Promise.resolve(false) });

    await expect(new B21Transport(driver).probe()).resolves.toBe(false);
  });

  it('envoie l’étiquette composée', async () => {
    const driver = fakeDriver();

    await new B21Transport(driver).send(label, 2);

    expect(driver.jobs).toHaveLength(1);
    expect(driver.jobs[0]?.title).toBe('Bloc pleurote 12');
    expect(driver.jobs[0]?.copies).toBe(2);
  });

  /**
   * Le transport **ne rattrape pas** les échecs : la file d'impression compte
   * déjà ses tentatives. Deux couches de reprise produiraient neuf essais pour
   * trois demandés — et autant d'étiquettes en double sorties de la machine.
   */
  it('laisse remonter l’échec du pilote', async () => {
    const driver = fakeDriver({
      printQr: () => Promise.reject(new Error('BLE : périphérique injoignable')),
    });

    await expect(new B21Transport(driver).send(label, 1)).rejects.toThrow(/injoignable/);
  });
});
