# CLAUDE.md — Champignon Manager

> Guide de travail pour ce dépôt. Lis-le avant toute intervention.

## État du dépôt — la tranche verticale est écrite

> **La phase de cadrage est close** (feu vert du 08/08/2026). Les douze lots de
> `docs/22` sont livrés. Le dépôt contient désormais une application complète
> **et** ses documents de cadrage, qui restent la référence métier.

| Où | Quoi |
| --- | --- |
| `packages/contracts` | Schémas Zod — la source unique des types |
| `packages/domain` | **Cœur pur** : aucune I/O, aucune horloge, aucun aléa (le lint l'interdit) |
| `packages/persistence` | MongoDB (driver natif), toutes les écritures transactionnelles |
| `packages/api` | Hono, catalogue d'opérations, amorçage du premier démarrage |
| `packages/cli` | `champi` — **la** surface d'agent (pas de serveur MCP) |
| `packages/printing` | File d'impression, transport injecté |
| `apps/web` | React 19 + Vite, scanner QR, éditeur de process graphique |
| `e2e/` | 117 scénarios Playwright : API, CLI, Chrome, WebKit/iPhone |
| `docs/`, `claude-critics.md` | Cadrage métier — **toujours la référence**, à tenir à jour |
| `SUIVI-IMPLEMENTATION.md` | Journal de construction et **27 déviations** au plan |
| `docs/23-mise-en-service.md` | Déploiement Pi, Tailscale, sauvegarde, recette terrain |

**Contraintes non négociables du code** (elles portent la qualité, ne les affaiblis pas) :

- **100 % de couverture**, seuils Vitest stricts. Une ligne non couverte se
  **supprime**, elle ne se masque pas — `c8 ignore`, `.skip` et `.only` sont
  refusés par le lint. Ce seuil a débusqué neuf replis morts, dont quatre
  auraient corrompu des données en silence (D-10, D-19, D-21, D-24).
- **Score de mutation ≥ 90 %** sur `domain` et `contracts` : c'est ce qui
  empêche le 100 % d'être une métrique vanité.
- **Le domaine reste pur.** L'horloge, l'aléa et le réseau n'existent qu'à
  l'assemblage (`packages/api/src/server.ts`).
- **Les tests d'intégration tournent contre un vrai MongoDB**, jamais un mock.
- **Le serveur tourne sous Node, pas sous Bun** (le driver MongoDB ne charge pas
  sous Bun 1.3 — D-13). Bun reste l'outil de build, de workspaces et de tests.
- **MongoDB écoute sur 27018**, pas 27017 (D-6).

Avant de proposer une évolution : lire `SUIVI-IMPLEMENTATION.md`. Beaucoup de
choix qui paraissent perfectibles y sont documentés avec leur raison.

## Le produit (en une phrase)

Application **locale** de gestion et de **traçabilité** de la culture de champignons, **« du spore à l'assiette »**, avec identification physique par **QR code** et saisie terrain sur **iPhone**.

## Modèle métier essentiel (à avoir en tête)

La traçabilité couvre **toute la chaîne de propagation**, pas seulement le substrat :

```
Origine (spores / culture mère) → Gélose → Culture liquide (LC) → Grain → Substrat → Fructification → Récolte → Produit final
```

- **Unité de culture** = tout objet physique traçable par QR, à n'importe quel **stade** (`gelose | liquid_culture | grain | substrate | fruiting`). « Lot » = unité au stade substrat/fructification.
- **Trois relations de lignée** :
  - **clone** — multiplication au *même* stade (gélose→gélose, etc.), le parent (culture mère) survit ;
  - **transfert / repiquage** — passage au *stade suivant* (1 unité amont → N unités aval) ;
  - **division** — séparation physique d'une unité (surtout substrat).
- **Multi-espèces** : l'espèce est **configurable** (pleurote = 1ʳᵉ espèce de référence, pas la seule). Le process peut différer par espèce.
- **Cœur technique** : traçabilité **par événements** (état courant + journal d'événements immuable), généalogie parent/enfant, **process configurable** (pas codé en dur).

Référence vivante et visuelle : ouvrir **`docs/19-atlas-process-flux.html`** (atlas interactif des process).

## Décisions techniques arrêtées (pour le futur code)

- Stack cible : **Bun + TypeScript strict + Vite + React + MongoDB**, monorepo Bun workspaces.
- Backend : **Hono** (REST/JSON), **Zod**, client typé, OpenAPI auto. MongoDB **native driver** (pas Mongoose), **replica set local** pour transactions.
- Persistance : **état courant + événements immuables** ; suppression **logique** uniquement (jamais d'effacement métier).
- Réseau / accès : **Tailscale confirmé** (URL MagicDNS `*.ts.net`, HTTPS via `tailscale serve`) — c'est ce qui rend le **scanner web QR iOS** possible (contexte sécurisé).
- QR : **token opaque** seulement, registre central, scanner web intégré. Imprimante cible : **Nimbot B21** (driver à valider — risque).
- Déploiement : **Docker Compose** ; dev macOS/Windows, prod **Raspberry Pi**.
- **Aucune authentification** : pas de login, pas d'utilisateurs, pas de rôles, **pas d'auteur sur les événements**. Seule frontière d'accès = le tailnet Tailscale.
- **Aucune tâche générée** par l'application : statuts et alertes seulement.
- **Versions de process immuables**, unité épinglée à sa version jusqu'à fin de cycle, **pas de bascule** ; migration explicite par sélection.
- Toute grandeur physique passe par un type **`Quantity { value, unit, kind }`** (masse canonique en grammes) ; `substrateWeight` est un champ de premier rang.
- **Source et Unité/Lot = deux objets distincts.**
- **Idempotence** (`Idempotency-Key`) et **verrou optimiste** (`version`) dès les premiers endpoints.
- Imprimante **Nimbot B21 : testée et validée** (08/2026).
- Hors MVP : caméra Reolink, Inkbird, ventes/facturation, contrôle matériel actif, offline/PWA avancé, **rôles/RBAC**, **module de tâches**.

Détail et nuances : `docs/18-decisions-techniques-dev.md` (réponses brutes) et **`docs/21-decisions-avant-code.md`** (décisions du 08/08/2026, qui priment).

## Carte des documents (`docs/`)

| Fichier | Rôle |
| --- | --- |
| `00`–`05` | Cahier des charges, glossaire, personas, flux & traçabilité, process configurable, modèle de domaine. |
| `06`–`08` | Architecture technique, modèle de données MongoDB, contrats API. |
| `09`–`12` | UX/frontend, QR/impression/scan, mesures/observations/caméra, exigences non-fonctionnelles. |
| `13`, `14` | Roadmap d'implémentation, questions ouvertes. |
| `15` | Questionnaire cultivateur (source markdown). |
| `16-formulaire-reponses-cultivateur.html` | **Formulaire interactif** que le cultivateur remplit (autosave, export JSON/Markdown). |
| `17-formulaire-questions-dev.html` | Formulaire interactif décisions développeur. |
| `18-decisions-techniques-dev.md` | Synthèse des décisions développeur (répondant : Sam). |
| `19-atlas-process-flux.html` | **Atlas visuel interactif** des process (Mermaid data-driven). |
| `20-modele-process-par-defaut.md` / `.json` | **Modèle de process pré-rempli et modifiable** livré au premier démarrage. Chaque valeur porte une `provenance` : `cultivator` (réponse réelle) ou `invented` (inventée pour éviter le champ vide — n'engage rien). |
| `21-decisions-avant-code.md` | **Décisions finales du 08/08/2026** (répondant : Olivier). Clôt les derniers points bloquants. **Prime sur les documents antérieurs en cas de divergence.** |
| `22-tranche-verticale-mvp.md` | **Périmètre, architecture, qualité et estimation de la tranche 1.** Ce qu'on construit et dans quel ordre. À lire avant toute proposition d'implémentation. |
| `23-mise-en-service.md` | **Déploiement chez le cultivateur** : Raspberry Pi, `tailscale serve`, amorçage du premier démarrage, sauvegarde vérifiée, restauration, recette terrain en neuf points. |
| `champignon-reponses-dev-sam-2026-06-17.json` | Export brut des réponses dev — **archive horodatée, ne pas réécrire**. |
| `champignon-reponses-cultivateur-2026-07-30.json` | Export brut des réponses cultivateur — **archive horodatée, ne pas réécrire**. Attention : son `summary` annonce 100 %, mais 104 des 188 questions sont vides. |
| `../claude-critics.md` | Revue critique du cadrage (P0/P1/P2, risques, re-scoping MVP). À tenir à jour. |

## Outils interactifs — comment ils marchent

Ce sont des fichiers **HTML autonomes**, **data-driven** (donc faciles à modifier) :

- **`16` (formulaire cultivateur)** : questions définies dans `const SECTIONS = [...]`. Ajouter/éditer une question = éditer ce tableau. Autosave localStorage + export JSON/Markdown. Hors-ligne.
- **`19` (atlas process)** : chaque process = entrée de `const PROCESSES = [...]` avec un **texte Mermaid** éditable + des **métadonnées de nœuds**. Modifier un process = éditer ce texte. **Dépend du CDN** (Mermaid + polices) ; dégrade en affichant le code source hors-ligne.
  - Pièges Mermaid déjà corrigés (ne pas réintroduire) : `classDef` n'accepte **pas** `rgba()` → utiliser l'hex 8 chiffres `#rrggbbaa` ; ne **jamais** animer `transform` sur `.node` (écrase le positionnement → nœuds en haut à gauche) ; pas de `setPointerCapture` (vole le clic des nœuds).

## Ce qui dépend encore du cultivateur (Julien)

**Mise à jour 2026-07-30** — réponses reçues (`docs/champignon-reponses-cultivateur-2026-07-30.json`). Détail : `docs/14` §18, `claude-critics.md` §9.

Trois passes : 84 réponses réelles au 1er export (l'export annonçait 100 % à tort — 104 questions vides marquées répondues en masse), 139 après une passe de questions groupées, **186 / 188 au second export v8 du 30/07 22:02**. Seuls les deux tableaux (`q10_3`, `q20_table`) restent vides, et ils relèvent de la configuration.

**Le process réel fait 6 étapes, pas 13** : incubations 1/2/3 et fructifications 1/2 sont « sans différence ». Modèle par défaut à livrer : inoculation → incubation (2-3 sem., 24 °C, obscurité) → fructification (90 %, 18-24 °C) → flush 1/2/3 → fin de cycle. Voir `docs/04` §18.

**Structure figée — ne plus rediscuter :**
- traçabilité jusqu'aux spores / souche reçue ; QR sur **chaque unité dès le début** ;
- départ possible à **n'importe quel stade** (une unité peut naître sans ascendant) ;
- clonage à tous les stades, **sans limite de génération** ;
- **parent = lien de parenté détaillé de bout en bout**, pas une session d'inoculation ;
- conservation possible partout ; **sortie de conservation = nouvelle unité** ; archivage **réversible** ;
- étapes **sautables, refaisables, réversibles** ; changement de process en cours de route autorisé ;
- **le passage d’étape se fait à l’observation visuelle**, validé par une personne — la durée cible n’est qu’un rappel, jamais un déclencheur ;
- **pas de liste d’actions ni d’observations par étape** : liste complète partout, filtrée par pertinence ;
- récolte : **poids par unité + qualité + pertes avec cause** ; mélanges autorisés avec proportions exactes ;
- emplacement suivi **jusqu’à la position** (chambre, étagère, niveau) ;
- photo obligatoire sur contamination, **gravité à 3 niveaux** ;
- étiquette : nom d’unité, type, date, code QR ;
- modification d'un process → **bascule des unités en cours** après confirmation ;
- process créé/modifié par **une seule personne** (cohérent avec l'auth `admin` unique) ;
- vocabulaire : gélose/boîte de Pétri, culture liquide/LC, ballot de grain, ballot de substrat, bloc, sac, pain.

**Devenu de la configuration runtime (arbitrage 31/07/2026 : « le tableau sera de toute façon configurable ») — ne bloque plus rien :**
- **aucune valeur chiffrée** : durées, T°, humidité, ratios, seuils d'alarme, pour aucun stade ;
- liste réelle des espèces (réponse actuelle : « tout type de champignon, configurable ») ;
- chambres et emplacements réels, mesures et fréquences, observations terrain ;
- récoltes (unité de poids, qualité, mélanges), contenu des étiquettes, conduite en cas de contamination.

**Conséquence majeure** : sans seed, l'application démarre **vide**. L'éditeur de process passe de « plus tard » à **indispensable au MVP** — la recommandation « seed data d'abord » de `claude-critics.md` ne tient plus (voir sa §10). Prévoir un **modèle de process pré-rempli et modifiable** pour éviter l'écran vide à la mise en service.

**Contradictions arbitrées le 08/08/2026** (voir `docs/21-decisions-avant-code.md`) :
- bascule de version **vs** comparaison → **la comparaison l'emporte, pas de bascule** ;
- « pas de tâches automatiques » (`q16_2`) **vs** tâche de nettoyage (`q9_10_5`) → **aucune tâche, alertes seulement**.

⚠️ **Deux décisions ne suivent pas les réponses du cultivateur — à lui remonter avant mise en service** : ses unités en cours ne basculeront pas lors d'une modification de process, et l'application ne saura jamais qui a fait quoi.

Dans les docs, marquer ces points **« à confirmer »** plutôt que d'inventer des valeurs.

## Conventions de travail

- **Langue** : tous les documents sont en **français**. Garder ce registre.
- **Cohérence** : une décision change souvent plusieurs docs. Après une modif structurante, propager (ex. un nouveau champ du modèle touche `05`, `07`, `08`…) et mettre à jour `claude-critics.md` si un risque évolue.
- **Vérifier les HTML** : après édition d'un fichier `.html`, valider le JS — `awk '/<script[^>]*>/{f=1;next}/<\/script>/{f=0}f' fichier.html > /tmp/x.mjs && node --check /tmp/x.mjs`.
- **Ne pas réécrire** les exports JSON horodatés (ce sont des archives de réponses).
- **Git** : travailler sur une branche (`docs/...` pour le cadrage, `feat/...` pour le code), pas sur `main` directement ; ne committer/pusher que sur demande explicite. Ne pas committer `.DS_Store`.
- **Avant de déclarer quelque chose fait** : l'exécuter. La pile de production a été **réellement démarrée**, la sauvegarde **réellement restaurée**, l'image **réellement construite** — chaque fois, cela a révélé quelque chose (D-23, D-26). Un fichier de configuration jamais lancé n'est qu'une intention.
- **Les réserves se disent en clair.** Le rapport d'audit porte six limites assumées. Ne pas les diluer : ce qui n'a pas été vérifié doit être annonçable comme tel.

## Prochaines étapes logiques

> **État au 08/08/2026 : plus aucun prérequis bloquant.** Questionnaire à 186/188, modèle métier figé, imprimante validée, six dernières décisions arrêtées (`docs/21`).

1. ✅ ~~Faire remplir le questionnaire cultivateur~~ — 186/188, le reste est de la configuration.
2. ✅ ~~Figer le modèle métier~~ — unité/stades/lignée arrêtés ; modèle de process par défaut dans `docs/20`.
3. ✅ ~~Dé-risquer l'impression Nimbot B21~~ — **testée, fonctionne**.
4. ✅ ~~Définir la tranche verticale MVP et estimer la charge~~ — **`docs/22`**, 12 lots. Exigences : éditeur de process **graphique**, 100 % de couverture + mutation, E2E + rapport d'audit, application **pilotable à 100 % par un LLM** (API + CLI ; le serveur MCP a été écarté — D-20).
5. ✅ ~~Écrire la tranche verticale~~ — **les douze lots sont livrés.** 1044 tests, 117 scénarios E2E, 100 % de couverture, 92,23 % de mutation, rapport d'audit publié en CI.
6. ✅ ~~Impression B21 et scan caméra~~ — **vérifiés sur matériel le 09/08/2026** : une étiquette sort de la B21, son QR scanné depuis un iPhone réel (Safari, HTTPS Tailscale) ouvre la fiche. Deux des trois réserves d'origine sont levées.
7. **Ce qui reste ne se vérifie qu'à la ferme** : budgets de performance rejoués **sur le Raspberry Pi** (`CHAMPI_PERF_FACTOR`), et impression **depuis le Pi** — le conteneur n'imprime volontairement pas (`docs/23` §6). Dérouler la recette de `docs/23` §8.
8. Ensuite seulement, élargir : stockage des photos (seul le `photoId` est enregistré aujourd'hui), stades amont au-delà du modèle par défaut, alarmes.
