# 11 — Mesures, observations, caméra et appareils

## 1. Objectif

Centraliser les données de suivi de culture : mesures manuelles, observations terrain, photos, caméra Reolink et appareils Inkbird futurs.

Ces données doivent enrichir la traçabilité et aider à comprendre le rendement, les problèmes et l’évolution de la pousse.

## 2. Types de mesures

Mesures possibles :

| Mesure | Unité | Cible typique |
| --- | --- | --- |
| Température | °C | chambre, lot, appareil Inkbird. |
| Humidité relative | % | chambre, appareil Inkbird. |
| CO2 | ppm | chambre. |
| Luminosité | lux ou niveau | chambre. |
| Poids | g/kg | source, lot, récolte, produit. |
| Durée | h/jours | étape, process. |
| Quantité | pièce/caisse | produit, contenant. |
| État relais | on/off | contrôleur Inkbird. |
| Consigne | °C/% | contrôleur Inkbird. |

## 3. Observations configurables

Les observations doivent être configurables par phase/étape.

Exemples :

- pousse visible ;
- primordia visibles ;
- maturité proche ;
- maturité dépassée ;
- contamination suspecte ;
- odeur anormale ;
- surface sèche ;
- excès d’humidité ;
- couleur anormale ;
- chapeau abîmé ;
- insectes ;
- besoin de récolte ;
- test expérimental.

Chaque observation peut créer :

- simple note ;
- alerte ;
- recommandation d’action ;
- changement de statut ;
- demande de photo obligatoire.

## 4. Cibles des données

Une mesure ou observation peut être liée à :

- un lot ;
- un sous-lot ;
- une source ;
- une chambre ;
- un emplacement ;
- une récolte ;
- un produit final ;
- une caméra ;
- un appareil ;
- un événement.

## 5. Saisie manuelle

Saisie rapide depuis mobile :

1. scan QR ;
2. choisir action “mesurer” ou “observer” ;
3. formulaire adapté à la phase/étape ;
4. validation ;
5. création d’événement ;
6. retour à la fiche.

L’application doit permettre :

- valeurs numériques ;
- choix qualitatifs ;
- notes libres ;
- photos ;
- tags ;
- gravité ;
- correction ultérieure historisée.

## 6. Photos depuis iPhone

Utilisations :

- suivi de pousse ;
- preuve de contamination ;
- comparaison entre chambres ;
- documentation d’un problème ;
- aide future à l’analyse visuelle.

Contraintes :

- compression des images ;
- stockage local organisé ;
- métadonnées MongoDB ;
- liaison avec lot/chambre/observation ;
- respect de l’espace disque.

## 7. Caméra Reolink

Une caméra Reolink est prévue pour le suivi de pousse.

L’utilisateur indique avoir déjà du code pour la contrôler. L’intégration sera branchée plus tard.

### 7.1 Objectifs futurs

- associer une caméra à une chambre ;
- déclencher une capture manuelle ;
- programmer des captures régulières ;
- consulter les images depuis la fiche chambre ;
- associer des captures à des lots présents ;
- générer un timelapse ;
- utiliser des images pour analyse future.

### 7.2 Données caméra

À stocker :

- caméra ;
- chambre associée ;
- date de capture ;
- fichier image ;
- lots potentiellement visibles ;
- tags ;
- commentaire ;
- résultat d’analyse futur.

### 7.3 Points d’intégration

- module backend `cameras` ;
- configuration caméra ;
- stockage fichier ;
- événements `camera_capture_created` ;
- affichage frontend dans vue chambre et vue lot.

## 8. Inkbird ITC-308-WIFI et IHC-200-WIFI

Les appareils Inkbird seront ajoutés plus tard.

### 8.1 Appareils connus

- **Inkbird ITC-308-WIFI** : contrôleur de température Wi‑Fi.
- **Inkbird IHC-200-WIFI** : contrôleur d’humidité Wi‑Fi.

### 8.2 Rôle possible dans l’app

- associer un appareil à une chambre ;
- afficher les valeurs courantes ;
- historiser température/humidité ;
- lire les consignes ;
- lire l’état des relais ;
- comparer conditions réelles et conditions cibles ;
- déclencher alertes si hors seuil ;
- corréler conditions et rendement.

### 8.3 Intégration à clarifier

Il faudra déterminer le mode d’accès :

- API locale officielle ;
- API cloud ;
- intégration tierce ;
- Home Assistant/MQTT comme passerelle ;
- export/import manuel ;
- saisie manuelle si aucune API fiable.

### 8.4 Prudence sur le contrôle

Pour le MVP, l’application doit d’abord lire et historiser.

Le contrôle actif des appareils — modification de consignes, activation relais — doit être traité plus tard avec prudence :

- sécurité production ;
- confirmation utilisateur ;
- journal d’audit ;
- limites de consignes ;
- retour d’état.

## 9. Alertes liées aux mesures

Exemples :

- température hors plage cible ;
- humidité trop basse ;
- humidité trop haute ;
- mesure manquante depuis X heures ;
- contamination signalée ;
- photo caméra absente ;
- appareil hors ligne ;
- caméra hors ligne.

## 10. Corrélation et rapports futurs

À terme, l’application pourra analyser :

- rendement par chambre ;
- rendement par plage température/humidité ;
- durée de phase vs rendement ;
- contamination par chambre ;
- effet d’un protocole expérimental ;
- comparaison entre lots frères.

## 11. Données minimales MVP

Pour commencer :

- mesures manuelles ;
- observations configurables ;
- photos liées aux observations ;
- association mesures/observations à lot ou chambre ;
- historique dans timeline ;
- architecture prête pour Reolink et Inkbird.
