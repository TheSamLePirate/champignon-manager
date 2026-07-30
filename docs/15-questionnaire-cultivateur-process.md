# 15 — Questionnaire cultivateur : process multi-espèces (pleurote et autres), traçabilité et suivi

## 1. Objectif du document

Ce document est destiné au cultivateur.

But : comprendre précisément comment se passe la culture sur le terrain pour que l’application corresponde au vrai métier, pas à une idée théorique.

L’application devra permettre de suivre chaque unité avec un QR code, depuis l’inoculation ou la réception jusqu’aux récoltes, avec les poids, les chambres, les conditions et les statistiques.

> **Mise à jour 2026-07-30 — réponses du cultivateur intégrées (2 passes).** Sources : `champignon-reponses-cultivateur-2026-07-30.json`, puis une session de questions groupées le même jour.
>
> **État : 139 questions renseignées sur 188.** La 1ʳᵉ passe en couvrait 84 (l’export annonçait à tort 100 % : 104 questions étaient vides). Une seconde passe, en regroupant les questions qui se répétaient d’un stade à l’autre, en a clos 55 de plus. Les 49 restantes portent la mention `⏳ SANS RÉPONSE`.
>
> **Ce qui est acquis** : les 10 principes de cadrage (§2.1) ; la structure de la chaîne (départ à n’importe quel stade, clonage partout, pas de limite de générations, réactivation = nouvelle unité, bascule de version avec confirmation, un seul auteur de process) ; et depuis la 2ᵉ passe — actions identiques à tous les stades filtrées par pertinence, **passage d’étape déclenché par l’observation visuelle** (la durée n’étant qu’un rappel), poids par unité + qualité + pertes avec cause à chaque flush, photo obligatoire sur contamination et gravité à 3 niveaux, suivi jusqu’à la position sur l’étagère, statuts de fin, et contenu de l’étiquette.
>
> **Ce qui manque toujours** — chemin critique inchangé : **toutes les valeurs chiffrées**. Aucune durée, température, humidité, aucun ratio, aucun seuil d’alarme, aucune liste d’espèces. Le **tableau §20 reste vide**, et c’est lui qui bloque l’amorçage du premier process.

## 2. Ce que nous avons compris pour l’instant

À confirmer ou corriger (les principes structurants, eux, sont déjà validés — voir §2.1) :

- Il y a plusieurs espèces de champignons (pleurote, shiitake, etc.), configurables — pas seulement des pleurotes.
- Chaque unité de culture doit avoir une traçabilité complète par QR code.
- La chaîne va « du spore à l’assiette » : origine (spores / culture mère) → gélose → culture liquide (LC) → grain → substrat → fructification, avec clones (cultures secondaires) et transferts à chaque stade.
- Les étapes évoquées sont :
  - inoculation ;
  - incubation 1 ;
  - incubation 2 ;
  - incubation 3 ;
  - fructification 1 ;
  - fructification 2 ;
  - récolte flush 1 ;
  - récolte flush 2 ;
  - récolte flush 3.
- Pour chaque récolte, le poids est mesuré par unité.
- L’utilisateur doit pouvoir faire avancer une unité dans le process depuis un iPhone connecté au Wi‑Fi local.
- Les unités peuvent être liées à des espaces différents : chambres, zones, températures, humidité.
- Il faudra pouvoir filtrer ou sélectionner des groupes d’unités :
  - par parent ;
  - par date d’inoculation ;
  - par phase d’incubation ;
  - par chambre ;
  - par espèce/variété.
- L’objectif final est aussi de produire des statistiques détaillées.

### 2.1 Principes de cadrage — ✅ validés par le cultivateur (2026-07-30)

Ces dix principes ont été proposés côté produit puis **acceptés en bloc par le cultivateur, sans réserve ni objection**. Ils sont donc **acquis** et fondent l’architecture de l’application : ils ne sont plus à rediscuter, sauf décision explicite.

1. **Chaque phase produit ses propres unités.** Une unité, c’est tout objet physique manipulé : souche, gélose, culture liquide, ballot de grain, sac de substrat, ballot inoculé, bac, caisse. Toutes sont traquées et monitorées.
2. **Toute unité peut être divisée**, à n’importe quel stade, chaque enfant recevant son propre QR.
3. **Après une division ou un transfert, le parent est au choix conservé actif ou archivé en historique** — les deux cas doivent exister.
4. **Le clonage est possible à chaque stade.**
5. **Toute unité peut être mise en conservation**, à n’importe quel stade.
6. **Chaque unité a son propre QR code, dès le début** de la chaîne.
7. **Le process est entièrement configurable** : on peut créer des process entiers ou des **sous-process réutilisables**, et les appliquer à des lots. Le moteur doit pouvoir tout faire, pour n’importe quel champignon ; seule la configuration change selon l’espèce/variété.
8. **Chaque phase/étape porte une durée**, avec des **alarmes de durée réglables dans le process**.
9. **Les décisions humaines agissent et priment** : l’application propose et alerte, l’opérateur valide.
10. **Sélection multi-critères totale** : on doit pouvoir sélectionner des unités selon n’importe quel paramètre (parenté, clone, session d’inoculation, stade, chambre, espèce, dates, génération…) et combiner les critères.

Corollaires : **traçabilité totale** de l’origine au produit final, et **toutes les statistiques possibles** doivent être calculables.

⏳ **Ce que ces principes ne disent pas** — et qui reste à obtenir du cultivateur, c’est maintenant le seul chemin critique :

- les **durées réelles** par stade et par espèce, et les **seuils d’alarme** associés ;
- les **conditions réelles** (température, humidité, lumière, aération) par stade et par espèce ;
- la **liste réelle des espèces et variétés** cultivées ;
- les **ratios de multiplication** (1 gélose → combien de LC, etc.) et les limites de génération ;
- le **vocabulaire exact** employé sur le terrain, stade par stade ;
- les **priorités d’affichage** : quelles actions après un scan, quelles stats au quotidien ;
- **ce qui devient trop lourd à saisir sur le terrain** malgré le principe de traçabilité totale.

Réponse du cultivateur (2026-07-30) :

```text
Les 10 principes sont acceptés, sans réserve ni objection.
```

## 3. Comment répondre

Répondre simplement, même avec des phrases courtes.

Quand une question ne s’applique pas, noter : `pas utile`, `jamais`, ou `à voir plus tard`.

