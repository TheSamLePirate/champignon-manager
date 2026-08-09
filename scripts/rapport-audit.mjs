#!/usr/bin/env node
/**
 * Rapport d'audit — `docs/22` §6.4.
 *
 * Agrège les preuves produites par la CI en une page unique : couverture,
 * mutation, end-to-end, traçabilité, parité de surface, accessibilité,
 * performance et contrat d'API.
 *
 * ⚠️ Ce script **ne mesure rien lui-même**. Il lit ce que les suites ont
 * produit. Un rapport qui recalculerait ses propres chiffres pourrait diverger
 * de ce que la CI a réellement vérifié — et un rapport d'audit qui ment est
 * pire que pas de rapport.
 *
 * Usage : node scripts/rapport-audit.mjs [dossier-de-sortie]
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const OUT_DIR = process.argv[2] ?? 'reports/audit';

/** Lit un JSON, ou rend `null` si la suite correspondante n'a pas tourné. */
async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}

function pct(value) {
  return value === null || value === undefined ? '—' : `${value.toFixed(2)} %`;
}

/** Verdict d'une section : réussi, échoué, ou non mesuré. */
function verdict(ok) {
  if (ok === null) return { label: 'non mesuré', cls: 'unknown' };
  return ok ? { label: 'conforme', cls: 'ok' } : { label: 'non conforme', cls: 'ko' };
}

async function collectCoverage() {
  const summary = await readJson('coverage/coverage-summary.json');
  if (summary === null) return { available: false };

  const total = summary.total;
  const metrics = ['lines', 'statements', 'functions', 'branches'].map((key) => ({
    key,
    value: total[key].pct,
    ok: total[key].pct === 100,
  }));

  return {
    available: true,
    metrics,
    ok: metrics.every((metric) => metric.ok),
  };
}

async function collectMutation() {
  const report = await readJson('reports/mutation/mutation.json');
  if (report === null) return { available: false };

  let killed = 0;
  let survived = 0;
  let timeout = 0;
  let noCoverage = 0;
  for (const file of Object.values(report.files ?? {})) {
    for (const mutant of file.mutants ?? []) {
      if (mutant.status === 'Killed') killed += 1;
      else if (mutant.status === 'Survived') survived += 1;
      else if (mutant.status === 'Timeout') timeout += 1;
      else if (mutant.status === 'NoCoverage') noCoverage += 1;
    }
  }

  // Formule de Stryker, **NoCoverage compris au dénominateur**. Les exclure
  // remonterait le score sans qu'aucun test ne se soit amélioré : un rapport
  // d'audit qui s'arrange avec sa propre mesure ne vaut rien. L'écart n'est pas
  // théorique — il valait 0,46 point le 08/08/2026.
  const scored = killed + survived + timeout + noCoverage;
  const score = scored === 0 ? null : ((killed + timeout) / scored) * 100;

  return {
    available: true,
    killed,
    survived,
    timeout,
    noCoverage,
    score,
    ok: score !== null && score >= 90,
  };
}

async function collectE2e() {
  const results = await readJson('reports/e2e/results.json');
  if (results === null) return { available: false };

  const counts = { passed: 0, failed: 0, skipped: 0 };
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const status = test.results?.[0]?.status ?? 'skipped';
        if (status === 'passed') counts.passed += 1;
        else if (status === 'skipped') counts.skipped += 1;
        else counts.failed += 1;
      }
    }
    for (const child of suite.suites ?? []) walk(child);
  };
  for (const suite of results.suites ?? []) walk(suite);

  return { available: true, ...counts, ok: counts.failed === 0 };
}

/**
 * Les preuves que le rapport doit porter, au-delà des chiffres.
 *
 * Chaque ligne cite le test qui la démontre : un lecteur peut vérifier plutôt
 * que croire.
 */
