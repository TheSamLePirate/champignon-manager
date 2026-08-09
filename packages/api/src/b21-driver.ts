/* eslint-disable no-console -- pilote matériel : la console est la seule trace disponible quand la radio décroche. */
import { ImageEncoder, NiimbotHeadlessBleClient } from '@mmote/niimblue-node';
import { LabelType, Utils, type EncodedImage } from '@mmote/niimbluelib';
import type { B21Driver, B21Job } from '@champi/printing';
import * as QRCode from 'qrcode';
import sharp from 'sharp';

/**
 * Pilote Bluetooth de la Nimbot B21 Pro.
 *
 * ⚠️ **Ce fichier est le seul du dépôt qui touche du matériel.** Il vit à côté
 * de `main.ts` — la racine d'assemblage — pour la même raison que l'horloge et
 * l'aléa n'existent que dans `server.ts` : ce qui ne peut pas être éprouvé sans
 * appareil ne doit contaminer aucune couche testable. La logique d'impression,
 * elle, est dans `@champi/printing` et couverte à 100 %.
 *
 * Reprend le pilote validé de `nimbot-lib`, réduit à ce dont l'application a
 * besoin : une étiquette QR, sans CLI ni options de mise au point.
 *
 * Matériel de référence (validé le 08/2026) :
 *
 * ```txt
 * B21_Pro-HC19050441 · modèle 785 · protocole 5 · 300 ppp · tâche D110M_V4
 * ```
 */

/** Le nom BLE annoncé par l'imprimante. Sur macOS, il marche mieux que l'adresse. */
export interface B21DriverOptions {
  readonly address: string;
  /** Millisecondes entre deux écritures BLE. Trop court, la radio décroche. */
  readonly packetIntervalMs?: number;
}

const TAILLE_QR_MAX = 0.62;

/**
 * Compose l'image de l'étiquette : titre, QR, légende.
 *
 * Exportée pour la prévisualisation : le pilote de référence recommande de
 * regarder le PNG avant d'engager du ruban, et c'est exactement la même image
 * qui part à l'imprimante.
 */
export async function rendreEtiquette(job: B21Job): Promise<sharp.Sharp> {
  // La taille du texte suit sa longueur : une étiquette est physique, elle ne
  // défile pas. Un nom d'unité un peu long débordait du ruban — mieux vaut
  // écrire plus petit que rogner ce qu'on doit lire.
  const titrePx = ajusterAuCadre(job.title, job.widthPx, Math.floor(job.heightPx * 0.14), 20);
  const legendePx = ajusterAuCadre(job.caption, job.widthPx, Math.floor(job.heightPx * 0.075), 12);
  const qrPx = Math.floor(Math.min(job.widthPx, job.heightPx) * TAILLE_QR_MAX);

  const qr = await QRCode.toBuffer(job.data, {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 1,
    width: qrPx,
    color: { dark: '#000000ff', light: '#ffffffff' },
  });

  const texte = `
<svg width="${String(job.widthPx)}" height="${String(job.heightPx)}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <text x="50%" y="${String(titrePx)}" text-anchor="middle"
        font-family="Helvetica, Arial, sans-serif" font-size="${String(titrePx)}"
        font-weight="bold" fill="#000000">${echapper(job.title)}</text>
  <text x="50%" y="${String(job.heightPx - Math.floor(legendePx * 0.6))}" text-anchor="middle"
        font-family="Helvetica, Arial, sans-serif" font-size="${String(legendePx)}"
        fill="#000000">${echapper(job.caption)}</text>
</svg>`;

  return sharp(Buffer.from(texte))
    .composite([
      {
        input: qr,
        top: Math.floor((job.heightPx - qrPx) / 2),
        left: Math.floor((job.widthPx - qrPx) / 2),
      },
    ])
    .flatten({ background: '#ffffff' })
    .greyscale()
    .threshold(128);
}

/**
 * Plus grande taille à laquelle le texte tient dans la largeur du ruban.
 *
 * Le facteur 1,9 approche la largeur moyenne d'un caractère en Helvetica ; on
 * garde 6 % de marge de chaque côté, parce qu'une étiquette mal centrée sur le
 * rouleau mange quelques pixels.
 */
function ajusterAuCadre(
  texte: string,
  largeurPx: number,
  maximum: number,
  minimum: number,
): number {
  const disponible = largeurPx * 0.88;
  const parCaractere = Math.floor((disponible * 1.9) / Math.max(1, texte.length));
  return Math.max(minimum, Math.min(maximum, parCaractere));
}

function echapper(valeur: string): string {
  return valeur
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Ouvre une connexion BLE, ou lève avec un message exploitable en chambre. */
async function connecter(options: B21DriverOptions): Promise<NiimbotHeadlessBleClient> {
  const client = new NiimbotHeadlessBleClient();
  // L'adresse se pose avant la connexion — sur macOS, le **nom** annoncé par
  // l'imprimante fonctionne mieux que l'adresse matérielle.
  client.setAddress(options.address);
  client.setPacketInterval(options.packetIntervalMs ?? 10);

  await client.connect();
  await Utils.sleep(200);
  return client;
}

/**
 * Pilote réel.
 *
 * Chaque appel ouvre puis referme la connexion : garder la radio ouverte entre
 * deux étiquettes empêchait l'application officielle NIIMBOT de reprendre la
 * main, et une session BLE oubliée bloque l'imprimante jusqu'à extinction.
 */
export function createB21Driver(options: B21DriverOptions): B21Driver {
  return {
    async probe(): Promise<boolean> {
      try {
        const client = await connecter(options);
        await client.disconnect();
        return true;
      } catch (cause) {
        console.warn(`Imprimante B21 injoignable : ${String(cause)}`);
        return false;
      }
    },

    async printQr(job: B21Job): Promise<void> {
      const image = await rendreEtiquette(job);
      const client = await connecter(options);

      try {
        const direction = client.getModelMetadata()?.printDirection ?? 'top';
        const tache = client.getPrintTaskType() ?? 'D110M_V4';
        const encodee: EncodedImage = await ImageEncoder.encodeImage(image, direction);

        const impression = client.abstraction.newPrintTask(tache, {
          density: job.density,
          labelType: LabelType.WithGaps,
          totalPages: job.copies,
          statusPollIntervalMs: 500,
          statusTimeoutMs: 25_000,
        });

        try {
          await impression.printInit();
          await impression.printPage(encodee, job.copies);
          await impression.waitForFinished();
        } finally {
          // `printEnd` peut échouer si la radio a déjà lâché : on ne masque pas
          // pour autant l'erreur d'impression qui, elle, doit remonter.
          await impression.printEnd().catch((cause: unknown) => {
            console.warn(`Fin d'impression imparfaite : ${String(cause)}`);
          });
        }
      } finally {
        await client.disconnect();
      }
    },
  };
}