Quand il y a plusieurs cas, donner des exemples concrets.

Exemple :

> Pour le pleurote gris, incubation 1 dure environ 7 jours à 22 °C. Pour le pleurote rose, c’est plus court et plus chaud.

## 4. Vocabulaire à valider

Avant de coder, il faut choisir les bons mots dans l’application.

### 4.1 Unité de suivi

Dans l’app, une “unité” est l’objet physique que l’on suit avec un QR code.

Questions :

1. Comment appelles-tu naturellement une unité, à chaque stade ?

Le mot change probablement selon le stade — donne ton vocabulaire pour chacun :
   - gélose / boîte de Pétri ?
   - culture liquide / LC ?
   - ballot de grain ?
   - ballot, bloc, sac, pain, substrat ?
   - bac, caisse ?
   - autre ?

Réponse :

```text
gélose/boîte de Pétri, culture liquide/LC, ballot de grain, ballot de substrat, bloc, sac, pain
```

2. Une unité correspond à quoi physiquement ?
   - un sac de substrat ?
   - un ballot inoculé ?
   - un bac ?
   - une caisse ?
   - autre ?

> ✅ **Validé (30/07/2026)** : une unité = tout objet physique manipulé, à n’importe quelle phase — souche, gélose, culture liquide, ballot de grain, sac de substrat, ballot inoculé, bac, caisse. Basiquement, chaque phase produit ses propres unités, toutes traquées et monitorées.
>
> ⏳ **Reste à préciser** : les contenants réels utilisés et leurs tailles typiques.

Réponse :

```text
Une unité = tout objet physique manipulé, à n’importe quelle phase — souche, gélose, culture liquide, ballot de grain, sac de substrat, ballot inoculé, bac, caisse. Basiquement, chaque phase produit ses propres unités, toutes traquées et monitorées.
```

3. Est-ce que l’unité peut être divisée physiquement en plusieurs enfants ?

Exemple : un parent donne plusieurs sous-unités, chacune avec son QR code.

> ✅ **Validé (30/07/2026)** : oui, à chaque fois — toute unité peut être divisée, à n’importe quel stade, chaque enfant recevant son propre QR.
>
> ⏳ **Reste à préciser** : à quels stades la division est réellement pratiquée, en combien de morceaux, et si le poids de chaque enfant doit être saisi.

Réponse :

```text
Oui, à chaque fois — toute unité peut être divisée, à n’importe quel stade, chaque enfant recevant son propre QR.
```

4. Si une unité est divisée, est-ce que le parent continue à exister, ou est-ce qu’il devient seulement un historique ?

> ✅ **Validé (30/07/2026)** : les deux cas doivent exister, au choix au moment de l’opération — parent conservé actif (culture mère, réserve) ou parent basculé en historique (immobile mais consultable et relié à ses enfants).
>
> ⏳ **Reste à préciser** : le comportement par défaut souhaité, stade par stade.

Réponse :

```text
Les deux cas doivent exister, au choix au moment de l’opération — parent conservé actif (culture mère, réserve) ou parent basculé en historique (immobile mais consultable et relié à ses enfants).
```

5. Toutes les unités doivent-elles être suivies avec le même niveau de détail ?

Le principe retenu est la traçabilité totale, mais la saisie doit rester tenable. Où est-ce que ça devient trop lourd ?

Réponse :

```text
Le principe retenu est la traçabilité totale : chaque unité est traquée et monitorée, à tous les stades.
```

## 5. Espèces, variétés et souches (multi-espèces, configurable)

L’application doit pouvoir comparer les résultats selon le type cultivé.

Questions :

1. Quelles espèces (et variétés) de champignons cultives-tu actuellement ?

Exemples possibles : pleurote gris, pleurote jaune, pleurote rose, pleurote du panicaut, shiitake, et autres espèces (configurables dans l’app).

Réponse :

```text
Tout type de champignon, configurable dans l app
```

2. Pour chaque espèce/variété, est-ce que le process change ?

Exemples : durée d’incubation différente, température différente, humidité différente, nombre de flushs différent.

> ✅ **Validé (30/07/2026)** : ce qui change d’une variété à l’autre est la **configuration** (durées, T°, humidité, nombre de flushs, seuils d’alarme), pas le moteur — le process de l’app doit pouvoir tout faire, pour n’importe quel champignon. Rien n’est codé en dur pour le pleurote.
>
> ⏳ **Reste à préciser** : les valeurs réelles, variété par variété.

Réponse :

```text
Ce qui change d’une variété à l’autre, c’est la configuration (durées, températures, humidité, nombre de flushs, seuils d’alarme), pas le moteur : le process de l’app doit pouvoir tout faire, pour n’importe quel champignon. Rien n’est codé en dur pour le pleurote.
```

3. Est-ce que tu veux suivre la souche précise, le fournisseur, ou seulement le type de champignon ?

> ✅ **Validé (30/07/2026)** : traçabilité totale — espèce, variété, souche précise, fournisseur/origine, et lignée complète (de quelle souche et de quelle génération descend chaque unité).
>
> ⏳ **Reste à préciser** : les identifiants utilisés pour nommer une souche.

Réponse :

```text
Traçabilité totale : espèce, variété, souche précise et fournisseur/origine, avec la lignée complète (de quelle souche et de quelle génération descend chaque unité).
```

4. Quelles statistiques veux-tu comparer par espèce/variété ?

Exemples : rendement total, rendement par flush, durée d’incubation, taux de contamination, poids moyen par unité.

> ✅ **Validé (30/07/2026)** : toutes les statistiques possibles doivent être calculables.
>
> ⏳ **Reste à préciser — c’est ça l’information utile** : les 3 ou 4 chiffres à regarder tous les jours en ouvrant l’app.

Réponse :

```text
Toutes les statistiques possibles doivent être calculables : rendement total et par flush, poids moyen par unité, rendement par kg de substrat, durée réelle de chaque stade, taux de contamination, pertes, ratios de multiplication, comparaison par souche et par génération.
```

## 6. Départ du process : inoculation ou réception

L’inoculation est le moment où le substrat reçoit le mycélium/spawn.

Mais parfois, on peut recevoir un ballot déjà inoculé. Il faut savoir où commence la traçabilité.

Questions :

1. Le process commence-t-il toujours à l’inoculation ?

Réponse :

