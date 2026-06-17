# formulaire_html_questions_dev

- Source: ht_plan_set
- Created: 2026-06-17T15:53:14.373Z

## Sidebar steps

- [ ] **step-1** — Relire docs techniques
- [ ] **step-2** — Créer formulaire dev HTML
- [ ] **step-3** — Mettre à jour README
- [ ] **step-4** — Vérifier export et syntaxe
## Detailed plan

# Plan — formulaire HTML questions développeur

## Objectif
Créer un formulaire HTML autonome destiné au développeur, dans la même logique que le formulaire cultivateur : UI/UX soignée, autosauvegarde locale, statuts par question, modification des questions, export/import JSON et export Markdown.

## Approche
1. Relire les documents techniques existants pour extraire les décisions développeur à clarifier : architecture, MongoDB, API, QR, réseau local, déploiement, sécurité, matériel.
2. Créer `docs/17-formulaire-questions-dev.html` avec une interface autonome, sans dépendance externe.
3. Inclure des sections orientées décisions techniques : stack, architecture, typage, base de données, process configurable, API, frontend, QR/impression, iPhone local, Reolink/Inkbird, sécurité, tests, sauvegardes, roadmap.
4. Ajouter import/export JSON, export Markdown, statuts par question et autosauvegarde locale.
5. Mettre à jour `docs/README.md` et vérifier le fichier HTML.

## Fichiers impactés
- Lecture : `docs/06-architecture-technique.md`, `docs/07-modele-donnees-mongodb.md`, `docs/08-contrats-api.md`, `docs/14-questions-ouvertes.md`.
- Création : `docs/17-formulaire-questions-dev.html`.
- Modification : `docs/README.md`.

## Validation
- Le HTML doit s’ouvrir directement dans un navigateur.
- Chaque question doit pouvoir être répondue, modifiée, marquée non pertinente ou à clarifier.
- Le JSON exporté doit contenir métadonnées, sections, questions, statuts, réponses, choix et tableaux.
- Le JSON doit être réimportable.
- Aucun backend ni dépendance externe.

## Risques
- Certaines décisions devront attendre les réponses du cultivateur ; elles seront marquées comme dépendances ou questions à clarifier.

## Rollback
Supprimer `docs/17-formulaire-questions-dev.html` et retirer son lien du README.