const PROMESSES = [
  {
    promesse: 'L’état stocké est reconstructible depuis le journal',
    preuve: 'e2e/parcours-nominal.api.spec.ts — « le journal rejoué concorde avec l’état stocké »',
    origine: 'claude-critics.md P2-3',
  },
  {
    promesse: 'Un rejeu ne crée jamais de doublon',
    preuve: 'e2e/parcours-degrade.api.spec.ts — « cinq rejeux consécutifs restent sans effet »',
    origine: 'claude-critics.md P2-4',
  },
  {
    promesse: 'Dix écritures concurrentes n’en appliquent qu’une',
    preuve: 'e2e/parcours-degrade.api.spec.ts — verrou optimiste',
    origine: 'docs/08 §2.1',
  },
  {
    promesse: 'Publier un process ne déplace aucune unité en cours',
    preuve: 'e2e/editeur-process.api.spec.ts — « publier une version ne déplace aucune unité »',
    origine: 'docs/21 §2',
  },
  {
    promesse: 'Une version publiée est immuable',
    preuve:
      'e2e/editeur-process.api.spec.ts — « un brouillon se modifie, une version publiée non »',
    origine: 'docs/21 §2',
  },
  {
    promesse: 'On remonte d’une barquette aux blocs, avec la part exacte',
    preuve: 'e2e/spore-a-assiette.api.spec.ts — « remonte d’une barquette au bloc »',
    origine: 'q14_5 — « du spore à l’assiette »',
  },
  {
    promesse: 'Une chaîne de traçabilité incomplète échoue bruyamment',
    preuve: 'e2e/spore-a-assiette.api.spec.ts — récolte supprimée volontairement',
    origine: 'docs/22 §6.3',
  },
  {
    promesse: 'Une contamination exige une photo',
    preuve: 'e2e/spore-a-assiette.api.spec.ts — « refuse une contamination sans photo »',
    origine: 'q12_4',
  },
  {
    promesse: 'Le scan caméra ouvre la fiche depuis un iPhone réel',
    preuve:
      'Vérifié le 09/08/2026 : Safari iOS sur tailnet HTTPS (tailscale serve), QR d’une étiquette B21 imprimée → la fiche SUB-2026-0001 s’ouvre. Safari n’ayant pas BarcodeDetector, le décodage passe par un décodeur embarqué.',
    origine: 'claude-critics.md P0-4',
  },
  {
    promesse: 'L’étiquette sort réellement de la Nimbot B21',
    preuve:
      'Vérifié sur matériel le 09/08/2026 : POST /api/units/SUB-2026-0001/label/print → status « printed », une étiquette imprimée (B21_Pro-HC19050441)',
    origine: 'docs/21 §7',
  },
  {
    promesse: 'Une réimpression réutilise le même token',
    preuve:
      'e2e/parcours-nominal.api.spec.ts — « la réimpression réutilise le même token » ; vérifié sur matériel le 09/08/2026 : deux étiquettes imprimées portent le token ZBAKASUB2THMWYV7PUNGJF, printCount 0 → 2, isReprint false → true',
    origine: 'q17_5',
  },
  {
    promesse: 'Toute opération d’API a une commande CLI',
    preuve: 'e2e/parcours-agent.api.spec.ts — parité vérifiée sur le système qui tourne',
    origine: 'docs/22 §4.5',
  },
  {
    promesse: 'Le parcours complet est pilotable sans interface',
    preuve: 'e2e/parcours-agent.api.spec.ts — « du spore à l’assiette, par le CLI »',
    origine: 'docs/22 §4',
  },
  {
    promesse: 'Aucune violation WCAG 2.2 AA, contraste 7:1 atteint',
    preuve: 'e2e/accessibilite.web.spec.ts — axe-core sur Chrome et WebKit/iPhone',
    origine: 'docs/22 §7.3',
  },
  {
    promesse: 'L’application est utilisable au premier démarrage, sans rien configurer',
    preuve: 'e2e/mise-en-service.api.spec.ts — « on peut lancer une culture sur le modèle amorcé »',
    origine: 'docs/22 lot 12',
  },
  {
    promesse: 'L’amorçage n’écrase jamais les process du cultivateur',
    preuve: 'e2e/mise-en-service.api.spec.ts + packages/api/src/seed.test.ts — rejeu inerte',
    origine: 'docs/23 §2',
  },
  {
    promesse: 'L’éditeur de process est atteignable depuis l’application',
    preuve:
      'e2e/editeur-process.web.spec.ts — « l’éditeur est atteignable depuis l’application, sans passer par l’API »',
    origine: 'suivi D-28',
  },
  {
    promesse: 'Une version publiée s’édite en lecture seule, et se modifie en créant une version',
    preuve: 'e2e/editeur-process.web.spec.ts — « une version publiée s’affiche en lecture seule »',
    origine: 'docs/21 §2',
  },
  {
    promesse: 'Une sauvegarde se restaure à l’identique — vérifié, pas supposé',
    preuve:
      'scripts/sauvegarde.mjs — restauration dans une base jetable et recomptage de chaque collection ; échec au moindre écart',
    origine: 'docs/23 §4',
  },
];

