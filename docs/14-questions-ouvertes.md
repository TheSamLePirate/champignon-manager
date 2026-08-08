# 14 — Questions ouvertes

Ce document centralise les décisions à prendre avant ou pendant le codage.

## 1. Vocabulaire métier

1. Quel terme utiliser dans l’application : ballot, bloc, sac, substrat, pain, source ?
2. Est-ce qu’une “source” et un “lot” doivent être deux objets différents pour toi ?
3. Un sous-lot est-il toujours issu d’une division physique, ou peut-il être une simple séparation logique ?
4. Quelles espèces seront gérées au début ? → **Plusieurs espèces (configurable) ; pleurote en premier, mais pas uniquement (shiitake, etc.).**
5. Les souches/variétés doivent-elles être suivies précisément ?

## 2. Process de culture

1. Quelles sont les phases réelles de ton process pleurote actuel (et faut-il un process différent par espèce) ?
2. Quelles étapes veux-tu voir dans la première version ?
3. Quelles transitions doivent être autorisées ?
4. Faut-il autoriser un retour arrière d’étape ?
5. Certaines étapes doivent-elles avoir une durée minimale ou maximale ?
6. Quelles étapes déclenchent une alerte si rien n’est fait ?
7. Veux-tu plusieurs process selon espèce, souche, fournisseur ou type de ballot ?

## 3. Actions configurables

1. Quelles actions doivent être proposées à chaque phase ?
2. Quelles actions doivent être réservées à certains rôles ?
3. La division de lot peut-elle se faire à n’importe quelle étape ?
4. La récolte peut-elle être enregistrée uniquement depuis certaines étapes ?
5. Faut-il une action spéciale “contamination” ?
6. Faut-il une action spéciale “compost/rebut” ?
7. Faut-il une action “pause/attente” ?

## 4. Observations et mesures

1. Quelles observations veux-tu proposer par défaut ?
2. Quelles observations doivent être obligatoires à certaines étapes ?
3. Les photos doivent-elles être obligatoires pour contamination ?
4. Quelles mesures sont saisies manuellement aujourd’hui ?
5. Quelles mesures viendront des Inkbird plus tard ?
6. Veux-tu suivre CO2 et luminosité dès le modèle, même sans capteur au début ?
7. Faut-il noter la maturité de récolte avec une échelle qualitative ?

## 5. Lots, divisions et mélanges

1. Quand divises-tu un lot en pratique ?
2. La division doit-elle répartir un poids total contrôlé ?
3. Un sous-lot peut-il être fusionné avec un autre ?
4. Les récoltes de plusieurs lots peuvent-elles être mélangées dans un même produit final ?
5. Si oui, faut-il suivre les proportions exactes ?
6. Un lot parent reste-t-il actif après division ou devient-il seulement un conteneur historique ?

## 6. Chambres et emplacements

1. Combien de chambres ou zones au début ?
2. Faut-il suivre seulement la chambre ou aussi étagère/rack/niveau ?
3. Les chambres ont-elles des conditions cibles différentes ?
4. Un lot peut-il être dans plusieurs emplacements en même temps ?
5. Les chambres doivent-elles avoir leur propre QR code ?

## 7. QR et étiquettes

1. Quel est le modèle exact de l’imprimante QR ?
2. Quelle taille d’étiquette ?
3. Quelles informations doivent être imprimées en plus du QR ?
4. Faut-il une étiquette pour chaque sous-lot ?
5. Faut-il une étiquette produit final ?
6. Comment gérer une étiquette perdue ou abîmée ?
7. Le QR doit-il rester lisible en environnement humide ?

## 8. Interface iPhone

1. L’utilisateur scannera-t-il avec l’appareil photo iOS ou dans l’interface web ?
2. L’iPhone aura-t-il toujours du Wi‑Fi dans les chambres ?
3. Faut-il prévoir un mode hors ligne ?
4. Quelles sont les 3 actions les plus fréquentes après scan ?
5. Faut-il un mode “opérateur sans mot de passe” sur appareil local ?

