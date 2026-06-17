# 13 — Roadmap d’implémentation

## 1. Principe

Le produit doit être construit par incréments utilisables.

La priorité est un socle complet, mais livré progressivement pour éviter une application trop large avant validation terrain.

## 2. Phase 0 — Validation du cadrage

Objectifs :

- relire les documents ;
- répondre aux questions ouvertes ;
- confirmer le vocabulaire métier avec le cultivateur ;
- Hono REST validé ;
- MongoDB native driver + Zod validé ;
- modèle QR token opaque validé ;
- imprimante cible identifiée : Nimbot B21 ;
- clarifier driver/protocole Nimbot B21 ;
- accès réseau : Tailscale confirmé — valider HTTPS iOS (`tailscale serve` + cert TLS).

Livrables :

- cahier des charges validé ;
- modèle domaine validé ;
- première version process (pleurote, 1re espèce ; espèce configurable) ;
- backlog initial.

## 3. Phase 1 — Socle technique

Objectifs :

- créer monorepo Bun workspaces + TypeScript strict ;
- backend Hono ;
- frontend Vite/React ;
- MongoDB en replica set local via Docker Compose ;
- schémas Zod partagés ;
- OpenAPI automatique ;
- erreurs typées ;
- authentification admin simple ;
- audit events ;
- layout frontend Tailwind/shadcn ;
- outillage Vitest, Playwright, Husky/lint-staged.

Critère de sortie :

- utilisateur peut se connecter et accéder à une interface vide mais structurée.

## 4. Phase 2 — Sources, lots et QR

Objectifs :

- créer source ;
- créer lot ;
- générer QR ;
- résoudre QR ;
- fiche lot ;
- timeline événementielle ;
- impression QR initiale si driver prêt.

Critère de sortie :

- créer un ballot inoculé, imprimer son QR, le scanner depuis iPhone, voir sa fiche.

## 5. Phase 3 — Process configurable complet MVP

Objectifs :

- process template ;
- version de process ;
- phases ;
- étapes ;
- transitions ;
- actions configurables ;
- observations configurables ;
- mesures attendues ;
- formulaires dynamiques ;
- alertes ;
- éditeur de process complet ;
- changement d’étape ;
- actions en masse.

Critère de sortie :

- un lot suit un process configurable (pleurote pour commencer, espèce configurable), avec actions, observations et formulaires adaptés à sa phase/étape.

## 6. Phase 4 — Chambres, mouvements, mesures

Objectifs :

- config chambres/emplacements ;
- déplacement lot ;
- mesures manuelles ;
- observations terrain ;
- photos iPhone ;
- alertes simples.

Critère de sortie :

- en chambre, l’utilisateur scanne un lot et saisit une mesure ou observation.

## 7. Phase 5 — Division et généalogie

Objectifs :

- diviser un lot ;
- cloner une unité (culture secondaire, même stade) ;
- transférer/repiquer au stade suivant (gélose→LC→grain→substrat) ;
- créer sous-lots ;
- imprimer QR enfants ;
- afficher arbre parent/enfant multi-stade « du spore à l’assiette » ;
- filtrer par branche ;
- suivre emplacements différents.

Critère de sortie :

- un lot parent peut être divisé et chaque enfant est suivi indépendamment.

## 8. Phase 6 — Récoltes et produits finaux

Objectifs :

- enregistrer récolte ;
- gérer flush ;
- poids brut/net/pertes ;
- créer produit final ;
- stock simple ;
- traçabilité ascendante depuis produit.

Critère de sortie :

- un produit final peut être relié à son lot de culture d’origine.

## 9. Phase 7 — Dashboards et rapports

Objectifs :

- dashboard production ;
- alertes ;
- tâches du jour ;
- rendement par lot/chambre/période ;
- pertes et contaminations ;
- exports.

Critère de sortie :

- le responsable production voit l’état global et les rendements.

## 10. Phase 8 — Matériel avancé

Objectifs :

- stabiliser impression QR ;
- intégrer caméra Reolink ;
- snapshots programmés ;
- intégrer Inkbird si accès disponible ;
- historique température/humidité appareil ;
- alertes appareil hors ligne.

Critère de sortie :

- au moins une chambre affiche caméra et/ou mesures appareils.

## 11. Phase 9 — PWA/offline et durcissement

Objectifs :

- PWA installable si besoin terrain confirmé ;
- cache minimal ;
- gestion réseau instable ;
- file d’attente saisie si nécessaire ;
- sauvegardes automatisées ;
- tests de restauration.

Critère de sortie :

- l’application est robuste pour usage quotidien sur site.

## 12. Backlog priorisé MVP

Backlog MVP proposé après réponses développeur :

1. Socle monorepo Bun + TypeScript strict + tooling + Docker Compose.
2. Backend Hono + MongoDB replica set local + Zod + OpenAPI + erreurs typées.
3. Auth admin simple + audit events + migrations.
4. Modèle source / unité / lot + QR registry + public codes.
5. Impression Nimbot B21 + printJobs + réimpression.
6. Frontend React + Tailwind/shadcn + layout mobile/desktop + login.
7. Scan QR web intégré + fiche unité mobile + timeline.
8. Moteur process configurable + éditeur complet + actions / observations / formulaires dynamiques.
9. Mesures, observations, chambres, actions en masse et changements d’étape.
10. Récoltes complètes, produits/stock simple, dashboard, rapports MVP, tests E2E.

Hors MVP :

- caméra Reolink ;
- Inkbird ;
- offline avancé ;
- ventes ;
- facturation ;
- contrôle actif des appareils.

## 13. Risques de planning

- intégration Nimbot B21 plus longue que prévu ;
- scan web iPhone nécessitant HTTPS : adressé par Tailscale confirmé (`serve` + cert TLS), à valider sur Safari iOS ;
- compréhension incomplète du process cultivateur ;
- modèle process configurable complet trop ambitieux ;
- exécution fiable sur Raspberry Pi ;
- accès Inkbird non documenté ou dépendant du cloud ;
- généalogie multi-origine difficile si mélanges fréquents ;
- chaîne amont (gélose, LC, grain) élargit fortement le périmètre vs le seul substrat.

## 14. Recommandation de développement

Commencer avec un process pleurote configuré dans la base (espèce configurable, autres espèces ajoutables sans recoder), pas codé en dur.

Décision développeur : viser un éditeur de process complet dès le MVP. Si la complexité devient trop élevée, garder le modèle configurable complet mais livrer d’abord une interface admin simplifiée.

Synthèse complète des réponses développeur : [18-decisions-techniques-dev.md](./18-decisions-techniques-dev.md).
