# 04 — Processus configurable

## 1. Objectif

Le process de culture ne doit pas être figé dans le code. L’application doit pouvoir gérer plusieurs process selon l’espèce, la méthode, le type de source ou l’expérimentation.

## 2. Concepts

| Concept | Description |
| --- | --- |
| Process template | Modèle de process réutilisable. Exemple : “Pleurotes — ballot inoculé”. |
| Version de process | Snapshot du process utilisé par un lot. Important si le modèle change après création du lot. |
| Phase | Grande période métier de culture : incubation, fructification, récolte, repos, fin de cycle. Une phase peut contenir plusieurs étapes. |
| Étape | Moment opérationnel précis dans une phase. |
| Transition | Passage autorisé entre deux étapes. |
| Formulaire d’étape | Données à saisir pour une étape ou une transition. |
| Règle | Condition, seuil, obligation ou alerte. |
| Action configurable | Action proposée à l’utilisateur selon la phase, l’étape, le statut du lot et son rôle. |
| Observation configurable | Type d’observation attendu ou proposé : pousse visible, contamination, humidité de surface, odeur, couleur, maturité. |

## 3. Exemple de process pleurotes

Process indicatif à adapter :

1. Réception source inoculée ;
2. Contrôle initial ;
3. Incubation / attente colonisation ;
4. Préparation fructification ;
5. Entrée chambre fructification ;
6. Suivi pousse ;
7. Récolte flush 1 ;
8. Repos / relance ;
9. Récolte flush 2 ;
10. Récolte flush 3 optionnelle ;
11. Fin de production ;
12. Sortie / compost / rebut.

## 4. Phases, étapes, actions et observations

Le système doit distinguer deux niveaux :

- **phase** : niveau métier large, utile pour le dashboard et la compréhension humaine ;
- **étape** : niveau opérationnel précis, utilisé pour les transitions, formulaires et actions.

Exemple :

| Phase | Étapes possibles |
| --- | --- |
| Réception | Réception source, contrôle initial, QR imprimé. |
| Incubation | Mise en incubation, contrôle colonisation, attente. |
| Fructification | Entrée chambre, choc, suivi pousse, maturité. |
| Récolte | Flush 1, repos, flush 2, flush 3. |
| Fin de cycle | Fin normale, compost, rebut, nettoyage. |

Chaque phase ou étape peut définir :

- les actions disponibles ;
- les observations proposées ;
- les mesures attendues ;
- les champs obligatoires ;
- les alertes ;
- les transitions autorisées.

## 5. Données configurables par étape

Chaque étape peut définir :

- nom court ;
- description ;
- durée attendue ;
- durée minimale ;
- durée maximale avant alerte ;
- statut associé ;
- actions disponibles ;
- mesures attendues ;
- champs obligatoires ;
- transitions autorisées ;
- conditions de sortie ;
- rôle autorisé à valider.

## 6. Types de champs configurables

| Type de champ | Exemples |
| --- | --- |
| Texte court | souche, fournisseur, commentaire court. |
| Texte long | observation, anomalie. |
| Nombre | poids, température, humidité. |
| Oui/non | contamination visible, étiquette posée. |
| Choix simple | qualité A/B/C, statut sanitaire. |
| Choix multiple | symptômes observés. |
| Date/heure | date de réception, date récolte. |
| Photo | photo de pousse ou anomalie. |
| Référence | chambre, emplacement, utilisateur. |
| Quantité avec unité | 12,4 kg, 85 %, 450 ppm. |

## 7. Actions configurables

Les actions ne doivent pas être codées en dur dans l’interface. Le backend doit renvoyer au frontend les actions disponibles selon :

- le process ;
- la phase ;
- l’étape courante ;
- le statut du lot ;
- le rôle de l’utilisateur ;
- les règles métier.

Actions possibles selon la phase ou l’étape :

- ajouter observation ;
- ajouter mesure ;
- changer d’étape ;
- déplacer vers une chambre ;
- diviser le lot ;
- imprimer QR enfant ;
- enregistrer récolte ;
- déclarer contamination ;
- déclarer perte ;
- terminer le lot ;
- créer produit final.

## 8. Observations configurables

Les observations doivent aussi être configurables.

Exemples d’observations proposées :

| Observation | Type de saisie | Utilisation |
| --- | --- | --- |
| Pousse visible | Oui/non + photo optionnelle | Déclencher suivi fructification. |
| Maturité récolte | Choix qualitatif | Décider récolte. |
| Contamination suspecte | Gravité + note + photo | Créer alerte sanitaire. |
| Surface sèche | Oui/non + note | Ajuster humidité. |
| Couleur anormale | Choix + photo | Suivi qualité. |
| Odeur anormale | Choix + texte | Signalement problème. |
| Densité de bouquet | Note qualitative | Suivi rendement futur. |

Chaque observation configurable peut définir :

- libellé ;
- description ;
- phase/étape concernée ;
- type de saisie ;
- obligation ou suggestion ;
- gravité par défaut ;
- besoin de photo ;
- création automatique d’alerte ;
- action suivante recommandée.

## 9. Transitions

Chaque transition doit définir :

- étape de départ ;
- étape d’arrivée ;
- libellé utilisateur ;
- champs à saisir au passage ;
- validation automatique ou manuelle ;
- droits requis ;
- effets sur l’état courant ;
- événement créé.

Exemples :

| Depuis | Vers | Condition possible |
| --- | --- | --- |
| Réception | Incubation | Contrôle initial validé. |
| Incubation | Fructification | Colonisation suffisante. |
| Fructification | Récolte flush 1 | Champignons à maturité. |
| Récolte flush 1 | Repos | Poids récolté saisi. |
| Repos | Fructification flush 2 | Relance décidée. |
| Fructification | Rebut | Contamination ou échec. |

## 10. Alertes

Alertes configurables :

- lot bloqué trop longtemps dans une étape ;
- mesure attendue non saisie ;
- humidité hors seuil ;
- température hors seuil ;
- récolte attendue ;
- contamination signalée ;
- QR non imprimé ;
- lot sans chambre ;
- stock produit final bientôt périmé.

## 11. Versioning du process

Quand un process est modifié, les lots déjà créés ne doivent pas changer de règles sans contrôle.

Principe recommandé :

- le modèle de process est versionné ;
- un lot référence la version utilisée à sa création ;
- les modifications créent une nouvelle version ;
- un administrateur peut migrer un lot vers une version plus récente si nécessaire.

## 12. Process expérimental

L’application doit permettre des variantes :

- test de chambres différentes ;
- test de substrats ;
- test de durées ;
- test de méthodes de déclenchement ;
- suivi comparatif des rendements.

Pour cela, un lot ou sous-lot peut recevoir des tags :

- expérimentation ;
- témoin ;
- souche ;
- substrat ;
- protocole ;
- notes libres.

## 13. Données minimales d’un process viable

Pour coder une première version, un process template doit au minimum contenir :

- nom ;
- version ;
- espèce cible optionnelle ;
- liste de phases ;
- liste d’étapes ;
- étape initiale ;
- étapes terminales ;
- transitions autorisées ;
- actions disponibles par phase/étape ;
- observations configurables par phase/étape ;
- mesures attendues par phase/étape.
