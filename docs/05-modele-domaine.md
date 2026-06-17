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

### 2.2 Utilisateur

Personne utilisant l’application.

Attributs :

- nom ;
- email ou identifiant ;
- rôle ;
- actif/inactif ;
- préférences.

### 2.3 Source

Point de départ d’un flux de culture.

Attributs :

- identifiant interne ;
- type de source ;
- espèce ;
- souche/variété ;
- fournisseur ;
- date de réception ou création ;
- poids initial ;
- état sanitaire initial ;
- notes ;
- QR associé.

### 2.4 Lot

Unité centrale de suivi.

Attributs :

- code lisible ;
- source d’origine ;
- parent éventuel ;
- enfants éventuels ;
- process/version ;
- étape courante ;
- statut ;
- poids actuel estimé ;
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
- Les données configurables doivent être séparées des données opérationnelles.
- Les identifiants techniques ne doivent pas être les seuls identifiants visibles : prévoir des codes lisibles.
- Les entités scannables doivent être résolues par un registre QR central.
