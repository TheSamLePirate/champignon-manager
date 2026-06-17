# formulaire_html_reponses_cultivateur

- Source: ht_plan_set
- Created: 2026-06-17T15:06:07.928Z

## Sidebar steps

- [ ] **step-1** — Relire le questionnaire
- [ ] **step-2** — Créer le HTML design
- [ ] **step-3** — Ajouter export/import JSON
- [ ] **step-4** — Mettre à jour README
- [ ] **step-5** — Vérifier le formulaire
## Detailed plan

# Plan révisé — formulaire HTML design + export JSON

## Objectif
Créer un document HTML autonome, agréable à utiliser, avec une vraie UI/UX, permettant au cultivateur de répondre au questionnaire process.

Le formulaire doit générer principalement un **fichier de réponses JSON** transmissible au développeur, et réimportable plus tard pour continuer ou corriger.

## Exigences confirmées
- Interface soignée, claire, responsive, utilisable facilement sur ordinateur ou tablette.
- Export JSON prioritaire.
- Import JSON pour reprendre/modifier les réponses.
- Export Markdown lisible en bonus.
- Autosauvegarde locale dans le navigateur.
- Chaque question doit pouvoir être :
  - répondue ;
  - modifiée côté libellé si la question est mal formulée ;
  - classée `Non pertinent` ;
  - classée `À clarifier` ;
  - laissée `À répondre`.
- Aucun backend requis.
- Aucune dépendance externe.

## Approche
1. Relire le questionnaire Markdown existant pour reprendre les sections et questions.
2. Créer `docs/16-formulaire-reponses-cultivateur.html` avec :
   - design moderne ;
   - navigation par sections ;
   - progression globale ;
   - cartes de questions ;
   - statut par question ;
   - champs de réponses confortables ;
   - filtres par statut ;
   - export JSON ;
   - import JSON ;
   - export Markdown ;
   - impression.
3. Mettre à jour `docs/README.md` avec le lien.
4. Vérifier que le HTML est autonome et contient les sections clés.

## Fichiers impactés
- Lecture : `docs/15-questionnaire-cultivateur-process.md`.
- Création : `docs/16-formulaire-reponses-cultivateur.html`.
- Modification : `docs/README.md`.

## Validation
- Ouvrir le HTML directement dans un navigateur doit fonctionner.
- Les réponses doivent être exportables en `.json`.
- Le JSON doit contenir les métadonnées, sections, questions, libellés modifiés, statuts et réponses.
- Les réponses doivent être réimportables via le même HTML.
- Toutes les questions principales du document Markdown doivent être représentées.

## Risques
- Comme c’est un HTML autonome, les données restent dans le navigateur tant qu’elles ne sont pas exportées.
- L’export JSON devra être utilisé régulièrement pour éviter une perte liée au navigateur.

## Rollback
Supprimer `docs/16-formulaire-reponses-cultivateur.html` et retirer son lien du README.
