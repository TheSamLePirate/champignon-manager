import { describe, expect, it } from 'vitest';
import type { Stage } from '@champi/contracts';
import { buildUnitLabel, formatLabelDate, renderLabelText, stageLabel } from './label.js';
import { makeUnit } from '../__testing__/builders.js';

const TOKEN = 'ABCDEFGHJKMNPQRSTUVWXY';

describe('stageLabel', () => {
  it.each<[Stage, string]>([
    ['gelose', 'Gélose'],
    ['liquid_culture', 'Culture liquide'],
    ['grain', 'Ballot de grain'],
    ['substrate', 'Ballot de substrat'],
    ['fruiting', 'Fructification'],
  ])('rend « %s » en « %s », dans le vocabulaire du cultivateur', (stage, label) => {
    expect(stageLabel(stage)).toBe(label);
  });
});

describe('formatLabelDate', () => {
  it('rend une date en jour/mois/année', () => {
    expect(formatLabelDate('2026-08-01T08:00:00.000Z')).toEqual({ ok: true, value: '01/08/2026' });
  });

  it('conserve les zéros initiaux', () => {
    const result = formatLabelDate('2026-01-05T00:00:00.000Z');
    expect(result.ok && result.value).toBe('05/01/2026');
  });

  it('accepte une date seule, sans heure', () => {
    const result = formatLabelDate('2026-12-31');
    expect(result.ok && result.value).toBe('31/12/2026');
  });

  it('refuse un format non ISO en disant ce qui est attendu', () => {
    const result = formatLabelDate('01/08/2026');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_FAILED');
    expect(result.error.message).toContain('01/08/2026');
    expect(result.error.message).toContain('date ISO exploitable');
    expect(result.error.hint).toContain('ISO 8601');
    expect(result.error.hint).toContain('2026-08-01T08:00:00.000Z');
    expect(result.error.path).toBe('date');
  });

  it('refuse une chaîne vide', () => {
    expect(formatLabelDate('').ok).toBe(false);
  });
});

describe('buildUnitLabel', () => {
  it('compose les quatre éléments demandés par le cultivateur', () => {
    const result = buildUnitLabel(makeUnit(), TOKEN);
    expect(result).toEqual({
      ok: true,
      value: {
        name: 'Pleurote bloc 1',
        type: 'Ballot de substrat',
        date: '01/08/2026',
        publicCode: 'SUB-2026-0001',
        qrToken: TOKEN,
      },
    });
  });

  it('reflète le stade réel de l’unité', () => {
    const result = buildUnitLabel(makeUnit({ stage: 'gelose' }), TOKEN);
    expect(result.ok && result.value.type).toBe('Gélose');
  });

  /**
   * Réimprimer doit reproduire **exactement** la même étiquette (`q17_5`).
   * Regénérer le token casserait le lien avec l'objet déjà en chambre : le
   * token est fourni, jamais fabriqué ici.
   */
  it('reproduit la même étiquette à l’identique — la réimpression ne change rien', () => {
    const unit = makeUnit();
    expect(buildUnitLabel(unit, TOKEN)).toEqual(buildUnitLabel(unit, TOKEN));
  });

  it('remonte l’échec quand la date de création est inexploitable', () => {
    const result = buildUnitLabel(makeUnit({ createdAt: 'hier' }), TOKEN);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_FAILED');
    expect(result.error.message).toContain('hier');
    expect(result.error.path).toBe('date');
  });
});

describe('renderLabelText', () => {
  it('rend les quatre lignes dans l’ordre de lecture', () => {
    const label = buildUnitLabel(makeUnit(), TOKEN);
    expect(label.ok).toBe(true);
    if (!label.ok) return;
    expect(renderLabelText(label.value)).toBe(
      'Pleurote bloc 1\nBallot de substrat\n01/08/2026\nSUB-2026-0001',
    );
  });

  it('n’imprime jamais le token en clair — il n’est que dans le QR', () => {
    const label = buildUnitLabel(makeUnit(), TOKEN);
    if (!label.ok) return;
    expect(renderLabelText(label.value)).not.toContain(TOKEN);
  });
});
