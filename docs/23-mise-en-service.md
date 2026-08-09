# 23 — Mise en service

> Comment installer, exposer, sauvegarder et restaurer l'application chez le
> cultivateur. Lot 12 de `docs/22`.

Ce document décrit la production : **Raspberry Pi**, accès par **Tailscale**,
sauvegarde vérifiée. Le développement local reste décrit dans `docs/22` §8.

---

## 1. Ce que la machine doit avoir

| Prérequis | Pourquoi |
| --- | --- |
| Raspberry Pi **64 bits** (Pi 4 ou 5, 4 Go minimum) | MongoDB 8 n'existe pas en 32 bits. Un Raspberry Pi OS 32 bits ne démarrera pas le conteneur. |
| **SSD USB**, pas la carte SD | Une carte SD s'use et lâche — elle emporterait le journal d'événements, c'est-à-dire la traçabilité elle-même. |
| Docker et le plugin Compose | Toute la pile tourne en conteneurs. |
| Tailscale installé et connecté au tailnet | C'est la seule frontière d'accès (`docs/21` §6) **et** ce qui rend le scanner QR iOS possible. |

> ⚠️ **Il n'y a aucune authentification dans l'application.** Décision du
> cultivateur, réaffirmée : « pas de sécurité, c'est sur le réseau local ». En
> conséquence, **quiconque atteint le port atteint toutes les données**. Les ACL
> Tailscale sont le seul contrôle d'accès — elles ne sont pas un détail de
> confort, elles sont le dispositif de sécurité.

---

## 2. Installation

```bash
git clone <dépôt> champignon-manager
cd champignon-manager

# Où vivent les données. À faire pointer vers le SSD, pas vers la carte SD.
export CHAMPI_DATA=/mnt/ssd/champignon

docker compose -f docker/docker-compose.prod.yml up -d --build
```

Le premier démarrage prend plusieurs minutes sur un Pi : l'image se construit
sur place. Au bout, deux conteneurs tournent :

```bash
docker compose -f docker/docker-compose.prod.yml ps
# champi-mongo   healthy
# champi-app     healthy
```

Le contrôle de santé interroge `/api/health`, pas le processus : une
application vivante mais incapable de joindre MongoDB est signalée `unhealthy`.

### Ce qui se passe au premier démarrage

Le serveur **amorce le modèle de process par défaut** (`docs/20`) et le publie.
Sans cela l'application serait inutilisable : pas de process, donc pas d'unité
possible — et **aucune valeur chiffrée n'a été fournie** par le cultivateur
(arbitrage du 31/07/2026), donc rien à installer d'autre.

```
Amorçage : Modèle « Modèle par défaut (à ajuster) » installé et publié : l'application est utilisable immédiatement.
⚠️  Ce process est un exemple à ajuster, pas une recommandation agronomique. […]
```

Deux propriétés à connaître :

- **l'amorçage est inerte dès qu'un process existe** — il ne réécrit jamais le
  travail du cultivateur, à aucun redémarrage ;
- chaque étape porte sa `provenance` (`cultivator` ou `invented`) : les valeurs
  inventées pour éviter un champ vide sont signalées comme telles dans
  l'éditeur. Elles n'engagent rien.

`CHAMPI_SEED=false` désactive l'amorçage, pour une ferme dont les process
viennent d'un import.

---

## 3. Exposition par Tailscale

L'application n'écoute **que sur `127.0.0.1`** (voir le mappage de ports du
Compose de production). C'est `tailscale serve` qui l'expose au tailnet, avec un
certificat TLS valide.

```bash
sudo tailscale serve --bg 3000
sudo tailscale serve status
# https://champi-pi.<tailnet>.ts.net (tailnet only) → http://127.0.0.1:3000
```

L'URL MagicDNS est celle à mettre en favori sur l'iPhone.

### Pourquoi HTTPS est indispensable

Le scanner QR de l'application utilise `getUserMedia`. Safari iOS **refuse
l'accès à la caméra hors contexte sécurisé**. Sans le certificat fourni par
`tailscale serve`, le scan à la caméra ne fonctionne pas — seule la saisie
manuelle du code resterait possible. C'est la raison technique du choix de
Tailscale, pas une préférence.

### Restreindre l'accès

Le contrôle d'accès se fait **dans les ACL Tailscale**, puisque l'application
n'en a aucun. Limiter l'accès aux seuls appareils du cultivateur :