```text
Tout est possible, Spores/gélose, culture liquide, grain, ou directement substrat, meme parfois des unités déjà prêtes
```

2. Est-ce que certaines unités arrivent déjà inoculées ?

Réponse :

```text
oui, c 'est possible
```

3. Quelles informations faut-il enregistrer à l’inoculation ?

Exemples : date, heure, espèce, souche, poids substrat, poids spawn, taux d’inoculation, opérateur, lot de matière première, fournisseur.

Réponse :

```text
tout ca
```

4. Est-ce que le QR code doit être imprimé au moment de l’inoculation ou plus tard ?

> ✅ **Validé (30/07/2026)** : le QR existe **dès le début** — il est créé en même temps que l’unité, au premier stade de la chaîne, pas au moment du substrat.
>
> ⏳ **Reste à préciser** : quand l’étiquette est physiquement imprimée et collée.

Réponse :

```text
Le QR existe dès le début : il est créé en même temps que l’unité, dès le premier stade de la chaîne, et non au moment du substrat.
```

5. Est-ce qu’une inoculation crée plusieurs unités en même temps ?

Exemple : une session d’inoculation produit 30 sacs.

Réponse :

```text
oui
```

6. Si oui, veux-tu pouvoir sélectionner toutes les unités d’une même session d’inoculation ?

Réponse :

```text
oui
```

## 7. Parent, enfants et lots groupés

L’application peut gérer une hiérarchie :

- parent : lot ou session d’origine ;
- enfants : unités individuelles suivies par QR ;
- récoltes : résultats produits par chaque unité.

Questions :

1. Dans ton fonctionnement, qu’est-ce qui devrait être le parent ?
   - une session d’inoculation ?
   - un lot de substrat ?
   - une espèce/souche ?
   - un fournisseur ?
   - autre ?

Réponse :

```text
lien de parenté détaillé depuis le debut a la fin
```

2. Les enfants sont-ils les unités physiques avec QR code ?

Réponse :

```text
oui
```

3. Dois-tu parfois faire avancer tous les enfants d’un même parent en même temps ?

Exemple : passer tous les sacs inoculés le même jour en incubation 2.

Réponse :

```text
oui
```

4. Dois-tu parfois faire avancer seulement une partie des enfants ?

Exemple : seulement ceux d’une chambre, ou seulement ceux qui sont prêts.

Réponse :

```text
oui
```

5. Quels filtres sont indispensables pour sélectionner des unités en masse ?

> ✅ **Validé (30/07/2026)** : sélection multi-critères totale — on doit pouvoir sélectionner des unités selon n’importe quel paramètre et **combiner** les critères.
>
> ⏳ **Reste à préciser** : les 3 ou 4 sélections faites tous les jours, à mettre en raccourci.

Coche ou complète :

- [x] parent direct ;
- [x] lignée complète (tous les descendants d’une unité) ;
- [x] type de lien (clone / transfert / division) ;
- [x] génération ;
- [x] session d’inoculation ;
- [x] date d’inoculation ;
- [x] date de transfert ;
- [x] espèce/variété ;
- [x] souche ;
- [x] chambre ;
- [x] emplacement (rack, niveau) ;
- [x] stade ;
- [x] phase ;
- [x] incubation 1/2/3 ;
- [x] process appliqué ;
- [x] statut sanitaire ;
- [x] statut de conservation (mère, réserve, archivé) ;
- [x] opérateur ;
- [x] retard sur la durée cible ;
- [ ] autre.

Réponse :

```text
On doit pouvoir sélectionner des unités selon n’importe quel paramètre — parenté, clone, inoculation, stade, chambre, espèce, dates… — et combiner plusieurs critères en même temps.
```

6. Y a-t-il des sélections que tu refais tout le temps ?

Elles pourront être enregistrées comme filtres favoris. Exemple : « tout ce qui est en incubation dans la chambre 2 », « tout ce qui vient de la souche X ».

Réponse :

```text
oui, filtres configurables
```

## 8. Process global à décrire

Merci de décrire le process réel, même approximatif.

> Mise à jour 2026-06-17 : le process couvre toute la chaîne **« du spore à l’assiette »** — origine (spores / culture mère) → gélose → culture liquide (LC) → grain → substrat → fructification. À chaque stade : **clone** (cultures secondaires de même type) et **transfert/repiquage** vers le stade suivant. Les questions détaillées par stade amont (gélose, LC, grain) sont dans le formulaire `16-formulaire-reponses-cultivateur.html`.

### 8.1 Liste des phases / stades

> ✅ **Validé (30/07/2026)** : cette liste n’est qu’un point de départ pleurote. Le process est **entièrement configurable** dans l’app (phases, étapes, ordre, boucles de flush) — rien n’est figé.
>
> ⏳ **Reste à préciser** : ce qui manque, ce qui ne colle pas, et les noms réellement utilisés.

Est-ce que cette liste est correcte ?

1. Gélose ;
2. Culture liquide (LC) ;
3. Grain (ballot de grain) ;
4. Inoculation substrat ;
5. Incubation 1 ;
6. Incubation 2 ;
7. Incubation 3 ;
8. Fructification 1 ;
9. Fructification 2 ;
10. Récolte flush 1 ;
11. Récolte flush 2 ;
12. Récolte flush 3 ;
13. Fin de cycle.

Réponse / correction :

```text
⏳ SANS RÉPONSE au 30/07/2026
```

### 8.2 Différence entre phase et étape

Dans l’application :

- une **phase** est une grande période, par exemple incubation ;
- une **étape** est un moment plus précis, par exemple incubation 1, incubation 2, incubation 3.

Question : cette distinction est-elle utile pour toi ?

Réponse :

```text
⏳ SANS RÉPONSE au 30/07/2026
```

### 8.3 Passage d’une étape à l’autre

Pour chaque étape, il faut comprendre si le passage est basé sur :

- une durée ;
- une observation visuelle ;
- une mesure ;
- une décision humaine ;
- une règle fixe.

> ✅ **Validé (30/07/2026)** : les deux à la fois — chaque phase/étape porte une **durée cible** qui déclenche des **alarmes réglables**, mais la **décision humaine agit et prime** : c’est l’opérateur qui valide le passage.
>
> ⏳ **Reste à préciser** : les étapes où la durée seule suffirait, et celles où c’est toujours l’œil qui décide.

Réponse générale :

