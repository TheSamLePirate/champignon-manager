# 09 — Interface frontend et UX

## 1. Objectif UX

L’interface doit être simple sur le terrain et complète au bureau.

Deux usages principaux :

1. **mobile/iPhone** : scan QR, consultation rapide, action immédiate ;
2. **desktop/tablette** : configuration, dashboards, analyse, gestion de stock.

## 2. Principes d’interface

- Mobile first pour les actions terrain.
- Peu de clics après scan QR.
- Gros boutons utilisables avec les mains occupées.
- Textes courts et lisibles.
- Actions proposées selon le contexte du lot.
- Historique complet accessible mais non envahissant.
- Couleurs de statut cohérentes.
- Fonctionnement sur réseau local.
- Éviter les écrans trop denses en chambre.

## 3. Navigation principale

Sections proposées :

- Dashboard ;
- Scan QR ;
- Lots ;
- Chambres ;
- Mesures / Observations ;
- Récoltes ;
- Produits / Stock ;
- Rapports ;
- Configuration ;
- Paramètres matériels.

## 4. Parcours mobile : scan QR

### 4.1 Scan réussi

Après scan :

1. résolution du QR ;
2. affichage de la cible : lot, chambre, produit, récolte ;
3. affichage de l’état actuel ;
4. affichage des actions rapides disponibles ;
5. possibilité d’ajouter observation ou mesure ;
6. accès à l’historique.

### 4.2 Fiche mobile d’un lot

Informations prioritaires :

- code du lot ;
- espèce/souche ;
- phase actuelle ;
- étape actuelle ;
- chambre/emplacement ;
- durée dans l’étape ;
- alertes ;
- dernières observations ;
- dernières mesures ;
- actions rapides.

Actions rapides possibles :

- ajouter observation ;
- ajouter mesure ;
- changer d’étape ;
- déplacer ;
- diviser ;
- récolter ;
- signaler problème ;
- imprimer/réimprimer QR ;
- voir généalogie.

Ces actions viennent de la configuration du process et des permissions utilisateur.

## 5. Dashboard production

Le dashboard doit afficher :

- lots actifs par phase ;
- lots actifs par chambre ;
- lots en retard ;
- alertes ouvertes ;
- tâches du jour ;
- récoltes attendues ;
- dernières récoltes ;
- rendement par période ;
- problèmes récents.

## 6. Vue lots

### 6.1 Liste

Filtres :

- statut ;
- phase ;
- étape ;
- chambre ;
- espèce ;
- souche ;
- tag ;
- date de création ;
- alerte ouverte.

Colonnes utiles :

- code ;
- espèce/souche ;
- phase/étape ;
- chambre ;
- âge ;
- dernière action ;
- rendement à date ;
- statut.

### 6.2 Fiche lot desktop

Onglets proposés :

- Résumé ;
- Actions ;
- Timeline ;
- Mesures ;
- Observations ;
- Récoltes ;
- Généalogie ;
- QR / étiquettes ;
- Corrections.

## 7. Timeline

La timeline doit permettre de comprendre rapidement l’histoire du lot.

Éléments affichés :

- création ;
- impressions QR ;
- changements d’étape ;
- mouvements ;
- mesures ;
- observations ;
- divisions ;
- récoltes ;
- produits créés ;
- corrections.

Filtres utiles :

- afficher uniquement récoltes ;
- afficher uniquement problèmes ;
- afficher mesures ;
- afficher événements système.

## 8. Généalogie

Visualisation arbre :

- source à la racine ;
- lots et sous-lots en branches ;
- récoltes rattachées ;
- produits finaux en sortie.

Objectifs :

- voir les divisions ;
- comprendre les rendements par branche ;
- remonter d’un produit au lot d’origine ;
- descendre d’une source vers ses produits.

## 9. Chambres et emplacements

### 9.1 Vue chambre

Afficher :

- lots présents ;
- capacité ;
- conditions cibles ;
- dernières mesures ;
- alertes ;
- caméra associée si disponible ;
- appareils associés, par exemple Inkbird.

### 9.2 Vue emplacement

Si le détail est activé :

- rack ;
- niveau ;
- position ;
- lot présent ;
- historique des mouvements.

## 10. Formulaires configurables

Les formulaires doivent être générés depuis la configuration du process quand possible.

Chaque action configurable peut fournir :

- titre ;
- description courte ;
- champs ;
- valeurs par défaut ;
- champs obligatoires ;
- validation ;
- événement créé ;
- prochaine action proposée.

Exemples :

- action “Ajouter observation contamination” ;
- action “Mesure humidité chambre” ;
- action “Récolter flush 1” ;
- action “Diviser lot”.

## 11. Observations

L’interface d’observation doit être très rapide.

Champs possibles :

- type d’observation ;
- gravité ;
- note ;
- photo ;
- tags ;
- action immédiate : créer alerte, marquer contamination, proposer déplacement.

Les observations proposées dépendent de la phase et de l’étape.

## 12. Récolte et produits

### 12.1 Saisie récolte

- scan lot ;
- choisir flush ;
- saisir poids brut/net ;
- saisir qualité ;
- saisir pertes ;
- ajouter note/photo ;
- créer produits finaux directement ou plus tard.

### 12.2 Création produit final

- choisir type de produit ;
- quantité ;
- conditionnement ;
- origine ;
- date ;
- DLC/DDM si utilisée ;
- QR produit si nécessaire.

## 13. Configuration

Écrans de configuration :

- espèces/souches ;
- chambres/emplacements ;
- process templates ;
- phases ;
- étapes ;
- actions ;
- observations ;
- mesures ;
- produits finaux ;
- imprimantes ;
- modèles d’étiquettes ;
- caméras ;
- appareils Inkbird.

## 14. UX hors ligne / réseau instable

À décider pour le MVP.

Options :

- mode strictement en ligne réseau local ;
- PWA avec cache lecture seule ;
- file d’attente locale pour saisies hors ligne.

Décision proposée : commencer en ligne local, puis ajouter un mode PWA offline si le terrain le nécessite.

## 15. États vides et erreurs

Prévoir des écrans clairs pour :

- QR inconnu ;
- QR révoqué ;
- lot terminé ;
- action non autorisée ;
- imprimante indisponible ;
- appareil indisponible ;
- réseau backend inaccessible ;
- conflit de modification.
