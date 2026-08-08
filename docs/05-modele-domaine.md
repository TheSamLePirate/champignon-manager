# 05 — Modèle de domaine

## 1. Vue d’ensemble

Le domaine est organisé autour de quatre axes :

1. **Traçabilité matière** : source, lot, sous-lot, récolte, produit final.
2. **Process** : phases, étapes, transitions, actions, observations, formulaires, alertes.
3. **Localisation** : site, chambre, emplacement, mouvement.
4. **Historique** : événements, mesures, observations, corrections.

## 2. Entités principales

### 2.1 Site

Représente le lieu de production.

Attributs importants :

- nom ;
- adresse optionnelle ;
- paramètres locaux ;
- fuseau horaire ;
- unités par défaut.

### 2.2 Utilisateur — ❌ hors MVP

**Décision du 2026-08-08 (`21` §6) : il n’y a pas d’entité Utilisateur.** Pas d’authentification, pas de rôles, pas d’auteur sur les événements. Les attributs envisagés (nom, identifiant, rôle, préférences) sont conservés ici pour mémoire, en vue d’une éventuelle réintroduction (`02` §6.2).

Conséquences directes sur le modèle : pas de `createdBy` / `updatedBy`, pas de `userId` sur les événements, et les **filtres favoris sont globaux** à l’installation au lieu d’être rattachés à une personne.

### 2.3 Source

Point de départ d’un flux de culture.

Attributs :

- identifiant interne ;
- type de source / origine : empreinte de spores, culture mère, gélose, LC, grain, substrat reçu, clone de tissu ;
- stade d’entrée dans la traçabilité ;
- espèce ;
- souche/variété ;
- fournisseur ;
- date de réception ou création ;
- poids initial ;
- état sanitaire initial ;
- notes ;
- QR associé.

### 2.4 Unité de culture (généralise « lot »)

Objet physique traçable à n’importe quel stade. Au stade substrat/fructification, on l’appelle « lot ».

Attributs :

- code lisible ;
- **stade** : gélose, culture liquide (LC), grain, substrat, fructification ;
- source/origine d’origine ;
- parent éventuel + **type de relation de lignée** : clone, transfert, division ;
- **génération** (rang de clone : G1, G2, …) ;
- indicateur « culture mère conservée » ;
- enfants éventuels ;
- process/version (process propre au stade) ;
- étape courante ;
- statut ;
- quantité actuelle estimée (selon stade : nb de boîtes, volume LC, masse grain/substrat) ;
- localisation courante ;
- tags ;
- QR associé ;
- dates clés.

### 2.5 Chambre

Espace physique de culture ou de stockage.

Attributs :

- nom ;
- type ;
- capacité ;
- conditions cibles ;
- active/inactive ;
- caméra associée optionnelle.

### 2.6 Emplacement

Sous-zone d’une chambre.

Attributs :

- chambre ;
- rack ;
- niveau ;
- position ;
- capacité ;
- notes.

### 2.7 Événement

Fait historisé.

Attributs :

- type ;
- date/heure ;
- utilisateur ;
- entité cible ;
- données métier ;
- contexte ;
- source de saisie ;
- événement annulé/corrigé optionnel.

### 2.8 Mesure

Valeur relevée.

Attributs :

- type de mesure ;
- valeur ;
- unité ;
- cible : lot, chambre ou emplacement ;
- date/heure ;
- méthode : manuel, capteur, import, caméra ;
- commentaire.

### 2.9 Observation

Constat terrain.

Attributs :

- texte ;
- photos optionnelles ;
- tags : contamination, pousse, humidité, odeur ;
- gravité ;
- cible ;
- date/heure ;
- utilisateur.

### 2.10 Récolte

Production récoltée sur un lot.

Attributs :

- lot d’origine ;
- flush ;
- poids brut ;
- poids net ;
- qualité ;
- pertes ;
- date ;
- opérateur ;
- notes.

### 2.11 Produit final

Produit prêt pour stock, vente ou usage.

Attributs :

- type de produit ;
- origine : une ou plusieurs récoltes ;
- quantité ;
- unité ;
- conditionnement ;
- date de production ;
- DLC/DDM optionnelle ;
- stock courant ;
- QR optionnel.

### 2.12 Mouvement de stock

Changement de quantité d’un produit final.

Attributs :

- produit concerné ;
- type : entrée, sortie, correction, perte, vente ;
- quantité ;
- date ;
- utilisateur ;
- justification.

### 2.13 QR Label

Représente une étiquette imprimée ou imprimable.

Attributs :

- cible ;
- payload ;
- statut ;
- date d’impression ;
- imprimante ;
- modèle utilisé ;
- historique de réimpression.

### 2.14 Process configurable

Un process contient des phases, étapes, actions et observations configurables.

Attributs importants :

- nom ;
- version ;
- phases ;
- étapes ;
- transitions ;
- actions disponibles par phase/étape ;
- observations proposées par phase/étape ;
- mesures attendues ;
- alertes ;
- formulaires dynamiques.

### 2.15 Caméra

Caméra associée à une chambre ou zone.

Attributs :

- nom ;
- marque/modèle ;
- type : Reolink ;
- adresse locale ;
- chambre associée ;
- statut ;
- paramètres de capture.

### 2.16 Appareil connecté

Matériel futur associé à une chambre ou zone, par exemple Inkbird.

Attributs :

- nom ;
- marque/modèle ;
- type : contrôleur température, contrôleur humidité, capteur ;
- chambre associée ;
- capacités ;
- mode de connexion ;
- statut ;
- dernières valeurs connues.

## 3. Relations importantes