```text
Les deux à la fois — chaque phase/étape porte une **durée cible** qui déclenche des **alarmes réglables**, mais la **décision humaine agit et prime** : c’est l’opérateur qui valide le passage.
```

### 8.4 Process configurable, sous-process et alarmes de durée

Cadrage retenu : dans l’application, on doit pouvoir créer des **process entiers** ou des **sous-process réutilisables**, et les appliquer à des lots. Chaque phase/étape porte une durée avec des alarmes réglables.

Questions :

1. Un « sous-process » réutilisable, ça correspondrait à quoi chez toi ?

Un sous-process est un bloc d’étapes réutilisé à plusieurs endroits. Exemples : un bloc « cycle de flush » (repos → fructification → récolte) rejoué 2 ou 3 fois ; un bloc « préparation labo » commun à toutes les espèces ; un bloc « quarantaine ».

Réponse :

```text
L’app doit permettre de créer des process entiers ET des sous-process réutilisables, puis de les appliquer à des lots.
```

2. Applique-t-on un process à une unité, à un lot, ou aux deux ?

> ✅ **Validé (30/07/2026)** : aux deux — un process ou un sous-process doit pouvoir s’appliquer à une unité seule, à un lot entier, ou à une sélection filtrée.

Réponse :

```text
Aux deux : un process ou un sous-process doit pouvoir s’appliquer à une unité seule, à un lot entier, ou à une sélection filtrée d’unités.
```

3. Un lot peut-il changer de process en cours de route ?

Exemple : basculer en milieu d’incubation une partie des unités sur un autre sous-process (relance, quarantaine, test).

Réponse :

```text
Oui, possible
```

4. Chaque phase/étape a-t-elle une durée cible chez toi ?

> ✅ **Validé (30/07/2026)** : oui — chaque phase/étape porte une durée, et les alarmes sont réglables directement dans le process.
>
> ⏳ **Reste à préciser** : les durées réelles par stade et par espèce (c’est le gros du travail restant).

Réponse :

```text
Oui, chaque phase/étape porte une durée, et les alarmes de durée sont réglables directement dans le process.
```

5. Quelles alarmes de durée veux-tu pouvoir régler par étape ?

- [x] rappel avant la fin prévue (ex : J-1) ;
- [x] alerte quand la durée cible est dépassée ;
- [x] 2ᵉ seuil : retard critique ;
- [ ] rappel périodique tant que l’étape n’est pas terminée ;
- [ ] rappel de contrôle en milieu d’étape ;
- [x] aucune alarme sur certaines étapes ;
- [ ] autre.

Réponse :

```text
Les alarmes doivent être réglables étape par étape dans le process : délai, seuil, répétition.
```

6. Que doit faire l’app quand la durée cible est dépassée ?

> ✅ **Validé (30/07/2026)** : prévenir, créer une tâche, marquer l’unité en retard — mais **jamais bloquer**.
>
> ⏳ **Reste à préciser** : qui est prévenu et par quel canal.

Réponse :

```text
Prévenir et créer une tâche, marquer l’unité en retard — mais jamais bloquer : les décisions humaines priment.
```

7. Le passage à l’étape suivante doit-il être automatique une fois la durée atteinte, ou toujours validé par une personne ?

> ✅ **Validé (30/07/2026)** : toujours validé par une personne.
>
> ⏳ **Reste à préciser** : existe-t-il des étapes purement mécaniques où l’automatisme serait acceptable ?

Réponse :

```text
Toujours validé par une personne : les décisions humaines agissent, l’app ne fait que proposer et alerter.
```

8. Une étape peut-elle être sautée, refaite ou remise en arrière ?

Réponse :

```text
oui, possiblement
```

9. Si un process est modifié, que deviennent les unités déjà lancées avec l’ancienne version ?

Important pour ne pas fausser les statistiques comparatives.

Réponse :

```text
elles basculent sur la nouvelle, avec un message clair (êtes vous sur)
```

10. Veux-tu comparer les résultats entre deux versions d’un process ?

Réponse :

```text
oui
```

11. Qui a le droit de créer ou modifier un process ?

Réponse :

```text
moi
```

### 8.5 Conservation, cultures mères et archivage

Cadrage retenu : chaque unité, à n’importe quel stade, peut être mise en conservation ; et après une division ou un transfert, le parent peut être gardé actif ou basculé en historique.

Questions :

1. Quelles unités mets-tu réellement en conservation, et à quel stade ?

> ✅ **Validé (30/07/2026)** : en théorie toutes.
>
> ⏳ **Reste à préciser** : ce qui est réellement conservé, et ce qui n’a aucun sens à conserver.

Réponse :

```text
En théorie toutes : la conservation doit être possible pour chaque unité, à chaque stade.
```

2. Comment conserves-tu une unité ?

Frigo, congélation, huile minérale, dormance à température ambiante, contenant, température, durée maximale.

Réponse :

```text
Frigo, dormance à température ambiante, contenant, configurable
```

3. Une unité en conservation doit-elle disparaître des listes de travail du jour ?

> ✅ **Validé (30/07/2026)** : elle passe en état « en réserve » — hors tâches et hors alarmes de durée courantes, mais toujours scannable, retrouvable et reliée à sa lignée.

Réponse :

```text
Une unité conservée passe dans un état « en réserve » — elle sort des tâches et des alarmes de durée courantes, mais reste scannable, retrouvable et reliée à sa lignée.
```

4. Quand tu réactives une unité conservée, est-ce la même unité ou une nouvelle ?

Reprise de la même unité (même QR), ou clone créé à la sortie de conservation ? Important pour la lignée et les statistiques.

Réponse :

```text
une nouvelle
```

5. Après une division ou un transfert, le parent est-il gardé actif ou archivé — et qui décide ?

> ✅ **Validé (30/07/2026)** : les deux au choix, au moment de l’opération.
>
> ⏳ **Reste à préciser** : le comportement par défaut par stade, pour éviter une question à chaque manipulation.

Réponse :

```text
Les deux doivent être possibles, au choix au moment de l’opération : parent conservé (il continue à vivre) ou parent mis en historique (il ne bouge plus mais reste consultable).
```

6. Faut-il une durée maximale de conservation avec alarme ?

Exemple : alerter au bout de X mois pour repiquer une culture mère avant qu’elle ne s’épuise.

Réponse :

