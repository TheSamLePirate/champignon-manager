# 03 — Flux métier et traçabilité

## 1. Principe général

Le système doit suivre un flux réel de matière.

Une source devient un lot, le lot peut être déplacé, divisé, mesuré, récolté, puis transformé en produits finaux. À tout moment, l’utilisateur doit pouvoir remonter ou descendre la chaîne.

## 2. Flux nominal proposé

1. **Réception ou création de source**
   - L’utilisateur crée une source : ballot inoculé, bloc, substrat colonisé.
   - Il saisit les informations initiales.
   - L’application génère un identifiant unique.

2. **Impression QR**
   - L’utilisateur imprime une étiquette.
   - L’étiquette est posée physiquement sur la source ou son contenant.

3. **Activation du lot**
   - La source devient un lot actif.
   - Le lot reçoit un process de culture.
   - Une première étape est assignée.

4. **Suivi par étapes**
   - À chaque étape, l’utilisateur peut saisir les informations attendues.
   - L’application garde l’historique complet.

5. **Mouvements**
   - Le lot entre dans une chambre ou change d’emplacement.
   - Chaque mouvement est horodaté.

6. **Division éventuelle**
   - Le lot peut être divisé en plusieurs sous-lots.
   - Chaque sous-lot reçoit son QR code.
   - Les sous-lots peuvent suivre des chemins différents.

7. **Fructification et observations**
   - L’utilisateur ajoute mesures, notes, photos.
   - Les anomalies sont marquées.

8. **Récolte**
   - Un flush est enregistré.
   - Poids et qualité sont saisis.
   - Les pertes sont séparées si besoin.

9. **Conditionnement / transformation**
   - La récolte devient un ou plusieurs produits finaux.
   - Chaque produit final garde le lien avec son lot d’origine.

10. **Stock et sortie**
   - Les produits finaux entrent en stock.
   - Les sorties peuvent être vente, consommation, perte, don, transformation.

## 3. Traçabilité descendante

Depuis une source, l’utilisateur doit voir :

- lots créés ;
- sous-lots issus de divisions ;
- chambres traversées ;
- mesures prises ;
- récoltes produites ;
- produits finaux créés ;
- rendements ;
- pertes et rebut.

## 4. Traçabilité ascendante

Depuis un produit final, l’utilisateur doit retrouver :

- récolte d’origine ;
- lot ou sous-lot d’origine ;
- source initiale ;
- historique de culture ;
- chambres traversées ;
- observations sanitaires ;
- utilisateur ayant conditionné.

## 5. Généalogie des lots

### 5.1 Division simple

Un lot parent donne plusieurs enfants.

Exemple :

- Lot A : 20 kg ;
- division en :
  - Lot A-1 : 8 kg, chambre 1 ;
  - Lot A-2 : 8 kg, chambre 2 ;
  - Lot A-3 : 4 kg, test expérimental.

Chaque enfant garde le parent `Lot A`.

### 5.2 Récoltes multiples

Un même lot peut produire plusieurs récoltes :

- Flush 1 : 3,2 kg ;
- Flush 2 : 1,7 kg ;
- Flush 3 : 0,8 kg.

Chaque récolte est rattachée au lot et à l’étape/flush.

### 5.3 Produit final issu de plusieurs récoltes

À éviter si possible au début, mais à prévoir :

- Produit final peut provenir d’une seule récolte ;
- ou d’un mélange de plusieurs récoltes compatibles.

Dans le cas d’un mélange, le produit final doit stocker plusieurs origines avec leurs quantités.

## 6. Événements clés

| Moment | Événement attendu |
| --- | --- |
| Création source | `source_created` |
| Impression QR | `label_printed` |
| Démarrage lot | `lot_activated` |
| Entrée étape | `step_entered` |
| Validation étape | `step_completed` |
| Déplacement | `location_changed` |
| Division | `lot_split` |
| Mesure | `measurement_recorded` |
| Observation | `observation_added` |
| Problème | `issue_reported` |
| Récolte | `harvest_recorded` |
| Produit final | `product_batch_created` |
| Stock | `inventory_movement_created` |
| Fin de lot | `lot_closed` |

## 7. Règles de cohérence

- Un lot actif doit avoir une étape courante.
- Un lot actif doit avoir une localisation connue ou explicitement inconnue.
- Un sous-lot doit avoir au moins un parent.
- Un événement ne doit jamais être supprimé physiquement dans le flux normal.
- Une correction doit être un nouvel événement.
- Les poids répartis lors d’une division doivent être contrôlés.
- Une récolte ne peut pas être créée depuis un lot terminé ou rebuté, sauf correction admin.

## 8. Cas particuliers à prévoir

- QR illisible ou perdu : réimpression et remplacement.
- Lot contaminé : mise en quarantaine, rebut ou suivi séparé.
- Erreur de saisie : correction historisée.
- Lot mélangé accidentellement : événement d’incident.
- Produit final issu de plusieurs lots : traçabilité multi-origine.
- Déplacement sans scan : saisie manuelle possible avec audit.
- Lot sans poids initial : autoriser mais signaler l’information manquante.
