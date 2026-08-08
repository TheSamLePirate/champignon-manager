# 22 — Tranche verticale MVP

> Date : 2026-08-08. Fait suite à [`21-decisions-avant-code.md`](./21-decisions-avant-code.md).
> Répond au dernier point de cadrage ouvert : **P1-1 — « MVP » sur-dimensionné, sans estimation** ([`claude-critics.md`](../claude-critics.md) §11.5).
> Ce document définit **ce qui est construit**, **comment la qualité est obtenue**, **comment un LLM pilote l'application**, et **combien ça coûte**.

## 0. Lecture rapide

| Question | Réponse |
| --- | --- |
| Ce qu'on livre | Un chemin complet **process → unité → QR → scan → suivi → récolte → produit → traçabilité**, avec **éditeur de process graphique** |
| Ce qu'on ne livre pas | Lignée (clone/transfert/division), actions de masse, multi-espèces avancé, dashboards, Inkbird, Reolink |
| Qualité visée | **100 % de couverture** avec score de mutation, E2E, rapport d'audit automatisé |
| Pilotable par un LLM | **Oui, à 100 %** — API typée + serveur MCP + CLI + dry-run partout |
| Charge estimée | **62 à 78 jours-dev** (~13 à 16 semaines en solo) |

⚠️ **Interprétation de « AAA »** : lu comme **qualité d'ingénierie de premier ordre**, cohérent avec l'usage « AAA response pour le mieux ». Ce n'est **pas** lu comme une conformité **WCAG 2.2 niveau AAA**. L'accessibilité retenue est décrite en §7.3 : WCAG 2.2 **AA** en plancher, plus les critères AAA qui servent réellement en chambre de culture (contraste 7:1, taille de cible). Si la conformité WCAG AAA formelle est visée, il faut le dire : cela ajoute de l'audit, des tests dédiés et des contraintes de design (≈ +6 à 8 jours).

---

## 1. Le parcours livré

La tranche est validée quand **ce scénario tourne de bout en bout, en production, sur le téléphone du cultivateur**.

```
1. Ouvrir l'app (pas de login)                    → dashboard vide
2. Éditeur graphique : créer le process           → 6 étapes, glisser-déposer
   à partir du modèle pré-rempli (doc 20)
3. Publier la version 1 du process                → version immuable
4. Créer une chambre + un emplacement             → chambre, étagère, niveau, position
5. Créer une unité au stade substrat              → publicCode + poids substrat
6. Imprimer son étiquette (Nimbot B21)            → nom, type, date, QR
7. Scanner le QR depuis l'iPhone                  → fiche unité en < 2 s
8. Avancer d'étape (inoculation → incubation)     → événement + timeline
9. Saisir une observation + une mesure            → avec photo
10. Enregistrer une récolte (flush 1)             → poids en g, qualité, pertes + cause
11. Créer un produit final depuis la récolte      → quantité, QR produit
12. Depuis le produit, remonter toute la chaîne   → produit → récolte → unité → événements
```

**Critère de sortie** : l'étape 12 affiche un historique complet et **vérifiable** — c'est ce que teste le rapport d'audit (§8.3).

### 1.1 Hors tranche 1 — explicitement

Ces éléments sont **conçus dans le modèle** (les champs existent, les schémas les acceptent) mais **pas construits dans l'UI** :

| Reporté | Où c'est prévu | Tranche |
| --- | --- | --- |
| Lignée : clone, transfert, division | `parentLotId`, `lineageRelation`, `generation` existent en base ; `parentId` nullable | 2 |
| Arbre généalogique multi-stade | — | 2 |
| Stades amont (gélose, LC, grain) en UI | `stage` accepte déjà les 5 valeurs | 2 |
| Actions de masse | Contrat déjà spécifié (`08` §20.2) | 2 |
| Conservation / archivage / réactivation | — | 2 |
| Dashboards, rapports, exports CSV | — | 3 |
| Alarmes et notifications téléphone | `alerts` existe, non alimentée | 3 |
| Inkbird, Reolink | Hors MVP de toute façon | 4+ |

