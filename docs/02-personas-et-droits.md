# 02 — Personas et droits

## 1. Objectif

Définir les types d’utilisateurs, leurs besoins et les droits d’accès à prévoir.

Même si l’application est locale, elle doit conserver une notion d’utilisateur pour l’audit et la traçabilité.

## 2. Personas

### 2.1 Administrateur

Responsable de la configuration globale.

Besoins :

- configurer les process ;
- créer les chambres et emplacements ;
- gérer les utilisateurs ;
- gérer les modèles d’étiquettes ;
- corriger les erreurs ;
- consulter tous les historiques.

### 2.2 Responsable production

Pilote l’activité de culture.

Besoins :

- voir les lots actifs ;
- planifier les actions ;
- contrôler les rendements ;
- suivre les alertes ;
- valider les récoltes ;
- analyser les pertes et contaminations.

### 2.3 Opérateur culture

Travaille en chambre ou atelier.

Besoins :

- scanner un QR code ;
- voir quoi faire sur le lot ;
- saisir rapidement une mesure ou observation ;
- déplacer un lot ;
- diviser un lot ;
- enregistrer une récolte ;
- imprimer ou réimprimer une étiquette si autorisé.

### 2.4 Préparateur / conditionnement

Transforme la récolte en produit final.

Besoins :

- voir les récoltes disponibles ;
- créer des produits finaux ;
- peser, conditionner, étiqueter ;
- corriger le stock ;
- suivre les pertes de tri.

### 2.5 Lecture seule

Utilisateur qui consulte sans modifier.

Besoins :

- voir l’état des lots ;
- consulter les historiques ;
- accéder aux dashboards ;
- ne pas pouvoir modifier les données.

## 3. Rôles proposés

| Rôle | Description |
| --- | --- |
| admin | Accès total, configuration, corrections. |
| production_manager | Gestion production, validation, dashboards. |
| culture_operator | Saisie terrain, scan, mesures, mouvements, récoltes. |
| packaging_operator | Conditionnement et stock produits. |
| readonly | Consultation uniquement. |

## 4. Matrice de permissions

| Action | admin | production_manager | culture_operator | packaging_operator | readonly |
| --- | --- | --- | --- | --- | --- |
| Voir les lots | Oui | Oui | Oui | Oui | Oui |
| Créer une source | Oui | Oui | Oui | Non | Non |
| Modifier configuration process | Oui | Non | Non | Non | Non |
| Changer étape d’un lot | Oui | Oui | Oui | Non | Non |
| Déplacer lot | Oui | Oui | Oui | Non | Non |
| Diviser lot | Oui | Oui | Oui | Non | Non |
| Ajouter mesure/observation | Oui | Oui | Oui | Non | Non |
| Enregistrer récolte | Oui | Oui | Oui | Oui | Non |
| Créer produit final | Oui | Oui | Non | Oui | Non |
| Corriger stock | Oui | Oui | Non | Oui | Non |
| Supprimer/annuler événement | Oui | Cas limité | Non | Non | Non |
| Imprimer QR | Oui | Oui | Oui | Oui | Non |
| Gérer utilisateurs | Oui | Non | Non | Non | Non |
| Voir statistiques | Oui | Oui | Partiel | Partiel | Oui |

## 5. Principes d’audit

- Toute action métier doit être liée à un utilisateur.
- Décision développeur : toutes les actions importantes doivent être auditables.
- Les corrections, annulations et suppressions métier ne doivent pas effacer l’historique : elles doivent créer un événement de correction, d’annulation ou de suppression logique.
- Les droits doivent être contrôlés côté backend, pas seulement dans l’interface.
- Les scans QR doivent respecter les permissions : scanner ne suffit pas à modifier.

## 6. Authentification envisagée

Pour une première version locale :

- login / mot de passe simple ;
- rôle `admin` unique au MVP ;
- session web ;
- réseau local/Tailscale considéré comme environnement de confiance ;
- possibilité future de mode “poste opérateur” avec session longue si l’environnement est maîtrisé.

À clarifier plus tard :

- besoin de connexion sans mot de passe sur réseau local ;
- besoin de PIN rapide pour opérateurs ;
- nombre d’utilisateurs ;
- extension des rôles après le MVP ;
- accès depuis l’extérieur via Tailscale uniquement ou autre stratégie.
