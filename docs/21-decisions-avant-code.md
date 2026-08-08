# 21 — Décisions arrêtées avant le code

> Date : 2026-08-08. Répondant : Olivier.
> Ce document clôt les points identifiés comme « à trancher avant de coder » dans [`claude-critics.md`](../claude-critics.md) et [`14-questions-ouvertes.md`](./14-questions-ouvertes.md).
> **Après ces décisions, aucun prérequis métier ni technique ne bloque le démarrage du développement.**

## 1. Récapitulatif

| # | Sujet | Décision | Ferme |
| --- | --- | --- | --- |
| 1 | Versioning de process | **Comparaison entre versions** — les unités restent épinglées à leur version | P1-7, `dev_06_05`, `04` §15.3 |
| 2 | Tâches automatiques | **Aucune** — alertes et statuts seulement | tension `q16_2` ⇄ `q9_10_5` |
| 3 | Sémantique quantité/poids | **Best effort** — modèle typé `{ value, unit, kind }` (recommandation implémenteur) | P2-1 |
| 4 | Source et Lot | **Deux objets distincts** | P2-2, `14` §1.2 |
| 5 | Sécurité et identité | **Aucune** — pas d'auth, pas d'utilisateurs, pas d'auteur sur les événements | P1-2, P1-4, P1-5 |
| 6 | Imprimante Nimbot B21 | **Validée en test** — fonctionne comme attendu | P0-5 |

---

## 2. Versioning de process — la comparaison l'emporte

**Décision : comparaison entre versions.**

Le cultivateur avait demandé deux choses incompatibles (`04` §15.3) : que les unités déjà lancées **basculent** sur la nouvelle version, et pouvoir **comparer les résultats entre deux versions**. La comparaison est retenue ; la bascule automatique est abandonnée.

### Règles qui en découlent

- Une **version publiée est immuable**. Toute modification crée une nouvelle version.
- Une unité est **épinglée à la version de process en vigueur à sa création**, et y reste **jusqu'à la fin de son cycle**. Une modification de process ne déplace jamais une unité en cours.
- La **version appliquée est enregistrée sur l'unité** et figée dans ses événements — c'est la condition technique de toute comparaison.
- Une **migration d'unité vers une version plus récente reste possible**, mais elle est **explicite, manuelle et par sélection** — jamais globale, jamais automatique. Elle produit un événement traçable.
- Les statistiques peuvent donc segmenter par version de process, y compris sur des unités encore vivantes.

### Ce qui change dans les documents

Le §15.3 de `04` présentait deux pistes d'arbitrage ; c'est la seconde logique qui est retenue, mais **sans bascule** : la population témoin est préservée par défaut, pas par exception.

⚠️ **À signaler au cultivateur** : sa réponse « les unités basculent avec confirmation » n'est pas suivie. Concrètement, quand il modifie un process, ses unités en cours **continuent sur l'ancienne version** ; il pourra migrer une sélection s'il le souhaite. C'est le prix de la comparaison qu'il a lui aussi demandée.

---

## 3. Pas de tâches automatiques

**Décision : aucune tâche générée par l'application. Des alertes et des statuts, oui.**

