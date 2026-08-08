#!/usr/bin/env node
/**
 * Sauvegarde, vérification et restauration.
 *
 * Ce que l'application perd si le disque lâche n'est pas remplaçable : le
 * **journal d'événements** est la traçabilité elle-même, et il n'existe nulle
 * part ailleurs. Un cycle de culture dure des mois — une sauvegarde qui ne
 * marche pas ne se découvre qu'au pire moment.
 *
 * D'où le parti pris : **une sauvegarde non vérifiée ne compte pas**. La
 * commande `verifier` restaure réellement l'archive dans une base jetable et
 * recompte chaque collection. Elle échoue si un seul document manque.
 *
 * Utilisation :
 *
 *   node scripts/sauvegarde.mjs sauvegarder [--sortie <dossier>]
 *   node scripts/sauvegarde.mjs verifier <archive>
 *   node scripts/sauvegarde.mjs restaurer <archive> [--vers <base>]
 *
 * Options communes : --conteneur <nom> (défaut champi-mongo),
 * --base <nom> (défaut champignon), --port <n> (défaut 27018).
 */

import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readdir, stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { argv, env, exit, stderr, stdout } from 'node:process';

const DEFAULTS = {
  conteneur: 'champi-mongo',
  base: env.CHAMPI_DB_NAME ?? 'champignon',
  port: '27018',
  sortie: env.CHAMPI_BACKUP_DIR ?? './sauvegardes',
  /** Dossier des pièces jointes, sauvegardé s'il existe. */
  fichiers: env.CHAMPI_FILES_DIR ?? './fichiers',
};

function log(message) {
  stdout.write(`${message}\n`);
}

function echec(message) {
  stderr.write(`✗ ${message}\n`);
  exit(1);
}

/** Analyse `argv` : une commande, des positions, des options `--clé valeur`. */
function analyser(args) {
  const [commande, ...reste] = args;
  const positions = [];
  const options = { ...DEFAULTS };

  for (let index = 0; index < reste.length; index += 1) {
    const jeton = reste[index];
    if (!jeton.startsWith('--')) {
      positions.push(jeton);
      continue;
    }
    const valeur = reste[index + 1];
    if (valeur === undefined || valeur.startsWith('--')) {
      echec(`L'option « ${jeton} » attend une valeur.`);
    }
    options[jeton.slice(2)] = valeur;
    index += 1;
  }

  return { commande, positions, options };
}

/**
 * Exécute une commande.
 *
 * `versFichier` redirige la sortie standard vers un fichier — c'est ainsi que
 * l'archive sort du conteneur. `depuisFichier` alimente l'entrée standard,
 * c'est ainsi qu'elle y rentre. Aucune des deux ne passe par un volume monté.
 */