## 9. Récoltes et produits finaux

1. Quels produits finaux veux-tu gérer au début ?
2. Frais, barquette, vrac, séché, transformé, compost, rebut ?
3. Faut-il gérer DLC/DDM ?
4. Faut-il gérer prix ou seulement stock ?
5. Faut-il tracer vente/client ou uniquement sortie stock ?
6. Les pertes de tri doivent-elles être détaillées ?

## 10. Caméra Reolink

1. Quelle caméra Reolink est utilisée ?
2. Elle surveille une chambre entière ou un emplacement précis ?
3. À quelle fréquence capturer ?
4. Veux-tu des timelapses ?
5. Les captures doivent-elles être rattachées automatiquement aux lots présents dans la chambre ?
6. Le code existant de contrôle caméra expose-t-il déjà une API ou une librairie ?

## 11. Inkbird

1. Les appareils Inkbird sont-ils connectés au Wi‑Fi local ou seulement via cloud/app mobile ?
2. As-tu déjà un moyen de lire leurs valeurs ?
3. Veux-tu seulement afficher/historiser ou aussi modifier les consignes ?
4. À quelle fréquence lire les valeurs ?
5. Un Inkbird est-il associé à une chambre fixe ?
6. Faut-il déclencher des alertes si température/humidité hors plage ?

## 12. Technique et déploiement

1. Sur quelle machine tournera le backend local ?
2. MongoDB sera-t-il local sur la même machine ?
3. Faut-il Docker ou installation directe ?
4. Faut-il accès à distance hors site ?
5. Quel nom local utiliser : `champignon.local`, IP fixe, autre ? → **Résolu : nom MagicDNS Tailscale (`champignon.<tailnet>.ts.net`).**
6. Faut-il HTTPS local dès le début ? → **Résolu : oui, HTTPS fourni par Tailscale (`serve` + cert TLS).**
7. Quelle stratégie de sauvegarde souhaites-tu ?

## 13. Droits et utilisateurs

1. Combien d’utilisateurs au début ?
2. Faut-il plusieurs rôles dès le MVP ?
3. Un opérateur doit-il pouvoir corriger ses saisies ?
4. Qui peut modifier le process ?
5. Qui peut réimprimer des QR ?
6. Qui peut supprimer/annuler une donnée ?

## 14. Priorités immédiates à trancher

Pour démarrer le codage plus tard, il faudra surtout valider :

1. vocabulaire source/lot/sous-lot ;
2. premier process (pleurote) + process par espèce ;
3. actions par phase ;
4. observations par phase ;
5. niveau de localisation physique ;
6. informations d’étiquette QR ;
7. produits finaux MVP ;
8. stratégie d’authentification locale.

## 15. Mise à jour après réponses développeur — 2026-06-17

Synthèse complète : [18-decisions-techniques-dev.md](./18-decisions-techniques-dev.md).

### Décisions techniques closes

- Stack : Bun + TypeScript strict + Vite + React + MongoDB.
- Architecture : monorepo Bun workspaces.
- Backend : Hono REST.
- Validation : Zod.
- API : client typé + OpenAPI automatique.
- MongoDB : native driver + validation Zod.
- Modèle de persistance : état courant + événements immuables.
- Transactions : MongoDB replica set local via Docker Compose.
- Déploiement : Docker Compose.
- Environnements : dev macOS/Windows 11, production Raspberry Pi.
- Accès : **Tailscale confirmé** (tailnet privé), HTTPS fourni par Tailscale (`serve` + cert TLS), URL = nom MagicDNS `ts.net`.
- QR : token opaque seulement.
- Scan : scanner web intégré au MVP.
- Imprimante : Nimbot B21.
- Auth MVP : login/mot de passe simple, rôle `admin` au départ.
- UI : Tailwind + shadcn/ui recommandés.
- Tests : Vitest + Playwright + tests formulaires dynamiques.
- PWA/offline : pas obligatoire au MVP.
- Reolink/Inkbird/ventes/facturation/contrôle actif : après MVP.