Cela tranche la tension entre `q16_2` (« pas de tâches automatiques, mais des statuts et des alertes ») et `q9_10_5` (création d'une tâche de nettoyage en fin de cycle).

### Conséquences

- **Pas de module `tasks` au MVP**, pas de collection `tasks`, pas d'écran « tâches du jour » en tant que liste d'objets à cocher.
- La **fin de cycle** produit un **statut** (`terminé | compost | rebut | contaminé`) et une **alerte** « emplacement occupé jusqu'au nettoyage » — pas une tâche.
- Les **alarmes de durée** produisent des alertes (rappel avant échéance, dépassement, retard critique), conformément à `04` §15.2 et `20` §5.
- Une alerte se **résout par une action métier** (nettoyage enregistré, unité avancée), pas par une case à cocher indépendante.
- Le dashboard affiche donc des **alertes actives**, pas une to-do list.

Le point 7 de la Phase 7 de `13` (« tâches du jour ») est reformulé en « alertes actives ».

---

## 4. Sémantique quantité/poids — modèle typé

**Décision utilisateur : « au mieux » (best effort).** Le choix ci-dessous est donc une **recommandation d'implémenteur**, pas une décision métier — à corriger si le terrain le contredit.

### Modèle retenu

Toute grandeur physique est portée par un objet typé plutôt que par un nombre nu :

```
Quantity = {
  value: number,
  unit: "g" | "kg" | "piece" | "tray" | "L" | "mL",
  kind: "substrate" | "harvest" | "product" | "inoculum"
}
```

### Règles

- **Stockage canonique en grammes** pour toute masse ; l'unité de saisie est conservée pour l'affichage. Le cultivateur pèse ses récoltes **en grammes** (`q14_1`), c'est cohérent.
- `substrateWeight` devient un **champ de premier rang de l'unité au stade substrat** — c'est le dénominateur du rendement (efficacité biologique). Il est déjà saisi à l'inoculation (« poids substrat total », `20` §4).
- Les champs `currentQuantity` / `initialQuantity` de `07` sont **remplacés** : ils mélangeaient masse de substrat (qui ne décroît pas), masse récoltée et pièces de produit fini. Trois grandeurs distinctes, trois champs distincts.
- Une **récolte** porte `weight` (`kind: harvest`), sa `quality` et ses `losses[] { weight, cause }`.
- Un **produit final** porte une quantité `kind: product` (pièces, barquettes) et un lien pondéré vers ses récoltes d'origine (proportions exactes, `q14_5`).
- **Aucune conversion implicite entre `kind` différents.** Un rendement est un rapport explicite entre deux quantités nommées, jamais une soustraction de champs homonymes.

---

## 5. Source et Lot restent deux objets

**Décision : deux objets distincts.**

La question `14` §1.2 (« source et lot = deux objets différents ? ») était ouverte, et P2-2 proposait de les fusionner au MVP. La fusion est écartée.

- **Source** = ce qui entre dans la ferme : spores, souche achetée, ballot reçu déjà inoculé, fournisseur, lot fournisseur, date de réception.
- **Unité de culture / Lot** = l'objet physique suivi dans le process, à un stade donné, portant un QR.
- Une unité **référence** sa source quand elle en a une. Une unité peut naître **sans source** (clone d'une unité existante, ou création directe).
- Un ballot reçu déjà inoculé crée donc **une source et une unité** — c'est accepté comme le coût de la séparation.

---

## 6. Aucune sécurité, aucune identité

**Décision : pas de sécurité applicative. Le réseau local (tailnet) est la seule frontière.**

Cette réponse était déjà donnée deux fois côté développeur (`dev_09_01`, `dev_09_06`) puis « réinterprétée » en login simple dans `18` §11. **La réinterprétation est annulée** : la décision d'origine s'applique littéralement.

### Ce qui est supprimé du MVP

| Élément | Statut |
| --- | --- |
| Écran de login | ❌ supprimé |
| Module `auth` | ❌ supprimé |
| Module / collection `users` | ❌ supprimé |
| Mots de passe, hachage, sessions | ❌ supprimés |
| Endpoints `/api/auth/*` | ❌ supprimés |
| Rôles, RBAC, matrice de permissions | ❌ hors MVP (voir `02`) |
| Champs `createdBy` / `updatedBy` | ❌ supprimés |
| Auteur (`userId`) sur les événements | ❌ supprimé |

### Ce qui subsiste

- Le **journal d'événements reste intégral et immuable** : chaque action produit un événement horodaté. Ce qui disparaît, c'est **qui** l'a faite, pas **qu'elle a eu lieu**.
- La **correction et l'annulation** restent des événements de compensation (`q13_4`), jamais des effacements.
- Les **filtres favoris** (`q15_*`) deviennent globaux à l'installation au lieu d'être rattachés à un utilisateur.
- L'accès reste borné par **Tailscale** : seuls les appareils du tailnet atteignent l'application.

### Conséquence assumée sur le métier

Le cultivateur a répondu que le passage d'étape est « **validé par une personne** » (`q9_2_7`, `q9_3_6`, `q9_9_2`). Cela reste vrai au sens où **un humain déclenche l'action** — aucune transition n'est automatique. Mais la trace ne nommera jamais cette personne.

⚠️ **Limite à connaître** : la traçabilité produit répond à « qu'est-il arrivé à cette unité, et quand », pas à « qui l'a fait ». Si une exigence externe (certification, bio, contrôle sanitaire) demande un jour l'imputabilité nominative, il faudra réintroduire une identité — d'où la précaution ci-dessous.

### Précaution de conception (sans coût)

Le modèle d'événement **garde un emplacement libre pour un auteur** (champ optionnel, non peuplé, non exposé dans l'UI). Réintroduire une identité plus tard sera alors une migration de données, pas une refonte du journal. Rien n'est construit autour aujourd'hui.

---

## 7. Nimbot B21 — validée

**Le test terrain a réussi : l'imprimante fonctionne comme attendu.** L'intégration sera branchée plus tard, mais le risque technique n'existe plus.

**P0-5, seul P0 encore ouvert, est levé.** Le repli envisagé (génération d'image/PDF, ou imprimante ESC-POS de substitution) devient inutile.

Reste à documenter au moment du branchement : chemin exact (BLE direct depuis le backend ou service dédié), comportement en cas de déconnexion, et file de `printJobs` avec réimpression du **même** QR (`q17_5`, `dev_08_05`).

---

## 8. État des risques après ces décisions

| ID | Avant | Après |
| --- | --- | --- |
| P0-5 Nimbot B21 | 🔴 bloquant | 🟢 **levé** (testé) |
| P1-2 Contradiction sécurité | 🟠 majeur | 🟢 **levé** — décision explicite, plus de réinterprétation |
| P1-4 RBAC spéculatif | 🟠 majeur | 🟢 **sans objet** — plus de rôles du tout |
| P1-5 Module auth oublié | 🟠 majeur | 🟢 **sans objet** — plus de module auth |
| P1-7 Versioning de process | 🔴 aggravé | 🟢 **levé** (§2) |
| P2-1 Sémantique quantité | 🟡 moyen | 🟢 **levé** (§4) |
| P2-2 Source vs Lot | 🟡 moyen | 🟢 **levé** (§5) |
| P0-4 HTTPS iOS | 🟢 levé (stratégie) | spike de validation Safari à faire, non bloquant |
| **P1-1 MVP sur-dimensionné** | 🟠 majeur | 🟠 **toujours ouvert** — voir §9 |
| P2-4 Idempotence / concurrence | 🟡 moyen | 🟡 à traiter dans les contrats API (§9) |
| P2-7 Connectivité chambre | 🟡 moyen | 🟡 inchangé |
| P2-8 Ressources Raspberry Pi | 🟡 moyen | 🟡 inchangé |

---

## 9. Ce qui reste à faire avant la première ligne de code

Aucun de ces points n'est bloquant, mais ils se décident mieux maintenant qu'après.

### 9.1 Périmètre — le seul vrai sujet restant

`claude-critics.md` P1-1 tient toujours : ce qui est appelé « MVP » est un produit v1 complet, et **aucune estimation de charge n'existe**. La suppression de l'auth, des rôles et des tâches allège réellement le périmètre, mais l'éditeur de process reste obligatoire (pas de seed → application vide).

**À produire** : une définition de la tranche verticale, incluant de quoi créer un process.

### 9.2 Idempotence et concurrence (P2-4)

À intégrer aux contrats API **dès leur écriture**, pas après :

- champ `version` (verrou optimiste) sur les documents d'état courant ;
- en-tête `Idempotency-Key` sur les POST d'action, **impératif sur les actions de masse** (Wi-Fi instable + retry = double avancement).

### 9.3 Spikes restants (non bloquants)

1. **Safari iOS + `tailscale serve`** : confirmer l'accès caméra sous le certificat Let's Encrypt.
2. **Compatibilité Bun** : driver MongoDB natif + Vitest + outillage BLE. Prévoir d'isoler le service d'impression dans un process Node si Bun coince.

### 9.4 Points mineurs à fixer en chemin

- Format final des `publicCode`.
- Politique de sauvegarde : fréquence, destination, rétention.
- Hostname MagicDNS exact et configuration `tailscale serve`.
- Conditions cibles des deux chambres de fructification (`q10_3`, vide — configuration).

---

## 10. À faire remonter au cultivateur

Deux décisions ne suivent pas ses réponses. Elles ne sont pas bloquantes, mais il doit les connaître avant la mise en service :

1. **Modifier un process ne déplacera pas ses unités en cours** (§2). Il avait demandé une bascule ; la comparaison qu'il a également demandée l'interdit.
2. **L'application ne saura jamais qui a fait quoi** (§6). Il n'y a pas de connexion, donc pas de nom dans l'historique.

Les points de `20` §8 (durées labo inventées, seuils d'alarme, ratios de multiplication, conditions par chambre) restent à ajuster avec lui — mais en **configuration**, une fois l'application en service.