```text
Oui, la conservation est une étape comme une autre, donc elle peut porter une durée cible et une alarme réglable.
```

7. Une unité archivée en historique peut-elle être réactivée ?

Réponse :

```text
oui
```

### 8.6 Stades amont (gélose, LC, grain) — réponses du 30/07/2026

Ces questions ne figurent que dans le formulaire `16`. Réponses recopiées ici pour garder la trace.

| Question | Réponse |
| --- | --- |
| D’où part une gélose ? | Spores, clone de tissu, gélose reçue/achetée — **tout est possible** |
| Combien de géloses secondaires par gélose ? | Ça dépend — **configurable** |
| Conditions et durée gélose | **Configurable** |
| Observations gélose | Colonisation, contamination (moisissure, bactérie), couleur, vitesse, anomalies |
| Passage gélose → LC/grain | Critère visuel, durée, **décision humaine** |
| Infos à saisir gélose | Souche, espèce, origine, date, opérateur, génération, n° de boîte |
| Actions app gélose | Cloner, transférer en LC, observer contamination, marquer culture mère, imprimer QR, jeter |
| Démarrage d’une LC | Ça dépend — **tout est possible** |
| Clone LC → LC | Oui |
| Conditions et durée LC | **Configurable** |
| Observations LC | Croissance, trouble, contamination, odeur, vitesse |
| Ratio LC → grain | **Configurable** |
| Infos à saisir LC | Volume, souche, origine (gélose mère), date, opérateur, génération |
| Actions app LC | Cloner, transférer vers grain, observer contamination, imprimer QR, jeter |
| Inoculation du grain | **Tout est possible** |
| Clone grain → grain | Oui |
| Conditions et durée grain | Température, durée, secouage, stérilité |
| Observations grain | Taux de colonisation, contamination, uniformité, vitesse |
| Ratio grain → substrat | **Configurable** |
| Infos et poids grain | **Configurable** |
| Actions app grain | Cloner, transférer vers substrat, observer contamination, imprimer QR, jeter |

⏳ **Aucune valeur chiffrée n’a été donnée** pour ces stades : les durées, températures et ratios sont tous renvoyés à « configurable ». Il faudra des valeurs par défaut réelles pour amorcer le premier process.

## 9. Détail par étape

⏳ **Section entièrement sans réponse au 30/07/2026.** C’est le plus gros trou : aucune durée, température, humidité ni critère de passage n’a été fourni pour les incubations, fructifications, flushs et fin de cycle.

Remplir autant que possible. Si tu ne sais pas précisément, mettre une fourchette.

### 9.1 Inoculation

Explication : création ou préparation de l’unité de culture avec le mycélium/spawn.

Questions :

1. Que fait-on exactement à cette étape ?
2. Combien d’unités sont créées en général ?
3. Quelles informations faut-il saisir ?
4. Quelle étiquette QR doit être imprimée ?
5. Quel poids faut-il enregistrer ?
6. Y a-t-il un contrôle qualité à ce moment ?
7. Quelle est l’étape suivante ?

Réponse :

```text
⏳ SANS RÉPONSE au 30/07/2026
```

### 9.2 Incubation 1

Explication : première période où le mycélium colonise le substrat.

Questions :

1. Combien de temps dure généralement incubation 1 ?
2. Température cible ?
3. Humidité cible ?
4. Lumière ou obscurité ?
5. CO2/aération important ou non ?
6. Qu’est-ce qu’on doit observer ?
7. Quand sait-on qu’on peut passer en incubation 2 ?
8. Quelles actions doit proposer l’app à cette étape ?

Réponse :

```text
Critère de passage : à l’observation visuelle, validée par une personne — la durée n’est qu’un rappel.
Actions dans l’app : les mêmes que partout, filtrées par pertinence selon le stade.
⏳ Durée, température, humidité, lumière/obscurité, CO2 et observations attendues : NON FOURNIS.
```

### 9.3 Incubation 2

Explication : deuxième période d’incubation, si elle existe vraiment dans ton process.

Questions :

1. Pourquoi séparer incubation 1 et incubation 2 ?
2. Qu’est-ce qui change ?
3. Durée habituelle ?
4. Conditions cible : température, humidité, lumière, aération ?
5. Observation attendue ?
6. Critère de passage à incubation 3 ?
7. Actions utiles dans l’app ?

Réponse :

```text
Critère de passage à incubation 3 : observation visuelle + validation humaine.
Actions dans l’app : les mêmes que partout, filtrées par pertinence.
⏳ Raison de la séparation avec incubation 1, ce qui change, durée et conditions : NON FOURNIS.
```

### 9.4 Incubation 3

Explication : troisième période d’incubation ou fin de colonisation avant fructification.

Questions :

1. À quoi correspond incubation 3 ?
2. Est-elle obligatoire pour toutes les espèces ?
3. Durée habituelle ?
4. Conditions cible ?
5. Signes visuels à noter ?
6. Risques particuliers : contamination, dessèchement, retard ?
7. Critère de passage en fructification ?

Réponse :

```text
Incubation 3 est OPTIONNELLE — pas obligatoire pour toutes les espèces.
Critère de passage en fructification : observation visuelle + validation humaine.
⏳ Objectif de l’étape, durée, conditions, signes visuels et risques : NON FOURNIS.
```

### 9.5 Fructification 1

Explication : étape où l’on déclenche ou accompagne l’apparition des champignons.

Questions :

1. Que changes-tu en passant en fructification ?
   - température ?
   - humidité ?
   - lumière ?
   - aération ?
   - ouverture du sac/bloc ?
2. Durée habituelle avant voir les premiers signes ?
3. Quelles observations sont importantes ?
4. Quels problèmes peuvent apparaître ?
5. Quelle chambre ou zone est utilisée ?
6. Actions utiles dans l’app ?

Réponse :

```text
Actions dans l’app : les mêmes que partout, filtrées par pertinence.
⏳ Leviers de déclenchement, délai avant les premiers signes, observations, problèmes et chambre utilisée : NON FOURNIS.
```

### 9.6 Fructification 2

Explication : deuxième phase de fructification, peut-être maturation ou préparation de récolte.

Questions :

1. Pourquoi séparer fructification 1 et 2 ?
2. Qu’est-ce qui change entre les deux ?
3. Durée habituelle ?
4. Conditions cible ?
5. Comment sait-on que la récolte flush 1 est prête ?
6. Faut-il une observation “maturité récolte” ?
7. Actions utiles dans l’app ?