### Questions techniques restant ouvertes

- Driver/protocole exact pour Nimbot B21.
- Hostname MagicDNS Tailscale exact + configuration `tailscale serve` (stratégie close, valeur à fixer au déploiement).
- Politique exacte de sauvegarde : fréquence, destination, rétention.
- Versioning et migration d’un process déjà utilisé par des lots.
- Format final des `publicCode`.
- Niveau réaliste de couverture de tests au MVP.

### Questions métier toujours dépendantes du cultivateur

- Vocabulaire source / unité / lot / sous-lot.
- Phases et étapes réelles par espèce (pleurote en premier).
- Actions par phase/étape.
- Observations par phase/étape.
- Mesures obligatoires ou optionnelles.
- Niveau de détail chambres / emplacements.
- Produits finaux MVP.
- Contenu des étiquettes.

## 16. Mise à jour cultivateur (Julien) — 2026-06-17 : chaîne de propagation

Le process ne commence pas au substrat. La chaîne réelle est :

**origine (spores / culture mère) → gélose → culture liquide (LC) → grain → substrat → fructification.**

À chaque stade : possibilité de **clone** (cultures secondaires de même stade) et de **transfert/repiquage** vers le stade suivant. « Quasiment du spore à l’assiette. »

Conséquences intégrées dans les docs 00, 01, 03, 05, 07 (+ formulaire 16) :

- l’entité traçable devient « unité de culture » avec un champ `stade` ;
- lignée typée : `clone`, `transfert`, `division` ;
- traçabilité ascendante complète jusqu’à la gélose/origine.

Nouvelles questions ouvertes (cultivateur) :

- jusqu’où remonter : spore, gélose ou LC ?
- conserve-t-on des cultures mères ? combien de générations de clone avant de repartir des spores ?
- un process distinct par stade, ou un seul process multi-stade ?
- ratios de multiplication à suivre (1 gélose → N LC → N grain → N substrat) ?
- QR dès la gélose, ou seulement à partir du grain/substrat ?

## 17. Mise à jour — espèces multiples configurables (2026-06-17)

L’application n’est **pas limitée au pleurote**. L’**espèce est configurable** (pleurote, shiitake, etc.), chaque espèce — voire variété/souche — pouvant avoir son propre process, ses stades, durées, conditions, substrat et nombre de flushs.

Conséquences (déjà prévues par le modèle) :

- `species` / `strains` configurables ; `processTemplates.targetSpeciesIds` et `species.defaultProcessTemplateId` relient espèce ↔ process ;
- prévoir un **process (template) par espèce**, le pleurote étant le premier ;
- les stats doivent pouvoir comparer/segmenter **par espèce**.

À préciser avec le cultivateur :

- liste des espèces réellement cultivées au départ ;
- la chaîne gélose→LC→grain→substrat est-elle identique pour toutes les espèces ?
- différences de durées/conditions/substrat par espèce.

## 18. Mise à jour cultivateur — 2026-07-30 : réponses reçues

Source : `champignon-reponses-cultivateur-2026-07-30.json` (formulaire `16`).

⚠️ **L’export annonce « 188/188, 100 % » mais seules 84 questions contiennent réellement une réponse.** Les 104 autres ont été marquées répondues en masse sans texte ni case cochée. Le formulaire les a repassées en « À répondre ».

### 18.1 Questions désormais closes

