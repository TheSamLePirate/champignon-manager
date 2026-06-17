# 12 — Exigences non fonctionnelles

## 1. Fiabilité

L’application doit être fiable en environnement de production agricole.

Exigences :

- éviter les pertes de données ;
- sauvegarder régulièrement MongoDB ;
- historiser les actions importantes ;
- permettre la correction et la suppression logique auditée ;
- gérer les coupures réseau locales ;
- signaler clairement les erreurs d’impression ou de matériel.

## 2. Performance

Objectifs :

- ouverture rapide d’une fiche après scan QR ;
- affichage fluide sur iPhone ;
- listes paginées ;
- index MongoDB sur les champs de recherche ;
- stockage images optimisé ;
- dashboards calculés efficacement.

Cibles indicatives :

- résolution QR : moins d’une seconde sur réseau local ;
- chargement fiche lot : moins de deux secondes ;
- ajout observation : moins de deux secondes hors upload photo ;
- listes principales : pagination obligatoire au-delà de quelques centaines d’éléments.

## 3. Sécurité

Même en local, l’application gère des données de production.

Exigences :

- authentification simple login/mot de passe au MVP ;
- rôle `admin` unique au départ ;
- permissions backend extensibles ;
- sessions sécurisées même en local ;
- mots de passe hashés ;
- tokens QR non prédictibles ;
- audit de toutes les actions importantes ;
- accès imprimante et appareils réservé au backend ;
- sauvegardes protégées.

## 4. Réseau local

L’application doit fonctionner sur site.

Prévoir :

- adresse locale stable ;
- documentation de connexion iPhone ;
- Tailscale comme option probable pour accès local étendu/distant ;
- HTTPS via Tailscale si nécessaire ;
- gestion des changements d’IP ;
- mDNS/Bonjour si possible ;
- fallback par IP ;
- stratégie HTTPS locale si Tailscale ne suffit pas.

## 5. Compatibilité iPhone

L’interface doit être testée sur Safari iOS.

Points importants :

- scan QR via scanner web intégré au MVP ;
- scan via appareil photo iOS en option future si QR URL ;
- ajout à l’écran d’accueil ;
- upload photo ;
- permissions caméra si scan intégré ;
- lisibilité en environnement de culture ;
- gros contrôles tactiles.

## 6. Maintenabilité

Principes :

- architecture modulaire ;
- TypeScript strict ;
- schémas de validation centralisés ;
- séparation domaine/API/frontend ;
- tests sur services critiques ;
- documentation à jour ;
- migrations de données explicites.

## 7. Extensibilité

L’application doit pouvoir évoluer vers :

- nouvelles espèces ;
- nouveaux process ;
- nouveaux types de produits ;
- nouveaux appareils ;
- caméras multiples ;
- capteurs ;
- exports ;
- éventuellement multi-site.

## 8. Données et sauvegardes

Stratégie recommandée :

- sauvegarde MongoDB par `mongodump` ;
- sauvegarde des fichiers/photos ;
- définir fréquence, destination et rétention avant mise en production ;
- export ponctuel CSV/JSON pour données critiques ;
- procédure de restauration documentée ;
- test de restauration régulier obligatoire.

## 9. Observabilité

Le backend doit produire :

- logs applicatifs ;
- logs d’erreurs ;
- logs d’impression ;
- logs d’intégration caméra/appareils ;
- métriques simples : nombre de scans, événements, erreurs ;
- dashboard admin de consultation des logs.

## 10. Audit

Actions auditables :

- création/modification source ;
- changement d’étape ;
- division ;
- mouvement ;
- récolte ;
- produit final ;
- correction ;
- réimpression QR ;
- changement configuration process ;
- changement de droits ;
- suppression logique / annulation ;
- action matérielle future.

## 11. Robustesse face au matériel

L’application ne doit pas bloquer toute la production si un matériel est indisponible.

Cas :

- imprimante QR hors ligne ;
- caméra Reolink inaccessible ;
- Inkbird inaccessible ;
- Wi‑Fi instable ;
- iPhone sans réseau.

Réponse attendue :

- message clair ;
- retry ;
- action manuelle alternative ;
- journal d’erreur ;
- pas de corruption de données.

## 12. Internationalisation

Pour le moment, l’interface peut être en français.

Prévoir cependant :

- unités configurables ;
- dates/heures cohérentes ;
- libellés de process configurables ;
- possibilité future de traductions si besoin.

## 13. Accessibilité pratique

Même sans objectif formel WCAG complet au MVP, prévoir :

- contrastes suffisants ;
- textes lisibles ;
- boutons larges ;
- feedback visuel clair ;
- pas d’information uniquement par couleur ;
- mode sombre utile en chambre.

## 14. Tests et validation

Décisions développeur :

- objectif de couverture très élevé ;
- services métier testables ;
- tests unitaires et intégration avec Vitest ;
- tests E2E avec Playwright ;
- tests des formulaires dynamiques ;
- seeds / fixtures de développement ;
- validation locale au départ, CI distante non prioritaire.

Critère de fin d’une fonctionnalité :

- tests passants ;
- validation terrain si concernée ;
- capture écran pour UI ;
- documentation JSON/Markdown mise à jour ;
- migration prévue si nécessaire ;
- logs utiles ;
- rollback possible.

## 15. Décisions développeur intégrées

Synthèse complète : [18-decisions-techniques-dev.md](./18-decisions-techniques-dev.md).

Points clés :

- MVP réellement utilisable en production.
- Docker Compose pour déploiement local.
- Dev macOS / Windows 11, production Raspberry Pi.
- Tailscale pour accès local étendu/distant.
- Reolink, Inkbird, offline avancé, ventes et facturation après MVP.
