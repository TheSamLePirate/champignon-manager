# documentation_cahier_champignon_manager

- Source: ht_plan_set
- Created: 2026-06-17T14:30:59.321Z

## Sidebar steps

- [ ] **step-1** — Vérifier le dossier projet
- [ ] **step-2** — Formaliser les besoins métier
- [ ] **step-3** — Rédiger l’architecture docs
- [ ] **step-4** — Définir le modèle MongoDB
- [ ] **step-5** — Relire et valider les MD
## Detailed plan

# Plan de session — cahier des charges et architecture documentaire

## Objectif
Créer uniquement des fichiers Markdown pour cadrer une future application Bun + TypeScript + Vite + React + MongoDB, entièrement typée, destinée à gérer la culture de champignons — notamment pleurotes — depuis une source/ballot inoculé avec QR code jusqu’aux produits finaux prêts à la vente.

Aucun code applicatif ne sera produit pendant cette session.

## Approche
1. Vérifier rapidement l’état du dossier projet pour confirmer qu’il est vide ou quasi vide.
2. Recueillir les besoins métier connus et structurer les zones d’incertitude sous forme de questions ouvertes.
3. Créer une arborescence documentaire claire dans `docs/`, couvrant :
   - cahier des charges fonctionnel ;
   - vocabulaire métier et modèle de domaine ;
   - flux de lots, divisions, chambres, mesures et produits finaux ;
   - configuration du process de culture ;
   - architecture backend/frontend ;
   - modèle MongoDB typé ;
   - contrats API prévus ;
   - QR code, impression, scan iPhone en interface web locale ;
   - intégration future caméra Reolink ;
   - exigences non fonctionnelles ;
   - roadmap de réalisation ;
   - questions à trancher.
4. Rédiger des documents suffisamment précis pour permettre ensuite de coder directement l’application avec une architecture cohérente.
5. Relire les fichiers produits et vérifier qu’il n’y a pas de code généré accidentellement.

## Fichiers / zones à créer
Arborescence cible proposée :

```text
docs/
  README.md
  00-cahier-des-charges.md
  01-glossaire-metier.md
  02-personas-et-droits.md
  03-flux-metier-tracabilite.md
  04-processus-configurable.md
  05-modele-domaine.md
  06-architecture-technique.md
  07-modele-donnees-mongodb.md
  08-contrats-api.md
  09-interface-frontend-ux.md
  10-qr-impression-scan.md
  11-mesures-observations-camera.md
  12-exigences-non-fonctionnelles.md
  13-roadmap-implementation.md
  14-questions-ouvertes.md
```

## Validation
- Tous les livrables sont des fichiers `.md`.
- Aucune initialisation Bun/Vite/React, aucun fichier de code, aucune dépendance installée.
- Les documents décrivent une application full-stack typée avec backend, frontend, MongoDB, QR code, traçabilité par lots, process configurable, future caméra Reolink.
- Les questions ouvertes sont centralisées pour guider les prochaines décisions.

## Risques / points d’attention
- Certaines règles métier ne sont pas encore connues : vocabulaire exact, étapes de culture, mesures, statuts, droits utilisateurs, types de produits finis, contraintes réglementaires éventuelles.
- Les détails matériels de l’imprimante QR et de la caméra Reolink seront gardés au niveau architecture/intégration future, sans implémentation.
- Le modèle MongoDB devra rester suffisamment flexible pour un process configurable, sans devenir trop vague.

## Rollback / nettoyage
Comme seuls des fichiers Markdown seront créés, le rollback consiste à supprimer le dossier `docs/` ou à retirer les fichiers non souhaités.
