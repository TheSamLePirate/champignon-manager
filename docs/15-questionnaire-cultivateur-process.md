# 15 — Questionnaire cultivateur : process pleurotes, traçabilité et suivi

## 1. Objectif du document

Ce document est destiné au cultivateur.

But : comprendre précisément comment se passe la culture sur le terrain pour que l’application corresponde au vrai métier, pas à une idée théorique.

L’application devra permettre de suivre chaque unité avec un QR code, depuis l’inoculation ou la réception jusqu’aux récoltes, avec les poids, les chambres, les conditions et les statistiques.

## 2. Ce que nous avons compris pour l’instant

À confirmer ou corriger :

- Il y a plusieurs espèces ou variétés de pleurotes.
- Chaque unité de culture doit avoir une traçabilité complète par QR code.
- Les étapes évoquées sont :
  - inoculation ;
  - incubation 1 ;
  - incubation 2 ;
  - incubation 3 ;
  - fructification 1 ;
  - fructification 2 ;
  - récolte flush 1 ;
  - récolte flush 2 ;
  - récolte flush 3.
- Pour chaque récolte, le poids est mesuré par unité.
- L’utilisateur doit pouvoir faire avancer une unité dans le process depuis un iPhone connecté au Wi‑Fi local.
- Les unités peuvent être liées à des espaces différents : chambres, zones, températures, humidité.
- Il faudra pouvoir filtrer ou sélectionner des groupes d’unités :
  - par parent ;
  - par date d’inoculation ;
  - par phase d’incubation ;
  - par chambre ;
  - par espèce/variété.
- L’objectif final est aussi de produire des statistiques détaillées.

## 3. Comment répondre

Répondre simplement, même avec des phrases courtes.

Quand une question ne s’applique pas, noter : `pas utile`, `jamais`, ou `à voir plus tard`.

Quand il y a plusieurs cas, donner des exemples concrets.

Exemple :

> Pour le pleurote gris, incubation 1 dure environ 7 jours à 22 °C. Pour le pleurote rose, c’est plus court et plus chaud.

## 4. Vocabulaire à valider

Avant de coder, il faut choisir les bons mots dans l’application.

### 4.1 Unité de suivi

Dans l’app, une “unité” est l’objet physique que l’on suit avec un QR code.

Questions :

1. Comment appelles-tu naturellement une unité ?
   - ballot ?
   - bloc ?
   - sac ?
   - pain ?
   - substrat ?
   - autre ?

Réponse :

```text

```

2. Une unité correspond à quoi physiquement ?
   - un sac de substrat ?
   - un ballot inoculé ?
   - un bac ?
   - une caisse ?
   - autre ?

Réponse :

```text

```

3. Est-ce que l’unité peut être divisée physiquement en plusieurs enfants ?

Exemple : un parent donne plusieurs sous-unités, chacune avec son QR code.

Réponse :

```text

```

4. Si une unité est divisée, est-ce que le parent continue à exister, ou est-ce qu’il devient seulement un historique ?

Réponse :

```text

```

## 5. Espèces, variétés et souches de pleurotes

L’application doit pouvoir comparer les résultats selon le type cultivé.

Questions :

1. Quelles espèces ou variétés de pleurotes cultives-tu actuellement ?

Exemples possibles : pleurote gris, pleurote jaune, pleurote rose, pleurote du panicaut, autre.

Réponse :

```text

```

2. Pour chaque espèce/variété, est-ce que le process change ?

Exemples : durée d’incubation différente, température différente, humidité différente, nombre de flushs différent.

Réponse :

```text

```

3. Est-ce que tu veux suivre la souche précise, le fournisseur, ou seulement le type de pleurote ?

Réponse :

```text

```

4. Quelles statistiques veux-tu comparer par espèce/variété ?

Exemples : rendement total, rendement par flush, durée d’incubation, taux de contamination, poids moyen par unité.

Réponse :

```text

```

## 6. Départ du process : inoculation ou réception

L’inoculation est le moment où le substrat reçoit le mycélium/spawn.

