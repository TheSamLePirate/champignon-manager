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

Il doit contenir un lien ou token opaque permettant au backend de retrouver la cible.

Exemple conceptuel :

```text
http://champignon.local/q/<token>
```

Le token doit être :

- unique ;
- non prédictible ;
- révocable ;
- lié à une seule cible active ;
- enregistré dans `qrRegistry`.

## 4. Résolution d’un QR

Quand un QR est scanné :

1. le navigateur ouvre l’URL locale ;
2. le frontend ou backend résout le token ;
3. le système identifie la cible ;
4. le scan est historisé ;
5. l’utilisateur voit la fiche correspondante ;
6. les actions disponibles sont chargées selon le contexte.

## 5. Scan depuis iPhone

Options :

- scanner via l’appareil photo iOS ouvrant l’URL ;
- scanner intégré dans l’interface web si autorisé par le navigateur ;
- raccourci iPhone pointant vers la web app locale.

Priorité MVP : compatibilité avec scan caméra iOS standard + URL locale.

## 6. Réseau local

Conditions :

- l’iPhone doit être sur le même réseau Wi‑Fi ;
- le backend doit avoir une URL stable ;
- idéalement un nom local facile : `champignon.local` ou équivalent ;
- prévoir fallback par IP locale.

Points à vérifier :

- mDNS/Bonjour disponible ;
- certificat HTTPS si nécessaire pour fonctionnalités caméra web ;
- comportement iOS avec domaines locaux.

## 7. Impression

L’imprimante QR compatible Node.js sera pilotée depuis le backend local.

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
- générer un nouveau token si l’ancien QR est compromis ou perdu ;
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

## 14. Questions techniques

- Modèle exact de l’imprimante QR.
- Driver Node.js disponible.
- Format d’étiquette supporté : image, ESC/POS, ZPL, autre.
- Taille physique des étiquettes.
- Résistance des étiquettes à humidité/température.
- Besoin de QR seulement ou QR + texte + logo.