**Pourquoi cette coupe** : la tranche 1 suit **une unité, en ligne droite, de sa création à son produit**. C'est le plus court chemin qui traverse *toutes* les couches techniques (éditeur, moteur, QR, impression, scan, mobile, événements, traçabilité). Tout ce qui est reporté est une **multiplication** de ce chemin, pas une nouvelle couche.

---

## 2. Architecture — ce qui rend le 100 % atteignable

**Le 100 % de couverture n'est pas une contrainte de test, c'est une contrainte d'architecture.** On ne l'atteint pas en écrivant plus de tests à la fin ; on l'atteint en écrivant du code où il n'y a rien d'intestable.

### 2.1 Cœur fonctionnel, coquille impérative

```
packages/
  contracts/    Zod + types partagés. Zéro logique. Source de l'OpenAPI.
  domain/       ██ PUR ██ Aucune I/O. Aucun import de driver, d'horloge, d'aléatoire.
                Moteur de process, transitions, quantités, alarmes, généalogie,
                calculs de rendement, validation de graphe de process.
  persistence/  Adaptateurs MongoDB. Traduction document ⇄ domaine. Pas de règle métier.
  api/          Hono. Routage, validation, idempotence, erreurs. Pas de règle métier.
  printing/     Adaptateur Nimbot B21. Isolable en process Node si Bun coince.
  mcp/          Serveur MCP. Expose le domaine aux LLM.
  cli/          CLI JSON-in/JSON-out.
apps/
  web/          Vite + React. Composants purs + hooks d'accès.
```

**Règle non négociable** : `domain/` ne connaît ni la base, ni le réseau, ni `Date.now()`, ni `Math.random()`. Le temps et les identifiants sont **injectés**. Conséquence directe : chaque règle métier est testable par une fonction pure, sans base de données et sans mock. C'est ce qui rend 100 % atteignable **et rapide** (la suite `domain` doit tourner en moins de 2 secondes).

### 2.2 Où va la logique

| Type de code | Package | Couverture | Comment |
| --- | --- | --- | --- |
| Règles métier, calculs, validations | `domain` | **100 % + mutation ≥ 90 %** | Tests unitaires purs |
| Schémas | `contracts` | **100 %** | Tests de parsing (cas valides + invalides) |
| Requêtes, transactions | `persistence` | **100 %** | Intégration sur MongoDB réel (replica set Docker) |
| Routage, erreurs, idempotence | `api` | **100 %** | Tests HTTP in-process |
| Pilote imprimante | `printing` | **100 %** | Transport injecté ; un faux en test, le BLE en prod |
| UI | `web` | **100 % des composants** | Testing Library + E2E Playwright |

### 2.3 Ce que « 100 % » veut dire ici

La couverture de lignes seule est une métrique creuse : `expect(f()).toBeDefined()` couvre tout et ne prouve rien. Deux garde-fous rendent le chiffre honnête :

1. **Score de mutation** (Stryker) sur `domain` et `contracts`, **seuil de rupture à 90 %**. Un test qui ne détecte pas l'inversion d'une condition n'est pas un test.
2. **Interdiction des exclusions** : `/* c8 ignore */`, `.skip`, `.only` sont **refusés par le linter**. Une ligne non couverte se supprime, elle ne se masque pas.

Ces deux points transforment « 100 % » d'une métrique vanité (`claude-critics.md` P2-6) en contrainte de conception réelle. C'est atteignable **parce que** l'architecture §2.1 le permet.

### 2.4 Best practices — la liste courte et appliquée

