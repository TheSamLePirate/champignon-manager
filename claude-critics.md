# Claude — Analyse critique du cadrage `champignon-manager`

> Revue indépendante de l'ensemble du dossier `docs/` (00 → 18 + questionnaire cultivateur + réponses dev JSON).
> Objectif : pointer les angles morts, contradictions et risques **avant** d'écrire du code, pendant que c'est encore gratuit de les corriger.
> Date : 2026-06-17. Aucun code n'est jugé ici — uniquement le cadrage.

---

## 0. Verdict global

Le dossier est **sérieux, bien structuré et au-dessus de la moyenne** pour un cadrage : séparation claire des préoccupations, modèle événementiel/audit cohérent, glossaire métier explicite, périmètre « hors MVP » assumé, traçabilité bidirectionnelle pensée, et surtout un **questionnaire cultivateur** qui est exactement la bonne démarche.

Mais il y a un problème de fond qui domine tout le reste :

> **Le MVP entier est déclaré « dépendant des réponses du cultivateur » (vocabulaire, phases, étapes, actions, observations, produits, étiquettes, chambres), et ces réponses n'existent pas.** Le questionnaire `15` est **vierge** — 100 % des blocs de réponse sont vides. Pourtant les décisions figent déjà un périmètre très lourd (« éditeur de process complet au MVP », « process complet construit à partir des réponses cultivateur »).