Réponse :

```text
Une observation « maturité récolte » dédiée est souhaitée.
Critère « flush 1 prêt » : observation visuelle + validation humaine.
Actions dans l’app : les mêmes que partout, filtrées par pertinence.
⏳ Raison de la séparation avec fructification 1, durée et conditions : NON FOURNIS.
```

### 9.7 Récolte flush 1

Explication : première vague de récolte sur une unité.

Questions :

1. Comment décides-tu de récolter ?
2. Mesures-tu le poids par unité ?
3. Poids brut, poids net, pertes, ou seulement poids récolté ?
4. Notes-tu la qualité ?
5. Notes-tu la cause des pertes ?
6. Que devient l’unité après flush 1 ?
7. Passe-t-elle en repos, fructification 2, ou directement flush 2 ?

Réponse :

```text
Décision de récolter : observation visuelle + validation humaine.
Poids mesuré PAR UNITÉ, qualité notée, pertes notées AVEC LEUR CAUSE.
Après flush 1 : repos, fructification 2, ou directement flush 2 — les trois chemins existent.
```

### 9.8 Récolte flush 2

Questions :

1. Est-ce que toutes les unités font un flush 2 ?
2. Durée entre flush 1 et flush 2 ?
3. Conditions particulières entre les deux ?
4. Poids mesuré par unité aussi ?
5. Qualité différente du flush 1 ?
6. Que devient l’unité après flush 2 ?

Réponse :

```text
Toutes les unités font un flush 2. Poids par unité, même méthode qu’au flush 1. La qualité diffère du flush 1.
Après flush 2 : repos, fructification suivante, ou directement flush 3.
⏳ Durée entre flush 1 et 2, et conditions particulières entre les deux : NON FOURNIES.
```

### 9.9 Récolte flush 3

Questions :

1. Est-ce que le flush 3 est fréquent ou optionnel ?
2. Quand décide-t-on d’arrêter avant flush 3 ?
3. Le rendement vaut-il encore le coût/espace ?
4. Poids mesuré par unité ?
5. Que devient l’unité après flush 3 ?

Réponse :

```text
Le flush 3 est OPTIONNEL, pas systématique. Décision d’arrêt : observation visuelle + validation humaine. Poids mesuré par unité également.
Après flush 3 : repos, fructification suivante, ou fin de cycle.
⏳ Seuil de rentabilité (le flush 3 vaut-il le coût et l’espace) : NON FOURNI.
```

### 9.10 Fin de cycle

Questions :

1. Quels sont les statuts possibles en fin de cycle ?
   - terminé ;
   - compost ;
   - rebut ;
   - contaminé ;
   - autre.
2. Faut-il mesurer un poids final ?
3. Faut-il noter une raison de fin ?
4. Faut-il garder la chambre/emplacement jusqu’au nettoyage ?
5. Faut-il créer une tâche de nettoyage ?

Réponse :

```text
Statuts : terminé, compost, rebut, contaminé — ces quatre suffisent.
Poids final mesuré. Raison de fin notée. L’emplacement reste occupé jusqu’au nettoyage. Une tâche de nettoyage est créée.
```

## 10. Conditions de culture par chambre

L’application doit connaître les espaces de culture pour relier les unités aux conditions.

Questions :

1. Quels espaces veux-tu suivre ?
   - chambre incubation ;
   - chambre fructification ;
   - zone de préparation ;
   - zone de stockage ;
   - étagères/racks ;
   - autre.

Réponse :

```text
Chambres, étagères, niveau et position.
```

2. Faut-il suivre seulement la chambre, ou aussi l’étagère/le niveau/la position ?

Réponse :

```text
Les deux : chambre, étagère, niveau et position.
```

3. Quelles conditions cibles par chambre ?

À remplir si possible :

| Chambre/zone | Température cible | Humidité cible | Lumière | Aération/CO2 | Usage |
| --- | --- | --- | --- | --- | --- |
| | | | | | |
| | | | | | |

4. Une unité peut-elle changer plusieurs fois de chambre ?

Réponse :

```text
Oui, une unité peut changer plusieurs fois de chambre.
```

5. Veux-tu scanner le QR d’une chambre pour voir toutes les unités présentes ?

Réponse :

```text
Oui, scanner le QR d'une chambre doit afficher toutes les unités présentes.
```

## 11. Mesures à saisir ou récupérer

Questions :

1. Quelles mesures fais-tu aujourd’hui manuellement ?

Exemples : température, humidité, poids, nombre de sacs, contamination.

Réponse :

```text
Tout est fait à la main aujourd'hui : température, humidité, poids, contrôle visuel. Des appareils connectés sont envisagés dans un futur proche.
```

2. À quelle fréquence ?

Réponse :

```text
Manuellement aujourd'hui ; la fréquence dépendra des appareils connectés à venir.
```

3. Quelles mesures sont liées à une unité et lesquelles sont liées à une chambre ?

Exemple : poids = unité ; température = chambre.

Réponse :

```text
Aujourd'hui tout est saisi à la main — température, humidité, poids, visuel. Les appareils connectés prendront le relais sur les mesures d'ambiance (chambre), le poids restant lié à l'unité.
```

4. Les appareils Inkbird doivent-ils seulement servir d’historique, ou aussi déclencher des alertes ?

Réponse :

```text
Les Inkbird doivent aussi déclencher des alertes, pas seulement servir d'historique.
```

5. Quelles valeurs veux-tu voir dans les statistiques ?

Réponse :

```text
⏳ SANS RÉPONSE au 30/07/2026
```

6. Doit-on pouvoir suivre des mesures sur n’importe quelle unité, à n’importe quel stade ?

> ✅ **Validé (30/07/2026)** : oui — chaque unité est traquée et monitorée, quel que soit son stade.
>
> ⏳ **Reste à préciser** : les mesures qui ont un sens à chaque stade, pour ne pas proposer des champs inutiles sur l’iPhone.

Réponse :

```text
Oui — chaque unité est traquée et monitorée, quel que soit son stade.
```

## 12. Observations terrain

Les observations sont des constats rapides depuis l’iPhone.

Exemples : “pousse visible”, “contamination”, “trop sec”, “prêt à récolter”.

Questions :

1. Quelles observations veux-tu pouvoir saisir rapidement ?

Réponse :