Mais parfois, on peut recevoir un ballot déjà inoculé. Il faut savoir où commence la traçabilité.

Questions :

1. Le process commence-t-il toujours à l’inoculation ?

Réponse :

```text

```

2. Est-ce que certaines unités arrivent déjà inoculées ?

Réponse :

```text

```

3. Quelles informations faut-il enregistrer à l’inoculation ?

Exemples : date, heure, espèce, souche, poids substrat, poids spawn, taux d’inoculation, opérateur, lot de matière première, fournisseur.

Réponse :

```text

```

4. Est-ce que le QR code doit être imprimé au moment de l’inoculation ou plus tard ?

Réponse :

```text

```

5. Est-ce qu’une inoculation crée plusieurs unités en même temps ?

Exemple : une session d’inoculation produit 30 sacs.

Réponse :

```text

```

6. Si oui, veux-tu pouvoir sélectionner toutes les unités d’une même session d’inoculation ?

Réponse :

```text

```

## 7. Parent, enfants et lots groupés

L’application peut gérer une hiérarchie :

- parent : lot ou session d’origine ;
- enfants : unités individuelles suivies par QR ;
- récoltes : résultats produits par chaque unité.

Questions :

1. Dans ton fonctionnement, qu’est-ce qui devrait être le parent ?
   - une session d’inoculation ?
   - un lot de substrat ?
   - une espèce/souche ?
   - un fournisseur ?
   - autre ?

Réponse :

```text

```

2. Les enfants sont-ils les unités physiques avec QR code ?

Réponse :

```text

```

3. Dois-tu parfois faire avancer tous les enfants d’un même parent en même temps ?

Exemple : passer tous les sacs inoculés le même jour en incubation 2.

Réponse :

```text

```

4. Dois-tu parfois faire avancer seulement une partie des enfants ?

Exemple : seulement ceux d’une chambre, ou seulement ceux qui sont prêts.

Réponse :

```text

```

5. Quels filtres sont indispensables pour sélectionner des unités en masse ?

Coche ou complète :

- [ ] parent ;
- [ ] date d’inoculation ;
- [ ] espèce/variété ;
- [ ] souche ;
- [ ] chambre ;
- [ ] phase ;
- [ ] incubation 1/2/3 ;
- [ ] statut sanitaire ;
- [ ] autre.

Réponse :

```text

```

## 8. Process global à décrire

Merci de décrire le process réel, même approximatif.

### 8.1 Liste des phases

Est-ce que cette liste est correcte ?

1. Inoculation ;
2. Incubation 1 ;
3. Incubation 2 ;
4. Incubation 3 ;
5. Fructification 1 ;
6. Fructification 2 ;
7. Récolte flush 1 ;
8. Récolte flush 2 ;
9. Récolte flush 3 ;
10. Fin de cycle.

Réponse / correction :

```text

```

### 8.2 Différence entre phase et étape

Dans l’application :

- une **phase** est une grande période, par exemple incubation ;
- une **étape** est un moment plus précis, par exemple incubation 1, incubation 2, incubation 3.

Question : cette distinction est-elle utile pour toi ?

Réponse :

```text

```

### 8.3 Passage d’une étape à l’autre

Pour chaque étape, il faut comprendre si le passage est basé sur :

- une durée ;
- une observation visuelle ;
- une mesure ;
- une décision humaine ;
- une règle fixe.

Réponse générale :

```text

```

## 9. Détail par étape

Remplir autant que possible. Si tu ne sais pas précisément, mettre une fourchette.

### 9.1 Inoculation

Explication : création ou préparation de l’unité de culture avec le mycélium/spawn.

Questions :

1. Que fait-on exactement à cette étape ?
2. Combien d’unités sont créées en général ?
3. Quelles informations faut-il saisir ?
4. Quelle étiquette QR doit être imprimée ?
5. Quel poids faut-il enregistrer ?
6. Y a-t-il un contrôle qualité à ce moment ?
7. Quelle est l’étape suivante ?

Réponse :

```text

```

### 9.2 Incubation 1

