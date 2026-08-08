# Suivi d'implémentation — Champignon Manager

> Journal de bord de la construction de la **tranche 1** ([`docs/22-tranche-verticale-mvp.md`](./docs/22-tranche-verticale-mvp.md)).
> Ce fichier trace **ce qui est fait**, **ce qui dévie du plan** et **pourquoi**. Mis à jour à chaque fin de lot.

## Tableau de bord

| Lot | Contenu | Estimé | Statut |
| --- | --- | --- | --- |
| 1 | Socle monorepo, TS strict, Docker, CI, lint | 3–4 j | 🟡 en cours |
| 2 | Contrats Zod + domaine pur (100 % + mutation) | 7–9 j | ⬜ |
| 3 | Persistance MongoDB, transactions, migrations | 4–5 j | ⬜ |
| 4 | API Hono, OpenAPI, idempotence, erreurs | 5–6 j | ⬜ |
| 5 | QR, publicCode, printJobs, Nimbot B21 | 3–4 j | ⬜ |
| 6 | Socle web, scanner, file d'attente locale, a11y | 5–6 j | ⬜ |
| 7 | Suivi d'unité : fiche, timeline, étapes, mesures | 5–6 j | ⬜ |
| 8 | Récolte → produit → traçabilité | 4–5 j | ⬜ |
| 9 | Éditeur de process graphique | 11–15 j | ⬜ |
| 10 | MCP + CLI + parité de surface | 4–5 j | ⬜ |
| 11 | E2E, rapport d'audit, mutation, perfs Pi | 7–9 j | ⬜ |
| 12 | Intégration, déploiement Pi, mise en service | 4–5 j | ⬜ |

Légende : ⬜ à faire · 🟡 en cours · ✅ terminé · ⚠️ terminé avec déviation

---

## Journal

### 2026-08-08 — Démarrage

Cadrage clos et committé (`de64a71`). Feu vert explicite reçu pour coder.

Environnement vérifié : Bun 1.3.14, Node 24.14.0, Docker 27.5.1.

---

## Déviations au plan

*(Aucune pour l'instant. Toute déviation est consignée ici avec sa raison et son impact.)*