function executer(commande, args, { versFichier, depuisFichier } = {}) {
  return new Promise((resolvePromise) => {
    const enfant = spawn(commande, args, {
      stdio: [depuisFichier === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    });

    let sortie = '';
    let erreur = '';

    if (versFichier === undefined) {
      enfant.stdout.on('data', (morceau) => {
        sortie += String(morceau);
      });
    } else {
      enfant.stdout.pipe(createWriteStream(versFichier));
    }
    enfant.stderr.on('data', (morceau) => {
      erreur += String(morceau);
    });

    enfant.on('error', (cause) => {
      resolvePromise({ code: 127, sortie: '', erreur: cause.message });
    });
    enfant.on('close', (code) => {
      resolvePromise({ code: code ?? 1, sortie, erreur });
    });

    if (depuisFichier !== undefined) {
      createReadStream(depuisFichier).pipe(enfant.stdin);
    }
  });
}

/** Interroge la base et rend le résultat JSON de `mongosh`. */
async function interroger(options, script) {
  const resultat = await executer('docker', [
    'exec',
    options.conteneur,
    'mongosh',
    '--quiet',
    '--port',
    options.port,
    '--eval',
    script,
  ]);
  if (resultat.code !== 0) {
    echec(`mongosh a échoué : ${resultat.erreur.trim()}`);
  }
  try {
    return JSON.parse(resultat.sortie);
  } catch {
    echec(`Réponse illisible de mongosh : ${resultat.sortie.slice(0, 200)}`);
    return undefined;
  }
}

/** Nombre de documents par collection d'une base. */
function scriptInventaire(base) {
  return `
    const db = db.getSiblingDB(${JSON.stringify(base)});
    const inventaire = {};
    for (const nom of db.getCollectionNames().sort()) {
      inventaire[nom] = db.getCollection(nom).countDocuments();
    }
    print(JSON.stringify(inventaire));
  `;
}

function horodatage() {
  return new Date().toISOString().replaceAll(':', '-').slice(0, 19);
}

/** Crée l'archive et rend son chemin. */
async function sauvegarder(options) {
  const dossier = resolve(options.sortie);
  await mkdir(dossier, { recursive: true });

  const inventaire = await interroger(options, scriptInventaire(options.base));
  const total = Object.values(inventaire).reduce((somme, nombre) => somme + nombre, 0);
  if (total === 0) {
    // Ce n'est pas une erreur — une base neuve se sauvegarde aussi — mais le
    // silence serait trompeur si le nom de base est simplement mal orthographié.
    log(`⚠️  La base « ${options.base} » est vide. Vérifie --base si ce n'est pas attendu.`);
  }

  const archive = join(dossier, `${options.base}-${horodatage()}.archive.gz`);

  // `--archive` sur la sortie standard, redirigée côté hôte : aucun volume à
  // monter dans le conteneur, aucun fichier laissé à l'intérieur.
  const dump = await executer(
    'docker',
    [
      'exec',
      options.conteneur,
      'mongodump',
      '--port',
      options.port,
      '--db',
      options.base,
      '--archive',
      '--gzip',
    ],
    { versFichier: archive },
  );
  if (dump.code !== 0) {
    echec(`mongodump a échoué : ${dump.erreur.trim()}`);
  }

  const taille = (await stat(archive)).size;
  if (taille === 0) {
    echec("L'archive produite est vide : la sauvegarde n'a rien capturé.");
  }

  log(`✓ Archive : ${archive} (${(taille / 1024).toFixed(1)} Ko)`);
  for (const [collection, nombre] of Object.entries(inventaire)) {
    log(`  ${collection.padEnd(20)} ${String(nombre).padStart(7)} documents`);
  }

  await sauvegarderFichiers(options, dossier);
  return archive;
}

/**
 * Sauvegarde les pièces jointes.
 *
 * Le stockage de fichiers n'est **pas** dans la tranche verticale : une
 * observation ne porte aujourd'hui qu'un `photoId`, pas un binaire. Le dossier
 * est donc traité s'il existe et ignoré sinon — sans faire croire que les
 * photos sont sauvegardées alors qu'aucune n'est encore stockée.
 */
async function sauvegarderFichiers(options, dossier) {
  const source = resolve(options.fichiers);
  let entrees;
  try {
    entrees = await readdir(source);
  } catch {
    log(`  (aucun dossier de fichiers en ${source} : rien à joindre)`);
    return;
  }
  if (entrees.length === 0) {
    log(`  (dossier de fichiers vide : rien à joindre)`);
    return;
  }

  const archive = join(dossier, `fichiers-${horodatage()}.tar.gz`);
  const tar = await executer('tar', ['-czf', archive, '-C', source, '.']);
  if (tar.code !== 0) {
    echec(`La sauvegarde des fichiers a échoué : ${tar.erreur.trim()}`);
  }
  log(`✓ Fichiers : ${archive} (${String(entrees.length)} entrées)`);
}

/**
 * Restaure l'archive dans une base jetable et recompte tout.
 *
 * C'est la seule preuve qui vaille : une archive qui se lit, se restaure et
 * rend exactement les mêmes comptes. Toute divergence échoue.
 */
async function verifier(options, cheminArchive) {
  const archive = resolve(cheminArchive);
  const baseTemoin = `${options.base}_verif_${horodatage().replaceAll('-', '')}`;

  log(`Vérification de ${basename(archive)} → base jetable « ${baseTemoin} »`);

  const restore = await executer(
    'docker',
    [
      'exec',
      '-i',
      options.conteneur,
      'mongorestore',
      '--port',
      options.port,
      '--archive',
      '--gzip',
      `--nsFrom=${options.base}.*`,
      `--nsTo=${baseTemoin}.*`,
      '--quiet',
    ],
    { depuisFichier: archive },
  );
  if (restore.code !== 0) {
    echec(`mongorestore a échoué : ${restore.erreur.trim()}`);
  }

  const source = await interroger(options, scriptInventaire(options.base));
  const restauré = await interroger(options, scriptInventaire(baseTemoin));

  await interroger(
    options,
    `db.getSiblingDB(${JSON.stringify(baseTemoin)}).dropDatabase(); print('{}')`,
  );

  const écarts = [];
  for (const collection of new Set([...Object.keys(source), ...Object.keys(restauré)])) {
    const attendu = source[collection] ?? 0;
    const obtenu = restauré[collection] ?? 0;
    if (attendu !== obtenu) {
      écarts.push(`${collection} : ${String(attendu)} attendus, ${String(obtenu)} restaurés`);
    }
  }

  if (écarts.length > 0) {
    echec(`La restauration ne rend pas la base à l'identique :\n  ${écarts.join('\n  ')}`);
  }

  const total = Object.values(source).reduce((somme, nombre) => somme + nombre, 0);
  log(
    `✓ Restauration vérifiée : ${String(Object.keys(source).length)} collections, ${String(total)} documents identiques.`,
  );
}

/** Restaure pour de vrai, dans une base nommée. */
async function restaurer(options, cheminArchive) {
  const archive = resolve(cheminArchive);
  const cible = options.vers ?? options.base;

  const existant = await interroger(options, scriptInventaire(cible));
  const total = Object.values(existant).reduce((somme, nombre) => somme + nombre, 0);
  if (total > 0) {
    // On ne fusionne pas en silence : restaurer par-dessus des données
    // existantes mêlerait deux histoires de traçabilité.
    echec(
      `La base « ${cible} » contient déjà ${String(total)} documents.\n` +
        `  Restaure vers une base neuve : --vers ${cible}_restauree\n` +
        `  puis bascule CHAMPI_DB_NAME une fois la vérification faite.`,
    );
  }

  const restore = await executer(
    'docker',
    [
      'exec',
      '-i',
      options.conteneur,
      'mongorestore',
      '--port',
      options.port,
      '--archive',
      '--gzip',
      `--nsFrom=${options.base}.*`,
      `--nsTo=${cible}.*`,
      '--quiet',
    ],
    { depuisFichier: archive },
  );
  if (restore.code !== 0) {
    echec(`mongorestore a échoué : ${restore.erreur.trim()}`);
  }

  const inventaire = await interroger(options, scriptInventaire(cible));
  log(`✓ Restauré dans « ${cible} » :`);
  for (const [collection, nombre] of Object.entries(inventaire)) {
    log(`  ${collection.padEnd(20)} ${String(nombre).padStart(7)} documents`);
  }
  log(`\nBascule l'application avec CHAMPI_DB_NAME=${cible}, puis redémarre-la.`);
}

function aide() {
  log(`Sauvegarde de Champignon Manager.

  node scripts/sauvegarde.mjs sauvegarder [--sortie <dossier>]
      Crée une archive horodatée de la base et des pièces jointes.

  node scripts/sauvegarde.mjs verifier <archive>
      Restaure l'archive dans une base jetable et recompte tout. Échoue au
      moindre écart. Une sauvegarde non vérifiée ne compte pas.

  node scripts/sauvegarde.mjs restaurer <archive> [--vers <base>]
      Restaure pour de vrai. Refuse d'écraser une base non vide.

Options : --conteneur (${DEFAULTS.conteneur}) --base (${DEFAULTS.base}) --port (${DEFAULTS.port})`);
}

const { commande, positions, options } = analyser(argv.slice(2));

if (commande === 'sauvegarder') {
  const archive = await sauvegarder(options);
  // La sauvegarde se vérifie dans la foulée : c'est le seul moment où l'on
  // sait encore quoi faire si elle est mauvaise.
  await verifier(options, archive);
} else if (commande === 'verifier') {
  if (positions[0] === undefined) {
    echec('Indique l’archive à vérifier : node scripts/sauvegarde.mjs verifier <archive>');
  }
  await verifier(options, positions[0]);
} else if (commande === 'restaurer') {
  if (positions[0] === undefined) {
    echec('Indique l’archive à restaurer : node scripts/sauvegarde.mjs restaurer <archive>');
  }
  await restaurer(options, positions[0]);
} else {
  aide();
  if (commande !== undefined && commande !== 'aide' && commande !== '--help') {
    exit(1);
  }
}
