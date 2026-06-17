# 18 — Décisions techniques développeur

Source : `docs/champignon-reponses-dev-sam-2026-06-17.json`  
Répondant : Sam  
Date : 2026-06-17  
Progression du formulaire : 74 / 79 réponses, 1 point à clarifier, 4 à compléter.

## 1. Décision produit / MVP

Le MVP doit être une application réellement utilisable en production, pas seulement une démo.

Périmètre MVP retenu :

- création source / unité ;
- génération QR ;
- scan QR depuis iPhone ;
- fiche unité mobile ;
- timeline complète ;
- changement d’étape ;
- mesures ;
- récolte complète ;
- process complet construit à partir des réponses du cultivateur ;
- impression QR stable ;
- gestion d’erreurs complète ;
- sauvegardes robustes.

Fonctionnalités explicitement repoussées après MVP :

- caméra Reolink ;
- Inkbird ;
- offline avancé ;
- ventes ;
- facturation ;
- contrôle actif des appareils.

## 2. Dépendances métier

Les décisions suivantes dépendent des réponses du cultivateur :

- vocabulaire exact ;
- phases de culture ;
- étapes ;
- actions disponibles ;
- observations ;
- produits finaux ;
- contenu des étiquettes ;
- chambres et emplacements.

Ces sujets ne doivent pas être figés définitivement tant que le questionnaire cultivateur n’est pas traité.

## 3. Stack et architecture validées

Stack cible confirmée :

- Bun ;
- TypeScript strict ;
- Vite ;
- React ;
- MongoDB ;
- Docker Compose pour le déploiement local.

Environnements cibles :

- développement : macOS et Windows 11 ;
- production locale : Raspberry Pi ;
- accès distant/local étendu : Tailscale.

Architecture de dépôt : monorepo Bun workspaces avec structure modulaire de type application “AAA” :

```text
apps/
  api/
  web/
packages/
  domain/
  shared/
  config-schemas/
  database/
  api-contracts/
  ui/
  testing/
docs/
```

## 4. Qualité TypeScript et outillage

Décisions :

- TypeScript strict et bonnes pratiques avancées ;
- Vitest ;
- Playwright ;
- Husky / lint-staged ;
- outillage stable complémentaire à sélectionner au démarrage.

Recommandation technique associée :

- Biome pour format/lint si compatible avec les besoins ;
- `tsc --noEmit` comme validation de typage ;
- tests unitaires et intégration exécutables localement ;
- CI distante non prioritaire au MVP.

## 5. Backend et API

Choix backend :

- Hono ;
- REST HTTP/JSON ;
- schémas Zod ;
- client API typé côté frontend ;
- documentation OpenAPI automatique ;
- tRPC non retenu pour le MVP, mais possible plus tard si besoin.

Style API :

- endpoints métier explicites ;
- modèle d’erreur typé et détaillé ;
- format de réponse standard ;
- validation stricte des entrées ;
- actions métier auditables.

Modules backend MVP :

- `config` ;
- `sources` ;
- `lots` ;
- `events` ;
- `measurements` ;
- `harvests` ;
- `products` ;
- `qr` ;
- `printing` ;
- `files` ;
- `alerts` ;
- `reports` ;
- auth/admin minimal nécessaire même si non priorisé dans la checklist.

Modules après MVP :

- `cameras` ;
- `devices` ;
- contrôle matériel actif.

## 6. Typage, validation et contrats

Décisions :

- Zod comme librairie de schémas ;
- séparation en trois couches :
  - Domain Model ;
  - DTO / contrats API ;
  - documents MongoDB ;
- packages partagés :
  - `packages/domain` ;
  - `packages/shared` ;
  - `packages/config-schemas`.

Formulaires dynamiques :

- champs configurables ;
- validation par type ;
- unités ;
- champs obligatoires optionnels par configuration ;
- choix ;
- bornes ;
- photo requise ou optionnelle ;
- validation frontend et backend alignée.

