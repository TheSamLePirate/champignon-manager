# 14 — Questions ouvertes

Ce document centralise les décisions à prendre avant ou pendant le codage.

## 1. Vocabulaire métier

1. Quel terme utiliser dans l’application : ballot, bloc, sac, substrat, pain, source ?
2. Est-ce qu’une “source” et un “lot” doivent être deux objets différents pour toi ?
3. Un sous-lot est-il toujours issu d’une division physique, ou peut-il être une simple séparation logique ?
4. Quelles espèces seront gérées au début : pleurotes seulement ou autres dès le MVP ?
5. Les souches/variétés doivent-elles être suivies précisément ?

## 2. Process de culture

1. Quelles sont les phases réelles de ton process pleurotes actuel ?
2. Quelles étapes veux-tu voir dans la première version ?
3. Quelles transitions doivent être autorisées ?
4. Faut-il autoriser un retour arrière d’étape ?
5. Certaines étapes doivent-elles avoir une durée minimale ou maximale ?
6. Quelles étapes déclenchent une alerte si rien n’est fait ?
7. Veux-tu plusieurs process selon espèce, souche, fournisseur ou type de ballot ?

## 3. Actions configurables

1. Quelles actions doivent être proposées à chaque phase ?
2. Quelles actions doivent être réservées à certains rôles ?
3. La division de lot peut-elle se faire à n’importe quelle étape ?
4. La récolte peut-elle être enregistrée uniquement depuis certaines étapes ?
5. Faut-il une action spéciale “contamination” ?
6. Faut-il une action spéciale “compost/rebut” ?
7. Faut-il une action “pause/attente” ?

## 4. Observations et mesures

1. Quelles observations veux-tu proposer par défaut ?
2. Quelles observations doivent être obligatoires à certaines étapes ?
3. Les photos doivent-elles être obligatoires pour contamination ?
4. Quelles mesures sont saisies manuellement aujourd’hui ?
5. Quelles mesures viendront des Inkbird plus tard ?
6. Veux-tu suivre CO2 et luminosité dès le modèle, même sans capteur au début ?
7. Faut-il noter la maturité de récolte avec une échelle qualitative ?

## 5. Lots, divisions et mélanges

1. Quand divises-tu un lot en pratique ?
2. La division doit-elle répartir un poids total contrôlé ?
3. Un sous-lot peut-il être fusionné avec un autre ?
4. Les récoltes de plusieurs lots peuvent-elles être mélangées dans un même produit final ?
5. Si oui, faut-il suivre les proportions exactes ?
6. Un lot parent reste-t-il actif après division ou devient-il seulement un conteneur historique ?

## 6. Chambres et emplacements

1. Combien de chambres ou zones au début ?
2. Faut-il suivre seulement la chambre ou aussi étagère/rack/niveau ?
3. Les chambres ont-elles des conditions cibles différentes ?
4. Un lot peut-il être dans plusieurs emplacements en même temps ?
5. Les chambres doivent-elles avoir leur propre QR code ?

## 7. QR et étiquettes

1. Quel est le modèle exact de l’imprimante QR ?
2. Quelle taille d’étiquette ?
3. Quelles informations doivent être imprimées en plus du QR ?
4. Faut-il une étiquette pour chaque sous-lot ?
5. Faut-il une étiquette produit final ?
6. Comment gérer une étiquette perdue ou abîmée ?
7. Le QR doit-il rester lisible en environnement humide ?

## 8. Interface iPhone

1. L’utilisateur scannera-t-il avec l’appareil photo iOS ou dans l’interface web ?
2. L’iPhone aura-t-il toujours du Wi‑Fi dans les chambres ?
3. Faut-il prévoir un mode hors ligne ?
4. Quelles sont les 3 actions les plus fréquentes après scan ?
5. Faut-il un mode “opérateur sans mot de passe” sur appareil local ?

## 9. Récoltes et produits finaux

1. Quels produits finaux veux-tu gérer au début ?
2. Frais, barquette, vrac, séché, transformé, compost, rebut ?
3. Faut-il gérer DLC/DDM ?
4. Faut-il gérer prix ou seulement stock ?
5. Faut-il tracer vente/client ou uniquement sortie stock ?
6. Les pertes de tri doivent-elles être détaillées ?

