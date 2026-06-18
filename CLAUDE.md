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
- Auth MVP : login/mot de passe simple, rôle `admin` (RBAC complet = plus tard).
- Hors MVP : caméra Reolink, Inkbird, ventes/facturation, contrôle matériel actif, offline/PWA avancé.

Détail et nuances : `docs/18-decisions-techniques-dev.md`.

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
| `champignon-reponses-dev-sam-2026-06-17.json` | Export brut des réponses dev — **archive horodatée, ne pas réécrire**. |
| `../claude-critics.md` | Revue critique du cadrage (P0/P1/P2, risques, re-scoping MVP). À tenir à jour. |

## Outils interactifs — comment ils marchent

Ce sont des fichiers **HTML autonomes**, **data-driven** (donc faciles à modifier) :

- **`16` (formulaire cultivateur)** : questions définies dans `const SECTIONS = [...]`. Ajouter/éditer une question = éditer ce tableau. Autosave localStorage + export JSON/Markdown. Hors-ligne.
- **`19` (atlas process)** : chaque process = entrée de `const PROCESSES = [...]` avec un **texte Mermaid** éditable + des **métadonnées de nœuds**. Modifier un process = éditer ce texte. **Dépend du CDN** (Mermaid + polices) ; dégrade en affichant le code source hors-ligne.
  - Pièges Mermaid déjà corrigés (ne pas réintroduire) : `classDef` n'accepte **pas** `rgba()` → utiliser l'hex 8 chiffres `#rrggbbaa` ; ne **jamais** animer `transform` sur `.node` (écrase le positionnement → nœuds en haut à gauche) ; pas de `setPointerCapture` (vole le clic des nœuds).

## Ce qui dépend encore du cultivateur (Julien)

Ne pas figer tant que non répondu (cf. `docs/14` §16-17 et `claude-critics.md` P0-1/P0-3) :
- jusqu'où remonter la traçabilité (spore / gélose / LC) et QR à partir de quel stade ;
- durées, conditions (T°/humidité), observations **par stade et par espèce** ;
- liste réelle des espèces ; un process par espèce ou un seul multi-stade ;
- ratios de multiplication clone/transfert ; nombre max de générations ;
- vocabulaire exact, produits finaux, contenu des étiquettes, niveau de détail des emplacements.

Dans les docs, marquer ces points **« à confirmer »** plutôt que d'inventer des valeurs.

## Conventions de travail

- **Langue** : tous les documents sont en **français**. Garder ce registre.
- **Cohérence** : une décision change souvent plusieurs docs. Après une modif structurante, propager (ex. un nouveau champ du modèle touche `05`, `07`, `08`…) et mettre à jour `claude-critics.md` si un risque évolue.
- **Vérifier les HTML** : après édition d'un fichier `.html`, valider le JS — `awk '/<script[^>]*>/{f=1;next}/<\/script>/{f=0}f' fichier.html > /tmp/x.mjs && node --check /tmp/x.mjs`.
- **Ne pas réécrire** les exports JSON horodatés (ce sont des archives de réponses).
- **Git** : travailler sur une branche `docs/...` (pas `main` directement) ; ne committer/pusher que sur demande explicite. Ne pas committer `.DS_Store`.
- **MVP réaliste** : `claude-critics.md` recommande une **tranche verticale fine** (un seul stade de bout en bout, process en *seed data* plutôt qu'éditeur visuel complet) avant d'élargir. En tenir compte dans toute proposition d'implémentation future.

## Prochaines étapes logiques

1. Faire remplir le **questionnaire cultivateur** (`16`) — chemin critique n°1.
2. Figer le **modèle métier** (unité/stades/lignée) et le **premier process pleurote** en données.
3. Dé-risquer (spikes) : impression Nimbot B21 (BLE) et scanner QR iOS via Tailscale HTTPS.
4. **Seulement ensuite**, sur demande, créer le squelette de l'application.
