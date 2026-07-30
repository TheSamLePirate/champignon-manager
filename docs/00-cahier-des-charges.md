# 00 — Cahier des charges fonctionnel

## 1. Vision

Champignon Manager est une application locale de gestion de flux pour la culture de champignons. Elle gère **plusieurs espèces configurables** (pleurote, shiitake, etc.) ; le pleurote est la première espèce de référence, pas la seule. Chaque espèce — voire variété/souche — peut avoir son propre process.

Elle doit permettre de suivre chaque unité de production sur toute la chaîne de propagation — « du spore à l’assiette » : gélose → culture liquide (LC) → grain → substrat → fructification → récoltes → produits finaux. Chaque stade peut être cloné (cultures secondaires de même type) et transféré au stade suivant. La traçabilité commence en amont (gélose, voire empreinte de spores), pas seulement au ballot de substrat.

Le suivi repose sur :

- une identification physique par QR code ;
- une interface web utilisable sur iPhone sur le réseau local ;
- un backend typé ;
- une base MongoDB adaptée aux lots, sous-lots, événements et process configurables ;
- des écrans de saisie rapides pour les opérateurs sur site ;
- une intégration future caméra Reolink pour observation de pousse ;
- une intégration future Inkbird ITC-308-WIFI et IHC-200-WIFI pour température/humidité.

## 2. Périmètre de la première version cible

La priorité choisie est un **socle complet**, livré par étapes progressives.

Décision développeur du 2026-06-17 : la première version doit être un outil réellement utilisable en production, avec UI mobile propre, impression stable, sauvegardes robustes et gestion d’erreurs complète.

La première version réellement utilisable doit couvrir :

1. création et suivi des sources/lots ;
2. génération et impression de QR codes ;
3. scan QR depuis iPhone ;
4. historique complet des événements du lot ;
5. process configurable avec phases, étapes, actions, observations, formulaires et statuts ;
6. gestion des divisions de lots et mouvements entre chambres ;
7. mesures et observations manuelles ;
8. récoltes complètes avec poids par unité/flush selon process validé ;
9. conversion en produits finaux ;
10. stock simple de produits finaux ;
11. architecture prête pour caméra et automatisations, sans les intégrer au MVP.

## 3. Hors périmètre immédiat

Ces sujets sont prévus mais ne doivent pas bloquer le socle :

- e-commerce ou facturation complète ;
- ventes détaillées ;
- comptabilité ;
- automatisation matérielle de chambres ;
- contrôle actif des appareils ;
- intégration Reolink ;
- intégration Inkbird ;
- offline avancé/PWA complète ;
- prédiction de rendement par IA ;
- intégration caméra avancée avec analyse d’image automatique ;
- application mobile native ;
- synchronisation cloud multi-sites.

## 4. Problèmes à résoudre

### 4.1 Traçabilité

L’utilisateur doit savoir à tout moment :

- d’où vient une unité et toute sa lignée amont (substrat ← grain ← LC ← gélose ← origine) ;
- où elle se trouve ;
- dans quelle étape de culture il est ;
- quelles mesures et observations ont été prises ;
- s’il a été divisé ;
- quelles récoltes il a produites ;
- quels produits finaux en sont issus ;
- par quels clones et transferts il est passé (généalogie multi-stade).

### 4.2 Saisie rapide sur site

L’utilisateur peut être en chambre, avec un téléphone, dans un environnement humide ou peu pratique.

L’interface doit donc :

- s’ouvrir rapidement après scan QR ;
- proposer les actions les plus probables selon l’état du lot ;
- limiter le nombre de champs obligatoires ;
- fonctionner en réseau local ;
- être lisible sur iPhone ;
- permettre une saisie différée ou corrective si nécessaire.

### 4.3 Process configurable

Les étapes de culture ne doivent pas être codées en dur.

Le process couvre désormais plusieurs **stades** (gélose, culture liquide, grain, substrat, fructification), chacun avec ses propres étapes. Exemples d’étapes possibles :

- mise en gélose / clonage gélose ;
- passage en culture liquide (LC) ;
- inoculation du grain ;
- inoculation du substrat ;
- réception source ;
- incubation ;
- choc / déclenchement fructification ;
- chambre de fructification ;
- flush 1 ;
- récolte 1 ;
- repos ;
- flush 2 ;
- récolte 2 ;
- fin de production ;
- déclassement ;
- compost / rebut.

L’application doit permettre de configurer :

- les phases ;
- les étapes ;
- les transitions autorisées ;
- les actions disponibles par phase/étape ;
- les observations proposées ou obligatoires ;
- les données à saisir par étape ;
- les alertes ;
- les statuts terminaux ;
- les produits finaux générables.

## 5. Exigences fonctionnelles

### 5.1 Gestion des sources et lots

- Créer une source de production.
- Associer un identifiant unique.
- Imprimer une étiquette QR.
- Définir l’espèce, la souche ou variété si connue.
- Saisir fournisseur, date de réception, poids initial, notes.
- Transformer la source en lot actif.
- Créer une unité à n’importe quel stade : gélose, culture liquide (LC), grain, substrat.
- Cloner une unité (cultures secondaires de même stade), avec lien de lignée.
- Transférer/repiquer une unité vers le stade suivant (gélose→LC→grain→substrat), une unité pouvant en inoculer plusieurs.
- Suivre les sous-lots issus d’une division.

### 5.2 QR code

- Générer un QR code unique pour chaque élément traçable.
- Imprimer l’étiquette depuis l’application backend locale.
- Scanner depuis iPhone via l’interface web.
- Rediriger vers la fiche du lot, sous-lot, chambre ou produit.
- Permettre la réimpression contrôlée.

### 5.3 Lots et sous-lots

