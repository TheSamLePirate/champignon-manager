# 06 — Architecture technique

## 1. Stack cible

- Runtime/backend : Bun + TypeScript strict.
- Frontend : Vite + React + TypeScript strict.
- Base de données : MongoDB.
- API : Hono REST + schémas Zod + client frontend typé.
- Interface mobile : web responsive iPhone, PWA non obligatoire au MVP.
- UI : Tailwind + shadcn/ui recommandés pour une interface soignée et maintenable.
- Impression : service backend local compatible imprimante QR Node.js, cible matérielle Nimbot B21.
- Déploiement : Docker Compose, dev macOS/Windows 11, production locale Raspberry Pi.
- Réseau : **Tailscale confirmé** comme réseau d’accès (local étendu et distant). HTTPS fourni par Tailscale (`tailscale serve` + certificat TLS Let’s Encrypt sur le domaine `ts.net`).
- Caméra : intégration future Reolink via module dédié après MVP.
- Capteurs/contrôleurs futurs : Inkbird ITC-308-WIFI et Inkbird IHC-200-WIFI après MVP.

## 2. Objectif de typage

L’application doit être typée de bout en bout :

- validation des entrées API ;
- types partagés entre backend et frontend ;
- schémas MongoDB cohérents avec les types métier ;
- contrats API générables ou inférables ;
- formulaires frontend alignés avec les schémas backend.

## 3. Architecture logique

```text
Frontend React
  ├─ écrans desktop dashboard/configuration
  ├─ écrans mobile scan/action rapide
  ├─ client API typé
  └─ cache données UI

Backend Bun
  ├─ routes API
  ├─ services métier
  ├─ validation et permissions
  ├─ repositories MongoDB
  ├─ service QR / impression
  ├─ service fichiers/photos
  ├─ service caméra Reolink futur
  └─ jobs/alertes

MongoDB
  ├─ collections opérationnelles
  ├─ collections configuration
  ├─ événements/audit
  └─ index de recherche/traçabilité
```

> Ce schéma est descriptif. Il ne correspond pas encore à des fichiers de code.

## 4. Recommandation backend

Pour Bun + TypeScript, deux options sont pertinentes :

### Option recommandée : Hono + schémas de validation

Avantages :

- léger ;
- compatible Bun ;
- adapté à une API locale ;
- peut générer des contrats OpenAPI ;
- simple à tester ;
- bon contrôle des middlewares : auth, permissions, logs.

### Alternative : tRPC

Avantages :

- typage frontend/backend très direct ;
- productivité élevée ;
- moins de duplication.

Inconvénient potentiel :

- API moins standard si l’on veut plus tard intégrer d’autres clients.

### Décision validée

Démarrer avec **Hono + validation de schémas Zod + client frontend typé**. Garder tRPC comme alternative future si la priorité absolue devient la vitesse de développement full TypeScript.

## 5. Validation de données

Utiliser une librairie de schémas TypeScript au centre de l’architecture.

Rôle des schémas :

- valider les requêtes API ;
- valider les documents avant insertion MongoDB ;
- décrire les formulaires dynamiques ;
- produire des types TypeScript ;
- documenter les contrats API.

Options possibles :

- Zod ;
- Valibot ;
- TypeBox.

Décision validée : **Zod** pour démarrer, car très courant, lisible et adapté au partage de contrats TypeScript.

## 6. Accès MongoDB

Deux approches possibles :

### Native MongoDB driver + schémas applicatifs

Avantages :

- contrôle total ;
- proche de MongoDB ;
- performant ;
- évite la complexité de certains ODM.

### Mongoose

Avantages :

- modèles et hooks intégrés ;
- validation côté modèle ;
- écosystème connu.

Décision validée : **MongoDB native driver + schémas TypeScript/Zod**, pour garder un modèle événementiel flexible et fortement validé côté application.

## 7. Modules backend prévus

| Module | Responsabilité |
| --- | --- |
| auth | Sessions, utilisateurs, rôles. |
| users | Gestion utilisateurs. |
| config | Espèces, chambres, process templates, produits. |
| sources | Création et suivi des sources. |
| lots | Lots, sous-lots, statuts, généalogie. |
| events | Journal d’événements et audit. |
| measurements | Mesures et observations. |
| harvests | Récoltes, flushs, pertes. |
| products | Produits finaux et stocks. |
| qr | Génération, résolution et registre QR. |
| printing | Impression d’étiquettes. |
| files | Photos, captures, pièces jointes. |
| cameras | Intégration Reolink future. |
| devices | Capteurs/contrôleurs futurs : Inkbird température/humidité, autres matériels. |
| alerts | Règles, tâches, notifications locales. |
| reports | Rendements, dashboards, exports. |

