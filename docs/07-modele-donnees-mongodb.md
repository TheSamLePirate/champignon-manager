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
| `updatedAt` | Dernière modification d’état courant. |
| `status` | Statut opérationnel. |
| `siteId` | Site concerné si multi-site futur. |
| `version` | **Verrou optimiste** — incrémenté à chaque écriture, comparé par l’API (`08` §2.1). |

❌ **`createdBy` et `updatedBy` sont supprimés** (décision du 2026-08-08, `21` §6) : il n’y a pas d’utilisateurs. La trace de « quand » subsiste intégralement, celle de « qui » n’existe pas.

### 3.1 Type `Quantity` — toute grandeur physique

Décision du 2026-08-08 (`21` §4). **Aucune grandeur physique n’est stockée en nombre nu** :

```text
Quantity = {
  value: number,
  unit:  "g" | "kg" | "piece" | "tray" | "L" | "mL",
  kind:  "substrate" | "harvest" | "product" | "inoculum"
}
```

Règles :

- **stockage canonique en grammes** pour toute masse ; l’unité de saisie est conservée pour l’affichage. Le cultivateur pèse en grammes (`q14_1`) ;
- **aucune conversion implicite entre `kind` différents** — un rendement est un rapport explicite entre deux quantités nommées, jamais une soustraction de champs homonymes ;
- ❌ **`currentQuantity` et `initialQuantity` sur `lots` sont supprimés** : ils mélangeaient masse de substrat (qui ne décroît pas), masse récoltée et pièces de produit fini. Trois grandeurs distinctes → trois champs distincts (`substrateWeight` sur l’unité, `weight` sur la récolte, `quantity` sur le produit).

## 4. Collections de configuration

### 4.1 `sites`

Sites ou lieux de production.

Champs :

- `name` ;
- `timezone` ;
- `defaultUnits` ;
- `localNetworkBaseUrl` ;
- `settings`.

### 4.2 `users` — ❌ collection supprimée

Décision du 2026-08-08 (`21` §6) : **pas d’utilisateurs, pas d’authentification**. Les champs autrefois prévus (`displayName`, `login`, `passwordHash`, `roles`, `isActive`, `lastLoginAt`) ne sont pas implémentés.

À réintroduire seulement si une identité redevient nécessaire (`02` §6.2).

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
- `targetStage` : stade visé (`gelose`, `liquid_culture`, `grain`, `substrate`, `fruiting`) ou multi-stade ;
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
- `sourceType` : `spore_print`, `mother_culture`, `gelose`, `liquid_culture`, `grain`, `received_substrate`, `tissue_clone` ;
- `entryStage` : stade où débute la traçabilité ;
- `speciesId` ;
- `strainId` ;
- `supplier` ;
- `receivedAt` ;
- `initialQuantity` : `Quantity` (voir §3.1) ;
- `healthStatus` ;
- `notes` ;
- `qrId` ;
- `createdLotIds`.

### 5.2 `lots` (unités de culture, tous stades)

Unités de culture à tous les stades : gélose, culture liquide, grain, substrat, fructification. « Lot » = unité au stade substrat/fructification.

Champs :

- `publicCode` ;
- `stage` : `gelose`, `liquid_culture`, `grain`, `substrate`, `fruiting` ;
- `lineageRelation` : `origin`, `clone`, `transfer`, `split` (relation avec le parent) ;
- `generation` : rang de clone (entier) ;
- `isMotherCulture` : culture mère conservée (booléen) ;
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
- `substrateWeight` : `Quantity` **`kind: substrate`** — poids substrat total saisi à l’inoculation, **champ de premier rang** (dénominateur du rendement) ;
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
- `recordedBy` : ⚠️ **non peuplé au MVP** — champ optionnel réservé, jamais renseigné ni exposé dans l’UI. Il n’existe que pour rendre une réintroduction d’identité possible sans refondre le journal (`21` §6) ;
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
- `quantity` : `Quantity` **`kind: product`** ;
- `availableQuantity` : `Quantity` **`kind: product`** ;
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
- `quantityDelta` : `Quantity` **`kind: product`** ;
- `occurredAt` ;
- `reason` ;
- `eventId`.

*(`unit` est absorbé par `Quantity` ; `recordedBy` est supprimé — pas d’utilisateurs.)*

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

## 8. Alertes

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

### 8.2 `tasks` — ❌ collection supprimée

Décision du 2026-08-08 (`21` §3) : **l’application ne génère aucune tâche.** Réponse du cultivateur `q16_2` : « pas de tâches automatiques, mais des statuts et des alertes ». Cela tranche la tension avec `q9_10_5` (tâche de nettoyage en fin de cycle).

À la place :

- la **fin de cycle** produit un statut (`terminé | compost | rebut | contaminé`) et une **alerte** « emplacement occupé jusqu’au nettoyage » ;
- les **alarmes de durée** produisent des alertes (rappel, dépassement, retard critique) ;
- une alerte se **résout par une action métier** (nettoyage enregistré, unité avancée), pas par une case à cocher indépendante.

## 9. Index recommandés

