# CLAUDE.md — Champignon Manager

> Guide de travail pour ce dépôt. Lis-le avant toute intervention.

## ⚠️ Règle d'or : on ne code PAS encore

Ce dépôt est en phase de **cadrage** : comprendre le process métier réel et **architecturer** l'application. Il ne contient **aucun code applicatif** — uniquement des documents de spécification (`docs/`), une revue critique (`claude-critics.md`) et des outils HTML autonomes d'aide au cadrage.

**Avant d'écrire la moindre ligne de code applicatif, il faut :**
1. obtenir les réponses du **cultivateur** (le process métier n'est pas encore figé) ;
2. valider le **modèle métier** et les décisions structurantes ;
3. y être explicitement invité.

Tant que ce n'est pas le cas : on **enrichit, clarifie et garde cohérents les documents**. On ne crée pas d'`apps/`, de `package.json`, de squelette de code.

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
- **Git** : travailler sur une branche `docs/...` (pas `main` directement) ; ne committer/pusher que sur demande explicite. Ne pas committer `.DS_Store`.
- **MVP réaliste** : `claude-critics.md` recommande une **tranche verticale fine** (un seul stade de bout en bout, process en *seed data* plutôt qu'éditeur visuel complet) avant d'élargir. En tenir compte dans toute proposition d'implémentation future.

## Prochaines étapes logiques

> **État au 08/08/2026 : plus aucun prérequis bloquant.** Questionnaire à 186/188, modèle métier figé, imprimante validée, six dernières décisions arrêtées (`docs/21`).

1. ✅ ~~Faire remplir le questionnaire cultivateur~~ — 186/188, le reste est de la configuration.
2. ✅ ~~Figer le modèle métier~~ — unité/stades/lignée arrêtés ; modèle de process par défaut dans `docs/20`.
3. ✅ ~~Dé-risquer l'impression Nimbot B21~~ — **testée, fonctionne**.
4. ✅ ~~Définir la tranche verticale MVP et estimer la charge~~ — **`docs/22`**, 12 lots, **62–78 jours-dev**. Exigences : éditeur de process **graphique**, 100 % de couverture + mutation, E2E + rapport d'audit, application **pilotable à 100 % par un LLM** (API + MCP + CLI).
5. Spikes restants, non bloquants : scanner QR iOS via Tailscale HTTPS (lot 6) ; compatibilité Bun (lot 1).
6. **Sur demande explicite**, créer le squelette de l'application — commencer par le lot 1 de `docs/22` §8.