## 8. Modules frontend prévus

| Module | Responsabilité |
| --- | --- |
| app-shell | Layout, navigation, session. |
| dashboard | Vue globale production. |
| scan | Scan QR mobile et résolution. |
| lots | Liste, fiche, historique, généalogie. |
| lot-actions | Actions rapides selon état courant. |
| chambers | Vue chambres, emplacements, mouvements. |
| measurements | Formulaires mesures/observations. |
| harvests | Saisie récolte, rendement. |
| products | Produits finaux, stock. |
| process-config | Éditeur de process. |
| settings | Utilisateurs, imprimante, unités, caméra. |
| reports | Statistiques et exports. |

## 9. Architecture de traçabilité

Recommandation : approche hybride.

- Les collections principales stockent l’état courant pour les écrans rapides.
- Une collection d’événements stocke tout l’historique immuable.
- Les modifications critiques passent par un service métier qui :
  1. valide l’action ;
  2. écrit l’événement ;
  3. met à jour l’état courant ;
  4. retourne la fiche mise à jour.

Cela évite d’avoir à reconstruire tous les écrans depuis l’historique, tout en conservant l’audit.

## 10. Architecture locale

Déploiement local envisagé :

- backend lancé sur une machine du réseau local ;
- développement sur Mac mini et Windows 11 ;
- production locale cible sur Raspberry Pi ;
- orchestration par Docker Compose ;
- MongoDB local, idéalement en replica set local pour les transactions ;
- frontend servi par le backend ou build statique ;
- iPhone connecté au backend via Tailscale (même tailnet) ;
- URL d’accès = nom MagicDNS Tailscale stable (ex. `champignon.<tailnet>.ts.net`) ;
- HTTPS fourni par Tailscale (`serve` + certificat TLS), ce qui satisfait le contexte sécurisé requis par le scanner web iOS (`getUserMedia`) ;
- imprimante Nimbot B21 accessible depuis la machine backend ;
- caméra Reolink accessible sur le réseau local plus tard ;
- contrôleurs Inkbird Wi‑Fi intégrés plus tard, si API ou passerelle disponible.

## 11. Photos et fichiers

Options :

- stockage local sur disque avec chemin référencé en MongoDB ;
- GridFS MongoDB ;
- stockage objet local type MinIO si le volume devient important.

Décision validée pour MVP : stockage local organisé, avec métadonnées MongoDB.

## 12. Jobs et automatisations

À prévoir :

- calcul des alertes ;
- snapshots caméra programmés ;
- génération de timelapse future ;
- import ou lecture périodique de valeurs Inkbird température/humidité si techniquement possible ;
- sauvegarde de base ;
- nettoyage fichiers orphelins ;
- exports périodiques.

## 13. Sécurité locale

Même en local :

- authentification obligatoire ou mode opérateur contrôlé ;
- permissions côté backend ;
- journal d’audit ;
- protection contre modification par URL directe ;
- sauvegardes ;
- secret de session ;
- QR tokens non prédictibles.

## 14. Structure future du dépôt

Quand le codage commencera, une structure possible sera :

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

Cette structure n’est pas créée maintenant ; elle sert de direction validée pour un monorepo Bun workspaces maintenable.

## 15. Décisions développeur intégrées

Synthèse complète : [18-decisions-techniques-dev.md](./18-decisions-techniques-dev.md).

Décisions clés :

- MVP orienté production réelle, pas démo.
- Process complet attendu au MVP, alimenté par les réponses cultivateur.
- Reolink, Inkbird, offline avancé, ventes, facturation et contrôle actif sont repoussés après MVP.
- TypeScript strict, Zod, Hono, MongoDB native driver, OpenAPI automatique.
- Tests élevés : Vitest, Playwright, formulaires dynamiques testés, validation locale au départ.
- UI mobile iPhone prioritaire avec gros boutons, contraste, mode sombre et confirmations.