## 10. Caméra Reolink

1. Quelle caméra Reolink est utilisée ?
2. Elle surveille une chambre entière ou un emplacement précis ?
3. À quelle fréquence capturer ?
4. Veux-tu des timelapses ?
5. Les captures doivent-elles être rattachées automatiquement aux lots présents dans la chambre ?
6. Le code existant de contrôle caméra expose-t-il déjà une API ou une librairie ?

## 11. Inkbird

1. Les appareils Inkbird sont-ils connectés au Wi‑Fi local ou seulement via cloud/app mobile ?
2. As-tu déjà un moyen de lire leurs valeurs ?
3. Veux-tu seulement afficher/historiser ou aussi modifier les consignes ?
4. À quelle fréquence lire les valeurs ?
5. Un Inkbird est-il associé à une chambre fixe ?
6. Faut-il déclencher des alertes si température/humidité hors plage ?

## 12. Technique et déploiement

1. Sur quelle machine tournera le backend local ?
2. MongoDB sera-t-il local sur la même machine ?
3. Faut-il Docker ou installation directe ?
4. Faut-il accès à distance hors site ?
5. Quel nom local utiliser : `champignon.local`, IP fixe, autre ?
6. Faut-il HTTPS local dès le début ?
7. Quelle stratégie de sauvegarde souhaites-tu ?

## 13. Droits et utilisateurs

1. Combien d’utilisateurs au début ?
2. Faut-il plusieurs rôles dès le MVP ?
3. Un opérateur doit-il pouvoir corriger ses saisies ?
4. Qui peut modifier le process ?
5. Qui peut réimprimer des QR ?
6. Qui peut supprimer/annuler une donnée ?

## 14. Priorités immédiates à trancher

Pour démarrer le codage plus tard, il faudra surtout valider :

1. vocabulaire source/lot/sous-lot ;
2. premier process pleurotes ;
3. actions par phase ;
4. observations par phase ;
5. niveau de localisation physique ;
6. informations d’étiquette QR ;
7. produits finaux MVP ;
8. stratégie d’authentification locale.

## 15. Mise à jour après réponses développeur — 2026-06-17

Synthèse complète : [18-decisions-techniques-dev.md](./18-decisions-techniques-dev.md).

### Décisions techniques closes

- Stack : Bun + TypeScript strict + Vite + React + MongoDB.
- Architecture : monorepo Bun workspaces.
- Backend : Hono REST.
- Validation : Zod.
- API : client typé + OpenAPI automatique.
- MongoDB : native driver + validation Zod.
- Modèle de persistance : état courant + événements immuables.
- Transactions : MongoDB replica set local via Docker Compose.
- Déploiement : Docker Compose.
- Environnements : dev macOS/Windows 11, production Raspberry Pi.
- Accès : local/Tailscale, HTTPS via Tailscale si nécessaire.
- QR : token opaque seulement.
- Scan : scanner web intégré au MVP.
- Imprimante : Nimbot B21.
- Auth MVP : login/mot de passe simple, rôle `admin` au départ.
- UI : Tailwind + shadcn/ui recommandés.
- Tests : Vitest + Playwright + tests formulaires dynamiques.
- PWA/offline : pas obligatoire au MVP.
- Reolink/Inkbird/ventes/facturation/contrôle actif : après MVP.

### Questions techniques restant ouvertes

- Driver/protocole exact pour Nimbot B21.
- URL finale Tailscale / locale.
- Politique exacte de sauvegarde : fréquence, destination, rétention.
- Versioning et migration d’un process déjà utilisé par des lots.
- Format final des `publicCode`.
- Niveau réaliste de couverture de tests au MVP.

### Questions métier toujours dépendantes du cultivateur

- Vocabulaire source / unité / lot / sous-lot.
- Phases et étapes réelles pleurotes.
- Actions par phase/étape.
- Observations par phase/étape.
- Mesures obligatoires ou optionnelles.
- Niveau de détail chambres / emplacements.
- Produits finaux MVP.
- Contenu des étiquettes.
