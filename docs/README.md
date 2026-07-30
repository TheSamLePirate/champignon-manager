# Champignon Manager — Documentation de cadrage

Ce dossier contient le cadrage fonctionnel, métier et technique de la future application de gestion de culture de champignons.

Stack cible envisagée : **Bun + TypeScript + Vite + React + MongoDB**, avec un backend et un frontend entièrement typés.

> Cette session ne produit pas de code applicatif. Les fichiers présents ici servent de base de cahier des charges et d’architecture pour coder ensuite l’application.

## État du cadrage — 2026-07-30

Le questionnaire cultivateur est renseigné à **139 / 188**. La **structure métier est figée** ; il manque **toutes les valeurs de terrain**.

**Acquis** — une unité est tout objet physique manipulé, à tout stade, avec son QR dès sa création ; entrée possible à n'importe quel stade (donc sans ascendant) ; clone, division et conservation partout, sans limite de génération ; conservation et archivage réversibles, la sortie de conservation créant une **nouvelle** unité ; process et sous-process réutilisables ; **le passage d'étape se décide à l'observation visuelle**, la durée n'étant qu'un rappel ; emplacement suivi jusqu'à la position ; poids par unité + qualité + pertes avec cause à chaque flush.

**Bloquant** — aucune durée, température, humidité, aucun ratio ni seuil d'alarme, aucune liste d'espèces. Le tableau §20 du questionnaire `15` reste vide : **aucun process ne peut être amorcé en seed data**, donc l'implémentation ne peut pas démarrer.

Synthèse détaillée : [14 §18](./14-questions-ouvertes.md) · revue critique : [claude-critics.md](../claude-critics.md) §9.

## Objectif produit

Permettre à un utilisateur sur site de suivre toute la chaîne de culture :

1. création d’une source, par exemple un ballot déjà inoculé ;
2. impression d’un QR code associé ;
3. suivi du lot tout au long d’un process configurable ;
4. division ou déplacement du lot entre chambres, zones et contenants ;
5. saisie de mesures, observations, pertes, récoltes et événements ;
6. transformation éventuelle en produits finaux configurables ;
7. consultation rapide via scan QR depuis iPhone sur une interface web locale ;
8. intégration future d’une caméra Reolink pour suivre la pousse ;
9. intégration future d’appareils Inkbird ITC-308-WIFI et IHC-200-WIFI pour température/humidité.

## Documents

