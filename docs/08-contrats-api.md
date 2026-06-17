# 08 — Contrats API prévus

## 1. Objectif

Décrire les ressources API à prévoir pour le futur backend.

Ce document ne définit pas encore du code. Il fixe les responsabilités fonctionnelles des endpoints et les règles de contrat.

## 2. Principes généraux

- API locale HTTP/JSON.
- Validation stricte des entrées.
- Réponses typées et documentées.
- Authentification par session ou token local.
- Permissions vérifiées côté backend.
- Erreurs normalisées.
- Pagination sur les listes.
- Les actions métier importantes créent des événements.

## 3. Format de réponse recommandé

Pour les succès :

```text
{
  data: ...,
  meta?: ...
}
```

Pour les erreurs :

```text
{
  error: {
    code: string,
    message: string,
    details?: unknown,
    requestId?: string
  }
}
```

Ce format est indicatif pour le cahier des charges ; il sera traduit en types lors du codage.

## 4. Authentification

| Méthode | Rôle |
| --- | --- |
| `POST /api/auth/login` | Ouvrir une session. |
| `POST /api/auth/logout` | Fermer une session. |
| `GET /api/auth/me` | Récupérer l’utilisateur courant. |
| `POST /api/auth/switch-operator` | Option future : changer rapidement d’opérateur par PIN. |

## 5. Configuration

### 5.1 Espèces et souches

| Méthode | Rôle |
| --- | --- |
| `GET /api/species` | Lister les espèces. |
| `POST /api/species` | Créer une espèce. |
| `PATCH /api/species/:id` | Modifier une espèce. |
| `GET /api/strains` | Lister les souches. |
| `POST /api/strains` | Créer une souche. |

### 5.2 Chambres et emplacements

| Méthode | Rôle |
| --- | --- |
| `GET /api/locations` | Lister zones, chambres et emplacements. |
| `POST /api/locations` | Créer un emplacement. |
| `GET /api/locations/:id` | Détail d’un emplacement. |
| `PATCH /api/locations/:id` | Modifier un emplacement. |
| `GET /api/locations/:id/lots` | Lots présents. |
| `GET /api/locations/:id/measurements` | Mesures associées. |

### 5.3 Process

| Méthode | Rôle |
| --- | --- |
| `GET /api/process-templates` | Lister les modèles. |
| `POST /api/process-templates` | Créer un modèle. |
| `GET /api/process-templates/:id` | Détail. |
| `POST /api/process-templates/:id/versions` | Créer une version. |
| `POST /api/process-versions/:id/publish` | Publier une version. |
| `GET /api/process-versions/:id` | Lire une version. |

## 6. Sources

| Méthode | Rôle |
| --- | --- |
| `GET /api/sources` | Liste filtrable. |
| `POST /api/sources` | Créer une source. |
| `GET /api/sources/:id` | Détail source. |
| `PATCH /api/sources/:id` | Correction contrôlée. |
| `POST /api/sources/:id/activate-lot` | Créer/activer un lot depuis la source. |
| `GET /api/sources/:id/trace` | Traçabilité descendante. |

## 7. Lots

| Méthode | Rôle |
| --- | --- |
| `GET /api/lots` | Liste filtrable par statut, étape, chambre, espèce. |
| `POST /api/lots` | Création directe si autorisée. |
| `GET /api/lots/:id` | Fiche complète. |
| `GET /api/lots/:id/timeline` | Historique chronologique. |
| `GET /api/lots/:id/genealogy` | Arbre parent/enfant. |
| `GET /api/lots/:id/actions` | Actions disponibles selon état courant. |
| `POST /api/lots/:id/events` | Ajouter un événement générique contrôlé. |
| `POST /api/lots/:id/change-step` | Changer d’étape. |
| `POST /api/lots/:id/move` | Déplacer. |
| `POST /api/lots/:id/split` | Diviser en sous-lots. |
| `POST /api/lots/:id/close` | Terminer. |
| `POST /api/lots/:id/mark-issue` | Déclarer problème ou contamination. |

## 8. Mesures et observations

| Méthode | Rôle |
| --- | --- |
| `GET /api/measurements` | Liste filtrable. |
| `POST /api/measurements` | Ajouter une mesure. |
| `GET /api/observations` | Liste filtrable. |
| `POST /api/observations` | Ajouter une observation. |
| `POST /api/observations/:id/photos` | Ajouter une photo. |

## 9. Récoltes

