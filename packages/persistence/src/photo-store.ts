import { appError } from '@champi/contracts';
import { err, ok, type Result } from '@champi/domain';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

/**
 * Dépôt de photos.
 *
 * Les images vivent **sur le disque**, pas dans MongoDB : une base qui gonfle
 * de binaires devient lente à sauvegarder et à restaurer, et c'est justement la
 * sauvegarde qui protège la traçabilité. Le journal, lui, ne garde que la
 * référence — c'est elle qui est tracée, rejouée et auditée.
 *
 * Conséquence à connaître : **une sauvegarde de la base ne suffit plus**. Le
 * script `scripts/sauvegarde.mjs` archive déjà le dossier de fichiers ; c'est
 * désormais indispensable et non plus optionnel.
 */

/** Formats acceptés. Le navigateur produit du JPEG ; les deux autres sont tolérés. */
export type PhotoContentType = 'image/jpeg' | 'image/png' | 'image/webp';

/** Exhaustif par construction : l'indexation est totale, sans valeur de repli. */
const TYPES: Readonly<Record<PhotoContentType, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export interface StoredPhoto {
  readonly photoId: string;
  readonly contentType: PhotoContentType;
  readonly byteSize: number;
}

/**
 * Taille maximale d'une photo, en octets.
 *
 * Un iPhone produit facilement 3 Mo ; on plafonne à 8 Mo pour qu'une photo
 * hors norme ne remplisse pas le disque du Pi sans qu'on s'en aperçoive.
 */
export const TAILLE_PHOTO_MAX = 8 * 1024 * 1024;

export class PhotoStore {
  private readonly racine: string;

  constructor(dossier: string) {
    this.racine = resolve(dossier);
  }

  /** Chemin du fichier d'une photo. Public : la sauvegarde en a besoin. */
  cheminDe(photoId: string, contentType: PhotoContentType): string {
    return join(this.racine, `${photoId}.${TYPES[contentType]}`);
  }

  /**
   * Enregistre une image transmise en base64.
   *
   * Le corps arrive en JSON comme tout le reste de l'API — un agent doit
   * pouvoir déposer une photo sans monter un envoi multipart.
   */
  async enregistrer(
    photoId: string,
    contentType: string,
    base64: string,
  ): Promise<Result<StoredPhoto>> {
    if (!(contentType in TYPES)) {
      return err(
        appError('VALIDATION_FAILED', `Format d'image non accepté : « ${contentType} ».`, {
          hint: `Formats acceptés : ${Object.keys(TYPES).join(', ')}.`,
          path: 'contentType',
        }),
      );
    }

    // On accepte aussi bien une data-URL complète que du base64 nu : c'est ce
    // que produit un canvas, et l'exiger nettoyé ferait trébucher un agent.
    const virgule = base64.indexOf(',');
    const charge = base64.startsWith('data:') ? base64.slice(virgule + 1) : base64;

    // `Buffer.from(..., 'base64')` ne lève jamais : il ignore les caractères
    // invalides. Un `try/catch` ici serait du code mort — c'est la taille nulle
    // qui révèle une entrée illisible, et c'est elle qu'on teste.
    const octets = Buffer.from(charge, 'base64');

    if (octets.byteLength === 0) {
      return err(
        appError('VALIDATION_FAILED', "L'image reçue est vide.", {
          hint: 'Vérifie que la capture a bien produit une image avant de l’envoyer.',
          path: 'data',
        }),
      );
    }
    if (octets.byteLength > TAILLE_PHOTO_MAX) {
      return err(
        appError('VALIDATION_FAILED', `Image trop lourde : ${String(octets.byteLength)} octets.`, {
          hint: `Maximum ${String(TAILLE_PHOTO_MAX)} octets. Réduis la définition avant l'envoi.`,
          path: 'data',
        }),
      );
    }

    const type = contentType as PhotoContentType;
    await mkdir(this.racine, { recursive: true });
    await writeFile(this.cheminDe(photoId, type), octets);

    return ok({ photoId, contentType: type, byteSize: octets.byteLength });
  }

  /** Relit une photo. `null` si le fichier a disparu du disque. */
  async lire(photoId: string, contentType: PhotoContentType): Promise<Buffer | null> {
    try {
      return await readFile(this.cheminDe(photoId, contentType));
    } catch {
      // Le fichier manque alors que le journal le référence : c'est une
      // sauvegarde incomplète, pas une erreur de programmation. L'appelant
      // répond 404 et le dit.
      return null;
    }
  }
}