```text
⏳ SANS RÉPONSE au 30/07/2026
```

2. Quelles observations doivent être proposées selon l’étape ?

Exemple : en incubation, contamination/colonisation ; en fructification, maturité/humidité.

Réponse :

```text
Pas de liste d'observations propre à chaque étape : la liste complète est disponible partout, l'app masque ce qui n'a pas de sens au stade courant.
```

3. Faut-il pouvoir prendre une photo à chaque observation ?

Réponse :

```text
Oui, une photo doit être possible sur toute observation.
```

4. Pour quelles observations la photo devrait-elle être obligatoire ?

Réponse :

```text
Photo obligatoire en cas de contamination.
```

5. Faut-il une notion de gravité ?

Exemple : faible, moyen, critique.

Réponse :

```text
Oui, gravité à trois niveaux : faible, moyen, critique.
```

## 13. Actions à faire depuis l’iPhone

Après scan QR, l’application doit proposer les bonnes actions.

Questions :

1. Quelles actions veux-tu absolument après scan d’une unité ?

> ✅ **Validé (30/07/2026)** : toutes ces actions doivent exister, puisque cloner, diviser, conserver et archiver sont possibles à chaque stade.
>
> ⏳ **Reste à préciser — c’est ça l’information utile** : les 3 ou 4 actions à mettre en gros boutons juste après le scan ; le reste ira dans un menu secondaire.

Coche ou complète :

- [x] voir fiche ;
- [x] voir la lignée (parents et enfants) ;
- [x] avancer à l’étape suivante ;
- [x] ajouter observation ;
- [x] ajouter mesure / peser ;
- [x] déplacer chambre ;
- [x] cloner ;
- [x] transférer au stade suivant ;
- [x] diviser en plusieurs unités ;
- [x] mettre en conservation ;
- [x] appliquer un sous-process ;
- [x] récolter ;
- [x] déclarer contamination ;
- [x] mettre en pause ;
- [x] terminer / compost ;
- [x] archiver en historique ;
- [x] réimprimer QR ;
- [ ] autre.

Réponse :

```text
Toutes ces actions doivent exister, puisque cloner, diviser, conserver et archiver sont possibles à chaque stade.
```

2. Quelles actions veux-tu faire en masse sur plusieurs unités ?

Exemples : déplacer 40 unités en chambre fructification, passer toutes les unités du parent X en incubation 2, appliquer un sous-process à tout un lot.

> ✅ **Validé (30/07/2026)** : toute action doit pouvoir s’appliquer à une sélection d’unités, y compris l’application d’un process ou d’un sous-process entier à un lot.
>
> ⏳ **Reste à préciser** : les actions de masse réellement pratiquées, et celles qui seraient dangereuses en masse.

Réponse :

```text
Toute action doit pouvoir s’appliquer à une sélection d’unités, y compris l’application d’un process ou d’un sous-process entier à un lot.
```

3. Faut-il une validation avant action en masse ?

Réponse :

```text
Oui, une validation est requise avant toute action en masse.
```

4. Faut-il pouvoir annuler ou corriger une action ?

Réponse :

```text
Oui, une action doit pouvoir être annulée ou corrigée.
```

## 14. Récoltes et poids par unité

Questions :

1. Le poids est-il mesuré pour chaque unité à chaque flush ?

Réponse :

```text
Oui, poids par unité à chaque flush.
```

2. Quelle unité de poids utilises-tu ? grammes ou kilogrammes ?

Réponse :

```text
⏳ SANS RÉPONSE au 30/07/2026
```

3. Faut-il enregistrer :
   - poids total récolté ;
   - poids vendable ;
   - pertes ;
   - qualité ;
   - calibre ;
   - destination ?

Réponse :

```text
Poids par unité, qualité et pertes avec leur cause.
```

4. La récolte d’une unité peut-elle être mélangée avec celle d’une autre unité ?

Réponse :

```text
Oui, les récoltes de plusieurs unités peuvent être mélangées.
```

5. Si oui, faut-il garder les proportions exactes ?

Réponse :

```text
Oui, les proportions exactes doivent être conservées en cas de mélange.
```

6. Quels indicateurs de rendement veux-tu ?

Exemples : poids total par unité, rendement par flush, rendement par kg de substrat, rendement par chambre, rendement par espèce.

Réponse :

```text
⏳ SANS RÉPONSE au 30/07/2026
```

## 15. Statistiques souhaitées

L’application peut calculer des statistiques, mais il faut savoir lesquelles sont vraiment utiles.

Questions :

1. Quelles stats veux-tu voir en premier ?

> ✅ **Validé (30/07/2026)** : toutes les statistiques possibles doivent être calculables, puisque la traçabilité est totale. **L’important ici n’est donc pas de tout cocher**, mais de dire lesquelles seraient regardées tous les jours.

Coche ou complète :

- [ ] rendement total par unité ;
- [ ] rendement par flush ;
- [ ] rendement par kg de substrat ;
- [ ] rendement par espèce/variété ;
- [ ] rendement par souche ;
- [ ] rendement par génération ;
- [ ] rendement par date d’inoculation ;
- [ ] rendement par parent/session ;
- [ ] rendement par chambre ;
- [ ] durée réelle par étape vs durée cible ;
- [ ] durée moyenne incubation ;
- [ ] durée moyenne fructification ;
- [ ] taux de contamination ;
- [ ] taux de réussite par type de lien (clone / transfert / division) ;
- [ ] ratios de multiplication réels ;
- [ ] pertes ;
- [ ] comparaison entre conditions température/humidité ;
- [ ] comparaison entre versions de process ;
- [ ] autre.

Réponse :

```text
Toutes les statistiques possibles doivent être calculables, puisque la traçabilité est totale.
```

2. Veux-tu comparer les enfants d’un même parent entre eux ?

Réponse :

```text
Oui, comparer les enfants d'un même parent entre eux.
```

3. Veux-tu comparer les performances entre chambres ?

Réponse :

```text
Oui, comparer les performances entre chambres.
```

4. Veux-tu exporter les données en CSV/Excel ?

Réponse :

```text
Oui, export CSV/Excel.
```

5. Veux-tu des statistiques sur la lignée et les générations ?

Exemple : cette souche perd-elle en vigueur après 5 repiquages ? Les clones font-ils aussi bien que les transferts ?