| Sujet | Décision |
| --- | --- |
| Vocabulaire par stade | gélose / boîte de Pétri, culture liquide / LC, ballot de grain, ballot de substrat, bloc, sac, pain. Nommer les stades « au plus simple et clair ». |
| Espèces gérées | **Toutes**, configurables dans l’app. Le pleurote n’est plus la référence unique. |
| Point de départ du process | **N’importe quel stade** : spores, gélose, LC, grain ou directement substrat — y compris des unités reçues déjà prêtes. |
| Traçabilité amont | Jusqu’à l’empreinte de spores **ou** la souche achetée/reçue. |
| Clonage | À **tous** les stades, y compris souche → souche et division substrat. |
| Générations de clone | **Aucune limite** imposée. |
| Ratios de multiplication | Tous à suivre ; les valeurs sont configurables. |
| Conservation | Frigo, dormance à température ambiante, contenant — **configurable**. |
| Réactivation d’une unité conservée | Crée une **nouvelle unité** (donc un nouveau maillon de lignée), pas une reprise de l’ancienne. |
| Unité archivée en historique | **Réactivable**. |
| Parent | Pas de « parent = session » : c’est un **lien de parenté détaillé du début à la fin** (lignée complète). |
| Avancement groupé | Tous les enfants d’un parent, ou seulement une partie — les deux. |
| Filtres | Filtres **configurables et enregistrables** comme favoris. |
| Phase vs étape | Distinction retenue : phase = grande période, étape = moment précis (incubation 1/2/3). |
| Changement de process en cours | **Autorisé** sur un lot déjà lancé. |
| Étape sautée / refaite / retour arrière | **Autorisés**. |
| Modification d’un process | Les unités déjà lancées **basculent sur la nouvelle version**, avec confirmation explicite (« êtes-vous sûr »). |
| Comparaison de versions de process | Oui — impose donc de conserver la version appliquée à chaque unité. |
| Droit de créer/modifier un process | **Une seule personne** (le cultivateur). Cohérent avec l’auth MVP `admin` unique. |
| Alarmes de durée | Rappel avant échéance, alerte au dépassement, 2ᵉ seuil critique, et possibilité de désactiver sur certaines étapes. |

Ces réponses closent les questions §1.4, §1.5, §2.4, §2.7, §5.6, §13.4 ci-dessus, ainsi que les questions ouvertes du §16 (jusqu’où remonter, cultures mères, générations, ratios, QR dès la gélose) et une partie du §17 (chaîne identique pour toutes les espèces).

### 18.2 Contradiction à arbitrer

**Versioning de process.** Le §15 listait « versioning et migration d’un process déjà utilisé par des lots » comme question technique ouverte. La réponse — bascule automatique sur la nouvelle version — **entre en tension avec la demande de comparer deux versions** : si tout bascule, il ne reste aucune population sur l’ancienne version à comparer. À trancher : bascule par défaut mais possibilité de figer une sélection sur l’ancienne version, ou comparaison portant uniquement sur l’historique déjà produit.

### 18.3 Ce qui reste bloquant

**Aucune valeur chiffrée n’a été fournie.** Tout ce qui concerne le terrain est absent :

- durées, températures, humidité, lumière, aération : **pour tous les stades** ;
- critères de passage d’étape (§9 du questionnaire : entièrement vide) ;
- chambres et emplacements réels, conditions cibles (§10 : vide) ;
- mesures manuelles et fréquences (§11 : vide) ;
- observations terrain et gravité (§12 : vide) ;
- récoltes : unité de poids, qualité, calibre, mélanges (§14 : vide) ;
- contenu des étiquettes, gestion d’un QR perdu (§17 : vide) ;
- conduite en cas de contamination, retard, fusion (§18 : vide) ;
- tableau de synthèse §20 : vide.

Le mot « configurable » revient à chaque question de valeur. C’est cohérent avec le cadrage, mais **une application configurable a quand même besoin de valeurs par défaut** pour être utilisable le premier jour. Sans elles, aucun process ne peut être amorcé en *seed data*.

### 18.4 Seconde passe — questions groupées (30/07/2026)

55 questions supplémentaires closes en regroupant celles qui se répétaient d’un stade à l’autre. **139 / 188 renseignées.**

