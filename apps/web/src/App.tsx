import { useCallback, useEffect, useState } from 'react';
import type { CultureUnit, DomainEvent, ProcessGraph, Stage } from '@champi/contracts';
import { StatusBanner } from './components/StatusBanner.js';
import { ScanPanel, type RecognisedScan } from './components/ScanPanel.js';
import { UnitSheet, type NextStep } from './components/UnitSheet.js';
import { ProcessWorkbench } from './components/ProcessWorkbench.js';
import { ObservationForm, type ObservationDraft } from './components/ObservationForm.js';
import { MeasureForm, type MeasureDraft } from './components/MeasureForm.js';
import { UnitList } from './components/UnitList.js';
import { UnitForm, type ProcessChoice, type UnitDraft } from './components/UnitForm.js';
import { LabelPanel } from './components/LabelPanel.js';
import { PhotoPanel } from './components/PhotoPanel.js';
import { HarvestView } from './components/HarvestView.js';
import { HarvestForm, type HarvestDraft } from './components/HarvestForm.js';
import type { ApiClient, MutationResult } from './lib/api-client.js';
import type { OfflineQueue } from './lib/offline-queue.js';
import type { ScanEnvironment } from './lib/scanner.js';

/**
 * Écran principal.
 *
 * Pas d'écran de connexion (docs/21 §6) : l'application s'ouvre directement sur
 * le travail. Le scan est la navigation principale — en chambre, on arrive
 * toujours par une étiquette, jamais par une liste.
 *
 * Deux vues seulement, et « Terrain » est celle par défaut : configurer un
 * process est rare, scanner une unité est le geste de tous les jours. La
 * configuration reste néanmoins **atteignable depuis l'application**, et pas
 * seulement par l'API — l'éditeur graphique est resté un temps orphelin,
 * construit et testé mais monté nulle part (déviation D-28).
 */

export interface AppProps {
  readonly client: ApiClient;
  readonly queue: OfflineQueue;
  readonly environment: ScanEnvironment;
  readonly online: boolean;
  /** Horloge. Elle n'existe qu'ici : le reste de l'interface la reçoit. */
  readonly now: () => string;
  /** Accès caméra et décodage QR, injectés depuis le point d'entrée. */
  readonly ouvrirCamera: () => Promise<MediaStream>;
  readonly detecter: (source: HTMLVideoElement) => Promise<readonly string[]>;
  /** Capture une image fixe du flux vidéo, en data-URL. Injectée : pas de canvas en test. */
  readonly capturer: (source: HTMLVideoElement) => string;
}

interface LoadedUnit {
  readonly unit: CultureUnit;
  readonly events: readonly DomainEvent[];
  readonly nominalNext: readonly NextStep[];
}

/**
 * Les trois vues.
 *
 * « Terrain » par défaut : c'est le geste quotidien. « Récoltes » regroupe ce
 * qui sort de la ferme, « Process » la configuration, qui est rare.
 */
type Vue = 'terrain' | 'recoltes' | 'process';

/** Les cinq stades, dans l'ordre de la chaîne de propagation. */
const STAGES: readonly Stage[] = ['gelose', 'liquid_culture', 'grain', 'substrate', 'fruiting'];

/** Formulaire ouvert. Un seul à la fois : l'écran reste lisible à bout de bras. */
type Saisie = 'aucune' | 'observation' | 'mesure' | 'creation' | 'recolte';

/** Étiquette d'une unité, telle que l'écran la connaît. */
interface Etiquette {
  readonly token: string;
  readonly printCount: number;
}

