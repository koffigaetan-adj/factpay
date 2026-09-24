import { currentUser } from '@/lib/auth';
import { one } from '@/lib/db';
import { getDocument } from '@/lib/documents';
import { readFile } from '@/lib/storage';

// Fichier d'un document : visible uniquement par l'entreprise qui l'a rangé.
// PDF et images s'ouvrent dans le navigateur, les autres formats se téléchargent.
export async function GET(_req, { params }) {
  const { id } = await params;
  const user = await currentUser();
  const company = user && await one('SELECT id FROM companies WHERE owner_id = $1', [user.id]);
  const doc = company && await getDocument(company.id, id);
  if (!doc) return new Response('Document introuvable.', { status: 404 });
  const inline = doc.file_mime === 'application/pdf' || doc.file_mime.startsWith('image/');
  return new Response(await readFile(doc.file_key), {
    headers: {
      'Content-Type': doc.file_mime,
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(doc.file_name)}`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  });
}