```jsonc
// Fichier de règles du tailnet
{
  "acls": [
    {
      "action": "accept",
      "src": ["group:ferme"],
      "dst": ["champi-pi:3000"],
    },
  ],
}
```

Sans cette règle, **tout appareil du tailnet** peut lire et modifier toute la
traçabilité.

---

## 4. Sauvegarde

Le journal d'événements n'existe nulle part ailleurs. Un cycle de culture dure
des mois : une sauvegarde défaillante ne se découvrirait qu'au pire moment.

D'où le parti pris du script : **une sauvegarde non vérifiée ne compte pas**.
`sauvegarder` enchaîne systématiquement sur une vérification qui restaure
réellement l'archive dans une base jetable et recompte chaque collection.

```bash
# Sauvegarde + vérification automatique
bun run sauvegarde

# Vérifier une archive ancienne (le seul test qui prouve quelque chose)
node scripts/sauvegarde.mjs verifier sauvegardes/champignon-2026-08-08T10-00-00.archive.gz
```

Sortie attendue :

```
✓ Archive : /…/champignon-2026-08-08T10-00-00.archive.gz (175.1 Ko)
  events                  1062 documents
  lots                     585 documents
  …
✓ Restauration vérifiée : 9 collections, 2884 documents identiques.
```

La commande **sort en erreur** au moindre écart de comptage.

### Automatiser

```cron
# Tous les jours à 3 h, dans le crontab du Pi.
0 3 * * * cd /home/pi/champignon-manager && /usr/bin/node scripts/sauvegarde.mjs sauvegarder --sortie /mnt/ssd/sauvegardes >> /var/log/champi-sauvegarde.log 2>&1
```

Deux points que le script ne fait **pas** et qui restent à la charge de
l'exploitant :

- **copier les archives hors du Pi.** Une sauvegarde sur le même disque que la
  base ne protège pas d'une panne de disque. Un `rsync` vers un autre appareil
  du tailnet suffit.
- **purger les anciennes archives.** Le script n'en supprime aucune : effacer
  une sauvegarde est une décision, pas un effet de bord.

### Les photos

Le stockage de fichiers **n'est pas dans la tranche verticale** : une
observation ne porte aujourd'hui qu'un `photoId`, pas de binaire. Le script
archive le dossier `CHAMPI_FILES_DIR` s'il existe, et le dit clairement s'il
n'existe pas. Quand le stockage de photos arrivera, la sauvegarde le prendra
sans modification.

---

## 5. Restauration

```bash
# 1. Restaurer à côté, jamais par-dessus.
node scripts/sauvegarde.mjs restaurer sauvegardes/<archive> --vers champignon_restauree

# 2. Vérifier les comptes affichés, puis basculer l'application.
#    Dans docker/docker-compose.prod.yml : CHAMPI_DB_NAME: 'champignon_restauree'
docker compose -f docker/docker-compose.prod.yml up -d
```

Le script **refuse de restaurer dans une base non vide**. Mêler deux histoires
de traçabilité produirait des lignées incohérentes que rien ne permettrait de
démêler ensuite — et la traçabilité est précisément ce qu'on sauvegarde.

---

## 6. Imprimante Nimbot B21 Pro

Le transport d'impression est **branché** sur le pilote Bluetooth réel. Sans
adresse d'imprimante, l'application garde son transport en mémoire : les
étiquettes sont composées et journalisées, mais rien ne sort — c'est le bon
défaut pour un poste sans imprimante.

```bash
# Le nom BLE annoncé par l'imprimante ; sur macOS il marche mieux que l'adresse.
export CHAMPI_PRINTER_ADDRESS='B21_Pro-HC19050441'
```

Au démarrage, le serveur annonce lequel des deux transports il utilise.

### Vérifier sans consommer de ruban

```bash
champi printer:test        # ouvre puis referme une vraie session BLE
champi label:print SUB-2026-0042 --dry-run   # compose l'étiquette sans imprimer
```

L'étiquette porte les quatre éléments demandés (`q17_4`) : **nom d'unité, type,
date, code QR**, plus le code public en clair — c'est lui qu'on lit à voix haute
quand le QR est abîmé. Le QR ne contient **que le token opaque** : une étiquette
photographiée hors de la ferme n'apprend rien.

