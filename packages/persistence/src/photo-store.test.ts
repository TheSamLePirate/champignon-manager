import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PhotoStore, TAILLE_PHOTO_MAX } from './photo-store.js';

/**
 * Le dépôt de photos, contre un **vrai disque**.
 *
 * Même règle que pour MongoDB : on n'écrit pas contre un faux système de
 * fichiers. Les erreurs qui comptent — dossier absent, fichier disparu, image
 * vide — ne se produisent que sur du réel.
 */

const dossiers: string[] = [];

async function magasin(): Promise<PhotoStore> {
  const dossier = await mkdtemp(join(tmpdir(), 'champi-photos-'));
  dossiers.push(dossier);
  return new PhotoStore(dossier);
}

afterEach(async () => {
  for (const dossier of dossiers.splice(0)) {
    await rm(dossier, { recursive: true, force: true });
  }
});

/** Un PNG minuscule mais valide. */
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('enregistrement', () => {
  it('écrit l’image et rend sa taille réelle', async () => {
    const store = await magasin();

    const result = await store.enregistrer('ph-1', 'image/png', PNG_BASE64);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.photoId).toBe('ph-1');
    expect(result.value.byteSize).toBeGreaterThan(0);
    // Relue depuis le disque : l'octet est bien là, pas seulement annoncé.
    const relue = await store.lire('ph-1', 'image/png');
    expect(relue?.byteLength).toBe(result.value.byteSize);
  });

  it('crée le dossier au premier envoi', async () => {
    const dossier = join(await mkdtemp(join(tmpdir(), 'champi-')), 'pas-encore-la');
    dossiers.push(dossier);

    const result = await new PhotoStore(dossier).enregistrer('ph-1', 'image/png', PNG_BASE64);

    expect(result.ok).toBe(true);
  });

  /** Un canvas produit une data-URL complète ; l'exiger nettoyée ferait trébucher. */
  it('accepte une data-URL aussi bien qu’un base64 nu', async () => {
    const store = await magasin();

    const result = await store.enregistrer(
      'ph-2',
      'image/png',
      `data:image/png;base64,${PNG_BASE64}`,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const nu = await store.enregistrer('ph-3', 'image/png', PNG_BASE64);
    expect(nu.ok && nu.value.byteSize).toBe(result.value.byteSize);
  });

  it('refuse un format non accepté, en listant ceux qui le sont', async () => {
    const store = await magasin();

    const result = await store.enregistrer('ph-1', 'image/gif', PNG_BASE64);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.hint).toContain('image/jpeg');
    expect(result.error.path).toBe('contentType');
  });

  it('refuse une image vide plutôt que d’écrire un fichier de zéro octet', async () => {
    const store = await magasin();

    const result = await store.enregistrer('ph-1', 'image/png', '');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('vide');
  });

  /** Une photo hors norme remplirait le disque du Pi sans qu'on s'en aperçoive. */
  it('refuse une image au-delà du plafond', async () => {
    const store = await magasin();
    const tropGrosse = Buffer.alloc(TAILLE_PHOTO_MAX + 1, 1).toString('base64');

    const result = await store.enregistrer('ph-1', 'image/png', tropGrosse);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.hint).toContain(String(TAILLE_PHOTO_MAX));
  });
});

describe('relecture', () => {
  it('rend null quand le fichier a disparu du disque', async () => {
    const store = await magasin();

    // Le journal peut référencer une photo qu'une restauration partielle n'a
    // pas ramenée : ce n'est pas un bug, c'est une sauvegarde incomplète.
    expect(await store.lire('jamais-ecrite', 'image/jpeg')).toBeNull();
  });

  it('relit exactement ce qui a été écrit', async () => {
    const store = await magasin();
    await store.enregistrer('ph-1', 'image/png', PNG_BASE64);

    const relue = await store.lire('ph-1', 'image/png');

    expect(relue?.toString('base64')).toBe(PNG_BASE64);
  });
});

describe('chemin de fichier', () => {
  it('donne à chaque format son extension', async () => {
    const store = await magasin();

    expect(store.cheminDe('ph-1', 'image/jpeg').endsWith('ph-1.jpg')).toBe(true);
    expect(store.cheminDe('ph-1', 'image/png').endsWith('ph-1.png')).toBe(true);
    expect(store.cheminDe('ph-1', 'image/webp').endsWith('ph-1.webp')).toBe(true);
  });

  /** La sauvegarde a besoin du chemin réel pour archiver les images. */
  it('range les photos sous la racine configurée', async () => {
    const dossier = await mkdtemp(join(tmpdir(), 'champi-photos-'));
    dossiers.push(dossier);
    await writeFile(join(dossier, 'temoin'), 'x');

    expect(new PhotoStore(dossier).cheminDe('ph-1', 'image/png').startsWith(dossier)).toBe(true);
  });
});
