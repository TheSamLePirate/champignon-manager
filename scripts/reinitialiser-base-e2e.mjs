#!/usr/bin/env node
/**
 * Remise à zéro de la base end-to-end, **avant** le démarrage du serveur.
 *
 * Deux raisons, pas une :
 *
 * 1. **Le premier démarrage est un scénario testable.** Le serveur n'amorce son
 *    modèle de process que si la base est vierge : sans ce nettoyage,
 *    `mise-en-service.api.spec.ts` ne vérifierait plus rien dès la deuxième
 *    campagne.
 * 2. **Les campagnes ne doivent pas se contaminer.** Sans cela, la base
 *    accumulait les données de tous les lancements précédents — plusieurs
 *    centaines de process en quelques jours — et les budgets de performance
 *    mesuraient cette accumulation plutôt que le code.
 *
 * Lancé dans la commande du serveur et non dans un `globalSetup` : Playwright
 * démarre le serveur **avant** le setup global, et vider la base après lui
 * effacerait précisément ce que le scénario vient vérifier.
 */

import { MongoClient } from 'mongodb';

const DB_NAME = process.env.CHAMPI_DB_NAME ?? 'champignon_e2e';
const URL = process.env.CHAMPI_MONGO_URL ?? 'mongodb://localhost:27018/?replicaSet=rs0';

if (!DB_NAME.includes('e2e')) {
  // Garde-fou : une variable d'environnement mal réglée ne doit pas effacer une
  // base réelle. Le nom d'une base de test contient toujours « e2e ».
  console.error(
    `Refus d'effacer la base « ${DB_NAME} » : le nettoyage end-to-end ne vise que les bases de test.`,
  );
  process.exit(1);
}

const client = new MongoClient(URL);
try {
  await client.connect();
  await client.db(DB_NAME).dropDatabase();
  console.log(`Base « ${DB_NAME} » remise à zéro : la campagne part d'un premier démarrage.`);
} finally {
  await client.close();
}
