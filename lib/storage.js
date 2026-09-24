import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

// Justificatifs de paiement, logos et documents. En ligne : Vercel Blob. En local : dossier .data/uploads.
// Vercel relie le stockage par BLOB_STORE_ID (nouvelle méthode) ou BLOB_READ_WRITE_TOKEN (ancienne).
// L'espace est privé par défaut : les fichiers ne se lisent que par le logiciel, qui vérifie les droits.
const localDir = path.join(process.cwd(), '.data', 'uploads');
const useBlob = () => Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
const access = () => (process.env.BLOB_ACCESS === 'public' ? 'public' : 'private');

export async function saveFile(file, folder = 'justificatifs') {
  const ext = (path.extname(file.name || '').toLowerCase().match(/^\.[a-z0-9]{1,5}$/) || [''])[0];
  const name = `${folder}/${crypto.randomBytes(16).toString('hex')}${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  if (useBlob()) {
    const { put } = await import('@vercel/blob');
    const blob = await put(name, bytes, { access: access(), contentType: file.type, addRandomSuffix: true });
    return blob.url;
  }
  await fs.mkdir(path.join(localDir, folder), { recursive: true });
  await fs.writeFile(path.join(localDir, name), bytes);
  return `local:${name}`;
}

export async function readFile(key) {
  if (key.startsWith('local:')) {
    const rel = key.slice(6);
    if (rel.includes('..')) throw new Error('Chemin invalide');
    return fs.readFile(path.join(localDir, rel));
  }
  const { get } = await import('@vercel/blob');
  const res = await get(key, { access: access() });
  if (!res || res.statusCode !== 200) throw new Error('Fichier introuvable');
  return Buffer.from(await new Response(res.stream).arrayBuffer());
}

// Supprime un fichier (document retiré). Une erreur ne bloque pas : le fichier devient simplement inutilisé.
export async function deleteFile(key) {
  try {
    if (key.startsWith('local:')) {
      const rel = key.slice(6);
      if (!rel.includes('..')) await fs.unlink(path.join(localDir, rel));
      return;
    }
    const { del } = await import('@vercel/blob');
    await del(key);
  } catch (err) {
    console.error('Fichier non supprimé :', err.message);
  }
}
