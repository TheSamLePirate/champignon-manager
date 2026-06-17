# 07 — Modèle de données MongoDB

## 1. Objectifs du modèle

Le modèle MongoDB doit permettre :

- une consultation rapide de l’état courant ;
- un historique complet par événements ;
- la généalogie des lots ;
- un process configurable ;
- la liaison entre source, lot, récolte et produit final ;
- l’intégration future de matériel : imprimante QR, caméra Reolink, Inkbird ITC-308-WIFI, Inkbird IHC-200-WIFI.

## 2. Principes de modélisation

### 2.1 État courant + événements

Chaque entité principale stocke son état courant dans sa collection.

Les événements conservent l’historique immuable.

Exemple :

- `lots.currentStepId` donne l’étape actuelle ;
- `events` contient tous les changements d’étape passés.

### 2.2 Références plutôt qu’imbrication lourde

Les entités fortement évolutives sont référencées par ID :

- lot → source ;
- lot → parent ;
- récolte → lot ;
- produit → récoltes ;
- événement → cible.

L’imbrication est réservée aux petits objets stables : quantités, unités, snapshots, métadonnées.

### 2.3 Snapshots utiles

Certains documents peuvent stocker des snapshots pour garder le contexte historique même si la configuration change.

Exemples :

- nom de l’étape au moment de l’événement ;
- nom de chambre au moment du mouvement ;
- modèle d’étiquette utilisé lors de l’impression.

### 2.4 Suppression logique

Éviter les suppressions physiques pour les données métier.

Utiliser :

- `status` ;
- `archivedAt` ;
- `deletedAt` uniquement pour suppression logique ;
- événement d’audit associé.

## 3. Conventions communes

Tous les documents métier devraient avoir :

| Champ | Rôle |
| --- | --- |
| `_id` | Identifiant MongoDB. |
| `publicCode` | Code lisible humain, stable, imprimable. |
| `createdAt` | Date de création. |
| `createdBy` | Utilisateur créateur. |
| `updatedAt` | Dernière modification d’état courant. |
| `updatedBy` | Utilisateur ou système responsable. |
| `status` | Statut opérationnel. |
| `siteId` | Site concerné si multi-site futur. |

## 4. Collections de configuration

### 4.1 `sites`

Sites ou lieux de production.

Champs :

- `name` ;
- `timezone` ;
- `defaultUnits` ;
- `localNetworkBaseUrl` ;
- `settings`.

### 4.2 `users`

Utilisateurs.

Champs :

- `displayName` ;
- `login` ;
- `passwordHash` ;
- `roles` ;
- `isActive` ;
- `lastLoginAt`.

### 4.3 `species`

Espèces cultivées.

Exemples : pleurote, shiitake, etc.

Champs :

- `commonName` ;
- `latinName` ;
- `defaultProcessTemplateId` ;
- `notes`.

### 4.4 `strains`

Souches ou variétés.

Champs :

- `speciesId` ;
- `name` ;
- `supplier` ;
- `notes` ;
- `active`.

### 4.5 `locations`

Modèle flexible pour site, zone, chambre, rack, étagère, emplacement.

Champs :

- `type`: `site`, `zone`, `chamber`, `rack`, `shelf`, `slot` ;
- `name` ;
- `parentLocationId` ;
- `path` ;
- `capacity` ;
- `targetConditions` ;
- `deviceIds` ;
- `cameraIds` ;
- `active`.

### 4.6 `processTemplates`

Modèles de process.

Champs :

- `name` ;
- `description` ;
- `targetSpeciesIds` ;
- `currentVersionId` ;
- `status`.

### 4.7 `processVersions`

Versions immuables ou quasi immuables d’un process.

Champs :

- `templateId` ;
- `versionNumber` ;
- `phases` ;
- `steps` ;
- `transitions` ;
- `actions` ;
- `observationTypes` ;
- `measurementRequirements` ;
- `forms` ;
- `alerts` ;
- `initialStepId` ;
- `terminalStepIds` ;
- `publishedAt`.

Structure attendue des sous-objets :

- `phases` : identifiant, nom, ordre, couleur, description, statut attendu ;
- `steps` : identifiant, phase parente, nom, ordre, durée attendue, actions autorisées ;
- `transitions` : étape départ, étape arrivée, conditions, champs de validation ;
- `actions` : identifiant, type métier, libellé, rôles autorisés, formulaire associé, événement créé ;
- `observationTypes` : libellé, phase/étape, gravité, photo requise, alerte automatique ;
- `measurementRequirements` : type de mesure, cible, fréquence attendue, seuils ;
- `forms` : champs dynamiques partagés par actions et transitions ;
- `alerts` : règles de durée, seuil, absence de mesure ou problème signalé.

