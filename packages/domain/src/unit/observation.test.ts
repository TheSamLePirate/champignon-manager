import { describe, expect, it } from 'vitest';
import type { Stage } from '@champi/contracts';
import {
  OBSERVATION_KINDS,
  observationChangesStatus,
  relevantObservationKinds,
  validateObservation,
} from './observation.js';
import { makeUnit } from '../__testing__/builders.js';

describe('OBSERVATION_KINDS', () => {
  it('épingle la liste — elle apparaît dans les indices d’erreur lus par un agent', () => {
    expect(OBSERVATION_KINDS).toEqual([
      'contamination',
      'colonisation',
      'odeur',
      'couleur_suspecte',
      'humidite_visuelle',
      'taille',
      'couleur',
      'autre',
    ]);
  });
});

describe('relevantObservationKinds', () => {
  /**
   * Il n'y a **pas** de liste d'observations par étape (`q12_2`) : la liste
   * complète existe partout, seul ce qui n'a aucun sens est masqué.
   */
  it('propose tout au stade substrat', () => {
    expect(relevantObservationKinds('substrate')).toEqual([...OBSERVATION_KINDS]);
  });

  it('propose tout au stade fructification', () => {
    expect(relevantObservationKinds('fruiting')).toEqual([...OBSERVATION_KINDS]);
  });

  it('propose tout au stade grain', () => {
    expect(relevantObservationKinds('grain')).toEqual([...OBSERVATION_KINDS]);
  });

  it('masque la taille sur une gélose — elle n’apprend rien', () => {
    const kinds = relevantObservationKinds('gelose');
    expect(kinds).not.toContain('taille');
    expect(kinds).not.toContain('humidite_visuelle');
    expect(kinds).toContain('contamination');
    expect(kinds).toContain('colonisation');
  });

  it('masque aussi la couleur en culture liquide', () => {
    const kinds = relevantObservationKinds('liquid_culture');
    expect(kinds).not.toContain('couleur');
    expect(kinds).toContain('couleur_suspecte');
  });

  it.each<Stage>(['gelose', 'liquid_culture', 'grain', 'substrate', 'fruiting'])(
    'laisse la contamination observable au stade « %s »',
    (stage) => {
      expect(relevantObservationKinds(stage)).toContain('contamination');
    },
  );
});

describe('validateObservation', () => {
  it('accepte une observation pertinente', () => {
    const result = validateObservation({
      unit: makeUnit(),
      kind: 'colonisation',
      severity: 'low',
    });
    expect(result).toEqual({ ok: true, value: { kind: 'colonisation', severity: 'low' } });
  });

  it('conserve la note quand elle est fournie', () => {
    const result = validateObservation({
      unit: makeUnit(),
      kind: 'odeur',
      severity: 'medium',
      note: 'odeur aigre côté nord',
    });
    expect(result.ok && result.value.note).toBe('odeur aigre côté nord');
  });

  it('accepte une photo sur une observation qui n’en exige pas', () => {
    const result = validateObservation({
      unit: makeUnit(),
      kind: 'colonisation',
      severity: 'low',
      photoId: 'f-1',
    });
    expect(result.ok && result.value.photoId).toBe('f-1');
  });

  /** La seule obligation de saisie de toute l'application (`q12_4`). */
  it('refuse une contamination sans photo', () => {
    const result = validateObservation({
      unit: makeUnit(),
      kind: 'contamination',
      severity: 'critical',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('PHOTO_REQUIRED');
    expect(result.error.message).toContain('photo');
    expect(result.error.hint).toContain('seule saisie obligatoire');
    expect(result.error.path).toBe('photoId');
  });

  it('accepte une contamination documentée', () => {
    const result = validateObservation({
      unit: makeUnit(),
      kind: 'contamination',
      severity: 'critical',
      photoId: 'f-42',
    });
    expect(result.ok && result.value.photoId).toBe('f-42');
  });

  it('exige la photo à tous les stades', () => {
    for (const stage of ['gelose', 'liquid_culture', 'grain', 'substrate', 'fruiting'] as const) {
      const result = validateObservation({
        unit: makeUnit({ stage }),
        kind: 'contamination',
        severity: 'critical',
      });
      expect(result.ok).toBe(false);
    }
  });

  it('refuse une observation sans objet au stade courant, en listant les valides', () => {
    const result = validateObservation({
      unit: makeUnit({ stage: 'gelose' }),
      kind: 'taille',
      severity: 'low',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION_FAILED');
    expect(result.error.message).toContain('gelose');
    expect(result.error.hint).toContain('colonisation');
    expect(result.error.hint).not.toContain('taille,');
    expect(result.error.path).toBe('kind');
  });

  it('refuse un type d’observation inventé', () => {
    const result = validateObservation({
      unit: makeUnit(),
      kind: 'telepathie',
      severity: 'low',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('telepathie');
  });

  it.each(['low', 'medium', 'critical'] as const)('accepte la gravité « %s »', (severity) => {
    const result = validateObservation({ unit: makeUnit(), kind: 'odeur', severity });
    expect(result.ok && result.value.severity).toBe(severity);
  });
});

describe('observationChangesStatus', () => {
  /**
   * Observer une contamination ne rebute pas l'unité : le cultivateur peut
   * mettre en quarantaine, nettoyer ou poursuivre (`q18_1`). Décider à sa place
   * fermerait des options qu'il a demandé de garder ouvertes.
   */
  it('ne change jamais le statut de l’unité', () => {
    expect(observationChangesStatus()).toBe(false);
  });
});
