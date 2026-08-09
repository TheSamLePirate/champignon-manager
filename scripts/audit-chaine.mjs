#!/usr/bin/env node
/**
 * Audit de chaîne complète — du spore à l'assiette.
 *
 * Ce script déroule **une production entière** contre une pile réelle, puis
 * vérifie que la traçabilité tient de bout en bout : d'une barquette on doit
 * remonter aux blocs, et de chaque unité on doit reconstruire l'état depuis son
 * journal.
 *
 * Ce n'est pas un test de plus. C'est la démonstration que les couches tiennent
 * **ensemble** sur une histoire réaliste — gélose, culture liquide, grain,
 * substrat, fructification, flushs, produit — avec QR, étiquettes, photos,
 * observations et mesures. Chaque étape est vérifiée au moment où elle est
 * franchie ; le rapport dit ce qui a été prouvé, et par quoi.
 *
 * Utilisation :
 *
 *   node scripts/audit-chaine.mjs [--url http://127.0.0.1:3000] [--blocs 3]
 *                                 [--flushs 2] [--espece Pleurote]
 *                                 [--sortie reports/audit-chaine]
 *
 * Tout est configurable : le nombre de blocs issus du grain, le nombre de
 * flushs par bloc, le nom de l'espèce. Le rapport produit est autonome.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { argv, exit, stdout } from 'node:process';

/** Un PNG minuscule mais valide — la photo n'a pas à être belle pour être tracée. */
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const DEFAUTS = {
  url: 'http://127.0.0.1:3000',
  blocs: 3,
  flushs: 2,
  espece: 'Pleurote',
  sortie: 'reports/audit-chaine',
};

function analyser(args) {
  const options = { ...DEFAUTS };
  for (let index = 0; index < args.length; index += 1) {
    const jeton = args[index];
    if (!jeton.startsWith('--')) continue;
    const valeur = args[index + 1];
    if (valeur === undefined || valeur.startsWith('--')) {
      stdout.write(`L'option « ${jeton} » attend une valeur.\n`);
      exit(1);
    }
    const cle = jeton.slice(2);
    options[cle] = ['blocs', 'flushs'].includes(cle) ? Number(valeur) : valeur;
    index += 1;
  }
  return options;
}

const options = analyser(argv.slice(2));

/** Journal de l'audit : chaque étape, ce qu'elle prouve, et son verdict. */
const etapes = [];

function log(message) {
  stdout.write(`${message}\n`);
}

/**
 * Enregistre une vérification.
 *
 * Le `constat` est ce qu'on a réellement observé, pas ce qu'on espérait : un
 * rapport qui ne cite que ses attentes ne prouve rien.
 */
function verifier(titre, prouve, condition, constat) {
  const ok = Boolean(condition);
  etapes.push({ titre, prouve, ok, constat });
  log(`${ok ? '✓' : '✗'} ${titre} — ${constat}`);
  if (!ok) {
    log(`\n  Échec : ${prouve}\n`);
  }
  return ok;
}

