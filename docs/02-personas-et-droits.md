# 02 — Personas et droits

> ⚠️ **Statut au 2026-08-08 : tout ce document décrit une CIBLE POST-MVP.**
> Décision arrêtée ([`21-decisions-avant-code.md`](./21-decisions-avant-code.md) §6) : **le MVP n’a ni authentification, ni utilisateurs, ni rôles.** Pas d’écran de login, pas de collection `users`, pas de matrice de permissions, et **aucun auteur inscrit sur les événements**.
> Les personas ci-dessous restent utiles pour comprendre **les besoins métier** et pour préparer une éventuelle réintroduction des rôles. Ils ne décrivent **pas** ce qui sera construit.

## 1. Objectif

Définir les types d’utilisateurs, leurs besoins et les droits d’accès **envisageables après le MVP**.

L’application étant locale et bornée au tailnet Tailscale, le MVP ne porte **aucune notion d’utilisateur**. L’audit repose sur le **journal d’événements horodaté** : il répond à « qu’est-il arrivé à cette unité, et quand », pas à « qui l’a fait ».

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

## 3. Rôles proposés *(cible post-MVP — non implémentés)*

| Rôle | Description |
| --- | --- |
| admin | Accès total, configuration, corrections. |
| production_manager | Gestion production, validation, dashboards. |
| culture_operator | Saisie terrain, scan, mesures, mouvements, récoltes. |
| packaging_operator | Conditionnement et stock produits. |
| readonly | Consultation uniquement. |

## 4. Matrice de permissions *(cible post-MVP — non implémentée)*

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

**Au MVP :**

- Toute action métier produit un **événement horodaté et immuable**. C’est la totalité de l’audit.
- Aucun événement ne porte d’auteur : il n’y a pas d’utilisateur dans le système.
- Les corrections et annulations ne doivent **jamais** effacer l’historique : elles créent un événement de correction, d’annulation ou de suppression logique.
- Le modèle d’événement conserve un **emplacement optionnel pour un auteur**, non peuplé et non exposé — pour rendre une réintroduction d’identité possible plus tard sans refondre le journal.

**Post-MVP, si des rôles sont réintroduits :**

- les droits devront être contrôlés côté backend, pas seulement dans l’interface ;
- les scans QR devront respecter les permissions : scanner ne suffira pas à modifier.

## 6. Authentification

### 6.1 Décision MVP : aucune

Arrêtée le 2026-08-08 (`21` §6) : **pas d’authentification du tout.**

- pas d’écran de login, pas de mot de passe, pas de session ;
- pas de module `auth`, pas de collection `users` ;
- pas d’endpoints `/api/auth/*` ;
- la seule frontière d’accès est le **tailnet Tailscale** : seuls les appareils du tailnet atteignent l’application.

⚠️ **Limite assumée** : l’application ne saura jamais *qui* a fait quoi. Le cultivateur a répondu que le passage d’étape est « validé par une personne » — cela reste vrai au sens où un humain déclenche l’action (aucune transition n’est automatique), mais cette personne n’est pas nommée dans la trace. Si une exigence externe (certification, bio, contrôle sanitaire) impose un jour l’imputabilité nominative, il faudra réintroduire une identité.

### 6.2 Pistes si l’identité redevient nécessaire

- opérateur sélectionnable sans mot de passe (liste en configuration, comme les chambres) ;
- login / mot de passe simple avec rôle unique ;
- PIN rapide pour opérateurs, mode « poste opérateur » à session longue ;
- puis seulement, la matrice de permissions des §3-4.

## Mise à jour 2026-07-30 — droits sur les process

Réponse du cultivateur à « Qui a le droit de créer ou modifier un process ? » : **« moi »**.

Conséquences :

- l’édition de process reste de fait réservée à **une seule personne** — au MVP, ce n’est pas un droit technique mais un usage : sans utilisateurs, l’application ne restreint rien ;
- les autres opérateurs, s’ils existent un jour, feront avancer les unités sur le terrain sans toucher à la configuration ;
- ⚠️ **mis à jour le 2026-08-08** : la modification d’un process **ne bascule plus** les unités en cours (`04` §15.3). Le risque « une seule main déplace la production entière » disparaît, et avec lui l’argument de protection.

⏳ Reste ouvert (post-MVP) : nombre réel d’utilisateurs, droit de correction d’une saisie erronée, droit de réimpression QR.
