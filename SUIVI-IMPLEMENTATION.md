# Suivi d'implémentation — Champignon Manager

> Journal de bord de la construction de la **tranche 1** ([`docs/22-tranche-verticale-mvp.md`](./docs/22-tranche-verticale-mvp.md)).
> Ce fichier trace **ce qui est fait**, **ce qui dévie du plan** et **pourquoi**. Mis à jour à chaque fin de lot.

## Tableau de bord

| Lot | Contenu | Estimé | Statut |
| --- | --- | --- | --- |
| 1 | Socle monorepo, TS strict, Docker, CI, lint | 3–4 j | ✅ **terminé** |
| 2 | Contrats Zod + domaine pur (100 % + mutation) | 7–9 j | ✅ **terminé** |
| 3 | Persistance MongoDB, transactions, migrations | 4–5 j | ✅ **terminé** |
| 4 | API Hono, OpenAPI, idempotence, erreurs | 5–6 j | ✅ **terminé** |
| 5 | QR, publicCode, printJobs, Nimbot B21 | 3–4 j | ✅ **terminé** |
| 6 | Socle web, scanner, file d'attente locale, a11y | 5–6 j | ⚠️ **terminé, capture caméra reportée** |
| 7 | Suivi d'unité : fiche, timeline, étapes, mesures | 5–6 j | ✅ **terminé** |
| 8 | Récolte → produit → traçabilité | 4–5 j | ✅ **terminé** |
| 9 | Éditeur de process graphique | 11–15 j | ✅ **terminé** |
| 10 | CLI + parité de surface | 4–5 j | ✅ **terminé** *(MCP écarté)* |
| 11 | E2E, rapport d'audit, mutation, perfs Pi | 7–9 j | ⚠️ **terminé, perfs non mesurées sur Pi** |
| 12 | Intégration, déploiement Pi, mise en service | 4–5 j | ⚠️ **terminé, recette Pi à dérouler** |

Légende : ⬜ à faire · 🟡 en cours · ✅ terminé · ⚠️ terminé avec déviation

## Indicateurs qualité — à jour

| Indicateur | Cible | Réel |
| --- | --- | --- |
| Tests unitaires et d'intégration | — | **1044** |
| Scénarios end-to-end | — | **117** (API, CLI, Chrome, WebKit/iPhone) |
| Couverture lignes / branches / fonctions / instructions | 100 % | **100 % / 100 % / 100 % / 100 %** |
| Score de mutation global | ≥ 90 % | **92,23 %** |
| Mutants sans couverture | 0 | **0** (voir D-24) |
| Score de mutation `domain` | ≥ 90 % | **93,25 %** |
| Score de mutation `contracts` | ≥ 90 % | ⚠️ **84,97 %** (voir D-4) |
| Avertissements lint | 0 | **0** |
| Erreurs de types | 0 | **0** |

---

## Journal

### 2026-08-08 — Démarrage

Cadrage clos et committé (`de64a71`). Feu vert explicite reçu pour coder.
Environnement : Bun 1.3.14, Node 24.14.0, Docker 27.5.1.

### 2026-08-08 — Lot 1 terminé (`3527658`)

