# 13 — Roadmap d’implémentation

## 1. Principe

Le produit doit être construit par incréments utilisables.

La priorité est un socle complet, mais livré progressivement pour éviter une application trop large avant validation terrain.

## 2. Phase 0 — Validation du cadrage

Objectifs :

- relire les documents ;
- répondre aux questions ouvertes ;
- confirmer le vocabulaire métier ;
- choisir REST/Hono ou tRPC ;
- confirmer stratégie MongoDB ;
- confirmer modèle de QR ;
- identifier l’imprimante QR exacte.

Livrables :

- cahier des charges validé ;
- modèle domaine validé ;
- première version process pleurotes ;
- backlog initial.

## 3. Phase 1 — Socle technique

Objectifs :

- créer monorepo Bun/TypeScript ;
- backend API ;
- frontend Vite/React ;
- connexion MongoDB ;
- schémas partagés ;
- authentification locale ;
- layout frontend ;
- système de permissions.

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

## 5. Phase 3 — Process configurable minimum

Objectifs :

- process template ;
- version de process ;
- phases ;
- étapes ;
- transitions ;
- actions disponibles ;
- observations configurables ;
- changement d’étape.

Critère de sortie :

- un lot suit un process pleurotes configurable, avec actions adaptées à son étape.

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
- créer sous-lots ;
- imprimer QR enfants ;
- afficher arbre parent/enfant ;
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

- PWA installable ;
- cache minimal ;
- gestion réseau instable ;
- file d’attente saisie si nécessaire ;
- sauvegardes automatisées ;
- tests de restauration.

Critère de sortie :

- l’application est robuste pour usage quotidien sur site.

## 12. Backlog priorisé MVP

Priorité très haute :

- lot/source ;
- QR scan ;
- fiche mobile ;
- événements ;
- process minimal ;
- observations/mesures ;
- chambres ;
- impression.

Priorité haute :

- division ;
- récolte ;
- produit final ;
- stock simple ;
- dashboard.

Priorité moyenne :

- photos ;
- rapports avancés ;
- caméra ;
- Inkbird ;
- PWA offline.

## 13. Risques de planning

- intégration imprimante plus longue que prévu ;
- accès Inkbird non documenté ou dépendant du cloud ;
- HTTPS local requis pour certaines fonctions iPhone ;
- modèle process trop flexible et donc complexe ;
- généalogie multi-origine difficile si mélanges fréquents.

## 14. Recommandation de développement

Commencer avec un process pleurotes simple mais configuré dans la base, pas codé en dur.

Même si l’interface de configuration complète arrive plus tard, les données doivent déjà utiliser le modèle configurable.