Explication : première période où le mycélium colonise le substrat.

Questions :

1. Combien de temps dure généralement incubation 1 ?
2. Température cible ?
3. Humidité cible ?
4. Lumière ou obscurité ?
5. CO2/aération important ou non ?
6. Qu’est-ce qu’on doit observer ?
7. Quand sait-on qu’on peut passer en incubation 2 ?
8. Quelles actions doit proposer l’app à cette étape ?

Réponse :

```text

```

### 9.3 Incubation 2

Explication : deuxième période d’incubation, si elle existe vraiment dans ton process.

Questions :

1. Pourquoi séparer incubation 1 et incubation 2 ?
2. Qu’est-ce qui change ?
3. Durée habituelle ?
4. Conditions cible : température, humidité, lumière, aération ?
5. Observation attendue ?
6. Critère de passage à incubation 3 ?
7. Actions utiles dans l’app ?

Réponse :

```text

```

### 9.4 Incubation 3

Explication : troisième période d’incubation ou fin de colonisation avant fructification.

Questions :

1. À quoi correspond incubation 3 ?
2. Est-elle obligatoire pour tous les pleurotes ?
3. Durée habituelle ?
4. Conditions cible ?
5. Signes visuels à noter ?
6. Risques particuliers : contamination, dessèchement, retard ?
7. Critère de passage en fructification ?

Réponse :

```text

```

### 9.5 Fructification 1

Explication : étape où l’on déclenche ou accompagne l’apparition des champignons.

Questions :

1. Que changes-tu en passant en fructification ?
   - température ?
   - humidité ?
   - lumière ?
   - aération ?
   - ouverture du sac/bloc ?
2. Durée habituelle avant voir les premiers signes ?
3. Quelles observations sont importantes ?
4. Quels problèmes peuvent apparaître ?
5. Quelle chambre ou zone est utilisée ?
6. Actions utiles dans l’app ?

Réponse :

```text

```

### 9.6 Fructification 2

Explication : deuxième phase de fructification, peut-être maturation ou préparation de récolte.

Questions :

1. Pourquoi séparer fructification 1 et 2 ?
2. Qu’est-ce qui change entre les deux ?
3. Durée habituelle ?
4. Conditions cible ?
5. Comment sait-on que la récolte flush 1 est prête ?
6. Faut-il une observation “maturité récolte” ?
7. Actions utiles dans l’app ?

Réponse :

```text

```

### 9.7 Récolte flush 1

Explication : première vague de récolte sur une unité.

Questions :

1. Comment décides-tu de récolter ?
2. Mesures-tu le poids par unité ?
3. Poids brut, poids net, pertes, ou seulement poids récolté ?
4. Notes-tu la qualité ?
5. Notes-tu la cause des pertes ?
6. Que devient l’unité après flush 1 ?
7. Passe-t-elle en repos, fructification 2, ou directement flush 2 ?

Réponse :

```text

```

### 9.8 Récolte flush 2

Questions :

1. Est-ce que toutes les unités font un flush 2 ?
2. Durée entre flush 1 et flush 2 ?
3. Conditions particulières entre les deux ?
4. Poids mesuré par unité aussi ?
5. Qualité différente du flush 1 ?
6. Que devient l’unité après flush 2 ?

Réponse :

```text

```

### 9.9 Récolte flush 3

Questions :

1. Est-ce que le flush 3 est fréquent ou optionnel ?
2. Quand décide-t-on d’arrêter avant flush 3 ?
3. Le rendement vaut-il encore le coût/espace ?
4. Poids mesuré par unité ?
5. Que devient l’unité après flush 3 ?

Réponse :

```text

```

### 9.10 Fin de cycle

Questions :

1. Quels sont les statuts possibles en fin de cycle ?
   - terminé ;
   - compost ;
   - rebut ;
   - contaminé ;
   - autre.
2. Faut-il mesurer un poids final ?
3. Faut-il noter une raison de fin ?
4. Faut-il garder la chambre/emplacement jusqu’au nettoyage ?
5. Faut-il créer une tâche de nettoyage ?

