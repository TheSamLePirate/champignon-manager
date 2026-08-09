/**
 * Étiquette d'une unité : QR, impression, réimpression.
 *
 * Trois règles du cadrage sont visibles ici :
 *
 * - le QR porte un **token opaque**, jamais une URL ni un code métier : une
 *   étiquette photographiée hors de la ferme n'apprend rien ;
 * - une **réimpression réutilise le même token** (`q17_5`). Le regénérer
 *   casserait le lien avec le sac déjà en chambre — l'écran l'annonce donc,
 *   plutôt que de laisser croire à une nouvelle étiquette ;
 * - le compteur d'impressions se lit : c'est la seule trace du nombre
 *   d'étiquettes en circulation pour une unité.
 */

export interface LabelPanelProps {
  readonly token: string | null;
  readonly printCount: number;
  readonly busy: boolean;
  readonly onAssigner: () => void;
  readonly onImprimer: () => void;
  readonly onTester: () => void;
}

export function LabelPanel({
  token,
  printCount,
  busy,
  onAssigner,
  onImprimer,
  onTester,
}: LabelPanelProps): React.JSX.Element {
  return (
    <section className="etiquette-panneau" aria-labelledby="etiquette-titre">
      <h3 id="etiquette-titre" className="unit__titre-section">
        Étiquette
      </h3>

      {token === null ? (
        <>
          <p className="unit__hint">
            Cette unité n’a pas encore de QR. Sans lui, elle ne peut pas être scannée en chambre.
          </p>
          <button type="button" disabled={busy} onClick={onAssigner}>
            Attribuer un QR
          </button>
        </>
      ) : (
        <>
          <p className="etiquette-panneau__token">{token}</p>
          <p className="unit__hint">
            {printCount === 0
              ? 'Jamais imprimée.'
              : printCount === 1
                ? '1 étiquette imprimée — une réimpression portera le même QR.'
                : `${String(printCount)} étiquettes imprimées — toutes portent le même QR.`}
          </p>
          <div className="unit__actions">
            <button type="button" disabled={busy} onClick={onImprimer}>
              {printCount === 0 ? 'Imprimer l’étiquette' : 'Réimprimer la même étiquette'}
            </button>
            <button type="button" className="bouton--secondaire" disabled={busy} onClick={onTester}>
              Tester l’imprimante
            </button>
          </div>
        </>
      )}
    </section>
  );
}