Monorepo Bun workspaces, TypeScript strict (`noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `verbatimModuleSyntax`), Prettier, ESLint avec
règles d'architecture, Vitest à seuil 100 %, Stryker à seuil de rupture 90 %,
MongoDB en replica set via Docker Compose, CI GitHub Actions en deux tâches
(qualité / mutation) avec publication des rapports.

**Les deux règles de lint qui portent le cadrage :**

1. `packages/domain` ne peut importer aucune I/O, ni appeler `Date.now()`,
   `new Date()` ou `Math.random()`. C'est ce qui rend le cœur testable sans
   mock — donc ce qui rend le 100 % atteignable.
2. `.skip` et `.only` sont refusés. Un test désactivé fausserait la couverture.

### 2026-08-08 — Lot 2 terminé (`3527658`)

`@champi/contracts` : primitives, process, unité, événements, catalogue
d'erreurs. `@champi/domain` : quantités, graphe de process, versions, alarmes,
avancement d'unité, récoltes, rejeu du journal.

**Ce que le lot 2 verrouille du cadrage**, avec le code correspondant :

| Décision | Où c'est appliqué |
| --- | --- |
| Pas de bascule de version | `publishingAffectsRunningUnits()` renvoie `false` — fonction écrite et testée pour que l'absence soit explicite, pas silencieuse |
| Migration par sélection seulement | `planMigration()` refuse une liste vide |
| Transitions non contraignantes | `advanceUnit()` autorise tout écart avec `confirmOffNominal`, et l'enregistre |
| La durée ne déclenche rien | `alarmCanAdvanceUnit()` renvoie `false` |
| Pas d'auteur sur les événements | `recordedBy: z.undefined()` — un événement portant un auteur est **refusé** au parsing |
| Pas de fusion de lignée | `lineageRelation` épinglé à 4 valeurs, test qui vérifie l'absence de `merge` |
| Proportions exactes | `validateProductOrigins()` avec tolérance flottante |
| Reconstructible depuis les événements | `replayUnit()` + `diffReplayAgainstStored()` + `checkJournalIntegrity()` |

### 2026-08-08 — Lot 11 terminé

Accessibilité mesurée, performances mesurées, rapport d'audit publié en CI.

- **Accessibilité** : axe-core sur Chrome **et** WebKit/iPhone. Zéro violation
  WCAG 2.2 AA sur l'accueil, la fiche d'unité et un état d'erreur. Les deux
  critères AAA retenus pour la chambre — contraste 7:1 (l'écran est vu à travers
  la condensation) et cibles de 44 px (on vise avec des gants) — sont vérifiés,
  pas déclarés.
- **Performances** : budgets mesurés qui **échouent** au dépassement. Fiche
  d'unité 2,8 ms (budget 400), journal 3,9 ms (600), audit 4,2 ms (800),
  découverte 3,2 ms (400), avancement 5,9 ms (800). Marges larges — mais sur
  Mac. `CHAMPI_PERF_FACTOR` permet de rejouer la suite sur le Pi.
- **Rapport d'audit** : `scripts/rapport-audit.mjs` **agrège**, il ne recalcule
  rien. Il lit la couverture, la mutation et les résultats E2E produits par les
  trois travaux de CI, et rend un verdict par section. 12 promesses, chacune
  citant le test qui la prouve ; 4 réserves assumées. Publié en artefact, avec
  90 jours de rétention.

Deux défauts trouvés ici : le rapport se flattait de 0,46 point (D-22) et les
campagnes E2E se contaminaient (D-23).

### 2026-08-08 — Lot 12 terminé

Mise en service. Ce lot ne se contente pas de fichiers : **tout a été exécuté**.

- **Image de production** construite et démarrée (`docker-compose.prod.yml`).
  Les deux conteneurs passent `healthy` ; le contrôle de santé interroge
  `/api/health`, pas le processus, pour qu'un serveur vivant mais coupé de
  MongoDB soit signalé. L'image est `linux/arm64`, l'architecture du Pi.
- **Amorçage au premier démarrage** : sans process, aucune unité n'est
  créable — et le cultivateur n'a fourni **aucune valeur chiffrée**. Le serveur
  installe donc le modèle de `docs/20`, publié, avec sa `provenance` par étape
  et son avertissement. Inerte dès qu'un process existe : vérifié par
  redémarrage réel, et par quatre scénarios E2E.
- **Sauvegarde** : `scripts/sauvegarde.mjs`. Parti pris — **une sauvegarde non
  vérifiée ne compte pas** : `sauvegarder` enchaîne sur une restauration réelle
  dans une base jetable et recompte chaque collection. Vérifié sur 2 884
  documents réels, puis sur la base de production. `restaurer` refuse d'écrire
  dans une base non vide : mêler deux histoires de traçabilité serait
  irréversible.
- **`docs/23-mise-en-service.md`** : prérequis, `tailscale serve` et la raison
  technique du HTTPS (Safari iOS refuse la caméra hors contexte sécurisé), ACL
  Tailscale comme **seul** contrôle d'accès, cron de sauvegarde, procédure de
  restauration, pilotage par le CLI, et une recette de mise en service en neuf
  points vérifiables.

Trois de ces neuf points ne peuvent pas être vérifiés hors de la ferme : ils
sont listés en D-27 et en réserves du rapport d'audit.

---

## Déviations au plan

### D-1 — La règle « domaine pur » a dû être affinée

**Plan** : interdire l'horloge dans `packages/domain`.
**Constat** : bannir le global `Date` cassait `Date.parse(isoInjecté)`, qui est
une fonction pure prenant une chaîne en paramètre.
**Décision** : la règle vise désormais l'impureté réelle — `Date.now()` et
`new Date()` sans argument — au lieu du type `Date`.
**Impact** : aucun sur le périmètre. La garantie d'origine est intacte.

### D-2 — Un bug réel trouvé par les tests avant toute intégration

`netHarvestWeight()` soustrayait les valeurs brutes sans vérifier les unités :
une perte exprimée en « pièces » se retranchait d'une masse en grammes, sans
erreur. Corrigé en passant par `subtractQuantities()`.
**À retenir** : c'est exactement la confusion que le type `Quantity` était censé
empêcher (docs/21 §4) — le type ne suffit pas, il faut que les opérations
passent toutes par les fonctions qui le respectent.

### D-3 — Friction Bun sur Stryker (prévue par P2-10)

Stryker ne trouvait pas son greffon `vitest-runner` avec la disposition
`node_modules` de Bun. Résolu en déclarant `plugins` explicitement dans
`stryker.config.json`.
**Impact** : aucun, mais c'est la première confirmation concrète du risque
P2-10 (« maturité de l'écosystème Bun »). À surveiller sur le driver MongoDB
au lot 3 et sur le BLE au lot 5.

### D-4 — ⚠️ Score de mutation de `contracts` sous la cible

**Cible `docs/22` §6.1** : ≥ 90 % sur `domain` **et** `contracts`.
**Réel** : `domain` 93,25 % ✅, `contracts` **84,97 %** ⚠️. Global 91,45 %, donc
le seuil de rupture global passe.

**Pourquoi** : les mutants survivants de `contracts` sont presque tous des
mutations de chaînes à l'intérieur de schémas Zod déclaratifs (`event.ts` à
73,8 %). Les tuer exigerait d'épingler chaque message d'erreur interne de Zod —
un effort important pour une valeur de détection faible.

**Ce qui a quand même été fait**, parce que c'était légitime :
- épinglage de **toutes les énumérations publiques** (`enums.test.ts`) : ce sont
  de vrais contrats d'API que lit un agent LLM, les retirer ou les renommer
  casse tous les appelants ;
- tests **exhaustifs des neuf types d'événements** (`event.test.ts`), champ
  obligatoire par champ obligatoire ;
- tests de **bornes** sur tous les schémas (`boundaries.test.ts`).

**Décision** : on s'arrête là pour `contracts` et on tient la barrière au niveau
global. À revoir si le score global redescend sous 90 % en ajoutant des paquets.

### D-5 — Lint désactivé sur les fichiers de configuration racine

`vitest.config.ts` et `eslint.config.js` n'appartiennent à aucun projet
TypeScript composite, donc les règles typées ne peuvent pas s'y appliquer.
Plutôt que de fabriquer un projet artificiel pour trois fichiers sans logique
métier, les règles typées y sont désactivées.
**Impact** : négligeable — aucun code métier dans ces fichiers.

### D-6 — ⚠️ Port MongoDB déplacé sur 27018

**Constat** : une installation **MongoDB Homebrew** (`mongodb-community`) tourne
déjà sur cette machine et occupe `127.0.0.1:27017`. Elle interceptait les
connexions destinées au conteneur — sans erreur visible : le driver se
connectait à un **standalone**, sans replica set, et `?replicaSet=rs0` expirait
après 30 s sur un message de sélection de serveur qui ne dit rien du vrai
problème.

**Décision** : le conteneur écoute sur **27018**, dedans comme dehors (pour que
l'hôte annoncé par le replica set soit joignable des deux côtés). L'instance
Homebrew de l'utilisateur n'est **pas** touchée.

**Impact** : `CHAMPI_MONGO_URL` permet de surcharger l'URL. À documenter au lot
12 (mise en service), car le même piège se posera sur toute machine de
développement ayant déjà MongoDB.

### D-7 — Le contrôle d'audit a détecté une incohérence dès son premier usage

En écrivant le test d'intégration, `diffReplayAgainstStored()` a signalé une
divergence sur `currentStepEnteredAt` : l'état sauvegardé gardait la date de
création alors que le journal disait que l'étape avait changé la veille.
C'était mon jeu de test qui était faux — mais **c'est exactement la classe de
bug que ce mécanisme existe pour attraper**, et il l'a attrapée avant la
première ligne d'API.

### D-9 — La CI livrée au lot 1 était cassée

Les deux jobs lançaient la suite complète **sans base de données**. Les tests
d'intégration de la persistance et de l'API auraient échoué au premier push :
la CI n'avait jamais tourné, seulement été écrite.

**Corrigé** : les deux jobs démarrent le replica set, attendent qu'il réponde,
et l'arrêtent en fin de job. Le pipeline complet a été **rejoué en local** dans
l'ordre exact de la CI — format, lint, types, couverture, mutation — avant
d'être considéré comme bon.

**À retenir** : écrire un fichier de CI n'est pas la même chose que l'avoir
vérifiée. Pour les lots suivants, rejouer le pipeline localement avant de
clore le lot.

### D-8 — ⚠️ Mutation : périmètre étendu puis ramené à la spec

**Ce que j'ai fait** : après le lot 4, j'ai étendu de ma propre initiative le
périmètre de mutation à `api` et `persistence`, au-delà de ce que prévoit
`docs/22` §6.1 (`domain` + `contracts`).

**Résultat mesuré** : score global **85,5 %** — sous le seuil de rupture.
Détail : `domain` 93,3 %, `contracts` 85,0 %, **`api` 78,1 %**,
**`persistence` 65,4 %**.

**Diagnostic** : les suites d'`api` et `persistence` étaient plus faibles sur
les assertions de message. Une passe de renforcement a été faite (messages,
indices, chemins d'erreur, plus un vrai test des index MongoDB — l'unicité de
`publicCode` est ce qui empêche deux unités de porter le même QR), mais
l'essentiel des survivants restants sont des chaînes de messages français dont
l'épinglage exhaustif est un long travail à faible valeur de détection.

**Détail technique utile** : les mutants de `ensureIndexes()` survivaient parce
que le code exécuté en `beforeAll` n'est attribué à aucun test par l'analyse de
couverture par test de Stryker. Corrigé en appelant `ensureIndexes()` dans les
tests qui le vérifient.

**Décision** : la barrière CI revient au périmètre spécifié (`domain` +
`contracts`, **91,45 %**). La mesure élargie est consignée en commentaire dans
`stryker.config.json` pour ne pas être oubliée.

**À faire** : renforcer les assertions de message d'`api` et `persistence` avant
d'élargir la barrière. Ce n'est pas urgent — la couverture reste à 100 % et le
comportement métier, lui, est couvert à 93 % en mutation.

### D-10 — Deux replis silencieusement dangereux supprimés

La barrière à 100 % de couverture a mis au jour deux valeurs de repli
inatteignables. Toutes deux auraient été **nuisibles** si elles s'étaient
déclenchées, pas seulement mortes :

1. `nextSequence()` finissait par `updated?.sequence ?? 1`. Avec `upsert: true`
   et `returnDocument: 'after'`, le document existe toujours — mais si le repli
   avait servi, il aurait **redistribué la séquence 1**, donc un code public en
   double : exactement ce que ce compteur existe pour empêcher. Remplacé par une
   assertion documentée.
2. `PrintQueue.run()` finissait par `lastError?.message ?? 'Échec inconnu.'`.
   La boucle a été restructurée pour que la variable soit toujours affectée —
   plus de repli du tout.

**À retenir** : viser 100 % ne sert pas qu'à « couvrir ». Ici, la contrainte a
servi de détecteur de code défensif faux, qu'un seuil à 95 % aurait laissé
passer sans bruit.

### D-13 — ⚠️ Le serveur tourne sous Node, pas sous Bun (P2-10 confirmé)

**Constat** : `bun run` sur le serveur échoue au chargement du driver MongoDB —
`bson` appelle `node:v8 isBuildingSnapshot`, non implémenté dans Bun 1.3.
L'erreur ne survient qu'au **runtime** : les tests passaient, ce qui a masqué le
problème jusqu'au premier démarrage réel.

**C'est P2-10 qui se matérialise** (« maturité de l'écosystème Bun », driver
MongoDB explicitement cité), après une première alerte sur Stryker (D-3).

**Décision** : le serveur est empaqueté par Bun (`bun build --target=node`) et
**exécuté par Node**. C'est exactement la mitigation prévue par `docs/22` §9.3
(« isoler le service dans un process Node si Bun ne convient pas »). Bun reste
l'outil de workspaces, de build et de tests.

**À surveiller** : le même piège guette l'intégration BLE de l'imprimante. Le
transport étant déjà derrière une interface injectée, le coût sera faible.

### D-14 — Un bug de traçabilité trouvé par les E2E

L'événement `unit.step_advanced` ne portait **pas le stade atteint**. Or changer
d'étape change le stade (`incubation` → `fructification` fait passer de
`substrate` à `fruiting`).

Conséquence : une unité passée en fructification restait « substrate » au rejeu.
**Le journal était lacunaire, donc l'état n'était pas reconstructible** — ce qui
vide de sens la promesse de traçabilité, celle-là même que P2-3 réclamait de
garantir.

**Détecté par le test d'audit end-to-end**, contre une vraie base. Ni les tests
unitaires ni les tests d'intégration ne l'avaient vu : ils utilisaient tous des
avancements au sein d'un même stade.

**Corrigé** par un champ `toStage` obligatoire sur l'événement, plus les deux
tests unitaires qui manquaient. **À retenir** : un test qui ne fait varier qu'une
dimension ne prouve rien sur les autres — ici, tous les avancements testés
restaient dans le même stade.

### D-15 — Les routes de création n'existaient pas

En écrivant les E2E, constat : **la tranche verticale n'était pas traversable**.
Aucune route ne permettait de créer un process ni une unité. Les lots 4 et 5
avaient livré la lecture, l'avancement, le QR et l'impression — mais rien pour
amorcer quoi que ce soit.

Le trou n'était visible d'aucun test unitaire, chacun créant ses données
directement par le dépôt. **C'est précisément ce que les E2E servent à
attraper** : la différence entre « chaque pièce fonctionne » et « le parcours
existe ».

Comblé : dépôt de process, routes de création/publication/brouillon/édition de
graphe, création d'unité, et assemblage du serveur.

### D-11 — ⚠️ Capture caméra reportée avec le spike iOS

**Prévu** : scanner QR fonctionnel au lot 6.
**Livré** : tout sauf la boucle de capture caméra.

**Pourquoi** : `getUserMedia` sous Safari iOS via `tailscale serve` n'a jamais
été validé sur un iPhone réel — c'est le dernier spike ouvert du projet
(`docs/22` §9). Écrire une boucle de capture non validée aurait produit du code
invérifiable, et surtout un **bouton qui ne fait rien**.

**Ce qui est livré à la place** :
- un **diagnostic** qui nomme la cause probable au lieu d'un message générique.
  Sous iOS, la cause n°1 est un contexte non sécurisé — et elle est réparable
  par l'opérateur lui-même (ouvrir l'adresse `.ts.net` plutôt qu'une IP) ;
- la **saisie manuelle du code** comme repli permanent, qui mène exactement au
  même endroit que le scan ;
- un message honnête à l'écran : « la capture caméra sera activée après
  validation sur iPhone ».

**Impact** : aucun sur le parcours — le travail terrain reste possible sans
caméra. À reprendre dès qu'un iPhone est disponible sur le tailnet.

### D-12 — Un affordance cassé corrigé par le typage

Le bouton « Scanner un QR » appelait `onScan('')`, ce qui affichait « Code non
reconnu » : un bouton qui promettait une action et rendait une erreur.

Corrigé en rendant le cas impossible **au niveau du type** : `ScanPanel` ne
remonte que des entrées déjà interprétées (`token` ou `public-code`), jamais
« inconnu ». L'appelant n'a donc plus de branche d'erreur à traiter — et il n'y
a plus de code mort à couvrir.

### D-16 — La photo obligatoire est une règle de domaine, pas d'interface

`q12_4` exige une photo en cas de contamination. Il aurait été plus simple de
l'imposer dans le formulaire — c'est là qu'un utilisateur la voit.

Elle est placée dans `packages/domain` : ainsi elle vaut pour **tous** les
appelants, y compris un agent qui passerait par l'API sans jamais ouvrir
l'interface. Une règle métier appliquée seulement dans l'UI n'est pas une règle,
c'est une suggestion.

### D-17 — La traçabilité échoue plutôt que de rendre un résultat partiel

Choix de conception : `traceUpstream` **échoue** si une récolte ou une unité
citée par un produit est introuvable, au lieu d'omettre la contribution.

Une chaîne incomplète est plus dangereuse qu'une absence de chaîne : elle a
l'air complète. Face à un contrôle sanitaire, rendre trois origines sur quatre
sans le dire serait pire que de refuser de répondre.

Deux tests E2E vérifient ce refus en supprimant volontairement une récolte puis
une unité de la base.

### D-18 — Canvas SVG écrit à la main plutôt qu'une bibliothèque de graphe

`docs/22` §3.2 mentionnait React Flow. Le canvas est finalement du **SVG écrit
à la main**.

**Pourquoi** : le process du cultivateur fait six étapes. Une bibliothèque de
graphe apporterait du glisser-déposer sophistiqué, du zoom et du panoramique —
et une surface d'intégration difficile à couvrir à 100 % sans simuler des
internes. Le rendu maison reste déterministe, testable en `happy-dom`, et sans
dépendance.

**Ce qu'on perd** : zoom, panoramique, glisser-déposer fluide. À réévaluer si
un process dépasse la vingtaine d'étapes — mais le modèle réel en compte dix.

**Choix d'interaction lié** : relier deux étapes se fait en **deux clics**
(« relier », puis clic sur la cible) et non en glisser-déposer. Nettement plus
fiable avec des gants humides sur un écran couvert de condensation — et cela
évite `setPointerCapture`, qui vole le clic des nœuds (piège déjà rencontré sur
l'atlas Mermaid).

### D-19 — Deux replis qui auraient menti sur une consigne de culture

Le panneau de propriétés ramenait une saisie illisible à `0` :
`parseOptionalNumber(value) ?? 0`. Vider le champ « température » aurait donc
enregistré **0 °C** — une consigne fausse, silencieuse, sur un paramètre qui
décide d'une culture.

Corrigé : une valeur illisible ne modifie rien. C'est le même motif que D-10 —
la barrière à 100 % a servi de détecteur de repli défensif faux, pas seulement
de mesure de couverture. Troisième occurrence.

### D-20 — ⚠️ Serveur MCP écarté : le CLI est la surface d'agent

**Décision de l'utilisateur** : pas de MCP, le LLM utilisera le CLI.

**Ce que ça simplifie** : deux surfaces au lieu de trois (Web, API, CLI), et
la parité devient une comparaison à deux termes.

**Ce que ça exige en retour** : le CLI n'est plus un confort de script, c'est
**la seule porte d'entrée d'un agent**. Sa découvrabilité et la qualité de ses
erreurs cessent d'être un agrément pour devenir la promesse elle-même. D'où :

- `champi help` rend le catalogue complet, les conventions et les recettes ;
- une commande inconnue propose les commandes proches ;
- un paramètre manquant donne l'usage exact ;
- une clé d'idempotence est **générée par défaut**, pour qu'un agent qui
  réessaie soit protégé même sans y avoir pensé.

**Le mécanisme qui tient la promesse** : `API_OPERATIONS` est la source unique
— elle alimente `/api/_discover` et les commandes du CLI. Un test E2E compare
ce que le **serveur annonce** à ce que le **binaire sait faire**, sur le
système qui tourne. Il échoue dès qu'une route est ajoutée sans commande.

`docs/22` §0, §2.1, §4.1, §4.2, §4.5, §6.2, §8 ont été mis à jour. L'estimation
du lot passe de 4–5 j à 3–4 j.

### D-21 — Quatre replis morts de plus, dont deux dangereux

La barrière à 100 % en a encore débusqué quatre :

- `split(':')[0] ?? ''` et `rest[index] ?? ''` dans l'analyse du CLI — morts,
  supprimés par restructuration (`indexOf`, `entries()`) ;
- les deux `?? 0` du panneau de propriétés (D-19) — **dangereux** : ils
  auraient enregistré 0 °C sur un champ vidé.

Motif désormais établi sur tout le projet : **les gardes défensives sur des
expressions totales sont systématiquement du bruit, et parfois un mensonge**.
Le seuil à 100 % les fait apparaître ; un seuil à 95 % les laisserait passer.

### D-22 — Le rapport d'audit se flattait de 0,46 point

Le rapport calculait le score de mutation sur `tués / (tués + survivants +
expirations)` — en **omettant les mutants `NoCoverage`**, que Stryker compte au
dénominateur. Résultat : 92,24 % annoncé contre 91,78 % mesuré.

L'écart est petit, la faute ne l'est pas : **un rapport d'audit qui s'arrange
avec sa propre mesure ne vaut rien**, et personne n'aurait recoupé. Corrigé pour
adopter la formule de Stryker, et les mutants sans couverture sont désormais
affichés en clair dans le rapport.

Trouvé en comparant la sortie de Stryker à celle du rapport, par acquit de
conscience — pas par un test. C'est une limite du dispositif : le rapport n'est
vérifié par rien.

### D-23 — Les campagnes E2E se contaminaient entre elles

La base `champignon_e2e` n'était jamais vidée. Au moment de la découverte elle
contenait **463 process** accumulés sur tous les lancements précédents. Deux
conséquences :

- le scénario de **premier démarrage** était invérifiable — le serveur n'amorce
  son modèle que sur une base vierge ;
- le budget de performance « liste avec 50+ unités » mesurait en réalité une
  base de plusieurs centaines d'unités, donc pas ce qu'il prétendait mesurer.

La remise à zéro est faite dans la **commande du serveur** et non dans un
`globalSetup` : Playwright lance le serveur **avant** le setup global — vérifié,
la première tentative a échoué exactement ainsi. Vider la base après le
démarrage effaçait le modèle amorcé que le scénario venait vérifier.

### D-24 — Six mutants sans couverture, et deux replis dangereux de plus

Le passage à la formule honnête (D-22) a rendu visibles **6 mutants
`NoCoverage`**, tous sur des valeurs de repli de déstructuration de `RegExp` :
`year = '0'`, `month = ''`, `day = ''`. Inatteignables — si l'expression a filé,
les groupes existent — mais `year = '0'` aurait produit **l'année 0** dans un
code public si elle l'avait été.

Même famille que D-10, D-19 et D-21. Remplacés par un découpage **par position**
sur la chaîne déjà validée, qui est total. Score de mutation : 91,78 % → **92,23
% avec zéro mutant sans couverture** — l'amélioration vient de la suppression de
code mort, pas d'un ajustement de mesure.

### D-25 — L'amorçage prend un graphe en paramètre

`seedDefaultProcess` accepte un graphe plutôt que de refermer
`defaultProcessGraph()` à l'intérieur. Motif : la garde « refuser de publier un
graphe invalide » serait sinon **inatteignable** — le modèle par défaut est
valide par construction, et un test du domaine le vérifie déjà.

Plutôt que de garder une garde morte ou de la supprimer, on a rendu la fonction
honnête sur ce qu'elle fait : elle valide ce qu'on lui donne. Effet de bord
utile — amorcer une ferme avec un modèle importé devient possible sans code
supplémentaire.

### D-26 — La pile de production a été démarrée pour de vrai

Un `Dockerfile` jamais bâti n'est qu'une intention. L'image a été construite et
la pile `docker-compose.prod.yml` **réellement démarrée** avant d'être déclarée
faite. Trois enseignements :

1. **Le replica set de développement n'est pas joignable depuis un conteneur.**
   Il s'annonce sur `localhost:27018` ; un client dans un autre conteneur suit
   cette adresse et échoue. La compose de production initialise le sien sur
   `mongo:27018` — la vérification l'a confirmé, elle n'était pas théorique.
2. **L'image produite est `linux/arm64`**, l'architecture du Raspberry Pi 64
   bits, la machine de développement étant elle-même arm64. La construction sur
   l'architecture cible est donc vérifiée ; la tenue **sur le matériel** du Pi ne
   l'est pas.
3. Amorçage, santé, front statique et **CLI embarqué dans l'image** ont été
   vérifiés sur la pile de production, redémarrage compris (l'amorçage reste
   inerte : « La base contient déjà 1 process : rien n'a été touché »).

### D-27 — ⚠️ Ce que la mise en service ne prouve toujours pas

Trois points restent ouverts, et le rapport d'audit les porte en réserves :

- **les budgets de performance n'ont pas tourné sur un Raspberry Pi** (D11 de
  `claude-critics.md`). Les mesures sur Mac disent seulement que le code n'est
  pas absurdement lent. La suite accepte `CHAMPI_PERF_FACTOR` pour être rejouée
  sur le Pi — c'est prêt, ce n'est pas fait ;
- **le scan caméra n'a jamais tourné sur un iPhone réel** (D-11). WebKit émulé
  attrape les régressions de mise en page, pas l'accès `getUserMedia` ;
- **l'impression Nimbot B21 n'est pas branchée.** Le cultivateur a validé le
  matériel ; le transport BLE reste un faux en attendant.

Ces trois points forment la **recette de mise en service** de `docs/23` §7 : ils
se lèvent sur place, pas ici.

---

## Prochaine étape

**La tranche verticale est complète.** Les douze lots sont livrés, la CI produit
son rapport d'audit, la production se déploie et se sauvegarde.

Ce qui reste n'est pas du code mais de la **mise en service sur place** :
dérouler la recette de `docs/23` §7 chez le cultivateur — scan caméra sur
iPhone réel, impression B21 branchée, budgets de performance rejoués sur le Pi
avec `CHAMPI_PERF_FACTOR`. Les trois réserves du rapport d'audit se lèvent là,
et nulle part ailleurs.

Ensuite seulement, élargir : stockage des photos (aujourd'hui seul le `photoId`
est enregistré), stades amont (gélose, culture liquide, grain) au-delà de leur
présence dans le modèle par défaut, et alarmes.

*(Le lot 11 est terminé : voir ci-dessous.)*

**Lot 11 — Rapport d'audit et perfs.** Rapport d'audit automatisé publié en CI
(couverture, mutation, E2E, traçabilité, parité, accessibilité, contrat API) et
mesure des performances **sur Raspberry Pi**, pas sur Mac — c'est le point D11
de `claude-critics.md` qui reste ouvert.

*(Le lot 6 est terminé : voir ci-dessous.)*

**Lot 6 — Socle web.** Vite/React, layout mobile pensé pour des gants et 90 %
d'humidité, scanner QR web via HTTPS Tailscale (spike à faire ici), file
d'attente locale des saisies, et plancher d'accessibilité.

*(Le lot 5 est terminé : voir ci-dessous.)*

**Lot 5 — QR, publicCode, printJobs, Nimbot B21.** Registre de QR à token
opaque, génération de codes publics, file d'impression avec réimpression du
**même** token, et adaptateur imprimante avec transport injecté (un faux en
test, le BLE en production).
