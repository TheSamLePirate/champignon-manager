# 03 — Flux métier et traçabilité

## 1. Principe général

Le système doit suivre un flux réel de matière.

Une origine (empreinte de spores, culture mère) devient une gélose, qui est clonée et/ou transférée en culture liquide, puis en grain, puis en substrat ; le substrat devient un lot qui est déplacé, divisé, mesuré, récolté, puis transformé en produits finaux. À chaque stade, une unité peut être clonée (cultures secondaires) ou transférée au stade suivant. À tout moment, l’utilisateur doit pouvoir remonter ou descendre la chaîne.

## 2. Flux nominal proposé

### 2.0 Chaîne de propagation amont (laboratoire) — « du spore à l’assiette »

0. **Origine** : empreinte de spores, culture mère reçue/achetée, clone de tissu.
1. **Gélose** : mise en boîte de Pétri ; peut être clonée en géloses secondaires ; une gélose peut être conservée comme culture mère.
2. **Culture liquide (LC)** : une gélose est transférée en LC ; la LC peut être clonée en LC secondaires.
3. **Grain** : la LC (ou une gélose) inocule des ballots de grain ; le grain peut être cloné (grain → grain).
4. **Substrat** : le grain inocule des ballots de substrat. À partir d’ici commence le flux détaillé ci-dessous.

À chaque stade : **clone** = multiplication au même stade (le parent survit) ; **transfert/repiquage** = passage au stade suivant (une unité amont peut en inoculer plusieurs). Chaque unité créée reçoit son QR et garde le lien vers son parent et le type de relation.

### 2.1 Flux substrat → produit (suite)

1. **Réception ou création de l’unité substrat (ou source reçue)**
   - L’unité substrat est créée par transfert depuis le grain, ou reçue déjà inoculée.
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

## 5. Généalogie des lots et des cultures

### 5.0 Lignée multi-stade : clone et transfert

La généalogie ne se limite pas à la division d’un substrat. Elle relie tous les stades :

- **Clone (même stade)** : 1 gélose → N géloses secondaires ; 1 LC → N LC ; 1 grain → N grains. Le parent (culture mère) reste actif.
- **Transfert (stade suivant)** : gélose → LC → grain → substrat. Une unité amont peut inoculer plusieurs unités aval (ratio de multiplication à tracer).

Exemple de lignée :

- Gélose G-001 (origine : spores X)
  - clone → Gélose G-001-c1 (culture mère conservée)
  - transfert → LC L-014
    - transfert → Grain GR-052, GR-053, GR-054
      - GR-052 transfert → Substrat S-300 … S-309 (10 ballots)

Chaque flèche est un événement horodaté (`culture_cloned` ou `culture_transferred`) avec quantités et étiquettes enfants.

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
| Clone (gélose/LC/grain) | `culture_cloned` |
| Transfert / repiquage stade suivant | `culture_transferred` |
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
- Une unité doit connaître son stade (gélose, LC, grain, substrat, fructification).
- Un clone garde le même stade que son parent ; un transfert passe au stade suivant.
- Une culture mère conservée peut rester active après clonage/transfert.
- Les quantités d’un transfert (nombre d’unités aval créées) doivent être enregistrées.

## 8. Cas particuliers à prévoir

- QR illisible ou perdu : réimpression et remplacement.
- Lot contaminé : mise en quarantaine, rebut ou suivi séparé.
- Erreur de saisie : correction historisée.
- Lot mélangé accidentellement : événement d’incident.
- Produit final issu de plusieurs lots : traçabilité multi-origine.
- Déplacement sans scan : saisie manuelle possible avec audit.
- Lot sans poids initial : autoriser mais signaler l’information manquante.
- Contamination en amont (gélose/LC) : isoler, jeter, repartir d’une culture mère saine.
- Sénescence d’une souche après trop de générations de clone : tracer la génération pour décider de repartir des spores.