| Relation | Sens |
| --- | --- |
| Source → Lot | Une source peut créer un ou plusieurs lots. |
| Lot → Lot | Un lot peut avoir des enfants issus de division. |
| Unité → Unité (clone) | Une unité produit des cultures secondaires de même stade. |
| Unité → Unité (transfert) | Une unité inocule une ou plusieurs unités du stade suivant. |
| Lot → ProcessVersion | Un lot suit une version de process incluant phases, étapes, actions et observations. |
| Lot → Chambre/Emplacement | Un lot a une localisation courante. |
| Lot → Événement | Un lot possède un historique. |
| Lot → Récolte | Un lot peut produire plusieurs récoltes. |
| Récolte → Produit final | Une récolte peut créer plusieurs produits. |
| Produit final → Récolte | Un produit final peut avoir une ou plusieurs origines. |
| Chambre → Caméra | Une chambre peut être surveillée par une caméra. |
| Chambre → Appareil connecté | Une chambre peut avoir des appareils Inkbird ou futurs capteurs/contrôleurs. |

## 4. Agrégats métier recommandés

### 4.1 Agrégat Lot

Inclut :

- lot ;
- état courant ;
- localisation courante ;
- étape courante ;
- liens parent/enfant ;
- derniers indicateurs utiles.

L’historique détaillé reste dans les événements.

### 4.2 Agrégat Process

Inclut :

- modèle de process ;
- version ;
- étapes ;
- transitions ;
- formulaires ;
- règles.

### 4.3 Agrégat Produit final

Inclut :

- définition produit ;
- lot produit ;
- origines ;
- mouvements de stock.

## 5. Principes de conception

- L’historique est prioritaire sur la modification directe.
- Le modèle doit permettre la généalogie des lots.
- Le modèle doit gérer une lignée multi-stade (gélose→LC→grain→substrat) avec relations clone et transfert, en plus de la division.
- Les données configurables doivent être séparées des données opérationnelles.
- Les identifiants techniques ne doivent pas être les seuls identifiants visibles : prévoir des codes lisibles.
- Les entités scannables doivent être résolues par un registre QR central.

## 6. Réponses cultivateur — 2026-07-30 : conséquences sur le modèle

Source : `champignon-reponses-cultivateur-2026-07-30.json`.

### 6.1 Lignée

- **Aucune limite de génération** n’est imposée : le compteur `generation` reste informatif, sans plafond bloquant.
- Le **parent** n’est pas une session d’inoculation mais un **lien de parenté détaillé du début à la fin**. Le modèle doit donc porter la lignée sur l’unité elle-même (parent direct + type de lien), et non sur un objet « session » intermédiaire. Une session d’inoculation reste utile comme *étiquette de regroupement*, pas comme parent.
- Le clonage est possible **à tous les stades**, y compris `souche → souche` et division au stade substrat.
- Le point d’entrée peut être **n’importe quel stade** : une unité peut naître sans parent, à n’importe quel niveau de la chaîne (y compris substrat reçu déjà inoculé). Le modèle ne doit donc pas exiger d’ascendant.

### 6.2 Conservation et archivage

- Toute unité peut passer en **conservation** (« en réserve ») à n’importe quel stade. Modalités : frigo, dormance à température ambiante, contenant — **configurable**.
- **La réactivation d’une unité conservée crée une nouvelle unité**, reliée à la conservée par un lien de lignée. Ce n’est pas un changement d’état de l’unité d’origine.
- Une unité **archivée en historique peut être réactivée**. L’archivage est donc un état réversible, pas une fin de vie.

Conséquence : `conservation` et `archivage` sont deux états distincts de l’unité, tous deux réversibles, et la sortie de conservation est un **événement générateur d’unité** au même titre qu’un clone.

### 6.3 Version de process

Chaque unité doit porter la **version du process** qui lui est appliquée (`processVersionId`), et cette version doit être figée dans les événements — c’est la condition technique de toute comparaison.

✅ **Tranché le 2026-08-08** (`21` §2) : une version publiée est **immuable** et l’unité y reste **épinglée jusqu’à la fin de son cycle**. Modifier un process ne déplace **aucune** unité en cours. Une migration reste possible, mais **explicite, manuelle et par sélection**, et produit un événement traçable. Voir `04` §15.3.

### 6.4 Filtres persistés

Les filtres de sélection doivent être **enregistrables comme favoris** : prévoir une entité de filtre sauvegardé (critères combinés + nom), rattachée à l’utilisateur.

## 7. Précisions du 30/07/2026 (2ᵉ passe)

### 7.1 Emplacement

Le suivi descend **jusqu’à la position** : chambre → étagère → niveau → position. Une unité **change plusieurs fois de chambre** au cours de sa vie : l’emplacement est donc un attribut historisé, pas une propriété stable.

En fin de cycle, l’**emplacement reste occupé jusqu’au nettoyage** — il faut donc un état d’occupation distinct de la présence d’une unité active, et une **tâche de nettoyage** générée automatiquement.

### 7.2 Récolte

Chaque flush enregistre, **par unité** : le poids, la qualité, et les **pertes avec leur cause**. Les récoltes de plusieurs unités peuvent être **mélangées dans un même produit final**, en **conservant les proportions exactes** — le lien produit → unités d’origine est donc pondéré, pas un simple ensemble.

Après un flush, trois chemins existent : **repos, fructification suivante, ou flush suivant directement**. Le modèle ne doit pas imposer de séquence.

### 7.3 Fin de cycle

Statuts : **terminé, compost, rebut, contaminé** — jugés suffisants. Un **poids final** et une **raison de fin** sont enregistrés.

Une unité **contaminée ne peut plus produire** : c’est un état terminal côté production, même si l’unité reste consultable.

### 7.4 Actions

Toute action en masse exige une **validation préalable**, et **toute action doit être annulable ou corrigeable** — ce qui impose, dans un modèle à événements immuables, un événement de compensation plutôt qu’une suppression.
