# 12 — Exigences non fonctionnelles

## 1. Fiabilité

L’application doit être fiable en environnement de production agricole.

Exigences :

- éviter les pertes de données ;
- sauvegarder régulièrement MongoDB ;
- historiser les actions importantes ;
- permettre la correction sans suppression ;
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

- authentification ;
- permissions backend ;
- sessions sécurisées ;
- mots de passe hashés ;
- tokens QR non prédictibles ;
- audit des corrections ;
- accès imprimante et appareils réservé au backend ;
- sauvegardes protégées.

## 4. Réseau local

L’application doit fonctionner sur site.

Prévoir :

- adresse locale stable ;
- documentation de connexion iPhone ;
- gestion des changements d’IP ;
- mDNS/Bonjour si possible ;
- fallback par IP ;
- stratégie HTTPS locale si nécessaire.

## 5. Compatibilité iPhone

L’interface doit être testée sur Safari iOS.

Points importants :

- scan QR via appareil photo ;
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

- sauvegarde MongoDB quotidienne ;
- sauvegarde des fichiers/photos ;
- export ponctuel CSV/JSON pour données critiques ;
- procédure de restauration documentée ;
- test de restauration régulier.

## 9. Observabilité

Le backend doit produire :

- logs applicatifs ;
- logs d’erreurs ;
- logs d’impression ;
- logs d’intégration caméra/appareils ;
- métriques simples : nombre de scans, événements, erreurs.

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
- mode sombre éventuellement utile en chambre.