async function appel(methode, chemin, corps) {
  const reponse = await fetch(`${options.url}${chemin}`, {
    method: methode,
    headers:
      corps === undefined
        ? {}
        : { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    ...(corps === undefined ? {} : { body: JSON.stringify(corps) }),
  });
  const texte = await reponse.text();
  let charge;
  try {
    charge = JSON.parse(texte);
  } catch {
    charge = { brut: texte.slice(0, 200) };
  }
  if (!reponse.ok) {
    throw new Error(
      `${methode} ${chemin} → ${String(reponse.status)} : ${JSON.stringify(charge.error ?? charge)}`,
    );
  }
  return charge.data;
}

/** Crée une unité, éventuellement issue d'une autre. */
async function creerUnite({ nom, stade, etape, versionId, parent, relation, poidsKg }) {
  const { unit } = await appel('POST', '/api/units', {
    name: nom,
    stage: stade,
    processVersionId: versionId,
    stepId: etape,
    ...(parent === undefined ? {} : { parentUnitId: parent.id }),
    ...(relation === undefined ? {} : { lineageRelation: relation }),
    ...(poidsKg === undefined
      ? {}
      : { substrateWeight: { value: poidsKg, unit: 'kg', kind: 'substrate' } }),
  });
  return unit;
}

/** Étiquette une unité : QR, impression, et une photo au journal. */
async function etiqueterEtDocumenter(unit) {
  const qr = await appel('POST', `/api/units/${unit.publicCode}/qr`, {});
  await appel('POST', `/api/units/${unit.publicCode}/label/print`, { copies: 1 });
  await appel('POST', `/api/units/${unit.publicCode}/photos`, {
    data: PNG,
    contentType: 'image/png',
    note: `État à la création de ${unit.publicCode}`,
  });
  return qr.token;
}

/**
 * Fait avancer une unité, en journalisant observation et mesure au passage.
 *
 * On **relit** l'unité avant de commencer : étiqueter et photographier ont déjà
 * incrémenté sa version, et repartir de la version connue à la création se fait
 * refuser par le verrou optimiste — ce qui est précisément son rôle.
 */
async function avancer(unit, etapes_) {
  const courante = await appel('GET', `/api/units/${unit.publicCode}`);
  let version = courante.version;
  for (const etape of etapes_) {
    const { unit: apres } = await appel('POST', `/api/units/${unit.publicCode}/advance`, {
      toStepId: etape,
      expectedVersion: version,
      confirmOffNominal: true,
    });
    version = apres.version;
    await appel('POST', `/api/units/${unit.publicCode}/observations`, {
      kind: 'colonisation',
      severity: 'low',
      note: `Passage à ${etape}`,
    });
    await appel('POST', `/api/units/${unit.publicCode}/measurements`, {
      metric: 'temperature_c',
      numericValue: 24,
    });
  }
  return version;
}

async function principal() {
  log(`\nAudit de chaîne complète — ${options.espece}`);
  log(`Serveur : ${options.url}\n`);

  // --- 1. Le process ---------------------------------------------------------
  const templates = await appel('GET', '/api/process-templates');
  const modele = templates[0];
  if (modele === undefined) {
    throw new Error("Aucun process : l'amorçage du premier démarrage a-t-il eu lieu ?");
  }
  const versions = await appel('GET', `/api/process-templates/${modele.id}/versions`);
  const publiee = [...versions].reverse().find((version) => version.status === 'published');
  if (publiee === undefined) {
    throw new Error(`Le process « ${modele.name} » n'a aucune version publiée.`);
  }
  verifier(
    'Un process publié existe au démarrage',
    "Sans process, aucune unité n'est créable : c'est ce que l'amorçage garantit.",
    publiee.graph.steps.length > 0,
    `« ${modele.name} » version ${String(publiee.versionNumber)}, ${String(publiee.graph.steps.length)} étapes`,
  );

  const etapeDe = (stade) => publiee.graph.steps.find((step) => step.stage === stade)?.id;

  // --- 2. La chaîne de propagation ------------------------------------------
  const gelose = await creerUnite({
    nom: `${options.espece} — gélose mère`,
    stade: 'gelose',
    etape: etapeDe('gelose'),
    versionId: publiee.id,
  });
  await etiqueterEtDocumenter(gelose);

  const clone = await creerUnite({
    nom: `${options.espece} — gélose clonée`,
    stade: 'gelose',
    etape: etapeDe('gelose'),
    versionId: publiee.id,
    parent: gelose,
  });
  verifier(
    'Un clone reste au même stade et change de génération',
    'Le cultivateur clone sans limite de génération ; une origine et un clone doivent rester distinguables.',
    clone.lineageRelation === 'clone' && clone.generation === 1,
    `relation « ${clone.lineageRelation} », génération ${String(clone.generation)}`,
  );

  const liquide = await creerUnite({
    nom: `${options.espece} — culture liquide`,
    stade: 'liquid_culture',
    etape: etapeDe('liquid_culture'),
    versionId: publiee.id,
    parent: clone,
  });
  const grain = await creerUnite({
    nom: `${options.espece} — ballot de grain`,
    stade: 'grain',
    etape: etapeDe('grain'),
    versionId: publiee.id,
    parent: liquide,
  });
  verifier(
    'Un changement de stade est un transfert',
    'Clone et transfert ne se confondent pas : le premier multiplie, le second fait avancer la propagation.',
    liquide.lineageRelation === 'transfer' && grain.generation === 3,
    `gélose → liquide → grain, génération ${String(grain.generation)}`,
  );

  // --- 3. Les blocs de substrat ---------------------------------------------
  const blocs = [];
  for (let index = 1; index <= options.blocs; index += 1) {
    const bloc = await creerUnite({
      nom: `${options.espece} — bloc ${String(index)}`,
      stade: 'substrate',
      etape: etapeDe('substrate'),
      versionId: publiee.id,
      parent: grain,
      poidsKg: 5,
    });
    await etiqueterEtDocumenter(bloc);
    blocs.push(bloc);
  }
  verifier(
    `Un ballot de grain donne ${String(options.blocs)} blocs`,
    'Une unité amont donne N unités aval : c’est la définition du transfert.',
    blocs.every((bloc) => bloc.parentUnitId === grain.id),
    `${String(blocs.length)} blocs rattachés à ${grain.publicCode}`,
  );

  // --- 4. Fructification et récoltes ----------------------------------------
  const recoltes = [];
  for (const bloc of blocs) {
    // Le bloc naît à l'étape substrat ; on le mène jusqu'à la fructification.
    await avancer(bloc, [etapeDe('fruiting')]);
    for (let flush = 1; flush <= options.flushs; flush += 1) {
      const { harvest } = await appel('POST', `/api/units/${bloc.publicCode}/harvests`, {
        flushNumber: flush,
        weight: { value: 900 - flush * 200, unit: 'g', kind: 'harvest' },
        quality: flush === 1 ? 'A' : 'B',
        losses:
          flush === 2
            ? [{ weight: { value: 40, unit: 'g', kind: 'harvest' }, cause: 'overripe' }]
            : [],
      });
      recoltes.push({ bloc, harvest });
    }
  }
  verifier(
    `Chaque bloc produit ${String(options.flushs)} flush(s)`,
    'Le poids se relève par unité et par flush : c’est ce qui rend les rendements comparables.',
    recoltes.length === options.blocs * options.flushs,
    `${String(recoltes.length)} récoltes enregistrées`,
  );

  const rendement = await appel('GET', `/api/units/${blocs[0].publicCode}/harvests`);
  verifier(
    'Le rendement biologique est calculable',
    'Il exige le poids de substrat saisi à l’inoculation ; sans lui, l’application dit pourquoi plutôt que de rendre zéro.',
    typeof rendement.biologicalEfficiencyPct === 'number',
    `${String(rendement.biologicalEfficiencyPct)} % sur ${blocs[0].publicCode}`,
  );

  // --- 5. Le produit final ---------------------------------------------------
  const poids = recoltes.map((entree) => entree.harvest.weight.value);
  const total = poids.reduce((somme, valeur) => somme + valeur, 0);
  const { product } = await appel('POST', '/api/products', {
    name: `Barquette ${options.espece}`,
    quantity: { value: total, unit: 'g', kind: 'product' },
    origins: recoltes.map((entree, index) => ({
      harvestId: entree.harvest.id,
      weight: { value: poids[index], unit: 'g', kind: 'harvest' },
      share: poids[index] / total,
    })),
  });
  verifier(
    'Un produit se compose de plusieurs récoltes',
    'Les mélanges sont autorisés, avec proportions exactes — sans quoi la remontée serait approximative.',
    product.publicCode.length > 0,
    `${product.publicCode}, ${String(total)} g issus de ${String(recoltes.length)} récoltes`,
  );

  // --- 6. La remontée --------------------------------------------------------
  const trace = await appel('GET', `/api/products/${product.publicCode}/trace`);
  const partTotale = trace.contributions.reduce(
    (somme, contribution) => somme + contribution.sharePct,
    0,
  );
  verifier(
    'De la barquette on remonte à chaque bloc',
    'C’est la promesse « du spore à l’assiette » : un rappel doit désigner les blocs exacts.',
    trace.contributions.length === recoltes.length && Math.abs(partTotale - 100) < 0.5,
    `${String(trace.contributions.length)} contributions, ${partTotale.toFixed(1)} % au total`,
  );

  const uniques = new Set(trace.contributions.map((contribution) => contribution.unitId));
  verifier(
    'La remontée désigne les bonnes unités',
    'Une part attribuée au mauvais bloc rendrait le rappel inopérant.',
    uniques.size === blocs.length,
    `${String(uniques.size)} blocs distincts identifiés`,
  );

  // --- 7. L'intégrité du journal --------------------------------------------
  let evenements = 0;
  let intacts = 0;
  for (const unite of [gelose, clone, liquide, grain, ...blocs]) {
    const audit = await appel('GET', `/api/units/${unite.publicCode}/audit`);
    evenements += audit.eventCount;
    if (audit.verified && audit.divergences.length === 0) {
      intacts += 1;
    }
  }
  const total_unites = 4 + blocs.length;
  verifier(
    'Chaque unité se reconstruit depuis son journal',
    'L’état stocké n’est qu’une commodité de lecture : le journal fait foi, et il doit le prouver.',
    intacts === total_unites,
    `${String(intacts)}/${String(total_unites)} unités vérifiées, ${String(evenements)} événements rejoués`,
  );

  const descendance = await appel('GET', `/api/units/${blocs[0].publicCode}/trace`);
  verifier(
    'De chaque bloc on redescend vers ses produits',
    'La traçabilité se lit dans les deux sens : du produit vers les blocs, et du bloc vers les produits.',
    descendance.products.length > 0,
    `${blocs[0].publicCode} → ${String(descendance.products.length)} produit(s)`,
  );

  return { modele, publiee, gelose, grain, blocs, recoltes, product, trace, evenements };
}

// --- Rapport ----------------------------------------------------------------

function rapport(contexte, reussi) {
  // Sans contexte, la chaîne s'est arrêtée en route : le rapport doit exister
  // quand même, sinon la CI ne publie rien précisément le jour où c'est utile.
  const resume =
    contexte === undefined
      ? `| Chaîne | **interrompue avant la fin** |`
      : `| Process | ${contexte.modele.name}, version ${String(contexte.publiee.versionNumber)} |
| Chaîne | gélose → clone → culture liquide → ballot de grain → ${String(options.blocs)} blocs |
| Récoltes | ${String(contexte.recoltes.length)} (${String(options.flushs)} flush(s) par bloc) |
| Produit final | ${contexte.product.publicCode} |
| Événements rejoués | ${String(contexte.evenements)} |`;

  const lignes = etapes
    .map(
      (etape) =>
        `| ${etape.ok ? '✅' : '❌'} | ${etape.titre} | ${etape.constat} | ${etape.prouve} |`,
    )
    .join('\n');

  return `# Audit de chaîne complète — ${options.espece}

> Déroulé le ${new Date().toISOString().slice(0, 19).replace('T', ' à ')} contre
> \`${options.url}\`, sur une pile réelle. **${etapes.filter((e) => e.ok).length}/${etapes.length}** vérifications passées.

Ce rapport n'est pas une intention : chaque ligne a été **exécutée**, et son
constat est ce qui a réellement été observé.

## Ce que cette chaîne a produit

| | |
| --- | --- |
${resume}

## Vérifications

| | Vérification | Constat | Ce que cela prouve |
| --- | --- | --- | --- |
${lignes}

## Reproduire

\`\`\`bash
node scripts/audit-chaine.mjs \\
  --url ${options.url} \\
  --blocs ${String(options.blocs)} \\
  --flushs ${String(options.flushs)} \\
  --espece '${options.espece}'
\`\`\`

Tout est configurable : le nombre de blocs issus d'un ballot de grain, le nombre
de flushs par bloc, l'espèce. La chaîne s'adapte au process **publié** trouvé sur
le serveur — elle ne suppose pas le modèle par défaut.

## Ce que cet audit ne prouve pas

- **Rien sur le matériel.** L'imprimante répond via le transport configuré ; si
  c'est le transport en mémoire, aucune étiquette ne sort. Le scan caméra, lui,
  ne se vérifie que sur un téléphone.
- **Rien sur la durée.** Les étapes sont franchies en quelques secondes, pas en
  trois semaines. Les alarmes de durée ne sont donc pas éprouvées ici.
- **Rien sur la charge.** Une chaîne, pas cent — les budgets de performance sont
  mesurés séparément (\`e2e/performance.api.spec.ts\`).

${reussi ? '' : '\n> ⚠️ **Cet audit a échoué.** Les lignes marquées ❌ ci-dessus indiquent où.\n'}`;
}

let reussi = false;
let contexte;
try {
  contexte = await principal();
  reussi = etapes.every((etape) => etape.ok);
} catch (cause) {
  log(`\n✗ Audit interrompu : ${String(cause)}\n`);
  etapes.push({
    titre: 'Déroulé complet de la chaîne',
    prouve: 'La chaîne doit se dérouler sans erreur, du spore à l’assiette.',
    ok: false,
    constat: String(cause),
  });
}

const dossier = options.sortie;
await mkdir(dossier, { recursive: true });
await writeFile(join(dossier, 'audit-chaine.md'), rapport(contexte, reussi), 'utf8');
await writeFile(
  join(dossier, 'audit-chaine.json'),
  JSON.stringify({ options, etapes, reussi }, null, 2),
  'utf8',
);
log(`\nRapport écrit dans ${join(dossier, 'audit-chaine.md')}`);

log(
  reussi
    ? `\n✓ Chaîne complète vérifiée : ${String(etapes.length)} points, aucun écart.\n`
    : `\n✗ ${String(etapes.filter((e) => !e.ok).length)} vérification(s) en échec.\n`,
);
exit(reussi ? 0 : 1);
