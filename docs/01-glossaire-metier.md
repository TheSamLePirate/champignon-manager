# 01 — Glossaire métier

Ce glossaire fixe le vocabulaire utilisé dans les documents et, plus tard, dans le code.

## Termes principaux

| Terme | Définition |
| --- | --- |
| Source / Origine | Point de départ amont de la traçabilité. Exemple : empreinte de spores, culture mère reçue ou achetée, clone de tissu, gélose, culture liquide ou ballot déjà inoculé. La chaîne va « du spore à l’assiette ». |
| Unité de culture | Tout objet physique traçable par QR, à n’importe quel stade (gélose, culture liquide, grain, substrat, fructification). Notion généralisant « lot »/« unité ». |
| Stade de culture | Niveau dans la chaîne de propagation : `gélose` → `culture liquide (LC)` → `grain` → `substrat` → `fructification`. Configurable. |
| Gélose | Boîte de Pétri / culture sur milieu gélosé (agar). Premier maillon typique ; peut servir de culture mère. |
| Culture mère | Unité conservée (souvent gélose ou LC) servant de réserve génétique pour cloner sans la consommer. |
| Culture liquide (LC) | Mycélium en milieu liquide, issu d’une gélose, servant à inoculer rapidement le grain. |
| Grain | Grain colonisé (« ballot de grain », spawn) issu d’une LC ou d’une gélose, servant à inoculer le substrat. |
| Substrat | Support de fructification (« ballot de substrat ») inoculé à partir du grain. Maillon déjà exploré du process. |
| Clone (secondaire) | Multiplication latérale au sein d’un même stade : une gélose donne des géloses secondaires, une LC des LC secondaires, un grain des grains secondaires. Le parent survit en général. |
| Transfert / Repiquage / Inoculation | Passage au stade suivant (le stade change) : gélose → LC → grain → substrat. Une unité amont peut inoculer plusieurs unités aval (ratio de multiplication). |
| Génération | Rang d’un clone dans sa lignée (G1, G2, …). Utile pour suivre la sénescence éventuelle d’une souche. |
| Ballot inoculé | Support de culture (grain ou substrat) déjà colonisé ou en cours de colonisation, acheté ou préparé en interne. |
| Lot | Unité de suivi au stade substrat/fructification. Cas particulier d’unité de culture. Un lot provient d’un transfert depuis le grain (ou d’une source reçue) et suit un process. |
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

- origine / culture mère ;
- unité de gélose ;
- unité de culture liquide (LC) ;
- unité de grain ;
- source ;
- lot (substrat) ;
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
| Propagation | clone (gélose/LC/grain secondaire), transfert/repiquage vers le stade suivant, inoculation. |
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

- Le terme exact souhaité pour chaque stade : gélose, culture liquide/LC, grain, substrat, ballot, bloc, sac, pain ?
- La différence métier entre source/origine, unité de culture, lot et sous-lot.
- Jusqu’où remonter la traçabilité : spore, gélose, ou culture liquide ?
- Les ratios de multiplication clone/transfert à suivre par stade.
- Les types exacts de produits finaux vendus.
- Les statuts réellement utilisés sur site.
- Les mesures obligatoires par stade/étape.