Dates et unités :

- stockage backend en UTC / ISO ;
- affichage en français, timezone Europe/Paris ;
- unités métriques par défaut : g, kg, °C, %, ppm, lux si nécessaire.

Identifiants :

- ID interne MongoDB ;
- `publicCode` lisible humain ;
- token QR opaque ;
- liens de traçabilité par `sourceId`, `parentLotId`, `rootLotId`, chemins de lignée et événements.

## 7. MongoDB

Choix :

- MongoDB native driver ;
- validation applicative par Zod ;
- approche hybride état courant + événements immuables ;
- replica set local recommandé pour transactions ;
- migrations par scripts versionnés ;
- collection `schemaMigrations` ;
- validation au démarrage.

Transactions nécessaires :

- création source + lot + QR + événement ;
- division ;
- récolte + stock ;
- correction / annulation.

Collections MVP retenues :

- `users` ;
- `sites` ;
- `species` ;
- `strains` ;
- `locations` ;
- `processTemplates` ;
- `processVersions` ;
- `sources` ;
- `lots` ;
- `events` ;
- `measurements` ;
- `observations` ;
- `harvests` ;
- `productBatches` ;
- `qrRegistry` ;
- `printJobs` ;
- `files` ;
- `alerts` ;
- `tasks`.

Collections après MVP :

- `cameras` ;
- `cameraCaptures` ;
- `devices` ;
- `deviceReadings`.

## 8. Process configurable

Décision : l’application doit prévoir un moteur de process très détaillé, avec éditeur complet au MVP.

Le process doit modéliser :

- phases ;
- étapes ;
- transitions ;
- actions configurables ;
- observations configurables ;
- mesures attendues ;
- formulaires dynamiques ;
- alertes ;
- actions en masse ;
- sélection par parent, date, phase, chambre, espèce ou statut.

Point à clarifier : versioning / migration d’un process déjà utilisé par des lots.

Décision provisoire recommandée :

- `processVersions` publiées et immuables ;
- un lot référence une version ;
- modification du process = nouvelle version ;
- migration manuelle assistée uniquement.

## 9. Frontend et UX

Décisions :

- React + Vite ;
- UI très soignée ;
- Tailwind + shadcn/ui recommandés ;
- PWA non obligatoire au MVP ;
- interface responsive mobile iPhone prioritaire ;
- gros boutons ;
- mode sombre ;
- contraste fort ;
- peu de champs ;
- confirmations pour actions critiques.

Écrans prioritaires :

- dashboard ;
- scan QR ;
- fiche lot mobile ;
- liste lots ;
- timeline lot ;
- actions rapides lot ;
- chambres ;
- mesures / observations ;
- récolte ;
- produits / stock ;
- configuration process ;
- rapports ;
- settings imprimante ;
- login minimal à ajouter car auth retenue.

Recommandation technique :

- TanStack Router ou React Router ;
- TanStack Query pour cache serveur ;
- React Hook Form + Zod pour formulaires ;
- générateur de formulaire dynamique pour process configurable.

## 10. QR, impression et réseau local

Décisions :

- QR payload : token opaque seulement ;
- scan : scanner web intégré ;
- URL / accès : **Tailscale confirmé** — URL = nom MagicDNS `ts.net`, HTTPS via `tailscale serve` ;
- imprimante : Nimbot B21 ;
- jobs d’impression : `printJobs` avec retry, statut, erreur, copies, réimpression, test imprimante, logs ;
- QR abîmé/perdu : réimpression du même token par défaut.

Recommandation de sécurité pragmatique :

- même si “pas besoin de sécurité” en réseau local, le token doit rester non prédictible ;
- les actions de modification restent derrière login ;
- les scans sont historisés.

## 11. Auth, sécurité et audit

Décisions :