> ✅ **Validé (30/07/2026)** : oui — la traçabilité totale permet de comparer par souche, par génération et par type de lien.
>
> ⏳ **Reste à préciser** : les questions concrètes auxquelles ces chiffres doivent répondre.

Réponse :

```text
Oui — la traçabilité totale permet de comparer par souche, par génération et par type de lien (clone / transfert / division).
```

## 16. Alertes et tâches

Questions :

1. Quelles situations doivent créer une alerte ?

Exemples : incubation trop longue, humidité trop basse, contamination, récolte prête, chambre hors température.

> ✅ **Validé (30/07/2026)** : base retenue — dépassement de la durée cible d’une étape (alarme réglable dans le process), contamination déclarée, récolte prête, chambre hors consigne, fin de durée de conservation.
>
> ⏳ **Reste à préciser** : les seuils réels, et ce qui dérangerait pour rien.

Réponse :

```text
Le dépassement de la durée cible d’une étape (alarme réglable dans le process), la contamination déclarée, la récolte prête, la chambre hors consigne, et la fin de durée de conservation.
```

2. Faut-il des tâches automatiques ?

Exemples : “vérifier incubation”, “récolter aujourd’hui”, “nettoyer chambre”.

Réponse :

```text
⏳ SANS RÉPONSE au 30/07/2026
```

3. Les alertes doivent-elles être visibles seulement dans l’app ou aussi envoyées ailleurs ?

Réponse :

```text
⏳ SANS RÉPONSE au 30/07/2026
```

4. Une alerte doit-elle pouvoir être ignorée ou reportée ?

Exemple : « je sais, c’est normal, rappelle-moi dans 3 jours ».

> ✅ **Validé (30/07/2026)** : oui — puisque la décision humaine prime, une alarme doit pouvoir être acquittée ou reportée sans bloquer l’unité, en gardant la trace de qui l’a fait et quand.

Réponse :

```text
Oui : puisque la décision humaine prime, une alarme doit pouvoir être acquittée ou reportée sans bloquer l’unité — en gardant la trace de qui l’a fait et quand.
```

## 17. QR code et étiquettes

Questions :

1. Quelles unités doivent avoir un QR ?

> ✅ **Validé (30/07/2026)** : chaque unité a son propre QR code, à tous les stades et dès le début — plus les chambres, les récoltes et les produits finaux.
>
> ⏳ **Reste à préciser** : le format et le support d’étiquette utilisables sur les petits objets (boîte de Pétri, bocal de LC) et en milieu humide ou stérilisé.

Réponse :

```text
Chaque unité a son propre QR code, à tous les stades et dès le début — plus les chambres, les récoltes et les produits finaux.
```

2. Que doit afficher l’étiquette en texte lisible ?

Exemples : code unité, espèce, date inoculation, parent, chambre, phase.

Réponse :

```text
Nom de l'unité, type, date, et le code QR.
```

3. Faut-il un QR pour les chambres ?

Réponse :

```text
Oui, un QR pour les chambres.
```

4. Faut-il un QR pour les récoltes ou produits finaux ?

Réponse :

```text
Oui, un QR pour les récoltes et les produits finaux.
```

5. Que faire si un QR est abîmé ou perdu ?

Réponse :

```text
⏳ SANS RÉPONSE au 30/07/2026
```

## 18. Cas particuliers et problèmes

Questions :

1. Que fais-tu en cas de contamination ?

Réponse :

```text
⏳ SANS RÉPONSE au 30/07/2026
```

2. Est-ce qu’une unité contaminée peut encore produire ?

Réponse :

```text
Non, une unité contaminée ne peut plus produire.
```

3. Que fais-tu si une unité est en retard ?

Réponse :

```text
⏳ SANS RÉPONSE au 30/07/2026
```

4. Que fais-tu si une unité est déplacée sans scan ?

Réponse :

```text
⏳ SANS RÉPONSE au 30/07/2026
```

5. Y a-t-il des cas où il faut regrouper/fusionner des unités ?

Réponse :

```text
⏳ SANS RÉPONSE au 30/07/2026
```

## 19. Résumé à produire après réponse

Les points 1 à 14 restent à extraire du terrain. Les **principes structurants** (§2.1), eux, sont déjà acquis — ils n’ont plus besoin d’être confirmés.

Après remplissage, on devra pouvoir extraire :

1. le vocabulaire officiel ;
2. la liste des espèces/variétés ;
3. le process exact avec phases et étapes ;
4. les conditions cibles par étape et par chambre ;
5. **les durées cibles et les seuils d’alarme par étape et par espèce** ;
6. **les sous-process réutilisables identifiés** ;
7. les actions disponibles par étape ;
8. les observations disponibles par étape ;
9. les données à saisir à l’inoculation ;
10. les données à saisir à chaque récolte ;
11. **les règles de conservation et d’archivage des parents (défaut par stade)** ;
12. les règles de sélection en masse ;
13. les statistiques prioritaires ;
14. **la liste des points où la traçabilité totale devient trop lourde à saisir sur le terrain**.

## 20. Version simplifiée du process à confirmer

Table de synthèse à remplir. Les colonnes « Durée cible » et « Alarme si dépassement » alimenteront directement les alarmes réglables du process.

| Ordre | Stade / étape | Durée cible | Alarme si dépassement | Température | Humidité | Observation clé | Action suivante (clone / transfert) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Origine (spores / souche reçue) | | | | | viabilité | transfert gélose |
| 2 | Gélose | | | | | contamination / colonisation | clone gélose ou transfert LC |
| 3 | Culture liquide (LC) | | | | | trouble / contamination | clone LC ou transfert grain |
| 4 | Grain (ballot) | | | | | colonisation / contamination | clone grain ou transfert substrat |
| 5 | Inoculation substrat | | | | | | incubation 1 |
| 6 | Incubation 1 | | | | | | |
| 7 | Incubation 2 | | | | | | |
| 8 | Incubation 3 | | | | | | |
| 9 | Fructification 1 | | | | | | |
| 10 | Fructification 2 | | | | | | |
| 11 | Récolte flush 1 | | | | | poids par unité | |
| 12 | Récolte flush 2 | | | | | poids par unité | |
| 13 | Récolte flush 3 | | | | | poids par unité | |
| 14 | Conservation (optionnel, à tout stade) | | | | | viabilité | réactivation ou clone |
| 15 | Fin de cycle | | | | | | |
