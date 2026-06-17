# 01 — Glossaire métier

Ce glossaire fixe le vocabulaire utilisé dans les documents et, plus tard, dans le code.

## Termes principaux

| Terme | Définition |
| --- | --- |
| Source | Point de départ traçable. Exemple : ballot déjà inoculé, sac de substrat, bloc de mycélium. |
| Ballot inoculé | Support de culture déjà colonisé ou en cours de colonisation, acheté ou préparé en interne. |
| Lot | Unité de suivi principale dans l’application. Un lot provient d’une source et suit un process. |
| Sous-lot | Partie issue d’une division d’un lot parent. Peut avoir son propre QR et son propre parcours. |
| Division | Action qui transforme un lot en plusieurs enfants traçables. |
| Fusion | Action éventuelle regroupant plusieurs lots ou récoltes. À utiliser avec prudence car elle complique la traçabilité. |
| Chambre | Espace de culture : incubation, fructification, stockage, séchage, etc. |
| Emplacement | Position précise dans une chambre : étagère, niveau, rack, bac, zone. |
| Phase | Grande période du process de culture : réception, incubation, fructification, récolte, fin de production. |
| Étape | Moment opérationnel précis dans une phase. |
| Transition | Passage autorisé d’une étape à une autre. |
| Process | Enchaînement configurable de phases, étapes, actions, observations, règles, champs à saisir et alertes. |
| Action configurable | Action proposée à l’utilisateur selon le contexte : mesurer, observer, déplacer, diviser, récolter, signaler. |
| Observation configurable | Type d’observation prévu dans une phase : contamination, pousse visible, maturité, surface sèche, odeur. |
| Événement | Enregistrement horodaté d’une action ou d’un fait : mesure, déplacement, récolte, division. |
| Mesure | Valeur numérique ou qualitative relevée : température, humidité, poids, CO2, luminosité. |
| Observation | Note libre, photo ou constat terrain. |
| Flush | Vague de fructification/récolte d’un même lot. |
| Récolte | Action de prélèvement des champignons produits par un lot ou sous-lot. |
| Produit final | Produit prêt à être stocké, vendu ou transformé : frais, séché, barquette, vrac, rebut, compost. |
| Lot produit | Lot de produit final issu d’une ou plusieurs récoltes. |
| Mouvement stock | Entrée, sortie, correction ou transformation de stock. |
| QR code | Identifiant visuel scannable relié à une entité traçable. |
| Étiquette | Support physique imprimé avec QR, libellé et informations utiles. |
| Caméra Reolink | Caméra réseau prévue pour suivre visuellement la pousse. |
| Inkbird | Contrôleur Wi‑Fi prévu pour température/humidité, notamment ITC-308-WIFI et IHC-200-WIFI. |
| Généalogie | Arbre parent/enfant reliant source, lots, sous-lots, récoltes et produits. |
| Traçabilité ascendante | Remonter d’un produit final vers sa source d’origine. |
| Traçabilité descendante | Partir d’une source et voir tout ce qu’elle a produit. |

## Entités traçables

Les entités suivantes peuvent recevoir un QR code :

- source ;
- lot ;
- sous-lot ;
- chambre ;
- emplacement ;
- récolte ;
- lot de produit final ;
- éventuellement bac, caisse, contenant ou étiquette temporaire.

## États possibles d’un lot

Les états exacts seront configurables, mais on peut prévoir :

| État | Sens |
| --- | --- |
| Brouillon | Créé mais pas encore actif. |
| Actif | Suit le process de culture. |
| En attente | Bloqué ou suspendu temporairement. |
| Divisé | A donné naissance à des sous-lots. |
| En production | En phase de fructification/récolte. |
| Terminé | Fin normale de cycle. |
| Rebut | Écarté, contaminé, composté ou détruit. |
| Transformé | Converti en produit final ou autre forme. |

## Catégories d’événements

| Catégorie | Exemples |
| --- | --- |
| Création | source créée, lot initialisé, QR imprimé. |
| Process | changement d’étape, validation d’étape, retour arrière contrôlé. |
| Localisation | entrée chambre, sortie chambre, déplacement étagère. |
| Division | création de sous-lots, poids répartis, étiquettes enfants. |
| Mesure | température, humidité, poids, CO2, luminosité. |
| Observation | note, photo, contamination, pousse visible, anomalie. |
| Récolte | flush, poids récolté, qualité, pertes. |
| Produit | conditionnement, transformation, entrée stock. |
| Stock | sortie vente, correction, perte, inventaire. |
| Matériel | impression QR, scan QR, caméra, maintenance. |
| Audit | correction, annulation, modification administrative. |

## Unités à prévoir

| Domaine | Unités possibles |
| --- | --- |
| Masse | g, kg. |
| Température | °C. |
| Humidité relative | %. |
| CO2 | ppm. |
| Luminosité | lux ou niveau qualitatif. |
| Temps | minutes, heures, jours. |
| Quantité | pièce, caisse, barquette, sac. |
| Volume | ml, L, si besoin. |

## Concepts à clarifier

- Le terme exact souhaité pour “ballot” : ballot, bloc, sac, pain, substrat, source ?
- La différence métier entre source, lot et sous-lot.
- Les types exacts de produits finaux vendus.
- Les statuts réellement utilisés sur site.
- Les mesures obligatoires par étape.
