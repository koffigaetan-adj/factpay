import { q, one } from './db.js';
import { saveFile, deleteFile } from './storage.js';
import { addDays, today } from './dates.js';

// Documents rangés par l'entreprise, rattachés ou non à un client.
export const CATEGORIES = {
  contrat: 'Contrat',
  bon_commande: 'Bon de commande',
  devis_signe: 'Devis signé',
  attestation: 'Attestation',
  administratif: 'Administratif (NIF, RCCM, statuts…)',
  rib: 'RIB / coordonnées bancaires',
  autre: 'Autre',
};

// Formats acceptés : PDF, images, Word, Excel, texte. 4 Mo au plus (limite des fonctions Vercel).
export const ALLOWED_TYPES = {
  'application/pdf': 'PDF',
  'image/png': 'Image',
  'image/jpeg': 'Image',
  'image/webp': 'Image',
  'application/msword': 'Word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'application/vnd.ms-excel': 'Excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
  'application/vnd.oasis.opendocument.text': 'Texte',
  'text/plain': 'Texte',
};
export const MAX_BYTES = 4 * 1024 * 1024;

export const kindOf = (mime) => ALLOWED_TYPES[mime] || 'Fichier';

// Étiquette courte de l'icône : PDF, IMG, DOC, XLS, TXT
export const badgeOf = (mime) => ({ PDF: 'PDF', Image: 'IMG', Word: 'DOC', Excel: 'XLS', Texte: 'TXT' })[kindOf(mime)] || 'FIC';
export const sizeLabel = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`);

// Échéance : expirée, bientôt (30 jours), ou rien
export function expiryState(doc) {
  if (!doc.expires_on) return null;
  if (doc.expires_on < today()) return 'expired';
  if (doc.expires_on <= addDays(today(), 30)) return 'soon';
  return null;
}

export function listDocuments(companyId, { clientId, category } = {}) {
  const where = ['d.company_id = $1'];
  const params = [companyId];
  if (clientId) { params.push(Number(clientId)); where.push(`d.client_id = $${params.length}`); }
  if (category) { params.push(category); where.push(`d.category = $${params.length}`); }
  return q(`SELECT d.*, c.name AS client_name FROM documents d LEFT JOIN clients c ON c.id = d.client_id
    WHERE ${where.join(' AND ')} ORDER BY d.created_at DESC, d.id DESC`, params);
}

export const getDocument = (companyId, id) => one('SELECT * FROM documents WHERE id = $1 AND company_id = $2', [Number(id) || 0, companyId]);

// Enregistre le fichier puis sa fiche. Renvoie { id } ou { error }.
export async function addDocument(companyId, { file, title, category, clientId, docDate, expiresOn, notes }) {
  if (!file || typeof file === 'string' || !file.size) return { error: 'Choisis un fichier.' };
  if (!ALLOWED_TYPES[file.type]) return { error: 'Format non accepté : PDF, image, Word, Excel ou texte.' };
  if (file.size > MAX_BYTES) return { error: 'Le fichier dépasse 4 Mo.' };
  if (clientId && !(await one('SELECT 1 FROM clients WHERE id = $1 AND company_id = $2', [Number(clientId), companyId]))) {
    return { error: 'Client introuvable.' };
  }
  const key = await saveFile(file, 'documents');
  const row = await one(`INSERT INTO documents (company_id, client_id, title, category, file_key, file_name, file_mime, file_size, doc_date, expires_on, notes)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
  [companyId, clientId ? Number(clientId) : null, title || file.name.replace(/\.[^.]+$/, ''), CATEGORIES[category] ? category : 'autre',
    key, file.name.slice(0, 200), file.type, file.size, docDate || null, expiresOn || null, notes || '']);
  return { id: row.id };
}

export async function removeDocument(companyId, id) {
  const doc = await one('DELETE FROM documents WHERE id = $1 AND company_id = $2 RETURNING file_key', [Number(id) || 0, companyId]);
  if (doc) await deleteFile(doc.file_key);
  return !!doc;
}