Les lots doivent référencer une version de process publiée. Si la configuration change, une nouvelle version doit être créée.

### 4.8 `productTypes`

Types de produits finaux.

Champs :

- `name` ;
- `category`: frais, séché, transformé, rebut, compost ;
- `defaultUnit` ;
- `shelfLifeDays` ;
- `requiresQr` ;
- `labelTemplateId`.

### 4.9 `labelTemplates`

Modèles d’étiquettes.

Champs :

- `name` ;
- `targetEntityTypes` ;
- `size` ;
- `fields` ;
- `printerProfileId`.

### 4.10 `printerProfiles`

Profils d’imprimantes.

Champs :

- `name` ;
- `driverType` ;
- `connection` ;
- `defaultLabelTemplateId` ;
- `settings`.

## 5. Collections opérationnelles

### 5.1 `sources`

Sources de culture.

Champs :

- `publicCode` ;
- `sourceType` ;
- `speciesId` ;
- `strainId` ;
- `supplier` ;
- `receivedAt` ;
- `initialQuantity` ;
- `healthStatus` ;
- `notes` ;
- `qrId` ;
- `createdLotIds`.

### 5.2 `lots`

Lots et sous-lots.

Champs :

- `publicCode` ;
- `sourceId` ;
- `parentLotId` ;
- `rootLotId` ;
- `childLotIds` ;
- `lineagePath` ;
- `processVersionId` ;
- `currentPhaseId` ;
- `currentStepId` ;
- `currentStepEnteredAt` ;
- `status` ;
- `currentLocationId` ;
- `currentQuantity` ;
- `initialQuantity` ;
- `tags` ;
- `qrId` ;
- `importantDates` ;
- `lastEventAt`.

### 5.3 `events`

Journal d’événements.

Champs :

- `eventType` ;
- `occurredAt` ;
- `recordedAt` ;
- `recordedBy` ;
- `target` : type + id ;
- `relatedTargets` ;
- `payload` ;
- `source` : manual, qr_scan, import, system, camera, device ;
- `correlationId` ;
- `correctsEventId` ;
- `voidedByEventId` ;
- `snapshots`.

La collection `events` est centrale pour l’audit.

### 5.4 `measurements`

Mesures numériques ou qualitatives.

Champs :

- `target` ;
- `measurementType` ;
- `value` ;
- `unit` ;
- `measuredAt` ;
- `recordedBy` ;
- `method` : manual, device, import ;
- `deviceId` optionnel ;
- `eventId` ;
- `notes`.

### 5.5 `observations`

Observations terrain.

Champs :

- `target` ;
- `observedAt` ;
- `recordedBy` ;
- `text` ;
- `tags` ;
- `severity` ;
- `photoFileIds` ;
- `eventId`.

### 5.6 `harvests`

Récoltes.

Champs :

- `publicCode` ;
- `lotId` ;
- `flushNumber` ;
- `harvestedAt` ;
- `grossQuantity` ;
- `netQuantity` ;
- `lossQuantity` ;
- `qualityGrade` ;
- `operatorId` ;
- `notes` ;
- `eventId` ;
- `productBatchIds`.

### 5.7 `productBatches`

Lots de produits finaux.

Champs :

- `publicCode` ;
- `productTypeId` ;
- `origins` : liste de récoltes/lots avec quantités ;
- `producedAt` ;
- `quantity` ;
- `availableQuantity` ;
- `unit` ;
- `packaging` ;
- `bestBeforeDate` ;
- `status` ;
- `qrId` ;
- `eventId`.

### 5.8 `inventoryMovements`

Mouvements de stock.

Champs :

- `productBatchId` ;
- `movementType` ;
- `quantityDelta` ;
- `unit` ;
- `occurredAt` ;
- `recordedBy` ;
- `reason` ;
- `eventId`.

## 6. QR et impression

### 6.1 `qrRegistry`

Registre central des QR codes.

Champs :

- `token` ;
- `targetType` ;
- `targetId` ;
- `publicCode` ;
- `status` ;
- `createdAt` ;
- `revokedAt` ;
- `lastScannedAt` ;
- `scanCount`.

### 6.2 `printJobs`

Historique des impressions.

Champs :

- `target` ;
- `qrId` ;
- `labelTemplateId` ;
- `printerProfileId` ;
- `status` ;
- `requestedBy` ;
- `requestedAt` ;
- `printedAt` ;
- `error` ;
- `copies`.

## 7. Fichiers, caméra et appareils

### 7.1 `files`

Métadonnées des fichiers locaux.

Champs :

- `filename` ;
- `mimeType` ;
- `size` ;
- `storagePath` ;
- `checksum` ;
- `uploadedBy` ;
- `linkedTargets` ;
- `createdAt`.