- **TypeScript strict** + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`. Aucun `any`, aucun `as` non justifié (règle lint).
- **Trois couches de types** : Domain / DTO-API / documents Mongo, jamais confondues (déjà acté `07`).
- **Erreurs typées** en union discriminée, jamais d'exception pour du contrôle de flux métier. Résultat `Ok | Err` dans le domaine.
- **Immutabilité** dans `domain` (`readonly` partout, pas de mutation en place).
- **Transactions MongoDB** sur toute écriture double état+événement (replica set déjà retenu).
- **Migrations versionnées** dès le premier schéma, avec test de rejouabilité.
- **Conventional commits** + CI bloquante : lint, types, tests, couverture, mutation, E2E, audit.
- **Zéro warning toléré** en build et en lint.

---

## 3. Éditeur de process graphique

Demandé explicitement. C'est le poste le plus lourd de la tranche (~20 % de la charge) — il est traité comme tel, pas comme un extra.

### 3.1 Le principe structurant

> **L'éditeur graphique et l'API éditent exactement le même objet JSON.**

Le canvas n'est **qu'une vue** sur la structure décrite dans [`20-modele-process-par-defaut.json`](./20-modele-process-par-defaut.json). Conséquences :

- un LLM peut écrire un process en JSON et le POSTer — l'éditeur l'affiche correctement ;
- le cultivateur peut le modifier au doigt — l'API le relit correctement ;
- **aucune fonctionnalité n'existe uniquement dans l'éditeur.** Pas de format propriétaire de canvas.

Les positions des nœuds sont stockées dans un champ `layout` **séparé et optionnel** : perdre le layout ne perd jamais le process. Un process créé par API sans layout est auto-disposé à l'affichage.

### 3.2 Ce que l'éditeur fait

| Capacité | Détail |
| --- | --- |
| Canvas nœuds/arêtes | Nœud = étape, arête = transition **nominale**. React Flow. |
| Glisser-déposer | Créer, déplacer, relier, supprimer une étape. |
| Panneau de propriétés | Durée cible, T°, humidité, lumière, aération, seuils d'alarme, étape optionnelle, stade concerné. |
| Démarrage assisté | Au premier lancement, propose le **modèle par défaut** (doc 20, 6 étapes) — pré-rempli et modifiable. Anti-écran-vide. |
| Provenance visible | Les valeurs `invented` du modèle sont **marquées visuellement** comme exemples à ajuster, jamais présentées comme recommandations. |
| Validation en direct | Étape inatteignable, étape sans nom, durée négative, boucle non déclarée, incohérence de stade. |
| Publication | Contrôle complet, puis **gel immuable**. Une version publiée ne se modifie plus. |
| Diff de versions | Comparaison v1 ⇄ v2 côte à côte, en préparation de la comparaison de résultats (`21` §2). |
| Import / export JSON | Le même JSON que l'API. Permet à un LLM de générer un process complet. |

### 3.3 Le piège à ne pas construire

Les réponses du cultivateur autorisent : **étapes sautables, refaisables, réversibles**, et **changement de process en cours de route**. Cela veut dire que **les arêtes du graphe ne sont pas des contraintes** — elles décrivent le chemin *nominal*, pas le chemin *autorisé*.

**À implémenter donc :**

- toute transition est **techniquement possible**, y compris hors arête ;
- suivre une arête = un clic ; s'en écarter = un clic **plus une confirmation** ;
- l'écart est **enregistré comme tel** dans l'événement (`followedNominalPath: false`), ce qui alimentera plus tard la statistique « écart au process ».

**À ne surtout pas implémenter** : un moteur de workflow qui *interdit* les transitions non déclarées. Ce serait rejeté sur le terrain dès la première semaine, et c'est un coût de développement pur perdu.

### 3.4 Ce que l'éditeur ne fait pas en tranche 1

- pas de configuration d'actions ni d'observations par étape (`q9_2_8` : la liste est globale, filtrée par pertinence de stade) ;
- pas de règles conditionnelles ni de formules ;
- pas d'édition collaborative (une seule personne édite — `q13_*`) ;
- pas de transition temporelle automatique (`q9_7_1` : le passage est visuel, validé par une personne).

---

## 4. Pilotage par un LLM — l'application comme surface programmable

Objectif : **tout ce qu'un humain peut faire dans l'interface, un LLM doit pouvoir le faire sans interface**, et le découvrir sans documentation externe.

L'absence d'authentification (`21` §6), qui est un coût côté sécurité, est ici un **avantage direct** : un agent n'a besoin que d'une URL de base sur le tailnet.

### 4.1 Les quatre surfaces

| Surface | Public | Rôle |
| --- | --- | --- |
| **Web** | cultivateur, iPhone | Saisie terrain, scan, éditeur graphique |
| **API HTTP/JSON** | tout | Source de vérité. OpenAPI 3.1 généré depuis Zod |
| **Serveur MCP** | Claude Code et agents | Outils typés, branchement direct |
| **CLI** | scripts, agents, humain | JSON in / JSON out, code de sortie fiable |

**Règle** : aucune opération n'existe dans une seule surface. Web, MCP et CLI appellent **la même API**, qui appelle **le même domaine**. Une fonctionnalité absente de l'API est une fonctionnalité qui n'existe pas.

### 4.2 Serveur MCP — le branchement natif

Package `@champi/mcp`, démarré avec l'application. Outils exposés :

```
champi_process_list          champi_unit_create           champi_harvest_record
champi_process_get           champi_unit_get              champi_product_create
champi_process_create        champi_unit_advance_step     champi_trace_upstream
champi_process_publish       champi_unit_observe          champi_trace_downstream
champi_process_diff          champi_unit_measure          champi_label_print
champi_room_list             champi_unit_move             champi_state_summary
champi_room_create           champi_unit_search           champi_audit_verify
```

Chaque outil : description explicite, schéma d'entrée Zod, exemples, et **erreurs actionnables**. Ainsi Claude Code pilote l'application sans écrire une ligne de HTTP.

### 4.3 Les sept propriétés qui rendent l'API réellement utilisable par un agent

1. **Découverte en un appel** — `GET /api/_discover` renvoie : opérations disponibles, état courant résumé (combien d'unités, à quels stades, quels process publiés), recettes des tâches courantes, et lien vers l'OpenAPI. Un agent qui arrive sans contexte sait quoi faire après **une** requête.
2. **Dry-run universel** — tout endpoint mutant accepte `?dryRun=true` et renvoie l'effet exact sans l'appliquer. Un agent vérifie avant d'agir. C'est aussi ce qui alimente la prévisualisation d'action de masse déjà spécifiée (`08` §20.2).
3. **Idempotence** — `Idempotency-Key` sur tout POST (`08` §2.1). Un agent qui réessaie ne crée pas de doublon. C'est la propriété qui rend un agent **sûr** sur un réseau instable.
4. **Erreurs actionnables** — jamais `{ code: "INVALID" }`. Toujours :
   ```json
   { "error": { "code": "STEP_NOT_IN_PROCESS",
                "message": "L'étape 'flush_4' n'existe pas dans la version v2 du process 'Pleurote standard'.",
                "hint": "Étapes disponibles : inoculation, incubation, fructification, flush_1, flush_2, flush_3, fin_de_cycle.",
                "docsUrl": "/api/docs#step-advance" } }
   ```
   L'indice contient **les valeurs valides**, pas seulement le constat d'échec.
5. **Identifiants lisibles** — `publicCode` (`SUB-2026-0042`) accepté partout où un `_id` l'est. Un agent, comme un humain, raisonne mieux sur `SUB-2026-0042` que sur `66b3f1e2a4c9...`.
6. **Réponses complètes** — une mutation renvoie l'objet résultant **et** l'événement créé. Pas de `204 No Content` obligeant à re-interroger.
7. **Pagination et filtres explicites** — curseurs stables, `?fields=` pour limiter la charge utile, jamais de troncature silencieuse.

### 4.4 Fichier `llms.txt`

Servi à la racine : présentation de l'application, du modèle métier (unité, stade, lignée, événement), et des cinq parcours principaux avec exemples d'appels. Un agent qui découvre l'application le lit et devient opérationnel immédiatement.

### 4.5 Tests dédiés à cette promesse

La promesse « 100 % pilotable par un LLM » est **testée**, pas seulement affirmée :

- **test de parité de surface** : toute opération de l'API a un outil MCP et une commande CLI correspondants. Il échoue dès qu'on ajoute une route sans l'exposer.
- **test de parcours agent** : un scénario E2E rejoue le parcours complet du §1 **uniquement via MCP**, sans ouvrir le navigateur. S'il passe, la promesse tient.

---

## 5. Modèle de données de la tranche

Collections construites en tranche 1 :

| Collection | Notes |
| --- | --- |
| `processTemplates`, `processVersions` | Version publiée immuable, `layout` séparé |
| `species` | Minimal : nom. L'espèce est configurable, pas de process par espèce en tranche 1 |
| `locations` | Chambre → étagère → niveau → position (`q10_2`) |
| `sources` | Objet distinct de l'unité (`21` §5) |
| `lots` | Unité de culture. `stage`, `processVersionId` épinglé, `substrateWeight`, `parentLotId` **nullable et inutilisé en tranche 1** |
| `events` | Journal immuable. `recordedBy` réservé, non peuplé (`21` §6) |
| `observations`, `measurements` | Avec photo ; photo **obligatoire** sur contamination (`q12_4`) |
| `harvests` | Poids en g par unité, qualité, `losses[] { weight, cause }` |
| `productBatches` | Origines pondérées (proportions exactes, `q14_5`) |
| `qrRegistry`, `printJobs` | Token opaque, réimpression du **même** token (`q17_5`) |
| `files` | Photos |
| `idempotencyKeys` | Clés + réponse d'origine |

Non construites : `alerts` (tranche 3), `inventoryMovements` (tranche 3). Jamais : `users`, `tasks` (`21` §3, §6).

---

## 6. Stratégie de test

### 6.1 Pyramide

| Niveau | Outil | Portée | Volume attendu |
| --- | --- | --- | --- |
| Unitaire pur | Vitest | `domain`, `contracts` | ~70 % des tests |
| Intégration | Vitest + MongoDB réel | `persistence`, `api` | ~20 % |
| Composant | Testing Library | `web` | ~7 % |
| E2E | Playwright | Parcours complets | ~3 % |
| Mutation | Stryker | `domain`, `contracts` | seuil 90 % |

**MongoDB réel, jamais de mock de base.** Un replica set Docker éphémère par exécution. Mocker la base fait passer des tests qui échouent en production — surtout avec des transactions.

### 6.2 E2E — les cinq scénarios obligatoires

1. **Parcours nominal complet** (§1, étapes 1→12) dans un navigateur desktop.
2. **Parcours mobile** — le même, en émulation iPhone, **scan de QR inclus** (caméra simulée avec une image de QR injectée).
3. **Parcours agent** — le même, **uniquement via MCP** (§4.5).
4. **Parcours dégradé** — coupure réseau au milieu d'une saisie, retry avec la même `Idempotency-Key` : vérifie qu'**aucun doublon** n'est créé et qu'aucun événement n'est perdu.
5. **Parcours d'audit de traçabilité** — voir §6.3.

### 6.3 Le test qui compte le plus : l'audit de traçabilité

C'est le test qui vérifie la **promesse du produit**, pas seulement le code.

```
Étant donné un produit final issu d'une unité ayant vécu un cycle complet :