| Méthode | Rôle |
| --- | --- |
| `GET /api/harvests` | Liste filtrable. |
| `POST /api/lots/:id/harvests` | Enregistrer une récolte sur un lot. |
| `GET /api/harvests/:id` | Détail récolte. |
| `POST /api/harvests/:id/create-products` | Créer produits finaux. |
| `PATCH /api/harvests/:id` | Correction contrôlée. |

## 10. Produits finaux et stock

| Méthode | Rôle |
| --- | --- |
| `GET /api/product-types` | Types configurés. |
| `POST /api/product-types` | Créer type produit. |
| `GET /api/product-batches` | Lots produits. |
| `GET /api/product-batches/:id` | Détail produit + origines. |
| `GET /api/product-batches/:id/trace` | Traçabilité ascendante. |
| `POST /api/product-batches/:id/inventory-movements` | Sortie, perte, correction. |
| `GET /api/inventory` | Vue stock courant. |

## 11. QR code et scan

| Méthode | Rôle |
| --- | --- |
| `POST /api/qr` | Créer un QR pour une cible. |
| `GET /api/qr/:token/resolve` | Résoudre un QR scanné. |
| `POST /api/qr/:token/scans` | Enregistrer un scan. |
| `POST /api/qr/:id/revoke` | Révoquer un QR. |
| `POST /api/qr/:id/reprint` | Demander réimpression. |

Résolution QR attendue :

- identifier la cible ;
- vérifier permissions ;
- enregistrer le scan ;
- renvoyer la route frontend appropriée ;
- renvoyer les actions rapides disponibles si demandé.

## 12. Impression

| Méthode | Rôle |
| --- | --- |
| `GET /api/printers` | Lister profils imprimantes. |
| `POST /api/print-jobs` | Créer un job d’impression. |
| `GET /api/print-jobs/:id` | Statut d’impression. |
| `POST /api/print-jobs/:id/retry` | Relancer. |
| `POST /api/print-test` | Test imprimante. |

## 13. Fichiers et photos

| Méthode | Rôle |
| --- | --- |
| `POST /api/files` | Upload fichier/photo. |
| `GET /api/files/:id` | Télécharger/afficher. |
| `POST /api/files/:id/link` | Lier à une entité. |

## 14. Caméras et appareils futurs

### 14.1 Caméras Reolink

| Méthode | Rôle |
| --- | --- |
| `GET /api/cameras` | Lister caméras. |
| `POST /api/cameras` | Déclarer caméra. |
| `POST /api/cameras/:id/capture` | Capturer snapshot. |
| `GET /api/cameras/:id/captures` | Voir captures. |

### 14.2 Inkbird et autres appareils

| Méthode | Rôle |
| --- | --- |
| `GET /api/devices` | Lister appareils. |
| `POST /api/devices` | Déclarer appareil. |
| `GET /api/devices/:id/readings` | Lire historique de valeurs. |
| `POST /api/devices/:id/readings/import` | Importer valeurs si intégration disponible. |
| `POST /api/devices/:id/sync` | Synchroniser avec l’appareil ou passerelle. |

Les endpoints appareil resteront inactifs tant que le mode d’intégration Inkbird n’est pas validé.

## 15. Dashboards et rapports

| Méthode | Rôle |
| --- | --- |
| `GET /api/dashboard/production` | Vue lots actifs, alertes, tâches. |
| `GET /api/reports/yield` | Rendements par période, chambre, espèce. |
| `GET /api/reports/losses` | Pertes et contaminations. |
| `GET /api/reports/traceability` | Exports de traçabilité. |

## 16. Règles d’erreurs

Codes à prévoir :

- `UNAUTHORIZED` ;
- `FORBIDDEN` ;
- `VALIDATION_ERROR` ;
- `NOT_FOUND` ;
- `CONFLICT` ;
- `INVALID_TRANSITION` ;
- `LOT_ALREADY_CLOSED` ;
- `QR_REVOKED` ;
- `PRINTER_UNAVAILABLE` ;
- `DEVICE_UNAVAILABLE`.

## 17. Pagination et filtres

Les listes doivent supporter :

- pagination ;
- tri ;
- filtre texte ;
- filtre date ;
- filtre statut ;
- filtre étape ;
- filtre chambre ;
- filtre espèce.

## 18. Contrats à stabiliser avant codage

- Choix REST/Hono ou tRPC.
- Format exact des erreurs.
- Format des IDs exposés côté frontend.
- Stratégie OpenAPI ou client généré.
- Niveau de granularité des endpoints d’action métier.
