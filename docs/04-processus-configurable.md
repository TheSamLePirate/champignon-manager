# 04 — Processus configurable

## 1. Objectif

Le process de culture ne doit pas être figé dans le code. L’application doit pouvoir gérer plusieurs process selon l’espèce, la méthode, le type de source ou l’expérimentation.

## 2. Concepts

| Concept | Description |
| --- | --- |
| Process template | Modèle de process réutilisable. Exemple : “Pleurotes — ballot inoculé”. |
| Stade de culture | Niveau dans la chaîne de propagation : gélose, culture liquide, grain, substrat, fructification. Chaque stade peut avoir son propre process. |
| Version de process | Snapshot du process utilisé par un lot. Important si le modèle change après création du lot. |
| Phase | Grande période métier de culture : incubation, fructification, récolte, repos, fin de cycle. Une phase peut contenir plusieurs étapes. |
| Étape | Moment opérationnel précis dans une phase. |
| Transition | Passage autorisé entre deux étapes. |
| Formulaire d’étape | Données à saisir pour une étape ou une transition. |
| Règle | Condition, seuil, obligation ou alerte. |
| Action configurable | Action proposée à l’utilisateur selon la phase, l’étape, le statut du lot et son rôle. |
| Observation configurable | Type d’observation attendu ou proposé : pousse visible, contamination, humidité de surface, odeur, couleur, maturité. |

## 3. Exemple de process (pleurote — première espèce de référence)

L’espèce est **configurable** : chaque espèce (pleurote, shiitake, etc.), voire variété/souche, peut avoir son propre process. Le pleurote ci-dessous est l’exemple de départ, pas le seul process possible.

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

## 3 bis. Chaîne multi-stade et process par stade

Le process ne commence plus au substrat : il couvre toute la chaîne **gélose → culture liquide (LC) → grain → substrat → fructification**. Chaque stade a ses propres étapes, conditions, observations et durées. Cette chaîne est **configurable par espèce** : selon l’espèce (pleurote, shiitake, etc.), certains stades peuvent différer, être absents ou utiliser un autre substrat (ex. bûche/sciure).

Recommandation : un `processTemplate` par stade (ou un template multi-stade avec sous-process), versionné. Les passages entre stades se font par deux actions configurables transverses :

- **Cloner** : créer N unités secondaires du même stade (le parent survit) ;
- **Transférer / repiquer** : créer N unités du stade suivant (inoculation).

Ces deux actions, plus la **division** (substrat), sont les trois façons de créer des unités enfants.

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
- cloner (culture secondaire de même stade) ;
- transférer / repiquer au stade suivant ;
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
- une version publiée doit être considérée comme immuable ;
- un administrateur peut migrer un lot vers une version plus récente si nécessaire.

Point développeur à clarifier : la stratégie exacte de migration d’un process déjà utilisé par des lots reste ouverte.

Décision provisoire : migration manuelle assistée uniquement, jamais automatique sans validation.

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

Décision développeur : viser un éditeur de process complet dès le MVP. Si cela devient trop complexe, garder le modèle complet en base mais livrer une interface admin simplifiée temporaire.

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
- mesures attendues par phase/étape ;
- formulaires dynamiques associés aux actions ;
- alertes configurables ;
- règles d’actions en masse.

## 14. Décisions développeur intégrées

Synthèse complète : [18-decisions-techniques-dev.md](./18-decisions-techniques-dev.md).

Décisions :

- process très détaillé ;
- actions configurables full detail ;
- observations configurables full detail ;
- actions en masse avec options complètes ;
- éditeur complet ciblé pour le MVP ;
- dépendance forte aux réponses cultivateur.

## 15. Réponses cultivateur — 2026-07-30

Source : `champignon-reponses-cultivateur-2026-07-30.json`.

### 15.1 Structure du process

- **Process entiers et sous-process réutilisables**, applicables à une unité, à un lot entier ou à une sélection filtrée.
- Distinction **phase / étape** retenue : la phase est une grande période (incubation), l’étape un moment précis (incubation 1/2/3).
- Un lot **peut changer de process en cours de route**.
- Une étape peut être **sautée, refaite ou remise en arrière**.
- Le moteur est le même pour toutes les espèces ; **seule la configuration change**.

### 15.2 Durées et alarmes

Chaque phase/étape porte une durée cible. Alarmes réglables étape par étape :

| Alarme | Retenue |
| --- | --- |
| Rappel avant la fin prévue (ex : J-1) | ✅ |
| Alerte au dépassement de la durée cible | ✅ |
| 2ᵉ seuil : retard critique | ✅ |
| Possibilité de n’avoir aucune alarme sur une étape | ✅ |
| Rappel périodique tant que l’étape n’est pas finie | ❌ non retenu |
| Rappel de contrôle en milieu d’étape | ❌ non retenu |

Au dépassement : **prévenir, créer une tâche, marquer l’unité en retard — jamais bloquer**. Le passage à l’étape suivante est **toujours validé par une personne** ; l’automatisme ne fait que proposer et alerter. Une alarme doit pouvoir être **acquittée ou reportée**, en gardant la trace de qui l’a fait et quand.

### 15.3 Versions de process

- Modifier un process fait **basculer les unités déjà lancées sur la nouvelle version**, après une **confirmation explicite** de l’utilisateur.
- Le cultivateur veut par ailleurs **comparer les résultats entre deux versions** d’un process.