- Un lot peut rester entier ou être divisé.
- Une division crée des enfants avec un lien parent.
- Chaque enfant peut suivre un chemin différent.
- Les événements doivent rester attachés au bon niveau.
- La fiche d’un lot doit afficher sa généalogie.

### 5.4 Chambres et emplacements

- Définir des chambres ou zones de culture.
- Déplacer un lot ou sous-lot vers une chambre.
- Historiser les mouvements.
- Visualiser les lots présents dans une chambre.
- Prévoir plusieurs niveaux : site, zone, chambre, étagère, emplacement.

### 5.5 Mesures et observations

- Ajouter une mesure manuelle : température, humidité, poids, CO2, luminosité, autre.
- Ajouter une observation textuelle.
- Ajouter une photo si supportée par le navigateur.
- Marquer un problème : contamination, dessèchement, retard, odeur, casse.
- Lier chaque mesure ou observation à un lot, une chambre, une étape ou un événement.

### 5.6 Récoltes

- Enregistrer une récolte avec poids, qualité, date, opérateur.
- Associer une récolte à un flush ou une étape.
- Créer un ou plusieurs produits finaux à partir de la récolte.
- Gérer pertes, tri, déclassement et transformation.

### 5.7 Produits finaux

- Configurer des types de produits (par espèce) : frais, barquette, vrac, séché, transformé, rebut, compost.
- Créer un lot de produit final.
- Suivre le stock disponible.
- Garder le lien avec les lots de culture d’origine.

### 5.8 Dashboard

- Afficher les lots actifs par étape.
- Afficher les lots par chambre.
- Afficher les actions à faire aujourd’hui.
- Afficher les alertes : étape trop longue, mesure manquante, récolte attendue, contamination.
- Afficher rendements par source, chambre, période, espèce.

## 6. Exigences de configuration

L’application doit permettre de configurer sans recoder :

- espèces cultivées ;
- variétés/souches ;
- types de sources ;
- phases et étapes de process ;
- actions disponibles par phase/étape ;
- observations configurables ;
- champs de saisie par étape ;
- chambres et emplacements ;
- types d’événements ;
- produits finaux ;
- unités de mesure ;
- modèles d’étiquette QR ;
- seuils d’alerte.

## 7. Exigences de traçabilité

Chaque action importante doit enregistrer :

- date et heure ;
- utilisateur ;
- entité concernée ;
- type d’action ;
- données saisies ;
- contexte éventuel : chambre, étape, parent, enfant, produit ;
- origine de l’action : saisie manuelle, scan QR, import, caméra, automatisation.

## 8. Contraintes techniques connues

- Backend local compatible Node.js/Bun pour piloter l’imprimante QR.
- Frontend web accessible depuis iPhone.
- MongoDB comme base principale.
- TypeScript partout.
- Architecture prête pour intégration future Reolink.

## 9. Critères de réussite

L’application est considérée utile si l’utilisateur peut :

1. créer un ballot inoculé ;
2. imprimer son QR code ;
3. scanner ce QR code en chambre ;
4. voir son état courant ;
5. ajouter une observation ou mesure ;
6. déplacer ou diviser le lot ;
7. enregistrer une récolte ;
8. créer un produit final ;
9. retrouver tout l’historique depuis le produit final jusqu’à la gélose/origine (traçabilité complète « du spore à l’assiette »).

## Mise à jour 2026-07-30 — périmètre après réponses du cultivateur

Détail : `14-questions-ouvertes.md` §18. Le questionnaire est renseigné à **139 / 188**.

### Ce que le produit doit faire (confirmé)

- Tracer **toute unité physique**, à tout stade, chacune avec son **QR dès sa création**.
- Accepter une entrée dans la chaîne **à n’importe quel stade**, y compris une unité reçue déjà prête, donc **sans ascendant**.
- Permettre **clone, transfert, division et conservation** à tous les stades, sans limite de génération.
- Conserver une **lignée détaillée de bout en bout**, avec le type de lien.
- Rendre **conservation et archivage réversibles** ; la sortie de conservation crée une **nouvelle unité**.
- Composer des **process et sous-process réutilisables**, applicables à une unité, un lot ou une sélection.
- Porter une **durée cible et des alarmes réglables** par étape — qui alertent, **jamais ne bloquent** ni ne font avancer.
- Laisser l’**opérateur décider** de chaque passage d’étape, à l’observation visuelle.
- Suivre l’emplacement **jusqu’à la position** (chambre, étagère, niveau).
- Enregistrer **poids par unité, qualité et pertes avec cause** à chaque flush ; autoriser les mélanges **avec proportions exactes**.
- Sélectionner des unités selon **n’importe quel critère combiné**, avec filtres enregistrables.
- Calculer **toutes les statistiques** issues de cette traçabilité, exportables en CSV/Excel.

### Ce que le produit ne doit PAS faire

- **Aucun avancement automatique** d’étape sur échéance.
- **Aucune liste d’actions ou d’observations propre à chaque étape** : liste globale filtrée par pertinence.
- **Aucun blocage** d’unité par une alarme.
- **Aucune suppression** : une action annulée produit un événement de compensation.

### Paramétrage (arbitrage 31/07/2026)

Les durées, températures, humidité, ratios, seuils d’alarme et espèces **ne sont pas livrés avec l’application** : ce sont des données que le cultivateur saisit lui-même. Le tableau §20 du questionnaire n’est donc pas un prérequis au développement.

En contrepartie, l’application doit être **utilisable avec zéro donnée initiale** et permettre de **créer un process complet depuis l’interface** dès le premier démarrage. Un **modèle pré-rempli et modifiable** est à prévoir pour éviter l’écran vide — voir `13-roadmap-implementation.md`.