| Sujet | Décision | Ferme |
| --- | --- | --- |
| Actions par étape | **Pas de liste par étape** : la liste complète existe partout, l’app masque ce qui n’a pas de sens au stade courant. Idem pour les observations. | q9_2_8, q9_3_7, q9_5_6, q9_6_7, q12_2 |
| Passage d’étape | **L’observation visuelle déclenche**, validée par une personne. La durée cible n’est qu’un rappel. | q9_2_7, q9_3_6, q9_4_7, q9_6_5, q9_7_1, q9_9_2 |
| Récoltes | **Poids par unité à chaque flush + qualité + pertes avec leur cause.** | q9_7_2→5, q9_8_4, q9_8_5, q9_9_4, q14_1, q14_3 |
| Observations | Photo possible partout, **obligatoire en cas de contamination**. Gravité à 3 niveaux (faible / moyen / critique). | q12_3, q12_4, q12_5 |
| Incubation 3 | **Optionnelle**, pas obligatoire pour toutes les espèces. | q9_4_2 |
| Flush 2 / flush 3 | Flush 2 systématique, qualité différente du flush 1. **Flush 3 optionnel.** | q9_8_1, q9_8_5, q9_9_1 |
| Après un flush | **Repos, fructification suivante ou flush suivant** — les trois chemins existent. | q9_7_6, q9_7_7, q9_8_6, q9_9_5 |
| Fin de cycle | Statuts **terminé / compost / rebut / contaminé** (suffisants). Poids final, raison de fin, emplacement occupé jusqu’au nettoyage, tâche de nettoyage créée. | q9_10_1→5 |
| Emplacements | Suivi **jusqu’à la position** : chambre, étagère, niveau, position. Une unité change plusieurs fois de chambre ; scan du QR chambre = inventaire. | q10_1, q10_2, q10_4, q10_5 |
| Mesures | **Tout à la main aujourd’hui** : température, humidité, poids, visuel. Appareils connectés envisagés à court terme ; les Inkbird devront **déclencher des alertes**, pas seulement historiser. | q11_1, q11_2, q11_3, q11_4 |
| Actions en masse | **Validation obligatoire** avant exécution ; toute action doit être **annulable ou corrigeable**. | q13_3, q13_4 |
| Mélange de récoltes | Autorisé, avec **conservation des proportions exactes**. | q14_4, q14_5 |
| Statistiques | Comparaison enfants d’un même parent, comparaison entre chambres, **export CSV/Excel**. | q15_2, q15_3, q15_4 |
| QR & étiquette | QR pour chambres, récoltes et produits finaux. Étiquette : **nom de l’unité, type, date, code QR**. | q17_2, q17_3, q17_4 |
| Contamination | Une unité contaminée **ne peut plus produire**. | q18_2 |

#### Nuance importante sur les durées

La réponse « le passage se fait à **l’observation visuelle**, la durée n’est qu’un rappel » **précise le principe n°8 du cadrage** (§2.1), qui plaçait durée et décision humaine à égalité. Conséquence pour l’implémentation : la durée cible **n’est jamais un déclencheur d’avancement**, seulement une base de calcul d’alarme. Le moteur ne doit pas modéliser de transition automatique par échéance.

#### Ce qui reste (49 questions)

Presque uniquement des **valeurs et des gestes** : déroulé exact de l’inoculation, différences réelles entre incubations 1/2/3, leviers de déclenchement de la fructification, conduite en cas de contamination / retard / fusion, et surtout le **tableau §20** — durée, alarme, température, humidité par stade. Ce dernier était présenté ici comme le seul vrai blocage — **c'est dépassé depuis l'arbitrage du 31/07/2026 : voir §18.5**, ces valeurs deviennent de la configuration saisie dans l'application.

### 18.5 Arbitrage du 31/07/2026 — le tableau §20 n’est plus un prérequis

**Décision : « le tableau sera de toute façon configurable ».**

Les durées, températures, humidité et seuils d’alarme ne sont donc **pas des données à obtenir avant de coder** : ce sont des **données que le cultivateur saisira lui-même dans l’application**, au même titre que ses espèces ou ses chambres.

#### Ce que ça ferme