Réponse :

```text

```

## 10. Conditions de culture par chambre

L’application doit connaître les espaces de culture pour relier les unités aux conditions.

Questions :

1. Quels espaces veux-tu suivre ?
   - chambre incubation ;
   - chambre fructification ;
   - zone de préparation ;
   - zone de stockage ;
   - étagères/racks ;
   - autre.

Réponse :

```text

```

2. Faut-il suivre seulement la chambre, ou aussi l’étagère/le niveau/la position ?

Réponse :

```text

```

3. Quelles conditions cibles par chambre ?

À remplir si possible :

| Chambre/zone | Température cible | Humidité cible | Lumière | Aération/CO2 | Usage |
| --- | --- | --- | --- | --- | --- |
| | | | | | |
| | | | | | |

4. Une unité peut-elle changer plusieurs fois de chambre ?

Réponse :

```text

```

5. Veux-tu scanner le QR d’une chambre pour voir toutes les unités présentes ?

Réponse :

```text

```

## 11. Mesures à saisir ou récupérer

Questions :

1. Quelles mesures fais-tu aujourd’hui manuellement ?

Exemples : température, humidité, poids, nombre de sacs, contamination.

Réponse :

```text

```

2. À quelle fréquence ?

Réponse :

```text

```

3. Quelles mesures sont liées à une unité et lesquelles sont liées à une chambre ?

Exemple : poids = unité ; température = chambre.

Réponse :

```text

```

4. Les appareils Inkbird doivent-ils seulement servir d’historique, ou aussi déclencher des alertes ?

Réponse :

```text

```

5. Quelles valeurs veux-tu voir dans les statistiques ?

Réponse :

```text

```

## 12. Observations terrain

Les observations sont des constats rapides depuis l’iPhone.

Exemples : “pousse visible”, “contamination”, “trop sec”, “prêt à récolter”.

Questions :

1. Quelles observations veux-tu pouvoir saisir rapidement ?

Réponse :

```text

```

2. Quelles observations doivent être proposées selon l’étape ?

Exemple : en incubation, contamination/colonisation ; en fructification, maturité/humidité.

Réponse :

```text

```

3. Faut-il pouvoir prendre une photo à chaque observation ?

Réponse :

```text

```

4. Pour quelles observations la photo devrait-elle être obligatoire ?

Réponse :

```text

```

5. Faut-il une notion de gravité ?

Exemple : faible, moyen, critique.

Réponse :

```text

```

## 13. Actions à faire depuis l’iPhone

Après scan QR, l’application doit proposer les bonnes actions.

Questions :

1. Quelles actions veux-tu absolument après scan d’une unité ?

Coche ou complète :

- [ ] voir fiche ;
- [ ] avancer à l’étape suivante ;
- [ ] ajouter observation ;
- [ ] ajouter mesure ;
- [ ] déplacer chambre ;
- [ ] récolter ;
- [ ] déclarer contamination ;
- [ ] mettre en pause ;
- [ ] terminer / compost ;
- [ ] réimprimer QR ;
- [ ] autre.

Réponse :

```text

```

2. Quelles actions veux-tu faire en masse sur plusieurs unités ?

Exemples : déplacer 40 unités en chambre fructification, passer toutes les unités du parent X en incubation 2.

Réponse :

```text

```

3. Faut-il une validation avant action en masse ?

Réponse :

```text

```

4. Faut-il pouvoir annuler ou corriger une action ?

Réponse :

```text

```

## 14. Récoltes et poids par unité

Questions :

1. Le poids est-il mesuré pour chaque unité à chaque flush ?

Réponse :

```text

```

2. Quelle unité de poids utilises-tu ? grammes ou kilogrammes ?

Réponse :

```text

```

3. Faut-il enregistrer :
   - poids total récolté ;
   - poids vendable ;
   - pertes ;
   - qualité ;
   - calibre ;
   - destination ?

Réponse :

```text

```

4. La récolte d’une unité peut-elle être mélangée avec celle d’une autre unité ?

Réponse :

```text

```