### 7.2 `cameras`

Caméras, notamment Reolink.

Champs :

- `name` ;
- `vendor` ;
- `model` ;
- `locationId` ;
- `connectionSettings` ;
- `captureSettings` ;
- `status` ;
- `lastSeenAt`.

### 7.3 `cameraCaptures`

Photos ou snapshots caméra.

Champs :

- `cameraId` ;
- `locationId` ;
- `capturedAt` ;
- `fileId` ;
- `relatedLotIds` optionnel ;
- `tags` ;
- `analysis` futur.

### 7.4 `devices`

Matériels connectés autres que caméra : Inkbird et futurs capteurs.

Champs :

- `name` ;
- `vendor` ;
- `model` : par exemple `ITC-308-WIFI`, `IHC-200-WIFI` ;
- `deviceType` : temperature_controller, humidity_controller, sensor, relay ;
- `locationId` ;
- `capabilities` ;
- `connectionMode` ;
- `settings` ;
- `status` ;
- `lastSeenAt`.

### 7.5 `deviceReadings`

Lectures issues d’un appareil.

Champs :

- `deviceId` ;
- `locationId` ;
- `readAt` ;
- `readings` : température, humidité, état relais, consigne ;
- `rawPayload` optionnel ;
- `measurementIds` optionnels.

## 8. Alertes et tâches

### 8.1 `alerts`

Alertes calculées ou manuelles.

Champs :

- `type` ;
- `severity` ;
- `target` ;
- `message` ;
- `createdAt` ;
- `acknowledgedAt` ;
- `resolvedAt` ;
- `metadata`.

### 8.2 `tasks`

Actions à faire.

Champs :

- `title` ;
- `target` ;
- `dueAt` ;
- `assignedRole` ;
- `assignedUserId` ;
- `status` ;
- `completedAt` ;
- `eventId`.

## 9. Index recommandés

| Collection | Index |
| --- | --- |
| `lots` | `publicCode`, `sourceId`, `parentLotId`, `rootLotId`, `status`, `currentPhaseId`, `currentStepId`, `currentLocationId`, `lastEventAt` |
| `events` | `target.type + target.id + occurredAt`, `eventType + occurredAt`, `correlationId` |
| `qrRegistry` | `token` unique, `targetType + targetId` |
| `measurements` | `target.type + target.id + measuredAt`, `measurementType + measuredAt`, `deviceId + measuredAt` |
| `observations` | `target.type + target.id + observedAt`, `tags` |
| `harvests` | `lotId`, `harvestedAt`, `publicCode` |
| `productBatches` | `publicCode`, `productTypeId`, `status`, `origins.harvestId` |
| `inventoryMovements` | `productBatchId + occurredAt` |
| `locations` | `type`, `parentLocationId`, `path` |
| `deviceReadings` | `deviceId + readAt`, `locationId + readAt` |

## 10. Transactions

Certaines actions doivent être atomiques :

- création source + lot + QR + événement ;
- division lot parent + création enfants + QR enfants + événement ;
- récolte + événement + mise à jour lot ;
- création produit final + mouvement stock + événement ;
- correction administrative.

Décision développeur : utiliser un **replica set MongoDB local** pour permettre les transactions, notamment via Docker Compose.

## 11. Décisions développeur intégrées

Synthèse complète : [18-decisions-techniques-dev.md](./18-decisions-techniques-dev.md).

Décisions validées :

- MongoDB native driver + Zod, sans Mongoose au MVP.
- Approche hybride confirmée : état courant dans les collections principales + événements immuables.
- Replica set local pour transactions.
- Migrations par scripts versionnés, collection `schemaMigrations`, validation au démarrage.
- Trois couches de types : Domain Model, DTO/API, documents MongoDB.
- `publicCode` à définir après réponses cultivateur, mais prévoir une convention détaillée et stable.

Collections MVP confirmées :

- `users`, `sites`, `species`, `strains` ;
- `locations` ;
- `processTemplates`, `processVersions` ;
- `sources`, `lots`, `events` ;
- `measurements`, `observations` ;
- `harvests`, `productBatches` ;
- `qrRegistry`, `printJobs` ;
- `files`, `alerts`, `tasks`.

Collections après MVP :

- `cameras`, `cameraCaptures` ;
- `devices`, `deviceReadings`.

## 12. Points à clarifier avant codage

- Phases, actions et observations configurables du premier process pleurotes.
- Versioning / migration d’un process déjà utilisé par des lots.
- Niveau exact de détail des emplacements physiques.
- Format final des `publicCode`.
- Règles de mélange de récoltes dans un produit final.
- Accès possible aux données Inkbird Wi‑Fi : API locale, cloud, scraping, passerelle tierce ou saisie manuelle uniquement.
