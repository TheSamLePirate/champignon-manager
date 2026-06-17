# 10 — QR code, impression et scan

## 1. Objectif

Le QR code est le lien entre le monde physique et l’application.

Chaque entité importante peut être scannée pour afficher sa fiche et proposer les actions adaptées.

## 2. Entités pouvant avoir un QR

- source ;
- lot ;
- sous-lot ;
- chambre ;
- emplacement ;
- récolte ;
- produit final ;
- caisse ou contenant ;
- étiquette temporaire.

## 3. Contenu du QR

Le QR ne doit pas contenir toutes les données métier.

Décision développeur : le QR doit contenir **un token opaque seulement**, pas toutes les données métier.

Le scanner web intégré lira ce token puis demandera au backend de retrouver la cible.

Exemple conceptuel :

```text
<token>
```

Option future si l’on veut utiliser l’appareil photo iOS natif hors web app : encapsuler ce token dans une URL locale/Tailscale.

Le token doit être :

- unique ;
- non prédictible ;
- révocable ;
- lié à une seule cible active ;
- enregistré dans `qrRegistry`.

## 4. Résolution d’un QR

Quand un QR est scanné :

1. l’utilisateur ouvre l’interface web locale/Tailscale ;
2. le scanner web intégré lit le token ;
3. le frontend demande au backend de résoudre le token ;
4. le système identifie la cible ;
5. le scan est historisé ;
6. l’utilisateur voit la fiche correspondante ;
7. les actions disponibles sont chargées selon le contexte.

## 5. Scan depuis iPhone

Options :

- scanner via l’appareil photo iOS ouvrant l’URL ;
- scanner intégré dans l’interface web si autorisé par le navigateur ;
- raccourci iPhone pointant vers la web app locale.

Priorité MVP : scanner intégré dans l’interface web, avec compatibilité iPhone. Le scan caméra iOS standard via URL locale devient une option de secours ou d’évolution.

## 6. Réseau local

Conditions :

- l’iPhone doit être sur le même réseau Wi‑Fi ou connecté via Tailscale ;
- le backend doit avoir une URL stable ;
- option probable : URL Tailscale ;
- prévoir fallback par IP locale ou nom local si Tailscale n’est pas utilisé.

Points à vérifier :

- Tailscale et HTTPS local ;
- mDNS/Bonjour si utilisé ;
- certificat HTTPS si nécessaire pour scanner web/caméra navigateur ;
- comportement iOS avec domaines locaux.

## 7. Impression

L’imprimante QR compatible Node.js sera pilotée depuis le backend local.

Décision matérielle actuelle : **Nimbot B21**.

Le système doit gérer :

- profils d’imprimantes ;
- modèles d’étiquette ;
- jobs d’impression ;
- erreurs ;
- réimpression ;
- historique d’impression.

## 8. Modèles d’étiquette

Un modèle d’étiquette peut inclure :

- QR code ;
- code lisible du lot ;
- nom court ;
- espèce ;
- souche ;
- date de création ;
- phase/étape initiale ;
- poids ;
- chambre prévue ;
- mentions libres.

Différents modèles peuvent exister :

- source/ballot ;
- sous-lot ;
- chambre ;
- récolte ;
- produit final ;
- étiquette temporaire.

## 9. Cycle de vie d’une étiquette

États possibles :

| État | Sens |
| --- | --- |
| créée | QR généré mais pas imprimé. |
| imprimée | Étiquette imprimée au moins une fois. |
| posée | Optionnel : utilisateur confirme la pose. |
| remplacée | Une nouvelle étiquette remplace l’ancienne. |
| révoquée | QR désactivé. |
| perdue | Étiquette déclarée perdue. |

## 10. Réimpression

La réimpression doit être possible mais historisée.

Règles :

- enregistrer qui a demandé la réimpression ;
- conserver le même token si l’étiquette est seulement abîmée ;
- décision MVP : réimprimer le même token si l’étiquette est abîmée ou perdue dans un contexte maîtrisé ;
- générer un nouveau token si l’ancien QR est compromis ;
- révoquer l’ancien si nécessaire.

## 11. Sécurité

Risques :

- QR photographié par erreur ;
- accès sans permission ;
- token deviné ;
- QR obsolète ;
- URL locale accessible à un invité Wi‑Fi.

Mesures :

- token long et non prédictible ;
- session utilisateur obligatoire pour modifier ;
- permissions côté backend ;
- scan lecture possible selon configuration ;
- révocation QR ;
- journal des scans.

## 12. Scan d’une chambre

Scanner une chambre pourrait permettre :

- voir les lots présents ;
- ajouter une mesure de chambre ;
- ajouter observation globale ;
- voir conditions cibles ;
- voir caméra associée ;
- voir appareils Inkbird associés.

## 13. Scan d’un produit final

Scanner un produit final doit permettre :

- voir type et quantité ;
- voir statut stock ;
- voir origine ;
- remonter la traçabilité ;
- enregistrer sortie ou perte selon permission.

## 14. Décisions développeur intégrées

Synthèse complète : [18-decisions-techniques-dev.md](./18-decisions-techniques-dev.md).

Décisions :

- payload QR = token opaque seulement ;
- scan MVP = scanner web intégré ;
- réseau = local/Tailscale, HTTPS via Tailscale si nécessaire ;
- imprimante cible = Nimbot B21 ;
- impression via `printJobs` avec statut, retry, erreur, copies, logs, test imprimante ;
- réimpression par défaut = même token.

## 15. Questions techniques restantes

- Driver Node.js/Bun disponible pour Nimbot B21.
- Protocole réel de la Nimbot B21 : Bluetooth, USB, image, commandes propriétaires, librairie existante.
- Format d’étiquette supporté.
- Taille physique des étiquettes.
- Résistance des étiquettes à humidité/température.
- Besoin de QR seulement ou QR + texte + logo.