### Ce que le conteneur ne fait pas

L'image de production **n'imprime pas**. Deux raisons, et aucune n'est un oubli :

1. le pilote s'appuie sur des modules natifs (`sharp`, pile BLE) qui ne sont pas
   embarqués dans l'image ;
2. le Bluetooth depuis un conteneur exige l'accès au D-Bus de l'hôte et au
   réseau hôte — c'est-à-dire à peu près tout abandonner de l'isolation.

Le plus simple sur le Pi : **imprimer depuis l'hôte**. Faire tourner le serveur
hors conteneur pour la partie impression, ou lancer un petit service dédié qui
porte `CHAMPI_PRINTER_ADDRESS`. Tant que ce n'est pas tranché sur place,
l'impression reste un point de la recette (§7), pas une promesse du conteneur.

### Si l'imprimante ne répond pas

| Symptôme | Cause la plus fréquente |
| --- | --- |
| `reachable: false` | L'application NIIMBOT officielle tient la connexion. La fermer. |
| Connexion refusée sur macOS | Bluetooth non autorisé pour le terminal (Réglages → Confidentialité). |
| Rien ne sort, voyant rouge | Mauvais type de média : le pilote suppose des étiquettes **à espaces**. |
| Sur Linux/Pi, échec de permission | `sudo setcap cap_net_raw+eip "$(readlink -f "$(which node)")"` |

---

## 7. Piloter depuis un agent

L'application est utilisable **entièrement en ligne de commande** (décision du
08/08/2026 : pas de serveur MCP, l'agent passe par le CLI).

```bash
export CHAMPI_URL=https://champi-pi.<tailnet>.ts.net

champi help                      # toutes les commandes
champi discover                  # état de l'API et opérations disponibles
champi unit:list --stage substrate
champi unit:advance SUB-2026-0042 --json '{"toStepId":"incubation","expectedVersion":3}' --dry-run
```

Trois propriétés qui rendent l'outil utilisable sans documentation :

- `--dry-run` sur toute écriture : l'agent peut vérifier avant d'agir ;
- les erreurs **portent les valeurs valides** — pas besoin de deviner ;
- une clé d'idempotence est générée par défaut : un appel rejoué n'écrit pas
  deux fois.

---

## 8. Recette de mise en service

À dérouler une fois sur la machine du cultivateur. Chaque ligne est vérifiable.

| # | Vérification | Comment |
| --- | --- | --- |
| 1 | Les deux conteneurs sont `healthy` | `docker compose -f docker/docker-compose.prod.yml ps` |
| 2 | L'application répond | `curl -s localhost:3000/api/health` |
| 3 | Le modèle par défaut est là et publié | `champi process:list` |
| 4 | L'URL Tailscale s'ouvre en HTTPS sur l'iPhone | Safari, URL MagicDNS |
| 5 | Le scan caméra ouvre la fiche | Safari sur iPhone, scanner une étiquette imprimée — ✅ validé le 09/08/2026 |
| 6 | L'imprimante répond **et sort une étiquette** | `champi printer:test`, puis `champi label:print <code>` |
| 7 | La sauvegarde s'exécute **et se vérifie** | `bun run sauvegarde` |
| 8 | Une restauration se déroule sans écart | `node scripts/sauvegarde.mjs verifier <archive>` |
| 9 | Les budgets de performance tiennent **sur le Pi** | `CHAMPI_PERF_FACTOR=6 bun run e2e` |

Les points **5** et **6** ont été vérifiés sur matériel le 09/08/2026, depuis un
Mac : étiquette imprimée sur la B21, scan du QR depuis un iPhone réel via
`tailscale serve`. Restent ouverts le point **9** — les budgets de performance
sur le Pi — et l'impression **depuis le Pi**, que le conteneur ne permet pas
(§6). Ce sont les réserves qui subsistent au rapport d'audit.

---

## 9. Mise à jour

```bash
git pull
docker compose -f docker/docker-compose.prod.yml up -d --build
```

Deux garanties portées par le code, pas par la procédure :

- **la suppression est logique** — aucune mise à jour n'efface de donnée métier ;
- **les unités en cours ne bougent pas** quand un process est republié : chacune
  reste épinglée à sa version jusqu'à la fin de son cycle (`docs/21` §2).

Sauvegarder avant, malgré tout : une migration de schéma imprévue reste possible.
