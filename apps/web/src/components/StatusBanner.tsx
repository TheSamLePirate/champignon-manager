/**
 * Indicateur d'état de la file locale.
 *
 * Exigence de `docs/22` §7.2 : l'état doit être **franc**, jamais ambigu.
 * « Enregistré » et « en attente d'envoi » sont deux choses différentes, et
 * l'opérateur doit pouvoir faire la différence d'un coup d'œil, à travers de la
 * condensation.
 */

export interface StatusBannerProps {
  readonly pendingCount: number;
  readonly failedCount: number;
  readonly online: boolean;
}

export function StatusBanner({
  pendingCount,
  failedCount,
  online,
}: StatusBannerProps): React.JSX.Element | null {
  if (failedCount > 0) {
    return (
      <div className="banner banner--error" role="alert">
        <strong>{failedCount}</strong>{' '}
        {failedCount > 1 ? 'saisies non envoyées' : 'saisie non envoyée'} — à reprendre
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      // `status` et non `alert` : c'est une information, pas une urgence. Une
      // saisie en attente n'est pas une saisie perdue.
      <div className="banner banner--pending" role="status">
        <strong>{pendingCount}</strong>{' '}
        {pendingCount > 1 ? 'saisies en attente d’envoi' : 'saisie en attente d’envoi'} — conservées
        sur l’appareil
      </div>
    );
  }

  if (!online) {
    return (
      <div className="banner banner--offline" role="status">
        Hors réseau — les saisies seront conservées et envoyées au retour
      </div>
    );
  }

  return null;
}