> **Mise à jour 2026-06-17 :** le cultivateur (Julien) a commencé à répondre et a **élargi le domaine** : la traçabilité ne part pas du substrat mais de toute la chaîne amont **gélose → culture liquide (LC) → grain → substrat** (« du spore à l'assiette »), avec à chaque stade un **clone** (culture secondaire) et un **transfert** (stade suivant). Bonne nouvelle (le métier se précise) mais cela **agrandit le périmètre** et **confirme P0-3** : l'entité tracée doit être une « unité de culture » multi-stade à lignée typée. Intégré dans 00/01/03/05/07 + formulaire 16.

On construit donc le toit avant les fondations métier. La deuxième tension de fond est un **décalage d'échelle** : ce qui est appelé « MVP » est en réalité un produit complet (moteur de process configurable + éditeur visuel + event sourcing + RBAC + impression BLE + replica set + dashboards + 100 % de couverture). Pour une ferme unique, c'est sur-dimensionné et le mot « MVP » est trompeur.

Le reste du document détaille ces points par sévérité.

---

## 1. Ce qui est bien fait (à conserver)

- **Modèle état-courant + événements immuables** : pragmatique, bien adapté à l'audit et à la traçabilité. Bon choix.
- **Glossaire (`01`) et modèle de domaine (`05`)** : vocabulaire posé tôt, entités et relations claires.
- **Séparation 3 couches de types** (Domain / DTO-API / documents Mongo) : excellente discipline.
- **Registre QR central + token opaque** : bonne décision sécurité/découplage.
- **Traçabilité ascendante ET descendante** explicitement traitée (`03`).
- **Périmètre hors-MVP explicite** (`00 §3`) : Reolink, Inkbird, ventes, facturation correctement repoussés.
- **Démarche questionnaire cultivateur** : la bonne façon d'éviter une app « théorique ». Le problème n'est pas le questionnaire, c'est qu'il n'a pas encore été rempli.

---

## 2. Problèmes critiques (bloquants) — P0

### P0-1 — Le questionnaire cultivateur est vide, mais tout en dépend
`15-questionnaire-cultivateur-process.md` : **aucune réponse**. `18 §2` et `dev_01_05` listent comme dépendant du cultivateur : vocabulaire, phases, étapes, actions, observations, produits finaux, étiquettes, chambres.
→ Conséquence : **80 % du MVP métier n'est pas spécifiable aujourd'hui.** On ne peut pas concevoir le moteur de process, les formulaires dynamiques, le `publicCode`, les étiquettes ni les stats sans ces réponses.
**Action :** faire remplir le questionnaire est le **chemin critique n°1**, avant Phase 1. Tant qu'il est vide, geler toute décision sur le contenu du process.
**Mise à jour 2026-06-17 :** Julien a commencé à répondre (chaîne de propagation amont — voir P0-3) et le formulaire `16` a été étendu en conséquence (sections gélose / LC / grain, clones, transferts). C'est un **bon signe**, mais cela montre que le périmètre métier était **encore plus sous-spécifié** qu'estimé : le reste du questionnaire reste à remplir.

### P0-2 — « Éditeur de process complet au MVP » est une fausse priorité MVP
`04 §13`, `13 §5`, `18 §8` visent un **moteur de process très détaillé + éditeur visuel complet** dès le MVP. C'est l'élément le plus coûteux et le plus risqué de tout le projet, et il est paradoxalement **impossible à finaliser tant que P0-1 n'est pas levé** (on ne connaît pas le process à éditer).
→ Construire un éditeur de workflow générique configurable (phases/étapes/transitions/actions/observations/formulaires/règles/alertes/actions de masse) est un projet en soi. Le faire « full detail » au MVP va absorber le planning.
**Action recommandée :** au MVP, **coder le process pleurote en seed data** (configurable en base, versionné, mais **édité par fichier/seed**, pas par UI). Livrer l'éditeur visuel en Phase ultérieure. Le doc l'envisage déjà comme repli (`13 §14`) — il faut en faire le plan A, pas le plan B.
**Mise à jour 2026-06-17 :** l'**espèce est configurable** (pleurote, shiitake, …), chacune pouvant avoir son propre process multi-stade → l'éditeur complet au MVP est encore plus coûteux. Raison de plus pour livrer des process en **seed par espèce** d'abord.

### P0-3 — Modèle « unité » vs « lot » : éclairé par le cultivateur (2026-06-17), à figer
Les docs `00`→`09` raisonnaient en **lot / sous-lot** ; le questionnaire et les réponses dev basculaient en **unité**.
**Apport de Julien :** le métier est une **chaîne de propagation multi-stade** — origine (spores / culture mère) → **gélose → culture liquide (LC) → grain → substrat** → fructification. À chaque stade, deux relations de lignée distinctes :
- **clone** = multiplication au **même** stade (gélose→gélose, LC→LC, grain→grain) ; le parent (culture mère) survit ;
- **transfert/repiquage** = passage au **stade suivant** (une unité amont en inocule plusieurs) ;
- plus la **division** physique (substrat) déjà connue.
→ La collection `lots` ne peut donc plus rester « lot/sous-lot ». **Modèle recommandé (désormais intégré dans 00/01/03/05/07) :**
- entité unique **« unité de culture »** avec un champ **`stage`** (`gelose|liquid_culture|grain|substrate|fruiting`) ;
- lignée **typée** : `lineageRelation ∈ {origin, clone, transfer, split}` + `parentLotId` + `generation` + `isMotherCulture` ;
- traçabilité ascendante complète jusqu'à la gélose/origine ;
- « lot » = alias de l'unité au stade substrat/fructification.
**Reste à figer avec Julien (questions ajoutées au formulaire 16) :** jusqu'où remonter (spore/gélose/LC) ; QR dès la gélose ou plus tard ; un process par stade ou un seul multi-stade ; ratios de multiplication à suivre ; nombre max de générations de clone.

### P0-4 — Scan web iPhone : chemin HTTPS confirmé via Tailscale ✅ *mis à jour 2026-06-17*
Le scanner **web intégré** (`10 §5`, décision MVP) exige `getUserMedia`, donc un **contexte sécurisé (HTTPS)** sous Safari iOS.
**Mise à jour : Tailscale est confirmé** comme réseau d'accès. HTTPS est fourni par `tailscale serve` + **certificat TLS Let's Encrypt** sur le domaine `ts.net` → le **contexte sécurisé iOS est satisfait** par un certificat de confiance (pas d'auto-signé à approuver). **Ce blocage est levé sur le plan stratégique.**
Restent deux points (non bloquants) :
- **Spike Phase 0 (recommandé) :** confirmer en pratique que le cert `tailscale serve` est accepté par Safari iOS pour l'accès caméra, et que les opérateurs sont bien sur le tailnet (ACL Tailscale).
- **Repli :** le QR ne contient qu'un **token opaque sans URL** (`10 §3`) → la caméra native iOS ne peut pas l'ouvrir. Avec Tailscale HTTPS le scanner web devrait suffire ; si un repli est souhaité, encoder une URL `https://champignon.<tailnet>.ts.net/q/<token>` tout en gardant le token comme payload métier.

### P0-5 — Imprimante Nimbot B21 : risque technique majeur sous-estimé
La **NIIMBOT B21** est une imprimante d'étiquettes **Bluetooth grand public**. À ma connaissance **il n'existe pas de SDK officiel Node/Bun** ; les intégrations existantes sont des **protocoles BLE rétro-conçus** par la communauté, surtout en Python. Or le cadrage en fait un **livrable MVP « impression stable »** piloté **depuis le backend** (`00 §2`, `13 §5`), potentiellement **sur Raspberry Pi via Bun + BLE**.
→ C'est probablement le **point le plus risqué du projet**, plus que ne le reconnaît `13 §13`. BLE headless sur Pi depuis Bun est fragile (appairage, stack `noble`, permissions, déconnexions).
→ Et c'est en **contradiction directe** avec la décision « aucun prototype » (`dev_13_03`).
**Action :** **spike obligatoire** B21 ↔ Node/Bun ↔ BLE **avant** de s'engager sur l'archi d'impression. Prévoir un repli : génération d'étiquette en image/PDF + impression via app Niimbot officielle, ou imprimante réellement pilotable (réseau/USB ESC-POS) si le B21 ne tient pas.

---

## 3. Problèmes majeurs — P1

### P1-1 — « MVP » sur-dimensionné : ce n'est pas un MVP
Cumul demandé « dès le MVP » : moteur de process full-detail + éditeur visuel + actions de masse full-options + event sourcing + audit total + généalogie multi-origine + RBAC + impression BLE + replica set transactions + OpenAPI auto + dashboards/rapports + **100 % de couverture** + monorepo 7 packages.
→ C'est un **produit v1 complet**, pas un *minimum viable*. Le risque planning est réel (`13 §13` le mentionne mais ne le chiffre pas — d'ailleurs **aucune estimation de charge/temps n'existe**).
**Action :** définir une **tranche verticale fine** réellement minimale (créer unité → imprimer → scanner → voir fiche → 1 mesure → 1 récolte → 1 produit → trace), la livrer en bout-en-bout, **puis** élargir. Reclasser éditeur de process, actions de masse, multi-origine et rapports avancés en post-tranche-1.
**Mise à jour 2026-06-17 :** la chaîne amont (gélose/LC/grain) ajoutée par Julien **agrandit encore** le périmètre (nouveaux stades, clone, transfert, contamination labo). Argument supplémentaire pour une tranche verticale centrée d'abord sur **un seul stade de bout en bout** (probablement substrat→produit), puis remonter la chaîne stade par stade.

### P1-2 — Contradiction « pas besoin de sécurité » ⇄ exigences de sécurité partout
Le dev répond plusieurs fois « pas besoin de sécurité (réseau local) » (`dev_02_06`, `dev_09_01`, `dev_09_06`). Mais `12 §3`, `06 §13`, `10 §11` exigent : mots de passe hashés, sessions sécurisées, tokens non prédictibles, audit complet, permissions backend.
De plus, **Tailscale = accès distant** : dès qu'on expose via Tailscale, l'hypothèse « réseau local de confiance » ne tient plus de la même façon (un device compromis sur le tailnet atteint l'app).
→ `18 §10-11` « réinterprète » les réponses du dev pour rester cohérent. C'est honnête, mais ça veut dire que **les réponses réelles de l'utilisateur ont été silencieusement écrasées**. À confirmer explicitement avec lui.
**Action :** acter une ligne claire : auth + hash + sessions + tokens non devinables + audit = **oui** (peu coûteux, et nécessaires dès qu'il y a Tailscale et plusieurs opérateurs plus tard). Documenter que « pas de sécurité » ≠ « pas d'auth ».

### P1-3 — Contradiction « suppression » ⇄ historique immuable
`dev_09_04` répond littéralement **« suppression »**. Tout le reste du dossier interdit la suppression physique métier (`02 §5`, `03 §7`, `07 §2.4`) au profit d'événements d'annulation/correction.
→ `18 §11` réinterprète encore en « suppression logique ». Le **souhait réel de l'utilisateur (hard delete) entre en conflit avec l'event sourcing** et a été tranché à sa place.
**Action :** valider avec l'utilisateur : « corriger/annuler = nouvel événement, jamais d'effacement réel ». S'il veut vraiment du hard-delete, ça change le modèle d'audit.

### P1-4 — Personas riches ⇄ un seul rôle `admin` au MVP
`02` définit 5 personas + une **matrice de permissions complète**. La décision MVP = **rôle `admin` unique** (`dev_09_02`).
→ Câbler des « rôles autorisés » par action/transition dans le moteur de process (`07 §4.7`, `04 §9`) alors qu'un seul rôle existe = **complexité spéculative (YAGNI)**. Et avec un utilisateur unique, l'audit « par utilisateur », la correction « de ses propres saisies » et l'UX multi-persona n'ont **aucun effet réel au MVP**.
**Action :** au MVP, garder le **champ** `allowedRoles` dans le modèle (cheap, prépare l'avenir) mais **ne pas construire l'UI/la logique de gating** tant qu'il n'y a qu'`admin`. Aligner `02` pour dire clairement « matrice = cible post-MVP ».

### P1-5 — Le module `auth`/`users` a été oublié dans la checklist mais est obligatoire
`dev_03_04` (modules backend) **ne coche ni `auth` ni `users`**. `18 §5` le rattrape par une note (« auth/admin minimal nécessaire même si non priorisé »). Or il faut login, sessions, hash, écran de login (`18 §9` l'ajoute « car auth retenue »).
→ Incohérence interne : un module **indispensable** absent de la liste « officielle » des modules.
**Action :** ajouter explicitement `auth` + `users` aux modules MVP.

### P1-6 — Plusieurs stats prioritaires sont **impossibles** avec les données du MVP
Stats voulues (`15 §15`, `11 §10`) : « comparaison par plage température/humidité », « rendement par conditions de chambre ». Or **la température/humidité fiable vient des Inkbird, qui sont post-MVP**. Au MVP, les mesures de chambre sont **manuelles et éparses**.
→ Donc ces analyses seront vides ou trompeuses au MVP. De même « rendement par kg de substrat » exige un **poids de substrat** qui n'est pas un champ clairement modélisé (voir P2-1).
**Action :** marquer ces stats « post-Inkbird ». Au MVP, livrer seulement les stats calculables : rendement/unité, par flush, par espèce, par session, par chambre (présence), durées de phase, taux de contamination.

### P1-7 — Versioning/migration de process : le seul point « à clarifier », et il est structurel
`dev_06_05` = **« à clarifier »**, `04 §11`, `07 §12`, `18 §8` laissent ouvert. Avec un **éditeur complet au MVP** + des **lots de production réels** référençant une version, l'utilisateur **éditera** des process et la question « que deviennent les lots en cours quand une étape est renommée/supprimée ? » se posera **tôt**, pas « plus tard ».
→ Les snapshots de nom d'étape dans les events aident pour l'historique, mais **pas pour un lot encore vivant** dont l'étape courante n'existe plus dans la nouvelle version.
**Action :** spécifier dès maintenant la règle minimale : versions publiées **immuables**, lot **épinglé** à sa version jusqu'à fin de cycle, migration **manuelle assistée uniquement**, et **interdiction de modifier une version publiée** (toute modif = nouvelle version). C'est un autre argument fort pour repousser l'éditeur (P0-2).

---

## 4. Dette de conception / problèmes moyens — P2

### P2-1 — Sémantique des quantités/poids floue
`lots.currentQuantity` / `initialQuantity`, `harvests.gross/net/loss`, et des unités mélangées (g, kg, pièces, barquettes). Pour un sac de substrat, « quantité » = masse de substrat (qui ne décroît pas vraiment) ; pour une récolte = masse de champignons ; pour un produit = pièces/barquettes.
→ « Rendement par kg de substrat » (efficacité biologique) exige un **poids de substrat humide/sec** comme champ de premier rang, et des **conversions d'unités** explicites. Rien de tout ça n'est défini. `currentQuantity` d'un lot ne veut pas dire grand-chose tel quel.
**Action :** définir un modèle de quantité typé (`{ value, unit, kind }` où `kind` ∈ substrat/récolte/produit) et figer ce qu'on mesure pour le calcul de rendement.

### P2-2 — Source vs Lot : dédoublement possiblement inutile au MVP
`Source` et `Lot` portent des attributs très proches (espèce, souche, fournisseur, poids initial, QR). Pour un ballot **reçu déjà inoculé**, source ≈ lot. La question « source et lot = 2 objets différents ? » (`14 §1.2`) est **non répondue**.
**Action :** envisager de **fusionner** source et lot au MVP (un drapeau `origin: received|inoculated-here`), réintroduire la séparation seulement si le métier la justifie.

### P2-3 — « Reconstructible par les événements » : promesse non garantie
`README` et `07 §2.1` affirment que l'historique complet est reconstructible depuis les events. En réalité l'archi est un **double-write** (écrire l'event + mettre à jour l'état courant) dans une transaction — **pas** un vrai event sourcing où l'état est *dérivé*. La reconstruction n'est vraie que si **chaque** mutation écrit toujours un event suffisamment complet, ce qui est une discipline facile à violer, et **aucun mécanisme de projection/rebuild n'est spécifié**.
**Action :** soit assumer « events = piste d'audit » (et ne pas promettre la reconstruction), soit spécifier un vrai mécanisme de rejouabilité + tests de cohérence état/events.

### P2-4 — Concurrence, idempotence et conflits non traités
Le code d'erreur `CONFLICT` existe mais **aucune stratégie de verrouillage optimiste** (champ `version`/`etag`) n'est décrite. Scénario réel : Wi-Fi instable + **action de masse sur 40 unités** + retry → **double avancement** sans **clé d'idempotence**. `correlationId` existe sur les events mais pas d'`Idempotency-Key` au niveau requête.
**Action :** ajouter `version` optimiste sur les docs d'état courant + `Idempotency-Key` sur les POST d'action (surtout actions de masse).

### P2-5 — « Aucun prototype » va à l'encontre du profil de risque
`dev_13_03` : « Aucun prototype ». Or les deux risques n°1 et n°2 reconnus par le dev lui-même (B21 + iPhone/HTTPS) **sont exactement** ce qu'il faut spiker avant de figer l'archi.
**Action :** transformer le « project test folder » évoqué en **2 spikes obligatoires** (P0-4, P0-5) en Phase 0.

### P2-6 — Objectif « 100 % de couverture » = anti-pattern
`dev_12_01` : « 100% coverage ». La couverture de lignes à 100 % est une **métrique vanité** coûteuse qui ne garantit pas la correction et **ralentira le MVP**. `12`/`18` adoucissent en « couverture très élevée » — donc, là encore, la réponse brute du dev a été tacitement corrigée.
**Action :** cibler une couverture **sur la logique métier critique + intégration + E2E des parcours clés**, pas un chiffre global. Acter explicitement l'abandon du « 100 % ».

### P2-7 — Connectivité terrain : online-only possiblement trop optimiste
Tout repose sur « iPhone + Wi-Fi en chambre ». Les chambres de fructification (humidité, métal, parfois sous-sol/conteneur) ont souvent un **Wi-Fi médiocre**. Le questionnaire le demande (`14 §8.2`) — **non répondu**. Or PWA/offline est repoussé en Phase 9.
→ Si la connectivité lâche, une app online-only **échoue précisément au moment de la saisie** (scan/formulaire). La promesse « ouvre vite après scan » dépend d'un réseau qui peut ne pas exister.
**Action :** au minimum prévoir tôt une **file d'attente de saisie locale** (write-behind) pour mesures/observations/changements d'étape, même sans PWA complète. Réévaluer après réponse cultivateur sur le Wi-Fi.

### P2-8 — Pi : ressources et chaîne de build sous-analysées
MongoDB **5+ exige un OS 64 bits** (ARMv8) ; replica set + transactions + stockage **photos** + Bun + dashboard de logs **sur un Raspberry Pi** = budget RAM/IO/stockage serré. Le stockage photo sur **carte SD** s'use et tombe en panne ; la croissance du volume image et la **gestion disque plein** (un des modes de panne pouvant corrompre) ne sont pas spécifiés. Build : dev **x86 (Mac/Windows)** → prod **ARM** ⇒ images Docker **multi-arch** non évoquées.
**Action :** prod sur **SSD USB** (pas SD), définir compression + rétention photos + alerte disque, et prévoir des builds Docker multi-arch (ou build sur le Pi).

### P2-9 — Cycle de vie du lot parent après division : non défini
`14 §5.6` (« le parent reste-t-il actif ou devient conteneur historique ? ») est **non répondu**. `01` liste l'état « Divisé » mais ne dit pas si un lot divisé peut encore recevoir événements/récoltes. Avec `lineagePath`/`rootLotId` c'est outillé, mais la **règle métier manque** et impacte `03 §7` (« récolte interdite sur lot terminé »).
**Action :** trancher l'état et les actions permises sur un parent divisé.

### P2-10 — Maturité de l'écosystème Bun pour cette stack
Plusieurs briques supposent une compat Bun non triviale : **Vitest sous Bun** (Bun a son propre runner ; des frictions existent), **driver MongoDB natif sous Bun**, **BLE/`noble` sous Bun**, **Husky/lint-staged** en contexte Bun. Aucune n'est rédhibitoire mais l'addition mérite une **vérification de compatibilité** en Phase 1.
**Action :** valider tôt le combo Bun + driver Mongo + Vitest + outillage ; sinon, isoler le service d'impression BLE dans un process Node si Bun ne convient pas.

---

## 5. Incohérences ponctuelles / dérive documentaire

| # | Incohérence | Où | Correctif |
|---|---|---|---|
| D1 | Questionnaire cultivateur entièrement vide | `15` (+ `16`/`17` HTML) | Le remplir avant Phase 1 (P0-1) |
| D2 | Réponses dev très vagues (« best practice », « you decide », « make the best ») présentées ensuite comme **décisions validées** dans `18` | JSON `dev_03_02/03`, `05_07`, `07_01/04` → `18` | Distinguer « décidé par l'utilisateur » de « recommandé par défaut par l'implémenteur » |
| D3 | `auth`/`users` absent de la checklist modules mais requis | `dev_03_04` vs `18 §5` | Ajouter aux modules MVP (P1-5) |
| D4 | « suppression » vs immuabilité | `dev_09_04` vs `02/03/07` | Valider la règle (P1-3) |
| D5 | « pas de sécurité » vs sécurité exigée | `dev_09_*` vs `12 §3` | Clarifier (P1-2) |
| D6 | 5 rôles + matrice vs 1 rôle `admin` | `02` vs `dev_09_02` | Marquer `02` comme cible (P1-4) |
| D7 | Triade « source/unité/lot » introduite tardivement, absente du modèle de domaine | `13`/`18` vs `05`/`07` | Unifier le vocabulaire (P0-3) |
| D8 | Exemple de division « 20 kg → sous-lots » ne correspond pas au flux « 1 session → 30 sacs » | `03 §5.1` vs `15 §6-7` | Réécrire l'exemple selon le vrai flux |
| D9 | Backlog « 10 tâches » et « décisions finales » jamais remplis ; `18 §16` **fabrique** un backlog en notant « le formulaire n'a pas rempli cette partie » | `dev_13_04`, `dev_13_05`, `dev_14_01`, `dev_14_03` | Faire valider ce backlog par l'utilisateur |
| D10 | `README` annonce « MongoDB » sans Hono ; modules/écrans listés diffèrent légèrement entre `06`, `13`, `18`, JSON | `README`, `06/13/18` | Passe d'alignement |
| D11 | Cibles de perf chiffrées (`12 §2`) mais jamais reliées au matériel le plus faible (Pi) | `12 §2` | Vérifier les SLA sur Pi, pas sur Mac |

---

## 6. Questions à trancher en priorité (avant de coder)

1. **Remplir le questionnaire cultivateur** (P0-1). Sans ça, le reste est spéculatif.
2. **Unité vs lot vs session** : qu'est-ce qui porte le QR ? qu'est-ce qu'un « parent » ? (P0-3)
3. **Process MVP : seed data ou éditeur visuel ?** Recommandation forte : seed d'abord (P0-2).
4. **Chemin HTTPS iPhone** : Tailscale **confirmé** (HTTPS via `serve` + cert TLS) → reste le spike de validation Safari iOS + ACL tailnet (P0-4).
5. **B21 : faisable en Node/Bun ?** Spike + plan de repli (P0-5).
6. **Sécurité/auth** : acter auth + hash + audit malgré « réseau local » (P1-2).
7. **Correction/annulation** : événement d'annulation, jamais de hard-delete métier (P1-3).
8. **Poids de substrat** comme champ de premier rang pour le rendement (P2-1).
9. **Versioning de process** : règle d'épinglage + immuabilité (P1-7).
10. **Connectivité chambre** : online-only acceptable, ou file d'attente locale dès le MVP ? (P2-7)

---

## 7. Recommandation de re-cadrage du MVP

Remplacer le « MVP = produit complet » par **deux paliers** :

**Palier 1 — Tranche verticale « du sac au produit » (réellement minimale)**
Process pleurote **en seed data** (pas d'éditeur). Auth admin. Créer unité → `publicCode` → QR (token) → impression (ou repli image/PDF si B21 KO) → scanner web → fiche mobile → timeline → changement d'étape → mesure/observation manuelle → récolte (poids/unité) → 1 produit → trace ascendante. Sauvegardes mongodump + photos. Tests sur la logique métier critique.
→ **C'est** le MVP. Il est démontrable et utile en production.

**Palier 2 — Élargissement** (après validation terrain du Palier 1)
Éditeur de process visuel, actions de masse full-options, généalogie multi-origine, RBAC multi-rôles, dashboards/rapports avancés, alertes calculées, puis matériel (Reolink, Inkbird) et offline/PWA.

Cette découpe respecte l'intention « outil de production, pas démo » **tout en** rendant le périmètre atteignable et en plaçant les vrais risques (B21, iOS/HTTPS, process) au plus tôt.

---

## 8. Tableau récapitulatif des risques

> ⚠️ **Tableau mis à jour le 2026-08-08** après les décisions de [`docs/21-decisions-avant-code.md`](./docs/21-decisions-avant-code.md). Voir §11.

| ID | Sévérité | Sujet | Impact si ignoré |
|----|----------|-------|------------------|
| P0-1 | 🟢 Levé | Questionnaire cultivateur — 186/188 ; structure close. Les valeurs manquantes sont de la **configuration runtime** (31/07/2026) | — |
| P0-2 | 🟠 Majeur *(déclassé)* | Éditeur de process obligatoire au MVP — pas de seed, l'app démarre vide. Allégé : 6 étapes, pas d'actions par étape, pas de transition temporelle | Sans éditeur, l'application est inutilisable au premier lancement |
| P0-3 | 🟢 Levé | Unité multi-stade + lignée clone/transfert/division — **figé le 30/07/2026** | Modèle arrêté (voir §9) |
| P0-4 | 🟢 Levé | Scan iOS / HTTPS — **Tailscale confirmé** (`serve` + cert TLS) | Reste un spike de validation iOS + ACL tailnet |
| P0-5 | 🟢 **Levé (08/08)** | Nimbot B21 **testée, fonctionne comme attendu** | — |
| P1-1 | 🟠 **Majeur — seul risque structurant restant** | « MVP » sur-dimensionné, **toujours aucune estimation de charge** | Dérive planning, pas de v1 livrable |
| P1-2 | 🟢 **Levé (08/08)** | Sécurité : décision explicite « aucune », plus de réinterprétation silencieuse | Limite assumée : pas d'imputabilité nominative |
| P1-3 | 🟢 Levé | « suppression » vs audit immuable — événement de compensation | — |
| P1-4 | 🟢 **Sans objet (08/08)** | Plus de rôles ni d'utilisateurs du tout | — |
| P1-5 | 🟢 **Sans objet (08/08)** | Plus de module auth à oublier | — |
| P1-6 | 🟠 Majeur | Stats T°/humidité impossibles sans Inkbird | Dashboards vides/trompeurs |
| P1-7 | 🟢 **Levé (08/08)** | Versioning : **comparaison retenue**, unité épinglée, pas de bascule | — |
| P2-1 | 🟢 **Levé (08/08)** | Type `Quantity { value, unit, kind }` + `substrateWeight` de premier rang | — |
| P2-2 | 🟢 **Levé (08/08)** | Source et Lot restent **deux objets distincts** | — |
| P2-3 | 🟡 Moyen | « Reconstructible » non garanti | Promesse d'audit creuse |
| P2-4 | 🟡 Moyen — **spécifié** | Idempotence + verrou optimiste actés dans `08` §2.1, restent à implémenter dès la Phase 1 | Double-action sur Wi-Fi instable |
| P2-7 | 🟡 Moyen | Online-only en environnement Wi-Fi douteux | Échec au moment de la saisie |
| P2-8 | 🟡 Moyen | Ressources/build Raspberry Pi | Instabilité prod, corruption disque |

---

*Fin de la revue. Ces critiques visent un cadrage déjà solide ; le but est de le rendre exécutable en levant d'abord les points P0 restants (P0-4 levé le 2026-06-17 par la confirmation Tailscale ; restent P0-1, P0-2, P0-3, P0-5).*

---

## 9. Mise à jour 2026-07-30 — réponses cultivateur reçues

Source : `docs/champignon-reponses-cultivateur-2026-07-30.json`.

### 9.1 Le chiffre à retenir : 84 / 188 en 1ʳᵉ passe, **139 / 188 après la 2ᵉ** (voir §9.6)

L'export affiche **« 188 répondues, 100 % »**. C'est faux : **104 questions ne contiennent ni texte ni case cochée** — elles ont été marquées répondues en masse (bouton « Marquer visibles répondues »). Le formulaire `16` a été corrigé pour recalculer le statut à partir du contenu réel, et le questionnaire `15` marque ces questions `⏳ SANS RÉPONSE`.

**Ne pas planifier sur la base du 100 %.**

### 9.2 P0-3 levé — le modèle est figé

Les réponses ferment la question « unité vs lot vs session » :

- l'unité est **tout objet physique manipulé**, à tout stade ;
- le **parent** est un lien de parenté détaillé de bout en bout, **pas** une session d'inoculation — la session redevient une simple étiquette de regroupement ;
- clonage à tous les stades, **sans limite de génération** ;
- une unité peut **naître sans ascendant**, à n'importe quel stade ;
- la **sortie de conservation crée une nouvelle unité** ; l'archivage est **réversible**.

Ces règles sont propagées dans `01`, `04`, `05`, `14`. Le modèle de domaine peut être considéré comme stable.

### 9.3 P0-1 réduit, mais toujours bloquant

Ce qui reste manquant n'est plus structurel — c'est **entièrement quantitatif** : aucune durée, température, humidité, aucun ratio, aucun seuil d'alarme, aucune liste d'espèces réelle, aucun contenu d'étiquette, aucune conduite en cas de contamination.

À toutes les questions de valeur, la réponse donnée est **« configurable »**. C'est cohérent avec le cadrage, mais **ça ne fait pas un produit utilisable** : un moteur configurable a besoin d'un jeu de valeurs par défaut pour démarrer. Sans elles, la recommandation « premier process en *seed data* » (P0-2) **ne peut pas être exécutée** — il n'y a rien à mettre dans le seed.

~~**Action :** demander le tableau §20 pour une seule espèce, plus petit livrable débloquant le seed.~~ **Dépassé le 31/07/2026 — voir §10** : le tableau est de la configuration runtime, il n'y a pas de seed à débloquer.

### 9.4 P1-7 aggravé — contradiction à arbitrer

Deux réponses incompatibles :

- « si tu modifies un process, les unités déjà lancées **basculent sur la nouvelle version** » (avec confirmation) ;
- « veux-tu **comparer les résultats entre deux versions** d'un process ? » → oui.

Si tout bascule, il ne reste aucune population témoin. Cela contredit aussi la recommandation P1-7 d'origine (versions publiées immuables, lot épinglé). À trancher avant de coder le moteur de process — voir `04-processus-configurable.md` §15.3.

### 9.5 Effets secondaires du « tout est possible »

Plusieurs réponses élargissent encore le périmètre sans le borner :

| Réponse | Effet |
| --- | --- |
| Départ possible à **n'importe quel stade** | Aucune contrainte d'ascendant : la validation métier ne peut plus s'appuyer sur la chaîne |
| Étape **sautée, refaite, remise en arrière** | Le moteur de process doit gérer un graphe libre, pas une séquence — coût réel sur P0-2 |
| **Aucune limite de génération** | Pas de garde-fou contre la sénescence ; à compenser par une statistique de vigueur par génération |
| Changement de process **en cours de route** | Complique le calcul de durée cible et l'historique d'alarmes |

Aucun de ces points n'est un blocage en soi, mais **cumulés ils renforcent P0-2** : l'éditeur de process complet au MVP devient encore moins tenable. La recommandation de tranche verticale fine reste valable, et le seed doit couvrir un chemin nominal simple avant d'ouvrir toutes ces libertés.

### 9.6 Seconde passe (30/07/2026) — 139/188, et une bonne nouvelle pour P0-2

En regroupant les questions qui se répétaient d'un stade à l'autre, 55 réponses supplémentaires ont été obtenues. Deux d'entre elles **allègent réellement le moteur de process** :

1. **Pas de liste d'actions ni d'observations par étape.** La liste complète existe partout, l'app masque ce qui n'a pas de sens au stade courant. L'éditeur de process n'a donc pas à gérer une configuration d'actions étape par étape — seulement des règles de pertinence par stade.
2. **La durée ne déclenche aucun passage.** Le passage se fait à l'observation visuelle, validée par une personne ; la durée n'est qu'un rappel. Il n'y a donc **pas de moteur de transition temporelle** à écrire : ni job planifié, ni état « prêt » calculé depuis une date.

C'est le premier allègement réel du périmètre depuis le début de la revue. **P0-2 reste néanmoins bloquant** : les libertés accordées (étapes sautables, réversibles, changement de process en cours, bascule de version) restent coûteuses, et surtout le seed n'a toujours rien à contenir.

**P0-1 reste ouvert pour une seule raison** : le tableau §20. Les 49 questions restantes sont presque toutes des demandes de valeurs. Aucune ne rouvre une question de structure.

---

## 10. Mise à jour 31/07/2026 — « le tableau sera de toute façon configurable »

Cette phrase change le diagnostic de cette revue. Elle mérite d'être prise au sérieux, y compris là où elle m'oblige à revenir sur une recommandation.

### 10.1 P0-1 est levé

J'ai répété pendant trois passes que l'absence de valeurs (durées, températures, ratios, seuils) bloquait le démarrage. **C'était faux si ces valeurs sont saisies dans l'application** plutôt que livrées avec elle. Elles deviennent de la donnée de configuration, comme les espèces ou les chambres.

Il ne manque donc plus rien pour commencer. Les 49 questions restantes du questionnaire décrivent du paramétrage, pas de la structure.

### 10.2 …mais P0-2 devient incontournable

La recommandation centrale de cette revue — **« premier process en seed data, éditeur visuel plus tard »** — reposait sur une hypothèse qui vient de tomber : qu'un process de référence serait livré avec l'application.

S'il n'y a pas de seed, **l'application démarre vide**. Le cultivateur doit pouvoir construire son process complet depuis l'interface au premier lancement. L'éditeur n'est plus une brique reportable : c'est la condition d'utilisabilité.

Deux conséquences :

1. La réponse développeur `dev_06_06` (« éditeur complet » au MVP), que je jugeais sur-dimensionnée, **devient cohérente**.
2. Le re-scoping proposé au §7 de cette revue (tranche verticale fine sans éditeur) **n'est plus applicable en l'état**. Une tranche verticale reste souhaitable, mais elle doit inclure de quoi **créer un process**, même sommairement (formulaire, pas forcément éditeur graphique).

### 10.3 P1-3 est levé

`dev_09_04` répondait « suppression », en conflit avec l'audit immuable — et j'avais noté que la règle avait été tranchée à la place de l'utilisateur. Le cultivateur a depuis demandé de pouvoir **« annuler ou corriger une action »**, ce qui valide l'interprétation par **événement de compensation**. La contradiction est résolue par le métier, pas par un arbitrage unilatéral.

### 10.4 Le risque se déplace

Il ne porte plus sur le manque d'information, mais sur la **mise en service** : au premier démarrage, il faudra saisir un process entier, les chambres, les espèces, les seuils. C'est le moment où un outil de traçabilité se fait abandonner.

**Action recommandée** : prévoir dès le MVP un **modèle de process pré-rempli et modifiable** (valeurs arbitraires, clairement présentées comme telles), plus un **jeu de démonstration** pour le développement et les tests E2E. Ce n'est pas un seed métier — c'est un point de départ éditable, qui évite l'écran vide.

### 10.5 Ce qui reste ouvert côté développeur

L'export `champignon-reponses-dev-sam-2026-06-17.json` compte **74 réponses sur 79**. Restent sans réponse :

| Question | Sujet |
| --- | --- |
| `dev_06_05` | Versioning / migration d'un process utilisé par des lots — marqué « à clarifier », et depuis **contredit** par les réponses cultivateur (voir §9.4) |
| `dev_13_04` | Backlog MVP en 10 tâches |
| `dev_13_05` | Sujets à faire attendre le cultivateur — sans objet désormais |
| `dev_14_01` | Tableau de synthèse des décisions techniques |
| `dev_14_03` | Résumé personnel des décisions |

Seul `dev_06_05` compte encore : c'est la contradiction bascule / comparaison de versions, toujours à trancher.

### 10.6 Export v8 — le process est deux fois plus court que documenté

Le second export (30/07, 22:02) porte le questionnaire à **186 / 188** et livre les premières valeurs réelles. Il révèle surtout une erreur de cadrage que cette revue n'avait pas vue.

**Les subdivisions 1/2/3 n'existent pas sur le terrain.** Réponses littérales : « pas de différence » entre incubation 1, 2 et 3 ; « pas de différences » entre fructification 1 et 2 ; « pas de différences » entre flush 1 et flush 2.

Or ces 13 étapes structurent **toute la documentation depuis le premier commit** — cahier des charges, flux, atlas, tableau de synthèse. Elles venaient de la formulation initiale du questionnaire, reprise ensuite comme si elle décrivait le métier. C'est un cas net de **spécification qui se valide elle-même** : la question suggérait la réponse, et personne n'a vérifié.

Le process réel :

```
inoculation → incubation (2-3 sem., 24 °C, obscurité) → fructification (90 %, 18-24 °C) → flush 1 → flush 2 → flush 3 (opt.) → fin de cycle
```

**Effet sur P0-2** : le modèle par défaut à livrer passe de 13 à 6 étapes. L'éditeur reste nécessaire, mais ce qu'il doit produire au premier lancement est bien plus modeste que prévu. Combiné à l'absence de configuration d'actions par étape (§9.6) et à l'absence de transition temporelle, **P0-2 devient tenable** — pour la première fois depuis le début de cette revue.

**Autre simplification** : `q18_5` répond **non** à la fusion d'unités. La traçabilité n'a donc pas à gérer de convergence de lignées, seulement des divergences (clone, transfert, division). Cela retire une des complexités les plus coûteuses d'un modèle généalogique. D5 du tableau des dérives peut être clos.

---

## 11. Mise à jour 2026-08-08 — les six dernières décisions

Source : [`docs/21-decisions-avant-code.md`](./docs/21-decisions-avant-code.md). Répondant : Olivier.

### 11.1 Ce que cette revue avait bien vu

Trois recommandations sont suivies :

- **P1-7 versioning** : la piste « versions publiées immuables, lot épinglé, migration manuelle assistée » (§3, P1-7) est retenue telle quelle. La contradiction bascule/comparaison est tranchée en faveur de la comparaison.
- **P2-1 quantités** : le modèle typé `{ value, unit, kind }` recommandé en §4 est adopté, avec le poids de substrat comme champ de premier rang — exactement ce que réclamait le calcul d'efficacité biologique.
- **P2-4 idempotence** : `version` optimiste + `Idempotency-Key` entrent dans les contrats API (`08` §2.1) avant l'écriture du code, pas après.

### 11.2 Ce que cette revue avait mal calibré

**P0-5 Nimbot B21 était surestimé.** Je l'ai classé « point le plus risqué du projet », en m'appuyant sur l'absence de SDK officiel Node/Bun et sur la fragilité du BLE headless. Le test terrain a réussi du premier coup. Le raisonnement — pas de SDK, protocole rétro-conçu, stack BLE fragile — n'était pas faux en soi, mais j'ai transformé une incertitude en risque bloquant sans avoir de quoi la quantifier. Le repli image/PDF que je réclamais était inutile.

**P2-2 Source vs Lot** : j'avais recommandé la fusion au MVP (« source ≈ lot pour un ballot reçu inoculé »). La séparation est maintenue. C'est défendable : la source décrit ce qui *entre dans la ferme* (fournisseur, lot fournisseur, date de réception), l'unité décrit ce qui *vit dans le process*. Les confondre aurait forcé à mélanger deux cycles de vie très différents.

### 11.3 P1-2 sécurité : tranché contre ma recommandation

J'avais insisté (§3, P1-2) pour acter « auth + hash + sessions + audit », en arguant que Tailscale = accès distant, donc fin de l'hypothèse « réseau local de confiance ».

**La décision est : aucune sécurité applicative.** Pas d'auth, pas d'utilisateurs, pas de rôles, pas d'auteur sur les événements. C'est un choix explicite, pris en connaissance de la conséquence — ce qui lève le vrai grief de P1-2, qui n'était pas « il faut de la sécurité » mais « la réponse de l'utilisateur a été silencieusement écrasée par `18` ». Elle ne l'est plus.

Ce que cela coûte, à porter en clair :

- **tout appareil du tailnet a un accès total en lecture et en écriture**, y compris à la configuration des process ;
- **la traçabilité répond à « quoi et quand », jamais à « qui »**. Le cultivateur a pourtant répondu que le passage d'étape est « validé par une personne » : l'humain déclenche bien l'action, mais son nom n'apparaît nulle part ;
- **si une certification (bio, contrôle sanitaire) exige un jour l'imputabilité nominative**, il faudra réintroduire une identité. Le champ `recordedBy` reste réservé et non peuplé dans `events` pour que ce soit une migration, pas une refonte.

Ce n'est pas une objection : c'est le périmètre de la promesse de traçabilité, qu'il faut énoncer avant de la vendre comme telle.

### 11.4 Effet net sur le périmètre

Le MVP maigrit réellement pour la première fois : plus de module `auth`, plus de `users`, plus de rôles ni de matrice de permissions, plus de collection ni de module `tasks`, plus de mécanique de bascule de version. Ajouté au process ramené à 6 étapes (§10.6), à l'absence de configuration d'actions par étape (§9.6) et à l'absence de fusion d'unités, **P0-2 est déclassé de bloquant à majeur**.

### 11.5 Le seul risque structurant qui reste : P1-1

Tout le reste est levé ou spécifié. Il demeure que **ce qui est appelé « MVP » n'a jamais été estimé** — ni en charge, ni en durée — et qu'il contient encore un moteur de process configurable avec étapes sautables, refaisables et réversibles, un éditeur, la généalogie multi-stade, le QR, l'impression, le scan et les rapports.

La recommandation du §7 reste valable **à une correction près** (déjà notée en §10.2) : la tranche verticale doit inclure de quoi **créer un process**, puisqu'il n'y a pas de seed. Un formulaire de création de phases/étapes suffit — l'éditeur graphique peut attendre.

**C'est le seul travail de cadrage encore utile avant de coder.**