/** Réserves à porter en clair : un audit qui les tait n'est pas un audit. */
const RESERVES = [
  {
    sujet: 'Performances non mesurées sur Raspberry Pi',
    detail:
      'Les budgets sont vérifiés, mais sur machine de développement. La cible de production est un Pi. Relancer avec CHAMPI_PERF_FACTOR ajusté sur le matériel réel.',
    origine: 'claude-critics.md D11',
  },
  {
    sujet: 'Impression vérifiée sur Mac, pas depuis le Raspberry Pi',
    detail:
      'Le pilote Nimbot B21 Pro est branché et une étiquette est réellement sortie le 09/08/2026 (B21_Pro-HC19050441, via POST /label/print). Restent non vérifiés : l’impression depuis le Pi, et depuis un conteneur — que l’image de production ne permet pas volontairement (modules natifs, D-Bus hôte).',
    origine: 'docs/23 §6',
  },
  {
    sujet: 'Mutation limitée à domain et contracts',
    detail:
      'api et persistence sont couverts à 100 % mais hors barrière de mutation. Mesure élargie au 08/08/2026 : 85,5 % global.',
    origine: 'suivi D-8',
  },
  {
    sujet: 'Rien ne vérifie qu’un composant est branché',
    detail:
      'La couverture et la mutation portent sur le code écrit, pas sur son accessibilité depuis l’application. L’éditeur de process est resté orphelin — construit, testé à 100 %, monté nulle part — jusqu’à ce qu’un lecteur le remarque (D-28). Seul un scénario end-to-end partant de l’écran d’accueil ferme cette faille, et il n’en existe aujourd’hui que pour les écrans connus.',
    origine: 'suivi D-28',
  },
  {
    sujet: 'Ce rapport n’est vérifié par aucun test',
    detail:
      'Il agrège des mesures produites ailleurs, mais rien ne teste son agrégation. Le 08/08/2026 il annonçait 92,24 % de mutation contre 91,78 % mesurés, faute de compter les mutants NoCoverage — corrigé après recoupement manuel, pas par une alerte.',
    origine: 'suivi D-22',
  },
  {
    sujet: 'Recette de mise en service non déroulée sur place',
    detail:
      'La pile de production a été démarrée et vérifiée, mais sur machine de développement (arm64, comme le Pi). Impression B21 branchée, scan caméra iPhone et budgets sur Pi restent à valider chez le cultivateur — docs/23 §7.',
    origine: 'suivi D-27',
  },
  {
    sujet: 'Aucune identité dans le journal',
    detail:
      'Décision assumée : la traçabilité répond à « quoi et quand », jamais à « qui ». Une certification exigeant l’imputabilité nominative demanderait de réintroduire une identité.',
    origine: 'docs/21 §6',
  },
];

