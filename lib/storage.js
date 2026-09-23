import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

// Justificatifs de paiement. En ligne : Vercel Blob. En local : dossier .data/uploads.
const localDir = path.join(process.cwd(), '.data', 'uploads');
const useBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export async function saveFile(file) {
  const ext = (path.extname(file.name || '').toLowerCase().match(/^\.[a-z0-9]{1,5}$/) || [''])[0];
  const name = `justificatifs/${crypto.randomBytes(16).toString('hex')}${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  if (useBlob()) {
    // Adresse publique mais impossible à deviner (32 caractères aléatoires + suffixe)
    const { put } = await import('@vercel/blob');
    const blob = await put(name, bytes, { access: 'public', contentType: file.type, addRandomSuffix: true });
    return blob.url;
  }
  await fs.mkdir(path.join(localDir, 'justificatifs'), { recursive: true });
  await fs.writeFile(path.join(localDir, name), bytes);
  return `local:${name}`;
}

export async function readFile(key) {
  if (key.startsWith('local:')) {
    const rel = key.slice(6);
    if (rel.includes('..')) throw new Error('Chemin invalide');
    return fs.readFile(path.join(localDir, rel));
  }
  const res = await fetch(key);
  if (!res.ok) throw new Error('Fichier introuvable');
  return Buffer.from(await res.arrayBuffer());
}
