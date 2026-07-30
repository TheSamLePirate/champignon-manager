# 20 — Modèle de process par défaut

> Fichier machine : [`20-modele-process-par-defaut.json`](./20-modele-process-par-defaut.json)

## 1. À quoi ça sert

Le cultivateur a tranché : **« le tableau sera de toute façon configurable »**. Il n'y a donc pas de process de production livré avec l'application — les valeurs sont saisies par l'utilisateur.

Mais sans rien, la première utilisation commence par une page blanche et un formulaire vide. C'est le moment classique d'abandon d'un outil de traçabilité.

Ce document définit un **modèle pré-rempli et modifiable**, proposé au premier démarrage. Ce n'est **pas** un seed métier : c'est un point de départ éditable.

**Règle d'affichage** : l'application doit indiquer clairement que ces valeurs sont un exemple à ajuster, et non des recommandations agronomiques.

## 2. Provenance des valeurs — à lire avant de s'en servir

Chaque valeur du JSON porte un champ `provenance` :

| Provenance | Signification | Nombre |
| --- | --- | --- |
| `cultivator` | **Réponse réelle** du cultivateur (export du 30/07/2026) | 47 |
| `invented` | **Valeur inventée** pour éviter un champ vide — aucune base agronomique | 14 |

⚠️ **Les valeurs `invented` n'engagent rien.** Elles sont plausibles, pas vérifiées. Elles concernent surtout les stades de laboratoire (gélose, LC, grain), le repos entre flushs et la durée de fructification, pour lesquels aucune réponse n'a été donnée.

## 3. Le process retenu — 6 étapes, pas 13

Les subdivisions incubation 1/2/3 et fructification 1/2 sont **volontairement absentes** : le cultivateur a répondu « pas de différence ». Elles restent créables à la main.

```
[gélose] → [culture liquide] → [ballot de grain]   ← stades labo, optionnels
                                      ↓
                            inoculation du substrat
                                      ↓
                                 incubation
                                      ↓
                               fructification
                                      ↓
                    flush 1 → [repos] → flush 2 → [repos] → flush 3 (optionnel)
                                      ↓
                                fin de cycle
```

Une unité peut **entrer à n'importe quel stade** — y compris directement au substrat, sans ascendant.

## 4. Étapes et valeurs

| Étape | Durée cible | Température | Humidité | Lumière | Provenance |
| --- | --- | --- | --- | --- | --- |
| Gélose *(opt.)* | 12 j (10-14) | 22-24 °C | — | obscurité | ⚠️ inventé |
| Culture liquide *(opt.)* | 10 j (7-14) | 22-24 °C | — | obscurité, agitation | ⚠️ inventé |
| Ballot de grain *(opt.)* | 18 j (14-21) | 24 °C | — | obscurité | ⚠️ inventé |
| **Inoculation substrat** | ponctuelle | — | — | — | ✅ réel |
| **Incubation** | **21 j (14-21)** | **24 °C** | **non contrôlée** | **obscurité** | ✅ réel |
| **Fructification** | 6 j (5-8) | **18-24 °C** | **90 %** | **lumière** | ✅ conditions réelles, durée inventée |
| **Flush 1 / 2 / 3** | 2 j | idem fructification | idem | idem | ✅ réel (durée inventée) |
| Repos entre flushs *(opt.)* | 10 j (7-14) | idem | idem | idem | ⚠️ inventé |
| **Fin de cycle** | — | — | — | — | ✅ réel |

Détails réels confirmés :

- **Inoculation** : vérification du grain → transfert sur substrat → scellage → incubation. Saisie du **poids substrat total**, contrôle aspect/odeur/propreté/température, impression d'un QR par unité (nom, type, date).
- **Fructification** : déclenchée par **ouverture du sac**, passage en lumière, montée à 90 % d'humidité et descente en température. **Primordia à 2-3 jours**. **2 chambres**.
- **Récoltes** : poids **en grammes, par unité**, plus qualité et **pertes avec leur cause**. Flush 2 systématique, qualité différente du flush 1. Flush 3 optionnel mais **rentable**.
- **Fin de cycle** : poids final, raison de fin, emplacement **occupé jusqu'au nettoyage**.

## 5. Alarmes par défaut

⚠️ Entièrement inventées — aucun seuil n'a été fourni.

| Alarme | Réglage proposé |
| --- | --- |
| Rappel avant échéance | J-1 |
| Alerte de dépassement | à la durée cible |
| Retard critique | +50 % de la durée cible |
| Rappel périodique | désactivé *(non retenu par le cultivateur)* |
| Contrôle en milieu d'étape | désactivé *(non retenu)* |

**Rappel structurant** : une alarme prévient, crée une alerte, marque un retard — elle **ne bloque jamais** et **ne fait jamais avancer** une unité. Le passage se décide à l'observation visuelle, validé par une personne.

## 6. Ce que le modèle ne contient pas

- **Aucune liste d'actions ni d'observations par étape.** Les deux listes sont globales, filtrées par pertinence de stade. Le JSON les porte au niveau du modèle, pas des étapes.
- **Aucune transition automatique.** Les durées ne servent qu'aux alarmes.
- **Aucune fusion d'unités** : la généalogie n'a que des divergences (clone, transfert, division).
- **Aucune espèce nommée** : le modèle s'applique à toute espèce (`speciesScope: "any"`).

## 7. Conditions par chambre

Le questionnaire §10.3 n'a pas été rempli. Deux chambres de fructification sont mentionnées, sans conditions distinctes. Le modèle ne propose donc **aucune configuration de chambre** : c'est à saisir à la mise en service.

## 8. Ce qu'il reste à ajuster avec le cultivateur

1. Les durées des stades labo — gélose, LC, grain — entièrement inventées.
2. La durée de fructification et le repos entre flushs.
3. Les seuils d'alarme réels.
4. Les ratios de multiplication (1 gélose → N LC → N grains → N substrats).
5. Les conditions cibles par chambre, et ce qui distingue les deux chambres de fructification.
6. La durée maximale de conservation (180 j proposés, arbitraires).