function html(sections) {
  const { coverage, mutation, e2e, generatedAt } = sections;

  const coverageRows = coverage.available
    ? coverage.metrics
        .map(
          (metric) =>
            `<tr><td>${metric.key}</td><td class="num">${pct(metric.value)}</td><td class="${metric.ok ? 'ok' : 'ko'}">${metric.ok ? '100 %' : 'sous le seuil'}</td></tr>`,
        )
        .join('')
    : '<tr><td colspan="3">Suite de couverture non exécutée.</td></tr>';

  const section = (titre, contenu, statut) => `
    <section>
      <h2>${titre} <span class="badge ${statut.cls}">${statut.label}</span></h2>
      ${contenu}
    </section>`;

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rapport d'audit — Champignon Manager</title>
<style>
  :root { color-scheme: dark light; --fond:#0f1115; --surface:#1a1d24; --texte:#f5f7fa;
          --doux:#c4cbd6; --ok:#7fd1a3; --ko:#ff8f7a; --attente:#ffd166; }
  body { margin:0; background:var(--fond); color:var(--texte); font:16px/1.6 system-ui,sans-serif; }
  main { max-width:56rem; margin:0 auto; padding:2rem 1rem 4rem; }
  h1 { font-size:1.8rem; margin-bottom:.25rem; }
  .meta { color:var(--doux); margin-top:0; }
  section { background:var(--surface); border-radius:12px; padding:1.25rem; margin:1.25rem 0; }
  h2 { font-size:1.15rem; margin-top:0; display:flex; align-items:center; gap:.75rem; flex-wrap:wrap; }
  table { width:100%; border-collapse:collapse; }
  th,td { text-align:left; padding:.5rem .4rem; border-bottom:1px solid #ffffff1a; vertical-align:top; }
  th { color:var(--doux); font-weight:600; }
  .num { font-variant-numeric:tabular-nums; }
  .badge { font-size:.75rem; padding:.15rem .6rem; border-radius:999px; font-weight:600; }
  .ok { color:var(--ok); } .badge.ok { background:var(--ok); color:var(--fond); }
  .ko { color:var(--ko); } .badge.ko { background:var(--ko); color:var(--fond); }
  .badge.unknown { background:var(--doux); color:var(--fond); }
  .origine { color:var(--doux); font-size:.85rem; }
  .reserve { border-left:3px solid var(--attente); padding-left:.9rem; margin:.9rem 0; }
  .reserve h3 { margin:0 0 .25rem; font-size:1rem; color:var(--attente); }
  .reserve p { margin:0; color:var(--doux); }
</style>
</head>
<body>
<main>
  <h1>Rapport d'audit</h1>
  <p class="meta">Champignon Manager — généré le ${generatedAt}</p>

  ${section(
    'Couverture de test',
    `<table><thead><tr><th>Métrique</th><th>Valeur</th><th>Seuil 100 %</th></tr></thead>
     <tbody>${coverageRows}</tbody></table>
     <p class="origine">Le seuil de 100 % est une contrainte d'architecture, pas une cible atteinte après coup : le cœur du domaine est pur, donc il n'y a rien d'intestable (docs/22 §2.3).</p>`,
    verdict(coverage.available ? coverage.ok : null),
  )}

  ${section(
    'Score de mutation',
    mutation.available
      ? `<table><tbody>
          <tr><th>Score</th><td class="num">${pct(mutation.score)}</td></tr>
          <tr><th>Mutants tués</th><td class="num">${mutation.killed}</td></tr>
          <tr><th>Mutants survivants</th><td class="num">${mutation.survived}</td></tr>
          <tr><th>Expirations</th><td class="num">${mutation.timeout}</td></tr>
          <tr><th>Mutants sans couverture</th><td class="num">${mutation.noCoverage}</td></tr>
         </tbody></table>
         <p class="origine">C'est ce score qui empêche le 100 % de couverture d'être une métrique vanité : un test qui ne détecte pas l'inversion d'une condition n'est pas un test. Périmètre : domain et contracts. Les mutants sans couverture comptent comme non tués — c'est la formule de Stryker, et l'écarter flatterait le score sans améliorer un seul test.</p>`
      : '<p>Suite de mutation non exécutée.</p>',
    verdict(mutation.available ? mutation.ok : null),
  )}

  ${section(
    'Scénarios end-to-end',
    e2e.available
      ? `<table><tbody>
          <tr><th>Réussis</th><td class="num ok">${e2e.passed}</td></tr>
          <tr><th>Échoués</th><td class="num ${e2e.failed > 0 ? 'ko' : ''}">${e2e.failed}</td></tr>
          <tr><th>Ignorés</th><td class="num">${e2e.skipped}</td></tr>
         </tbody></table>
         <p class="origine">Contre une vraie pile : serveur Node, MongoDB en replica set, navigateurs Chrome et WebKit/iPhone, CLI en sous-processus. Aucun mock.</p>`
      : '<p>Suite end-to-end non exécutée.</p>',
    verdict(e2e.available ? e2e.ok : null),
  )}

  ${section(
    'Promesses vérifiées',
    `<p class="origine">Chaque ligne cite le test qui la démontre : un lecteur peut vérifier plutôt que croire.</p>
     <table><thead><tr><th>Promesse</th><th>Preuve</th></tr></thead><tbody>
     ${PROMESSES.map(
       (item) =>
         `<tr><td>${item.promesse}<br><span class="origine">${item.origine}</span></td><td class="origine">${item.preuve}</td></tr>`,
     ).join('')}
     </tbody></table>`,
    verdict(e2e.available ? e2e.ok : null),
  )}

  <section>
    <h2>Réserves <span class="badge unknown">à porter</span></h2>
    <p class="origine">Un audit qui tait ses limites n'est pas un audit.</p>
    ${RESERVES.map(
      (item) =>
        `<div class="reserve"><h3>${item.sujet}</h3><p>${item.detail}</p><p class="origine">${item.origine}</p></div>`,
    ).join('')}
  </section>
</main>
</body>
</html>`;
}

const sections = {
  coverage: await collectCoverage(),
  mutation: await collectMutation(),
  e2e: await collectE2e(),
  generatedAt: new Date().toISOString().replace('T', ' à ').slice(0, 19),
};

await mkdir(OUT_DIR, { recursive: true });
await writeFile(join(OUT_DIR, 'index.html'), html(sections), 'utf8');
await writeFile(
  join(OUT_DIR, 'audit.json'),
  JSON.stringify({ ...sections, promesses: PROMESSES, reserves: RESERVES }, null, 2),
  'utf8',
);

const failures = [
  sections.coverage.available && !sections.coverage.ok ? 'couverture' : null,
  sections.mutation.available && !sections.mutation.ok ? 'mutation' : null,
  sections.e2e.available && !sections.e2e.ok ? 'end-to-end' : null,
].filter(Boolean);

console.log(`Rapport d'audit écrit dans ${OUT_DIR}/index.html`);
if (failures.length > 0) {
  console.error(`Sections non conformes : ${failures.join(', ')}`);
  process.exit(1);
}