| Fichier | Rôle |
| --- | --- |
| [00-cahier-des-charges.md](./00-cahier-des-charges.md) | Vision, périmètre, objectifs et exigences fonctionnelles principales. |
| [01-glossaire-metier.md](./01-glossaire-metier.md) | Vocabulaire commun : source, lot, sous-lot, chambre, récolte, produit, etc. |
| [02-personas-et-droits.md](./02-personas-et-droits.md) | Utilisateurs, rôles et permissions. |
| [03-flux-metier-tracabilite.md](./03-flux-metier-tracabilite.md) | Flux de traçabilité depuis le mycélium jusqu’au produit final. |
| [04-processus-configurable.md](./04-processus-configurable.md) | Modèle de process configurable : étapes, formulaires, transitions, alertes. |
| [05-modele-domaine.md](./05-modele-domaine.md) | Entités métier et relations. |
| [06-architecture-technique.md](./06-architecture-technique.md) | Architecture backend/frontend, typage, services et modules. |
| [07-modele-donnees-mongodb.md](./07-modele-donnees-mongodb.md) | Collections MongoDB, index, stratégie de traçabilité. |
| [08-contrats-api.md](./08-contrats-api.md) | Ressources API prévues et contrats fonctionnels. |
| [09-interface-frontend-ux.md](./09-interface-frontend-ux.md) | Écrans, parcours mobiles et interface opérateur. |
| [10-qr-impression-scan.md](./10-qr-impression-scan.md) | QR codes, impression, scan iPhone et règles de sécurité. |
| [11-mesures-observations-camera.md](./11-mesures-observations-camera.md) | Mesures, observations, photos, caméra Reolink. |
| [12-exigences-non-fonctionnelles.md](./12-exigences-non-fonctionnelles.md) | Robustesse, sauvegardes, réseau local, sécurité, performance. |
| [13-roadmap-implementation.md](./13-roadmap-implementation.md) | Découpage en phases de réalisation. |
| [14-questions-ouvertes.md](./14-questions-ouvertes.md) | Questions métier et techniques à trancher avant codage. |
| [15-questionnaire-cultivateur-process.md](./15-questionnaire-cultivateur-process.md) | Questionnaire vulgarisé à faire remplir au cultivateur sur le process réel. |
| [16-formulaire-reponses-cultivateur.html](./16-formulaire-reponses-cultivateur.html) | Formulaire HTML autonome avec autosauvegarde, import/export JSON et export Markdown. |
| [17-formulaire-questions-dev.html](./17-formulaire-questions-dev.html) | Formulaire HTML autonome pour les décisions développeur : architecture, API, DB, QR, déploiement. |
| [18-decisions-techniques-dev.md](./18-decisions-techniques-dev.md) | Synthèse des réponses développeur et décisions techniques retenues. |
| [19-atlas-process-flux.html](./19-atlas-process-flux.html) | Atlas visuel **interactif** des process et flux métier (chaîne de propagation, laboratoire, substrat, **moteur de process**, lignée, traçabilité, états). Diagrammes data-driven (Mermaid), éditables. |
| [index.html](./index.html) | Page d'accueil publique (GitHub Pages) : état du cadrage, outils interactifs, index documentaire. |
| [champignon-reponses-cultivateur-2026-07-30.json](./champignon-reponses-cultivateur-2026-07-30.json) | Export brut des réponses cultivateur — **archive horodatée, ne pas réécrire**. Son `summary` annonce 100 %, mais 104 des 188 questions étaient vides. |
| [champignon-reponses-dev-sam-2026-06-17.json](./champignon-reponses-dev-sam-2026-06-17.json) | Export brut des réponses développeur — **archive horodatée, ne pas réécrire**. |

## Décisions initiales proposées

- Le cœur de l’application est la **traçabilité par événements** : chaque action importante crée un événement horodaté et attribué à un utilisateur.
- L’état courant d’un lot est stocké pour consultation rapide, mais l’historique complet reste reconstructible par les événements.
- Les lots peuvent être divisés : la traçabilité doit donc gérer une **généalogie** parent/enfant.
- Le process de culture doit être configurable sans redéploiement de l’app.
- Les phases, actions, observations et mesures attendues doivent être configurables.
- L’interface mobile de scan QR est prioritaire, car elle sert sur site pendant les manipulations.
- La caméra Reolink et les appareils Inkbird sont prévus dès l’architecture mais intégrés après le socle métier.

### Précisions du 30/07/2026

- **Aucune transition temporelle** : la durée cible sert uniquement aux alarmes, jamais à faire avancer une unité.
- **Aucune liste d’actions ni d’observations par étape** : la liste est globale, filtrée par pertinence de stade.
- **Aucune suppression** : une action annulée produit un événement de compensation.
- **Aucun blocage** : une alarme prévient, crée une tâche, marque un retard — elle ne bloque jamais.
- **Pas de parent obligatoire** : une unité peut naître à n’importe quel stade, sans ascendant.

## Prochaine étape après ces documents

1. **Obtenir le tableau §20** du questionnaire `15` — durée cible, alarme, température, humidité par stade — pour **une seule espèce**. C’est le plus petit livrable qui débloque tout le reste.
2. Trancher la contradiction sur le versioning de process (bascule totale *vs* comparaison entre versions) — voir [04 §15.3](./04-processus-configurable.md).
3. Dé-risquer par deux spikes : impression Nimbot B21 (BLE) et scanner QR iOS via Tailscale HTTPS.
4. **Seulement ensuite**, créer le squelette de l’application : authentification locale, unités, QR, événements, consultation mobile.
