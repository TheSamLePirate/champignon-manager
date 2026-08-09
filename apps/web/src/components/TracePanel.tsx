import { useCallback, useState } from 'react';
import type { ApiClient, UnitTrace } from '../lib/api-client.js';

/**
 * Traçabilité d'une unité : ce qu'elle a produit, et le contrôle du journal.
 *
 * Deux questions, deux réponses, et la seconde compte autant que la première :
 *
 * - **où est parti ce bloc ?** — ses récoltes, les produits qui en sont issus,
 *   et la part exacte qu'il représente dans chacun ;
 * - **l'histoire est-elle intacte ?** — le contrôle d'audit rejoue le journal
 *   et le compare à l'état stocké. C'est la promesse centrale du projet, et
 *   elle doit être vérifiable **par le cultivateur**, pas seulement en CI.
 *
 * Le panneau ne charge rien tant qu'on ne le demande pas : une remontée coûte
 * plusieurs requêtes, et la fiche s'ouvre des dizaines de fois par jour pour
 * des gestes qui n'en ont pas besoin.
 */

export interface TracePanelProps {
  readonly client: ApiClient;
  readonly reference: string;
  readonly onMessage: (message: string | null) => void;
}

interface Audit {
  readonly verified: boolean;
  readonly divergences: readonly unknown[];
  readonly eventCount: number;
}

export function TracePanel({ client, reference, onMessage }: TracePanelProps): React.JSX.Element {
  const [trace, setTrace] = useState<UnitTrace | null>(null);
  const [audit, setAudit] = useState<Audit | null>(null);
  const [busy, setBusy] = useState(false);

  const remonter = useCallback(async () => {
    setBusy(true);
    try {
      const [descendance, controle] = await Promise.all([
        client.traceUnit(reference),
        client.auditUnit(reference),
      ]);
      if (!descendance.ok) {
        onMessage(descendance.error.hint ?? descendance.error.message);
        return;
      }
      setTrace(descendance.data);
      setAudit(controle.ok ? controle.data : null);
      onMessage(null);
    } finally {
      setBusy(false);
    }
  }, [client, reference, onMessage]);

  return (
    <section className="trace" aria-labelledby="trace-titre">
      <h3 id="trace-titre" className="unit__titre-section">
        Traçabilité
      </h3>

      {trace === null ? (
        <>
          <p className="unit__hint">Où est parti ce bloc, et son histoire est-elle intacte ?</p>
          <button
            type="button"
            className="bouton--secondaire"
            disabled={busy}
            onClick={() => void remonter()}
          >
            Remonter la trace
          </button>
        </>
      ) : (
        <>
          <p className="unit__hint">
            {trace.harvestCount === 0
              ? 'Aucune récolte : ce bloc n’a encore rien produit.'
              : `${String(trace.harvestCount)} récolte(s), ${String(trace.totalHarvestedGrams)} g au total.`}
          </p>

          {trace.products.length > 0 && (
            <ul className="trace__produits">
              {trace.products.map((produit) => (
                <li key={produit.productId}>
                  <span className="carte__code">{produit.publicCode}</span>
                  {/* La part exacte, pas une estimation : c'est elle qui rend
                      la remontée opposable en cas de rappel. */}
                  <span className="carte__etape">{produit.sharePct} % de ce produit</span>
                </li>
              ))}
            </ul>
          )}

          {audit !== null && (
            <p
              className={audit.verified ? 'trace__audit' : 'trace__audit trace__audit--rompu'}
              role="status"
            >
              {audit.verified
                ? `Journal vérifié : ${String(audit.eventCount)} événements rejoués, l’état stocké concorde.`
                : `⚠️ ${String(audit.divergences.length)} divergence(s) entre le journal et l’état stocké.`}
            </p>
          )}
        </>
      )}
    </section>
  );
}