- Le tableau §20 sort du chemin critique. **P0-1 est levé** : il ne manque plus rien pour commencer.
- Les 49 questions encore vides du questionnaire ne bloquent plus. Elles décrivent des valeurs qui seront saisies en configuration, pas des décisions de structure.
- La demande de « seed data process pleurote » (`dev_01_04`) perd son objet : il n’y a pas de process de référence à figer dans le code.

#### Ce que ça ouvre — et qui est plus lourd

Sans valeurs par défaut, **l’application est vide au premier démarrage**. Le cultivateur doit pouvoir construire son process entier depuis l’interface, dès le premier jour.

Conséquence directe : **l’éditeur de process passe de « plus tard » à « indispensable au MVP »**. La recommandation de `claude-critics.md` (« seed data d’abord, éditeur visuel ensuite ») **ne tient plus** — elle reposait sur l’existence d’un process de référence livré avec l’app. Ce n’est plus le cas.

Cela rend cohérente la réponse développeur `dev_06_06` (« éditeur complet » au MVP), qui était jusqu’ici jugée sur-dimensionnée.

#### Ce qu’il faut à la place

Un **jeu de démonstration** (et non un seed de production) reste utile pour développer et tester : un process fictif complet, avec des valeurs arbitraires, pour faire tourner les écrans et les tests E2E. Il n’engage rien sur le métier réel.

⚠️ **Risque à surveiller** : la première mise en service devient un exercice de saisie lourd (un process complet, des chambres, des espèces, des seuils). Prévoir un accompagnement, un import, ou un modèle de process pré-rempli **modifiable** — sinon l’outil sera abandonné avant d’avoir servi.

### 18.6 Export v8 du 30/07/2026 (22:02) — 186/188 et les premières valeurs réelles

Un second export a été fourni : **186 questions renseignées sur 188**. Seuls les deux tableaux restent vides (`q10_3` conditions par chambre, `q20_table` synthèse) — sans conséquence, ils relèvent de la configuration.

#### Premières valeurs chiffrées obtenues

| Étape | Valeurs |
| --- | --- |
| **Inoculation** | Vérification du grain → transfert sur substrat → scellage → incubation. Poids enregistré : **poids substrat total**. Contrôle qualité : aspect, odeur, propreté, température. Étiquette : QR par unité + nom + date. |
| **Incubation** | **2 à 3 semaines**, **24 °C**, **obscurité**. Humidité : **pas de contrôle**. CO2 / aération : **sans importance**. Observations : colonisation, contamination, couleur, odeur, humidité du sac. |
| **Fructification** | Déclenchement : **ouverture du sac**, passage **en lumière**, humidité portée à **90 %**, température **18-24 °C**. Premiers signes après **2-3 jours**. **2 chambres** utilisées. |
| **Récolte** | Poids en **grammes**. Flush 3 : son rendement **vaut encore le coût et l'espace**. |

#### ⚠️ Le process réel est bien plus court que celui décrit

Réponses répétées : **« pas de différence »** entre incubation 1, 2 et 3 ; **« pas de différences »** entre fructification 1 et 2 ; **« pas de différences »** de durée ou de conditions entre flush 1 et flush 2.

Autrement dit, la séquence à 13 étapes qui structure toute la documentation depuis le début **ne correspond pas au terrain**. Le process réel est :

```
inoculation → incubation (2-3 sem., 24 °C, obscurité) → fructification (90 %, 18-24 °C) → flush 1 → flush 2 → flush 3 (optionnel) → fin de cycle
```

Les subdivisions 1/2/3 n'ont **aucune réalité métier** : elles venaient de la formulation initiale du questionnaire, pas d'une pratique. Elles restent créables — le process étant configurable — mais **ne doivent pas être livrées comme modèle par défaut**.

C'est une simplification importante : le modèle de process type passe de 13 étapes à **6**.

#### Autres réponses

