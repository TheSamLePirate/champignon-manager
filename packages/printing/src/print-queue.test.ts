import { beforeEach, describe, expect, it } from 'vitest';
import type { LabelContent } from '@champi/domain';
import { MAX_ATTEMPTS, PrintQueue } from './print-queue.js';
import { InMemoryTransport } from './transport.js';

const NOW = '2026-08-08T10:00:00.000Z';

const label: LabelContent = {
  name: 'Pleurote bloc 1',
  type: 'Ballot de substrat',
  date: '01/08/2026',
  publicCode: 'SUB-2026-0001',
  qrToken: 'ABCDEFGHJKMNPQRSTUVWXY',
};

let transport: InMemoryTransport;
let queue: PrintQueue;

beforeEach(() => {
  transport = new InMemoryTransport();
  queue = new PrintQueue(transport);
});

function request(overrides: Partial<Parameters<PrintQueue['run']>[0]> = {}) {
  return { id: 'job-1', unitId: 'u-1', label, nowIso: NOW, ...overrides };
}

describe('testPrinter', () => {
  it('confirme une imprimante joignable', async () => {
    const result = await queue.testPrinter();
    expect(result).toEqual({ ok: true, value: { transport: 'memoire', reachable: true } });
  });

  it('signale une imprimante injoignable sans dramatiser', async () => {
    transport.setReachable(false);
    const result = await queue.testPrinter();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('memoire');
    expect(result.error.hint).toContain('allumée');
    expect(result.error.hint).toContain('à la reconnexion');
  });
});

describe('impression', () => {
  it('imprime une étiquette du premier coup', async () => {
    const result = await queue.run(request());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe('printed');
    expect(result.value.attempts).toBe(1);
    expect(result.value.completedAt).toBe(NOW);
    expect(transport.printed).toEqual([{ label, copies: 1 }]);
  });

  it('imprime le nombre de copies demandé', async () => {
    await queue.run(request({ copies: 3 }));
    expect(transport.printed[0]?.copies).toBe(3);
  });

  it('marque une réimpression comme telle', async () => {
    const result = await queue.run(request({ isReprint: true }));
    expect(result.ok && result.value.isReprint).toBe(true);
  });

  it('ne marque pas une première impression comme réimpression', async () => {
    const result = await queue.run(request());
    expect(result.ok && result.value.isReprint).toBe(false);
  });
});

/**
 * Le BLE se déconnecte et le Wi-Fi de chambre est mauvais : un échec est
 * normal. Ce qui compte, c'est que la file le dise plutôt que de le perdre.
 */
describe('reprises', () => {
  it('réessaie et finit par imprimer', async () => {
    transport.failNext(2);
    const result = await queue.run(request());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe('printed');
    expect(result.value.attempts).toBe(3);
    expect(transport.printed).toHaveLength(1);
  });

  it('abandonne après le nombre maximal de tentatives, en gardant la trace', async () => {
    transport.failNext(MAX_ATTEMPTS);
    const result = await queue.run(request());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe('failed');
    expect(result.value.attempts).toBe(MAX_ATTEMPTS);
    expect(result.value.lastError).toContain('injoignable');
    expect(result.value.completedAt).toBeUndefined();
    expect(transport.printed).toHaveLength(0);
  });

  it('un échec est un état du travail, pas une exception remontée à l’appelant', async () => {
    transport.failNext(99);
    const result = await queue.run(request());
    // Le travail reste visible dans la file : une étiquette non imprimée ne
    // doit jamais disparaître dans une erreur.
    expect(result.ok).toBe(true);
  });

  it('rapporte un échec non-Error de façon lisible', async () => {
    const hostile = new (class extends InMemoryTransport {
      override send(): Promise<void> {
        // La règle a raison pour du code de production — mais un pilote BLE
        // rétro-conçu rejette parfois avec une chaîne nue, et la file doit le
        // supporter sans planter. C'est exactement ce que ce test vérifie.
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        return Promise.reject('panne bas niveau');
      }
    })();
    const result = await new PrintQueue(hostile).run(request());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe('failed');
    expect(result.value.lastError).toBe("Échec d'impression inconnu.");
  });
});

describe('validation des copies', () => {
  it.each([0, -1, 1.5])('refuse « %s » copies', async (copies) => {
    const result = await queue.run(request({ copies }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.path).toBe('copies');
  });

  it('accepte le maximum de 50 copies', async () => {
    const result = await queue.run(request({ copies: 50 }));
    expect(result.ok).toBe(true);
  });

  it('refuse au-delà de 50, en supposant une faute de frappe', async () => {
    const result = await queue.run(request({ copies: 500 }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('erreur de saisie');
    expect(result.error.hint).toContain('50 copies');
  });

  it('n’imprime rien quand la validation échoue', async () => {
    await queue.run(request({ copies: 0 }));
    expect(transport.printed).toHaveLength(0);
  });
});
