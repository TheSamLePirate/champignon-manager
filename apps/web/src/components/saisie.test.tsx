import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CultureUnit } from '@champi/contracts';
import { ObservationForm } from './ObservationForm.js';
import { MeasureForm } from './MeasureForm.js';
import { StageRail } from './StageRail.js';

/**
 * Les saisies terrain et le repère de stade.
 *
 * Ce que ces tests protègent : **l'écran refuse avant le serveur**. Une
 * contamination sans photo, une mesure sans valeur — l'opérateur ne doit pas
 * découvrir le refus après l'envoi, une unité dans les mains.
 */

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

const NOW = '2026-08-13T09:00:00.000Z';

function renderObservation(overrides: Partial<Parameters<typeof ObservationForm>[0]> = {}) {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  render(
    <ObservationForm
      unit={unit}
      nowIso={NOW}
      busy={false}
      onSubmit={onSubmit}
      onCancel={onCancel}
      {...overrides}
    />,
  );
  return { onSubmit, onCancel };
}

describe('observation', () => {
  it('ouvre sur la colonisation, pas sur la contamination', () => {
    renderObservation();
    // Ouvrir sur l'exception imposerait une photo dès l'ouverture.
    expect(screen.getByLabelText('Ce que tu vois')).toHaveValue('colonisation');
    expect(screen.getByRole('button', { name: 'Enregistrer l’observation' })).toBeEnabled();
  });

  it('n’offre que les observations qui ont un sens au stade courant', () => {
    renderObservation({ unit: { ...unit, stage: 'gelose' } });

    const choix = within(screen.getByLabelText('Ce que tu vois'))
      .getAllByRole('option')
      .map((option) => option.textContent);
    // « Taille » sur une gélose n'apprend rien : le domaine la masque, l'écran suit.
    expect(choix).not.toContain('Taille');
    expect(choix).toContain('Contamination');
  });

  it('envoie le type, la gravité et la précision', async () => {
    const { onSubmit } = renderObservation();

    await userEvent.selectOptions(screen.getByLabelText('Ce que tu vois'), 'odeur');
    await userEvent.click(screen.getByRole('radio', { name: 'Critique' }));
    await userEvent.type(screen.getByLabelText(/Précision/), '  aigre  ');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer l’observation' }));

    expect(onSubmit).toHaveBeenCalledWith({
      kind: 'odeur',
      severity: 'critical',
      note: 'aigre',
    });
  });

  it('omet une précision laissée vide plutôt que d’envoyer une chaîne vide', async () => {
    const { onSubmit } = renderObservation();

    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer l’observation' }));

    expect(onSubmit).toHaveBeenCalledWith({ kind: 'colonisation', severity: 'low' });
  });

  /** La seule saisie obligatoire de l'application (`q12_4`). */
  it('bloque l’enregistrement d’une contamination sans photo, et dit pourquoi', async () => {
    renderObservation();

    await userEvent.selectOptions(screen.getByLabelText('Ce que tu vois'), 'contamination');

    expect(screen.getByRole('button', { name: 'Enregistrer l’observation' })).toBeDisabled();
    expect(screen.getByText(/seule saisie obligatoire/)).toBeInTheDocument();
  });

  it('débloque l’enregistrement une fois la photo confirmée', async () => {
    const { onSubmit } = renderObservation();

    await userEvent.selectOptions(screen.getByLabelText('Ce que tu vois'), 'contamination');
    await userEvent.click(screen.getByRole('button', { name: 'J’ai pris la photo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer l’observation' }));

    expect(onSubmit).toHaveBeenCalledWith({
      kind: 'contamination',
      severity: 'low',
      photoId: `photo-${NOW}`,
    });
  });

  it('dit franchement que l’image reste sur le téléphone', async () => {
    renderObservation();

    await userEvent.selectOptions(screen.getByLabelText('Ce que tu vois'), 'contamination');
    await userEvent.click(screen.getByRole('button', { name: 'J’ai pris la photo' }));

    // Le stockage des images n'existe pas encore : ne pas le laisser croire.
    expect(screen.getByText(/reste sur le téléphone/)).toBeInTheDocument();
  });

  /**
   * Le bouton désactivé ne suffit pas : un formulaire se soumet aussi au
   * clavier, et une saisie vocale ou un script contournent l'écran. La règle
   * est donc tenue **dans le gestionnaire**, pas seulement dans l'affichage.
   */
  it('ne soumet rien tant que la photo manque, même en contournant le bouton', async () => {
    const { onSubmit } = renderObservation();

    await userEvent.selectOptions(screen.getByLabelText('Ce que tu vois'), 'contamination');
    fireEvent.submit(screen.getByRole('button', { name: 'Annuler' }).closest('form') as Element);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('propose la colonisation à tous les stades — elle n’est jamais masquée', () => {
    for (const stage of ['gelose', 'liquid_culture', 'grain', 'substrate', 'fruiting'] as const) {
      const { unmount } = render(
        <ObservationForm
          unit={{ ...unit, stage }}
          nowIso={NOW}
          busy={false}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
      // C'est l'hypothèse sur laquelle repose le choix par défaut.
      expect(screen.getByLabelText('Ce que tu vois')).toHaveValue('colonisation');
      unmount();
    }
  });

  it('désactive l’enregistrement pendant un envoi', () => {
    renderObservation({ busy: true });
    expect(screen.getByRole('button', { name: 'Enregistrer l’observation' })).toBeDisabled();
  });

  it('annule sans rien envoyer', async () => {
    const { onSubmit, onCancel } = renderObservation();

    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

function renderMesure(overrides: Partial<Parameters<typeof MeasureForm>[0]> = {}) {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  render(<MeasureForm busy={false} onSubmit={onSubmit} onCancel={onCancel} {...overrides} />);
  return { onSubmit, onCancel };
}

describe('mesure', () => {
  it('refuse une mesure sans valeur — elle ne voudrait rien dire', () => {
    renderMesure();
    expect(screen.getByRole('button', { name: 'Enregistrer la mesure' })).toBeDisabled();
  });

  it('refuse une valeur qui n’est pas un nombre', async () => {
    renderMesure();

    await userEvent.type(screen.getByLabelText(/Valeur en/), 'tiède');

    expect(screen.getByRole('button', { name: 'Enregistrer la mesure' })).toBeDisabled();
  });

  it('accepte la virgule décimale — c’est ainsi qu’on tape en français', async () => {
    const { onSubmit } = renderMesure();

    await userEvent.type(screen.getByLabelText(/Valeur en/), '23,5');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer la mesure' }));

    expect(onSubmit).toHaveBeenCalledWith({ metric: 'temperature_c', numericValue: 23.5 });
  });

  it('change l’unité affichée avec la grandeur', async () => {
    renderMesure();

    expect(screen.getByLabelText('Valeur en °C')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Humidité' }));
    expect(screen.getByLabelText('Valeur en %')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Poids' }));
    expect(screen.getByLabelText('Valeur en g')).toBeInTheDocument();
  });

  it('envoie la grandeur choisie', async () => {
    const { onSubmit } = renderMesure();

    await userEvent.click(screen.getByRole('radio', { name: 'Poids' }));
    await userEvent.type(screen.getByLabelText(/Valeur en/), '2400');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer la mesure' }));

    expect(onSubmit).toHaveBeenCalledWith({ metric: 'weight', numericValue: 2400 });
  });

  it('ne soumet rien au clavier tant que la valeur est vide', async () => {
    const { onSubmit } = renderMesure();

    await userEvent.type(screen.getByLabelText(/Valeur en/), '{Enter}');

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('désactive l’enregistrement pendant un envoi', async () => {
    renderMesure({ busy: true });
    await userEvent.type(screen.getByLabelText(/Valeur en/), '24');
    expect(screen.getByRole('button', { name: 'Enregistrer la mesure' })).toBeDisabled();
  });

  it('annule sans rien envoyer', async () => {
    const { onSubmit, onCancel } = renderMesure();

    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('chaîne de propagation', () => {
  it('situe le stade courant et le nomme en toutes lettres', () => {
    render(<StageRail stage="substrate" />);

    // La couleur ne porte jamais l'information seule (WCAG 1.4.1).
    expect(screen.getByText(/stade actuel : Ballot de substrat/)).toBeInTheDocument();
  });

  it('marque les stades franchis et ceux à venir', () => {
    render(<StageRail stage="grain" />);

    const maillons = within(screen.getByRole('navigation')).getAllByRole('listitem');
    expect(maillons).toHaveLength(5);
    expect(maillons[0]?.textContent).toContain('franchi');
    expect(maillons[2]?.textContent).toContain('stade actuel');
    expect(maillons[4]?.textContent).toContain('à venir');
  });

  it('porte `aria-current` sur le seul maillon courant', () => {
    render(<StageRail stage="fruiting" />);

    const courants = within(screen.getByRole('navigation'))
      .getAllByRole('listitem')
      .filter((item) => item.getAttribute('aria-current') === 'step');
    expect(courants).toHaveLength(1);
  });

  /** Une unité peut naître au dernier stade : rien n'est alors « franchi ». */
  it('n’invente aucun passé pour une unité née en fructification', () => {
    render(<StageRail stage="gelose" />);

    const maillons = within(screen.getByRole('navigation')).getAllByRole('listitem');
    expect(maillons.filter((item) => item.textContent.includes('franchi'))).toHaveLength(0);
  });
});