- **Fusion d'unités : non** (`q18_5`). La traçabilité n'a pas à gérer de convergence de lignées — simplification notable.
- **Contamination** : quarantaine, rebut, observation, photo, nettoyage ou poursuite — **configurable** (`q18_1`).
- **Unité en retard** : attente, changement de conditions, rebut, alerte, observation (`q18_3`).
- **Déplacement sans scan** : correction manuelle, scan plus tard, inventaire (`q18_4`).
- **QR abîmé** : réimprimer **le même** QR (`q17_5`) — cohérent avec la décision développeur `dev_08_05`.
- **Notifications** : l'app envoie une **notification téléphone** en plus du dashboard (`q16_3`).
- **Observations rapides** : contamination, odeur, couleur suspecte, humidité visuelle, taille, couleur (`q12_1`).
- **Statistiques** : température moyenne par chambre, humidité au moment de la fructification, écart aux consignes — et un **dashboard configurable** (`q11_5`).

#### ⚠️ Tension à lever

`q16_2` : **« pas de tâches automatiques, mais des statuts et des alertes »**. Cela contredit `q9_10_5`, où la création d'une **tâche de nettoyage** en fin de cycle avait été acceptée.

Lecture proposée : pas de génération automatique de tâches récurrentes, mais les alarmes de durée et la fin de cycle produisent des **alertes** que l'on peut traiter. À confirmer avant de coder un module de tâches.

## 19. Mise à jour 2026-08-08 — les dernières questions sont tranchées

Répondant : Olivier. Détail complet : [`21-decisions-avant-code.md`](./21-decisions-avant-code.md).

### 19.1 Questions closes

| Question ouverte | Où elle était posée | Décision |
| --- | --- | --- |
| Source et lot = deux objets différents ? | §1.2, P2-2 | **Deux objets distincts.** Une unité référence sa source quand elle en a une ; elle peut naître sans source. |
| Versioning / migration d’un process utilisé par des lots | §15 « questions techniques », §18.2, `dev_06_05` | **Comparaison entre versions.** Version publiée immuable, unité épinglée jusqu’à fin de cycle, **pas de bascule**, migration explicite par sélection. |
| Tâches automatiques ? | tension `q16_2` ⇄ `q9_10_5` | **Aucune tâche.** Statuts et alertes seulement — collection et module `tasks` supprimés. |
| Sémantique quantité / poids | P2-1 | **Type `Quantity` `{ value, unit, kind }`**, masse canonique en grammes, `substrateWeight` en champ de premier rang. *(Réponse « au mieux » → recommandation implémenteur, pas décision métier.)* |
| Stratégie d’authentification locale | §14.8, §13, P1-2 | **Aucune.** Pas d’auth, pas d’utilisateurs, pas de rôles, pas d’auteur sur les événements. Seule frontière : le tailnet Tailscale. |
| Nombre d’utilisateurs, rôles dès le MVP | §13.1, §13.2 | **Sans objet** — il n’y a pas d’utilisateurs. |
| Qui peut corriger / réimprimer / modifier le process | §13.3, §13.4, §13.5, §13.6 | **Sans objet au MVP** — aucune restriction technique n’existe. |
| Driver / protocole Nimbot B21 | §15, P0-5 | **Résolu : testé, fonctionne.** Le repli image/PDF devient inutile. |

### 19.2 Ce qui reste ouvert

Aucun point bloquant. Il subsiste :

- **le périmètre** (P1-1) : définir la tranche verticale, éditeur de process minimal inclus, et estimer la charge — jamais fait ;
- **spikes non bloquants** : Safari iOS + `tailscale serve` (accès caméra), compatibilité Bun (driver Mongo, Vitest, BLE) ;
- **points mineurs** : format des `publicCode`, politique de sauvegarde, hostname MagicDNS, conditions cibles par chambre (`q10_3`, configuration) ;
- **à faire remonter au cultivateur** : ses unités en cours ne basculeront pas lors d’une modification de process, et l’application ne saura jamais qui a fait quoi (`21` §10).