1. remonter produit → récoltes → unité → événements ;
2. rejouer le journal d'événements depuis l'origine ;
3. ASSERTION : l'état reconstruit par rejeu === l'état courant en base ;
4. ASSERTION : chaque mutation d'état a produit exactement un événement ;
5. ASSERTION : aucun événement n'est orphelin ni ne référence une cible absente ;
6. ASSERTION : les proportions du mélange de récoltes totalisent 100 % ;
7. ASSERTION : la version de process appliquée est présente et cohérente
   sur l'unité et dans tous ses événements.
```

**Ceci résout P2-3** (`claude-critics.md` §4), qui reprochait au cadrage de promettre un historique « reconstructible depuis les événements » sans aucun mécanisme pour le garantir. Le mécanisme, c'est ce test — plus l'endpoint `GET /api/audit/verify` qui exécute les mêmes contrôles **en production**, à la demande.

### 6.4 Rapport d'audit automatisé

Produit à chaque exécution CI, publié en artefact HTML :

| Section | Contenu |
| --- | --- |
| Couverture | Par package, seuil 100 %, historique |
| Mutation | Score par package, mutants survivants listés |
| E2E | Les 5 scénarios, captures, traces Playwright |
| Traçabilité | Résultat des 7 assertions du §6.3 |
| Parité de surface | API ⇄ MCP ⇄ CLI : opérations manquantes |
| Accessibilité | axe-core sur chaque écran, contrastes mesurés |
| Performance | Temps de chargement fiche unité, mesurés **sur Raspberry Pi**, pas sur Mac |
| Contrat API | Diff OpenAPI vs version précédente, ruptures signalées |

Le point « performance mesurée sur Pi » répond à D11 (`claude-critics.md` §5) : les cibles de `12` §2 n'avaient jamais été reliées au matériel le plus faible.

---

## 7. Utilisabilité

### 7.1 Le cultivateur, en chambre

Contexte réel : **iPhone à une main, gants humides, 90 % d'humidité, lumière variable**.

- **Le scan est la navigation principale.** Bouton de scan permanent, accessible au pouce. Après scan : fiche unité en **moins de 2 secondes**.
- **Cibles tactiles de 44 px minimum**, espacées — utilisables avec des gants.
- **Actions les plus fréquentes en premier** : avancer d'étape, observer, peser. Les rares sont derrière un menu.
- **Liste d'actions unique**, filtrée par pertinence de stade (`q9_2_8`) — jamais « récolter » sur une gélose.
- **Saisie tolérante** : virgule et point acceptés pour les décimales, unité pré-remplie en grammes, dernière valeur suggérée.
- **Photo en deux touches**, obligatoire sur contamination (`q12_4`).
- **Aucun écran de connexion** — l'app s'ouvre sur le dashboard (`21` §6).

### 7.2 Réseau instable

`claude-critics.md` P2-7 signalait qu'une app *online-only* échoue précisément au moment de la saisie. Sans construire une PWA complète (hors MVP), la tranche 1 inclut le minimum vital :

- **file d'attente locale** pour les mutations : une saisie faite hors réseau est conservée et rejouée automatiquement, avec sa clé d'idempotence ;
- **indicateur d'état** franc : « enregistré » / « en attente d'envoi », jamais ambigu ;
- une saisie n'est **jamais perdue** parce que le Wi-Fi a lâché.

C'est ~2 jours de travail et cela supprime le principal mode d'abandon d'un outil de traçabilité terrain.

### 7.3 Accessibilité — le plancher retenu

**WCAG 2.2 niveau AA** vérifié automatiquement (axe-core dans le rapport d'audit), **plus** les critères AAA qui servent le contexte :

- **contraste 7:1** (critère AAA 1.4.6) — la chambre est lumineuse, l'écran est vu à travers un film de condensation ;
- **cibles de 44 px** (AAA 2.5.5) — gants ;
- navigation clavier complète, focus visible, labels explicites, `prefers-reduced-motion` respecté.

Ce n'est **pas** une conformité WCAG AAA formelle (elle impose d'autres critères sans objet ici). Si elle est visée, voir l'avertissement du §0.

---

## 8. Découpage et estimation

Unité : **jour-dev** = une journée de travail concentrée, un développeur expérimenté avec assistance LLM.

| # | Lot | Jours | Contenu |
| --- | --- | --- | --- |
| 1 | Socle | 3–4 | Monorepo Bun, TS strict, Docker Compose, replica set, CI, lint, hooks |
| 2 | Contrats + domaine | 7–9 | Zod, moteur de process pur, quantités, transitions, **tests à 100 % + mutation** |
| 3 | Persistance | 4–5 | Repos Mongo, transactions état+événement, migrations, tests d'intégration |
| 4 | API | 5–6 | Hono, OpenAPI, **idempotence + verrou optimiste**, erreurs actionnables, `/_discover` |
| 5 | QR + impression | 3–4 | Registre, `publicCode`, `printJobs`, Nimbot B21 (**déjà validée**) |
| 6 | Socle web | 5–6 | Vite/React, layout mobile, scanner web, file d'attente locale, a11y |
| 7 | Suivi d'unité | 5–6 | Fiche, timeline, avancement d'étape, observation, mesure, photo |
| 8 | Récolte → produit | 4–5 | Récolte pondérée, produit, traçabilité ascendante et descendante |
| 9 | **Éditeur graphique** | **11–15** | Canvas, propriétés, validation, publication, diff, import/export, modèle par défaut |
| 10 | MCP + CLI | 4–5 | Serveur MCP, CLI, parité de surface, `llms.txt` |
| 11 | E2E + audit | 7–9 | 5 scénarios, rapport d'audit, mutation à 90 %, perfs sur Pi |
| 12 | Intégration, mise en service | 4–5 | Déploiement Pi, sauvegardes, documentation, recette terrain |
| | **Total** | **62–78** | **≈ 13 à 16 semaines en solo** |

### 8.1 Ce que coûtent les exigences fortes

Information, pas objection — la décision reste la tienne :

| Exigence | Surcoût | Ce qu'on obtient |
| --- | --- | --- |
| **Éditeur graphique** (vs formulaire) | **+7 à 10 j** | Le cultivateur construit et modifie son process visuellement. Sans éditeur, l'app démarre vide et est inutilisable (`21`) — un formulaire suffirait techniquement, le canvas est un choix de confort |
| **100 % couverture + mutation** | **+9 à 12 j** | Régression quasi impossible sur le métier. Contrainte d'architecture saine. Le coût est réel mais **décroissant** : il se paie surtout sur les lots 2-4 |
| **MCP + CLI + parité** | **+4 à 5 j** | L'application devient pilotable par Claude Code. Sert aussi aux tests, à la reprise de données et au support |
| **E2E + rapport d'audit** | **+5 à 6 j** | Preuve automatisée que la traçabilité tient. C'est aussi le mécanisme qui manquait à P2-3 |

Sans ces quatre exigences, la même tranche fonctionnelle coûterait ≈ **35 à 45 jours**. L'écart est le prix de la qualité demandée — il est justifié pour un outil de production destiné à durer, il ne le serait pas pour une démo.

### 8.2 Ordre recommandé

Lots **1 → 2 → 3 → 4** d'abord (le socle testé), puis **5 → 6 → 7 → 8** (le parcours visible), puis **9** (l'éditeur), **10** en parallèle possible, **11 → 12** en clôture.

L'éditeur graphique arrive **après** le parcours de suivi, volontairement : il consomme l'API du moteur de process, qui doit être stable avant qu'on construise une interface dessus. Le modèle par défaut de `20` sert de process de travail en attendant.

---

## 9. Risques restants

| Risque | Sévérité | Traitement |
| --- | --- | --- |
| L'éditeur graphique déborde | 🟠 | Périmètre §3.4 tenu strictement. Le canvas n'invente aucune capacité absente de l'API |
| Scanner QR iOS via `tailscale serve` | 🟡 | Spike au lot 6, avant de construire le socle web. Repli documenté : URL dans le QR |
| Compatibilité Bun (driver Mongo, Vitest, BLE) | 🟡 | Vérifié au lot 1. `printing` isolable en process Node |
| Perfs sur Raspberry Pi | 🟡 | Mesurées en CI dès le lot 4, pas à la fin |
| Mise en service : tout est vide | 🟠 | Modèle de process pré-rempli (`20`) proposé au premier lancement. C'est le risque n°1 d'abandon |
| Stockage photos sur carte SD | 🟡 | SSD USB en prod, compression, rétention, alerte disque (P2-8) |

---

## 10. Après la tranche 1

| Tranche | Contenu | Estimation indicative |
| --- | --- | --- |
| **2 — Lignée** | Clone, transfert, division, stades amont en UI, arbre généalogique, actions de masse, conservation/archivage | 20–28 j |
| **3 — Pilotage** | Alertes et alarmes de durée, notifications téléphone, dashboards, rapports, exports CSV, stock | 15–20 j |
| **4 — Matériel** | Inkbird, Reolink, PWA complète | hors MVP |

La tranche 2 est **une multiplication du chemin de la tranche 1**, pas une nouvelle couche technique : c'est exactement ce que garantit la coupe du §1.1.