⚠️ **Ces deux réponses sont en tension.** Si toutes les unités basculent, il ne reste plus de population sur l’ancienne version à comparer. Deux pistes, à arbitrer avant implémentation :

1. bascule proposée par défaut, mais possibilité d’**exclure une sélection** qui reste sur l’ancienne version (permet un vrai A/B) ;
2. bascule systématique, et la comparaison ne porte que sur l’**historique déjà produit** (les unités terminées sous l’ancienne version).

Dans les deux cas, la **version de process appliquée doit être enregistrée sur chaque unité** et figée dans les événements — sinon aucune comparaison n’est possible.

### 15.4 Droits

Création et modification d’un process : **le cultivateur seul**.

### 15.5 Ce qui manque pour construire le premier process

⏳ Aucune valeur n’a été fournie : durées, températures, humidité, critères de passage, seuils d’alarme. Toutes les questions de valeur ont reçu la réponse « configurable ». **Un process configurable a néanmoins besoin de valeurs par défaut** pour être amorcé en *seed data* — c’est le blocage principal côté implémentation.

## 16. Précision du 30/07/2026 (2ᵉ passe) — la durée ne déclenche rien

Réponse du cultivateur à « sur quoi repose le passage d’une étape à la suivante ? » : **l’observation visuelle, validée par une personne. La durée cible n’est qu’un rappel.**

Cela **précise le §15.2** : les alarmes de durée restent telles que définies, mais le moteur ne doit modéliser **aucune transition automatique par échéance**. La durée sert exclusivement à :

- calculer les seuils d’alarme (avant échéance, dépassement, retard critique) ;
- marquer une unité « en retard » ;
- alimenter la statistique « durée réelle vs durée cible ».

Elle n’est **jamais** une condition de passage. Concrètement : pas de job d’avancement planifié, pas d’état « prêt à passer » calculé depuis une date — seul un opérateur fait avancer une unité.

### Actions et observations : pas de liste par étape

Il n’y a **pas de liste d’actions ni d’observations propre à chaque étape**. La liste complète existe à tous les stades ; l’application **masque simplement ce qui n’a pas de sens** au stade courant (par exemple « récolter » sur une gélose).

Conséquence : la configuration de process ne porte pas une liste d’actions par étape, mais au plus des **règles de pertinence par stade**. Cela simplifie nettement l’éditeur de process — un argument de plus pour le seed data avant l’éditeur visuel.

## 17. Arbitrage du 31/07/2026 — le process est saisi, pas livré

**« Le tableau sera de toute façon configurable. »**

Les durées, températures, humidité, conditions et seuils d'alarme ne sont **pas des constantes du code ni des données de seed** : ce sont des valeurs que le cultivateur saisit dans l'application.

Conséquences pour l'implémentation :

- **aucun process de référence n'est livré** avec l'application ;
- l'application doit permettre de **créer un process complet depuis l'interface**, dès le premier démarrage, sans intervention technique ;
- le moteur doit donc être opérationnel **avec zéro donnée initiale** : aucun écran ne peut supposer qu'un process existe ;
- un **jeu de démonstration** (process fictif, valeurs arbitraires) reste nécessaire pour le développement et les tests E2E — il ne prétend rien sur le métier réel.

### Anti-écran-vide

Un **modèle de process pré-rempli et modifiable** doit être proposé au premier lancement : phases et étapes types, durées d'exemple clairement signalées comme telles. L'objectif n'est pas de deviner le métier, mais d'éviter que la première utilisation commence par une page blanche et un formulaire de création vide.

> Le modèle concret correspondant est défini dans [`20-modele-process-par-defaut.md`](./20-modele-process-par-defaut.md) (+ JSON).

## 18. Le process réel (export v8 du 30/07/2026) — 6 étapes, pas 13

Les réponses détaillées par étape révèlent que **les subdivisions 1/2/3 n'ont aucune réalité métier** :

- incubation 1, 2 et 3 → « **pas de différence** » ;
- fructification 1 et 2 → « **pas de différences** » ;
- flush 1 → flush 2 : « **pas de différences** » de durée ni de conditions.

Ces subdivisions venaient de la formulation du questionnaire, pas du terrain.

### Modèle de process par défaut à livrer

```
inoculation → incubation → fructification → flush 1 → flush 2 → flush 3 (optionnel) → fin de cycle
```

| Étape | Durée | Température | Humidité | Lumière | Notes |
| --- | --- | --- | --- | --- | --- |
| Inoculation | — | — | — | — | poids substrat total ; contrôle aspect/odeur/propreté/température |
| Incubation | **2-3 semaines** | **24 °C** | **non contrôlée** | **obscurité** | CO2/aération sans importance |
| Fructification | 2-3 j avant primordia | **18-24 °C** | **90 %** | **lumière** | déclenchée par ouverture du sac ; 2 chambres |
| Flush 1 / 2 / 3 | — | idem fructification | idem | idem | flush 3 optionnel mais rentable |
| Fin de cycle | — | — | — | — | terminé / compost / rebut / contaminé |

Toutes ces valeurs sont **configurables** et signalées comme telles par le cultivateur. Elles constituent le **modèle pré-rempli modifiable** recommandé au §17, pas une contrainte codée.

⚠️ **Ne pas livrer les étapes 1/2/3 par défaut.** Elles restent créables — le moteur est configurable — mais les proposer d'emblée reproduirait une complexité que le terrain n'a pas.