5. Si oui, faut-il garder les proportions exactes ?

Réponse :

```text

```

6. Quels indicateurs de rendement veux-tu ?

Exemples : poids total par unité, rendement par flush, rendement par kg de substrat, rendement par chambre, rendement par espèce.

Réponse :

```text

```

## 15. Statistiques souhaitées

L’application peut calculer des statistiques, mais il faut savoir lesquelles sont vraiment utiles.

Questions :

1. Quelles stats veux-tu voir en premier ?

Coche ou complète :

- [ ] rendement total par unité ;
- [ ] rendement par flush ;
- [ ] rendement par espèce/variété ;
- [ ] rendement par date d’inoculation ;
- [ ] rendement par parent/session ;
- [ ] rendement par chambre ;
- [ ] durée moyenne incubation ;
- [ ] durée moyenne fructification ;
- [ ] taux de contamination ;
- [ ] pertes ;
- [ ] comparaison entre conditions température/humidité ;
- [ ] autre.

Réponse :

```text

```

2. Veux-tu comparer les enfants d’un même parent entre eux ?

Réponse :

```text

```

3. Veux-tu comparer les performances entre chambres ?

Réponse :

```text

```

4. Veux-tu exporter les données en CSV/Excel ?

Réponse :

```text

```

## 16. Alertes et tâches

Questions :

1. Quelles situations doivent créer une alerte ?

Exemples : incubation trop longue, humidité trop basse, contamination, récolte prête, chambre hors température.

Réponse :

```text

```

2. Faut-il des tâches automatiques ?

Exemples : “vérifier incubation”, “récolter aujourd’hui”, “nettoyer chambre”.

Réponse :

```text

```

3. Les alertes doivent-elles être visibles seulement dans l’app ou aussi envoyées ailleurs ?

Réponse :

```text

```

## 17. QR code et étiquettes

Questions :

1. Quelles unités doivent avoir un QR ?

Réponse :

```text

```

2. Que doit afficher l’étiquette en texte lisible ?

Exemples : code unité, espèce, date inoculation, parent, chambre, phase.

Réponse :

```text

```

3. Faut-il un QR pour les chambres ?

Réponse :

```text

```

4. Faut-il un QR pour les récoltes ou produits finaux ?

Réponse :

```text

```

5. Que faire si un QR est abîmé ou perdu ?

Réponse :

```text

```

## 18. Cas particuliers et problèmes

Questions :

1. Que fais-tu en cas de contamination ?

Réponse :

```text

```

2. Est-ce qu’une unité contaminée peut encore produire ?

Réponse :

```text

```

3. Que fais-tu si une unité est en retard ?

Réponse :

```text

```

4. Que fais-tu si une unité est déplacée sans scan ?

Réponse :

```text

```

5. Y a-t-il des cas où il faut regrouper/fusionner des unités ?

Réponse :

```text

```

## 19. Résumé à produire après réponse

Après remplissage, on devra pouvoir extraire :

1. le vocabulaire officiel ;
2. la liste des espèces/variétés ;
3. le process exact avec phases et étapes ;
4. les conditions cibles par étape et par chambre ;
5. les actions disponibles par étape ;
6. les observations disponibles par étape ;
7. les données à saisir à l’inoculation ;
8. les données à saisir à chaque récolte ;
9. les règles de sélection en masse ;
10. les statistiques prioritaires.

## 20. Version simplifiée du process à confirmer

Table de synthèse à remplir :

| Ordre | Phase/étape | Durée typique | Température | Humidité | Observation clé | Action suivante |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Inoculation | | | | | |
| 2 | Incubation 1 | | | | | |
| 3 | Incubation 2 | | | | | |
| 4 | Incubation 3 | | | | | |
| 5 | Fructification 1 | | | | | |
| 6 | Fructification 2 | | | | | |
| 7 | Récolte flush 1 | | | | poids par unité | |
| 8 | Récolte flush 2 | | | | poids par unité | |
| 9 | Récolte flush 3 | | | | poids par unité | |
| 10 | Fin de cycle | | | | | |