| Collection | Index |
| --- | --- |
| `lots` | `publicCode`, `stage`, `sourceId`, `parentLotId`, `rootLotId`, `lineageRelation`, `status`, `currentPhaseId`, `currentStepId`, `currentLocationId`, `lastEventAt` |
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
- clone d’une unité + création des cultures secondaires + QR enfants + événement ;
- transfert vers le stade suivant + création des unités aval + QR enfants + événement ;
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

Collections MVP confirmées *(mise à jour 2026-08-08)* :

- `sites`, `species`, `strains` ;
- `locations` ;
- `processTemplates`, `processVersions` ;
- `sources`, `lots`, `events` ;
- `measurements`, `observations` ;
- `harvests`, `productBatches` ;
- `qrRegistry`, `printJobs` ;
- `files`, `alerts` ;
- `idempotencyKeys` — clés d’idempotence et réponse d’origine (`08` §2.1).

❌ Retirées :

- **`users`** — pas d’authentification ni d’utilisateurs (`21` §6) ;
- **`tasks`** — aucune tâche n’est générée par l’application ; alertes et statuts seulement (`21` §3).

Collections après MVP :

- `cameras`, `cameraCaptures` ;
- `devices`, `deviceReadings`.

## 12. Points à clarifier avant codage

- Phases, actions et observations configurables du premier process (pleurote) ; l’espèce étant configurable, prévoir un process par espèce.
- Process propre à chaque stade amont (gélose, LC, grain) vs un seul process multi-stade.
- Jusqu’où remonter la traçabilité (spore, gélose, LC).
- Suivi des ratios de multiplication clone/transfert.
- Versioning / migration d’un process déjà utilisé par des lots.
- Niveau exact de détail des emplacements physiques.
- Format final des `publicCode`.
- Règles de mélange de récoltes dans un produit final.
- Accès possible aux données Inkbird Wi‑Fi : API locale, cloud, scraping, passerelle tierce ou saisie manuelle uniquement.

## 13. Mise à jour 2026-07-30 — impact des réponses cultivateur

Détail des réponses : `14-questions-ouvertes.md` §18. Conséquences sur les collections.

### 13.1 `cultureUnits` — champs à ajouter

| Champ | Raison |
| --- | --- |
| `parentId` **nullable** | Une unité peut naître **sans ascendant**, à n’importe quel stade (substrat reçu déjà inoculé). Ne pas rendre le parent obligatoire. |
| `lineageType` | `clone` \| `transfer` \| `division` \| `conservation_exit` — la sortie de conservation crée un nouveau maillon. |
| `generation` | Compteur **informatif, sans plafond** : aucune limite de génération n’est imposée. |
| `processTemplateId` + `processVersion` | La version appliquée doit être **figée sur l’unité**, sinon la comparaison entre versions est impossible. |
| `state` | Ajouter `reserve` (conservation) et `archived`, **tous deux réversibles**. Distincts de `terminated`. |
| `location` | Objet `{ roomId, shelf, level, position }` — le suivi descend **jusqu’à la position**. |
| `locationHistory` | Une unité **change plusieurs fois de chambre** : l’emplacement est historisé, pas une propriété stable. |

### 13.2 `harvests` — récolte

Chaque flush enregistre **par unité** : `weight`, `quality`, et `losses[] { weight, cause }` — les pertes sont notées **avec leur cause**.

### 13.3 `finalProducts` — mélanges pondérés

Une récolte peut être mélangée avec d’autres. Les **proportions exactes doivent être conservées** : le lien produit → unités d’origine est une liste **pondérée**, pas un simple tableau d’identifiants.

```
sources: [ { harvestId, unitId, weight, share } ]
```

### 13.4 `observations`

- `photoUrl` optionnel partout, **obligatoire quand le type est « contamination »** (contrainte applicative, pas seulement UI) ;
- `severity` : `low` \| `medium` \| `critical` ;
- **pas de liste d’observations par étape** : la liste est globale, filtrée par pertinence de stade à l’affichage.

### 13.5 `savedFilters` — nouvelle collection

Les filtres de sélection doivent être **enregistrables comme favoris** : `{ userId, name, criteria }`, les critères pouvant combiner n’importe quels paramètres (lignée, génération, type de lien, stade, chambre, retard…).

### 13.6 `events` — annulation

Toute action doit pouvoir être **annulée ou corrigée**. Dans un modèle à événements immuables, cela impose un **événement de compensation** (`reversedByEventId` / `reversesEventId`), jamais une suppression.

### 13.7 Ce que le modèle n’a PAS à porter

- **Aucune transition temporelle.** Le passage d’étape se fait à l’observation visuelle, validé par une personne. La durée cible ne sert qu’aux alarmes : pas d’état « prêt à passer » calculé depuis une date, pas de job d’avancement.
- **Aucune liste d’actions par étape** dans `processTemplates` : au plus des règles de pertinence par stade.

### 13.8 Toujours indéterminé

Aucune **valeur** n’a été fournie (durées, températures, humidité, ratios, seuils). Les champs de configuration existent, mais **aucun jeu de données d’amorçage** ne peut être écrit aujourd’hui.
