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
- cloner (culture secondaire) ;
- transférer / repiquer au stade suivant ;
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

Visualisation arbre multi-stade « du spore à l’assiette » :

- origine / gélose à la racine ;
- clones (cultures secondaires) et transferts (gélose→LC→grain→substrat) en branches, avec le type de relation ;
- lots substrat et sous-lots issus de division ;
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

Décision développeur : commencer en ligne via Tailscale (confirmé, HTTPS fourni), sans PWA obligatoire au MVP, puis ajouter un mode PWA/offline si le terrain le nécessite.

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

## 16. Décisions développeur intégrées

Synthèse complète : [18-decisions-techniques-dev.md](./18-decisions-techniques-dev.md).

Décisions UX/frontend :

- React + Vite avec TypeScript strict.
- Tailwind + shadcn/ui recommandés.
- TanStack Query recommandé pour les données serveur.
- React Hook Form + Zod recommandés pour les formulaires.
- Générateur de formulaires dynamiques pour les actions/process configurables.
- UI mobile iPhone prioritaire.
- Gros boutons, contraste fort, mode sombre, peu de champs.
- Confirmation obligatoire pour actions critiques et actions en masse.

Écrans prioritaires confirmés :

- dashboard ;
- scan QR ;
- fiche lot mobile ;
- liste lots ;
- timeline lot ;
- actions rapides lot ;
- chambres ;
- mesures / observations ;
- récolte ;
- produits / stock ;
- configuration process ;
- rapports ;
- settings imprimante ;
- login minimal.

## 17. Mise à jour 2026-07-30 — impact des réponses cultivateur

### 17.1 Après un scan

La liste d’actions est **la même à tous les stades** ; l’interface **masque simplement ce qui n’a pas de sens** au stade courant (pas de « récolter » sur une gélose). Il n’y a donc pas de configuration d’actions par étape à exposer dans l’UI.

Actions retenues : voir fiche, voir la lignée, avancer d’étape, observation, mesure/pesée, déplacer, cloner, transférer, diviser, mettre en conservation, appliquer un sous-process, récolter, déclarer contamination, terminer/compost, archiver, réimprimer le QR. *(« Mettre en pause » n’a pas été retenu.)*

⏳ Reste à trancher : les 3 ou 4 actions à mettre en gros boutons juste après le scan — le reste ira dans un menu secondaire.

### 17.2 Avancement d’étape

L’écran ne doit **jamais présenter une unité comme « prête » sur la seule base d’une durée écoulée**. Le passage se décide à l’œil : l’UI affiche la durée cible et l’état d’alarme comme information, mais l’action reste manuelle.

Une alarme doit pouvoir être **acquittée ou reportée** depuis la fiche, sans bloquer l’unité, en gardant la trace de qui et quand.

### 17.3 Actions en masse

**Écran de confirmation obligatoire** : nombre d’unités touchées, aperçu de la liste, puis validation. Toute action doit ensuite pouvoir être **annulée ou corrigée**.

### 17.4 Emplacements

Le sélecteur descend jusqu’à la **position** : chambre → étagère → niveau → position. Scanner le QR d’une **chambre** ouvre son **inventaire** — toutes les unités présentes.

### 17.5 Observations

Photo possible partout, **imposée par l’interface en cas de contamination**. Sélecteur de **gravité à trois niveaux** (faible / moyen / critique). Une observation dédiée « maturité récolte » est attendue en fructification.

### 17.6 Récolte

Saisie **par unité** à chaque flush : poids, qualité, et pertes **avec leur cause**. En cas de mélange de plusieurs unités dans un produit final, l’UI doit permettre de saisir les **proportions**.