export function App({
  client,
  queue,
  environment,
  online,
  now,
  ouvrirCamera,
  detecter,
  capturer,
}: AppProps): React.JSX.Element {
  const [vue, setVue] = useState<Vue>('terrain');
  const [saisie, setSaisie] = useState<Saisie>('aucune');
  const [loaded, setLoaded] = useState<LoadedUnit | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingCount, setPendingCount] = useState(queue.pendingCount());
  const [failedCount, setFailedCount] = useState(queue.failed().length);
  const [unites, setUnites] = useState<readonly CultureUnit[]>([]);
  const [chargementListe, setChargementListe] = useState(true);
  const [etiquette, setEtiquette] = useState<Etiquette | null>(null);
  const [processes, setProcesses] = useState<readonly ProcessChoice[]>([]);

  const refreshQueueCounts = useCallback(() => {
    setPendingCount(queue.pendingCount());
    setFailedCount(queue.failed().length);
  }, [queue]);

  // Au retour du réseau, on vide la file sans que l'opérateur ait à y penser.
  useEffect(() => {
    if (!online) {
      return;
    }
    void client.flushQueue().then(refreshQueueCounts);
  }, [online, client, refreshQueueCounts]);

  /**
   * Charge les unités de tous les stades.
   *
   * Cinq requêtes en parallèle plutôt qu'une : l'API liste **par stade**, et
   * inventer un paramètre « tous » côté serveur pour l'écran d'accueil aurait
   * ajouté une route que personne d'autre n'utilise.
   */
  const chargerListe = useCallback(async () => {
    setChargementListe(true);
    const lots = await Promise.all(STAGES.map((stage) => client.listUnits(stage)));
    setUnites(lots.flatMap((lot) => (lot.ok ? lot.data : [])));
    setChargementListe(false);
  }, [client]);

  /** Versions publiées, pour que la création propose des process utilisables. */
  const chargerProcess = useCallback(async () => {
    const templates = await client.listProcessTemplates();
    if (!templates.ok) {
      return;
    }
    const parModele = await Promise.all(
      templates.data.map(async (template) => {
        const versions = await client.listProcessVersions(template.id);
        if (!versions.ok) {
          return [];
        }
        // Seules les versions **publiées** : une unité épinglée à un brouillon
        // se retrouverait rattachée à un graphe encore mouvant.
        return versions.data
          .filter((version) => version.status === 'published')
          .map((version) => ({
            versionId: version.id,
            label: `${template.name} — version ${String(version.versionNumber)}`,
            graph: version.graph as ProcessGraph,
          }));
      }),
    );
    setProcesses(parModele.flat());
  }, [client]);

  /** Charge la fiche complète : identité, historique et suites possibles. */
  const loadUnit = useCallback(
    async (reference: string) => {
      const [unit, timeline, steps] = await Promise.all([
        client.getUnit(reference),
        client.getTimeline(reference),
        client.nextSteps(reference),
      ]);

      if (!unit.ok) {
        setLoaded(null);
        // On affiche l'indice du serveur : il contient les valeurs valides.
        setMessage(unit.error.hint ?? unit.error.message);
        return;
      }

      setLoaded({
        unit: unit.data,
        events: timeline.ok ? timeline.data : [],
        nominalNext: steps.ok ? steps.data.nominal : [],
      });
      // L'étiquette se **lit** sans être créée : demander « a-t-elle un QR ? »
      // ne doit pas lui en attribuer un.
      const qr = await client.getQr(reference);
      setEtiquette(qr.ok ? { token: qr.data.token, printCount: qr.data.printCount } : null);
      setMessage(null);
    },
    [client],
  );

  // La liste se charge à l'ouverture de la vue terrain.
  useEffect(() => {
    if (vue === 'terrain') {
      void chargerListe();
    }
  }, [vue, chargerListe]);

  /*
   * Les process ne se chargent qu'à l'ouverture du formulaire de création.
   *
   * Les charger avec la liste coûtait une requête par modèle **plus** une par
   * version, à chaque affichage du terrain — pour une information dont on ne se
   * sert qu'en créant une unité. Sur une ferme qui tourne depuis des mois, cela
   * revient à interroger tout l'historique des process pour afficher une liste
   * de sacs.
   */
  useEffect(() => {
    if (saisie === 'creation') {
      void chargerProcess();
    }
  }, [saisie, chargerProcess]);

  const openUnit = useCallback(
    async (input: RecognisedScan) => {
      if (input.kind === 'public-code') {
        await loadUnit(input.value);
        return;
      }

      const resolved = await client.resolveQr(input.value);
      if (!resolved.ok) {
        setLoaded(null);
        setMessage(resolved.error.hint ?? resolved.error.message);
        return;
      }
      if (resolved.data.target === null) {
        setLoaded(null);
        setMessage('Ce QR ne correspond à aucune unité connue.');
        return;
      }
      await loadUnit(resolved.data.target.publicCode);
    },
    [client, loadUnit],
  );

  /**
   * Traite le résultat d'une mutation.
   *
   * Trois issues, et l'opérateur doit pouvoir les distinguer : envoyée,
   * conservée pour plus tard, ou refusée pour une raison métier.
   */
  const handleMutation = useCallback(
    async (result: MutationResult<unknown>, reference: string) => {
      if ('queued' in result) {
        setMessage('Saisie conservée sur l’appareil — elle partira au retour du réseau.');
        setSaisie('aucune');
        refreshQueueCounts();
        return;
      }
      if (!result.ok) {
        setMessage(result.error.hint ?? result.error.message);
        return;
      }
      // La saisie a abouti : on referme le formulaire plutôt que de laisser
      // l'opérateur se demander s'il doit le refaire.
      setSaisie('aucune');
      await loadUnit(reference);
    },
    [loadUnit, refreshQueueCounts],
  );

  /** Crée une unité, puis ouvre directement sa fiche : c'est la suite du geste. */
  const creerUnite = useCallback(
    async (draft: UnitDraft) => {
      setBusy(true);
      try {
        const result = await client.createUnit(draft);
        if ('queued' in result) {
          // Une unité créée hors ligne n'aurait ni code public ni QR : on refuse
          // franchement plutôt que de promettre une fiche qui n'existe pas.
          setMessage('Création impossible hors ligne — reconnecte-toi pour démarrer une unité.');
          return;
        }
        if (!result.ok) {
          setMessage(result.error.hint ?? result.error.message);
          return;
        }
        setSaisie('aucune');
        await loadUnit(result.data.unit.publicCode);
      } finally {
        setBusy(false);
      }
    },
    [client, loadUnit],
  );

  /** Attribue un QR. Idempotent côté serveur : rappeler ne change pas le token. */
  const attribuerQr = useCallback(
    async (reference: string) => {
      setBusy(true);
      try {
        const result = await client.assignQr(reference);
        if ('queued' in result || !result.ok) {
          setMessage(
            'queued' in result
              ? 'Attribution impossible hors ligne — le QR doit venir du serveur.'
              : (result.error.hint ?? result.error.message),
          );
          return;
        }
        setEtiquette({ token: result.data.token, printCount: result.data.printCount });
      } finally {
        setBusy(false);
      }
    },
    [client],
  );

  const imprimer = useCallback(
    async (reference: string) => {
      setBusy(true);
      try {
        const result = await client.printLabel(reference, 1);
        if ('queued' in result) {
          setMessage('Impression impossible hors ligne — l’imprimante est jointe par le serveur.');
          return;
        }
        if (!result.ok) {
          setMessage(result.error.hint ?? result.error.message);
          return;
        }
        setMessage(
          result.data.isReprint
            ? 'Étiquette réimprimée — elle porte le même QR que la précédente.'
            : 'Étiquette imprimée.',
        );
        const qr = await client.getQr(reference);
        if (qr.ok) {
          setEtiquette({ token: qr.data.token, printCount: qr.data.printCount });
        }
      } finally {
        setBusy(false);
      }
    },
    [client],
  );

  const testerImprimante = useCallback(async () => {
    setBusy(true);
    try {
      const result = await client.testPrinter();
      setMessage(
        !result.ok
          ? (result.error.hint ?? result.error.message)
          : result.data.reachable
            ? `Imprimante « ${result.data.transport} » : elle répond.`
            : `Imprimante « ${result.data.transport} » : aucune réponse. Vérifie qu’elle est allumée et qu’aucune autre application ne la tient.`,
      );
    } finally {
      setBusy(false);
    }
  }, [client]);

  /**
   * Numéro du prochain flush, déduit du journal.
   *
   * On ne demande pas à l'opérateur de se souvenir du dernier : il a les mains
   * dans le substrat, et un numéro dupliqué serait refusé par le serveur.
   */
  const prochainFlush =
    (loaded?.events ?? []).filter((event) => event.type === 'harvest.recorded').length + 1;

  const runAction = useCallback(
    async (action: () => Promise<MutationResult<unknown>>, reference: string) => {
      setBusy(true);
      try {
        await handleMutation(await action(), reference);
      } finally {
        setBusy(false);
      }
    },
    [handleMutation],
  );

  return (
    <main>
      <h1>Champignon Manager</h1>

      <StatusBanner pendingCount={pendingCount} failedCount={failedCount} online={online} />

      <nav className="onglets" aria-label="Vues de l’application">
        <button
          type="button"
          className="onglet"
          aria-current={vue === 'terrain' ? 'page' : undefined}
          onClick={() => {
            setVue('terrain');
            setMessage(null);
          }}
        >
          Terrain
        </button>
        <button
          type="button"
          className="onglet"
          aria-current={vue === 'recoltes' ? 'page' : undefined}
          onClick={() => {
            setVue('recoltes');
            setMessage(null);
          }}
        >
          Récoltes
        </button>
        <button
          type="button"
          className="onglet"
          aria-current={vue === 'process' ? 'page' : undefined}
          onClick={() => {
            setVue('process');
            setMessage(null);
          }}
        >
          Process
        </button>
      </nav>

      {vue === 'process' && <ProcessWorkbench client={client} onMessage={setMessage} />}

      {vue === 'recoltes' && <HarvestView client={client} onMessage={setMessage} />}

      {vue === 'terrain' && loaded === null && saisie !== 'creation' && (
        <>
          <button
            type="button"
            className="bouton--principal"
            onClick={() => {
              setSaisie('creation');
              setMessage(null);
            }}
          >
            Nouvelle unité
          </button>
          <UnitList
            unites={unites}
            nowIso={now()}
            chargement={chargementListe}
            onOuvrir={(unite) => {
              void loadUnit(unite.publicCode);
            }}
          />
        </>
      )}

      {vue === 'terrain' && saisie === 'creation' && (
        <UnitForm
          processes={processes}
          busy={busy}
          onCancel={() => {
            setSaisie('aucune');
          }}
          onSubmit={(draft: UnitDraft) => {
            void creerUnite(draft);
          }}
        />
      )}

      {message !== null && (
        <p className="message" role="status">
          {message}
        </p>
      )}

      {vue === 'terrain' && loaded !== null && (
        <UnitSheet
          unit={loaded.unit}
          events={loaded.events}
          nominalNext={loaded.nominalNext}
          nowIso={now()}
          busy={busy}
          onAdvance={(stepId) => {
            void runAction(
              () => client.advance(loaded.unit.publicCode, stepId, loaded.unit.version),
              loaded.unit.publicCode,
            );
          }}
          onObserve={() => {
            setSaisie(saisie === 'observation' ? 'aucune' : 'observation');
          }}
          onMeasure={() => {
            setSaisie(saisie === 'mesure' ? 'aucune' : 'mesure');
          }}
        >
          {saisie === 'observation' && (
            <ObservationForm
              unit={loaded.unit}
              nowIso={now()}
              busy={busy}
              onCancel={() => {
                setSaisie('aucune');
              }}
              onSubmit={(draft: ObservationDraft) => {
                void runAction(
                  () => client.observe(loaded.unit.publicCode, draft),
                  loaded.unit.publicCode,
                );
              }}
            />
          )}
          {saisie === 'mesure' && (
            <MeasureForm
              busy={busy}
              onCancel={() => {
                setSaisie('aucune');
              }}
              onSubmit={(draft: MeasureDraft) => {
                void runAction(
                  () => client.measure(loaded.unit.publicCode, draft),
                  loaded.unit.publicCode,
                );
              }}
            />
          )}

          {loaded.unit.stage === 'fruiting' && loaded.unit.status === 'active' && (
            <>
              {saisie === 'recolte' ? (
                <HarvestForm
                  prochainFlush={prochainFlush}
                  busy={busy}
                  onCancel={() => {
                    setSaisie('aucune');
                  }}
                  onSubmit={(draft: HarvestDraft) => {
                    void runAction(
                      () => client.recordHarvest(loaded.unit.publicCode, draft),
                      loaded.unit.publicCode,
                    );
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="bouton--secondaire"
                  disabled={busy}
                  onClick={() => {
                    setSaisie('recolte');
                  }}
                >
                  Peser une récolte
                </button>
              )}
            </>
          )}

          <LabelPanel
            token={etiquette?.token ?? null}
            printCount={etiquette?.printCount ?? 0}
            busy={busy}
            onAssigner={() => {
              void attribuerQr(loaded.unit.publicCode);
            }}
            onImprimer={() => {
              void imprimer(loaded.unit.publicCode);
            }}
            onTester={() => {
              void testerImprimante();
            }}
          />

          <PhotoPanel
            events={loaded.events}
            urlDe={(photoId) => client.photoUrl(photoId)}
            ouvrirCamera={ouvrirCamera}
            capturer={capturer}
            busy={busy}
            onPhoto={(dataUrl) => {
              void runAction(
                () => client.addPhoto(loaded.unit.publicCode, { data: dataUrl }),
                loaded.unit.publicCode,
              );
            }}
          />

          <button
            type="button"
            className="bouton--secondaire"
            onClick={() => {
              setLoaded(null);
              setEtiquette(null);
              setMessage(null);
              void chargerListe();
            }}
          >
            Retour à la liste
          </button>
        </UnitSheet>
      )}

      {/*
       * Le scanner passe **après** la fiche dès qu'une unité est ouverte : en
       * chambre, on arrive par une étiquette et ce qu'on veut lire ensuite est
       * l'unité, pas le champ de saisie qui vient de servir.
       */}
      {vue === 'terrain' && (
        <ScanPanel
          environment={environment}
          ouvrirCamera={ouvrirCamera}
          detecter={detecter}
          compact={loaded !== null}
          onScan={(input) => {
            void openUnit(input);
          }}
        />
      )}
    </main>
  );
}