- login / mot de passe simple au MVP ;
- rôle unique `admin` au départ ;
- tailnet Tailscale (confirmé) considéré comme environnement de confiance ;
- CORS local ;
- HTTPS fourni par Tailscale (`serve` + certificat TLS) ;
- toutes les actions importantes doivent être auditables.

Correction / suppression :

- la réponse indique “suppression” ;
- pour rester compatible avec “tout auditer”, la suppression métier doit être interprétée comme suppression logique ou événement d’annulation ;
- suppression physique réservée aux données non métier ou à la maintenance admin contrôlée.

## 12. Déploiement, fichiers et sauvegardes

Décisions :

- Docker Compose ;
- dev sur Mac mini et Windows 11 ;
- production locale sur Raspberry Pi ;
- stockage fichiers/photos : disque local + métadonnées MongoDB ;
- sauvegardes : Mongo dump + fichiers photos ;
- définir fréquence, destination, rétention ;
- tester la restauration ;
- logs visibles dans un dashboard admin ;
- accès distant via Tailscale (confirmé).

## 13. Matériel futur

Décision : remettre après MVP.

Concerne :

- Reolink ;
- Inkbird ITC-308-WIFI ;
- Inkbird IHC-200-WIFI ;
- `deviceReadings` ;
- alertes matérielles ;
- contrôle actif.

La base et l’architecture doivent rester prêtes pour ces modules, mais ils ne doivent pas ralentir le MVP métier.

## 14. Tests et critères d’acceptation

Décisions :

- tout rendre testable ;
- objectif de couverture très élevé ;
- Vitest pour tests unitaires / intégration ;
- Playwright pour E2E ;
- tests des formulaires dynamiques ;
- seeds / fixtures oui ;
- validation locale uniquement au départ.

Critères “feature terminée” :

- tests ;
- validation terrain ;
- capture écran si UI ;
- documentation JSON / Markdown à jour ;
- migrations si nécessaire ;
- logs ;
- rollback prévu.

## 15. Risques techniques

Risques identifiés :

- iPhone + HTTPS : adressé par Tailscale (`serve` + cert TLS) — reste à valider sur Safari iOS (spike) ;
- configuration et ACL du tailnet Tailscale ;
- compréhension exacte du process cultivateur ;
- impression Nimbot B21 ;
- complexité du process configurable complet ;
- exécution fiable sur Raspberry Pi.

Pas de prototype obligatoire prévu, mais possibilité de créer un dossier de test projet pour valider une librairie ou une implémentation en cas de doute.

## 16. Backlog MVP proposé en 10 blocs

Le formulaire n’a pas rempli cette partie. Proposition cohérente avec les réponses :

1. Socle monorepo Bun + TypeScript strict + tooling + Docker Compose.
2. Backend Hono + MongoDB replica set local + Zod + OpenAPI + erreurs typées.
3. Auth admin simple + audit events + migrations.
4. Modèle source / unité / lot + QR registry + public codes.
5. Impression Nimbot B21 + printJobs + réimpression.
6. Frontend React + shadcn/Tailwind + layout mobile/desktop + login.
7. Scan QR web intégré + fiche unité mobile + timeline.
8. Moteur process configurable + éditeur complet + actions / observations / formulaires dynamiques.
9. Mesures, observations, chambres, actions en masse et changements d’étape.
10. Récoltes complètes, produits/stock simple, dashboard, rapports MVP, tests E2E.

## 17. Points encore ouverts

- Réponses cultivateur à intégrer.
- Versioning / migration des process déjà utilisés.
- Format final des `publicCode`.
- Détails de l’imprimante Nimbot B21 côté protocole/driver.
- Tailscale / URL / HTTPS : **stratégie close** (Tailscale confirmé, HTTPS via `serve`, URL MagicDNS `ts.net`) — reste à fixer le hostname exact au déploiement.
- Politique concrète de sauvegarde : fréquence, destination, rétention.
- Niveau réel de couverture de test atteignable au MVP.
