import { currentUser } from '@/lib/auth';
import { one } from '@/lib/db';
import { fileResponse } from '@/lib/documents';

// Pièce RH (justificatif de congé, reçu de note de frais) pour le propriétaire de l'entreprise.
// `type` = conge | frais. Le droit est vérifié sur company_id : une pièce d'une autre entreprise
// n'est jamais servie, même avec un identifiant deviné.
export async function GET(request, { searchParams }) {
  const user = await currentUser();
  if (!user) return new Response('Accès refusé', { status: 401 });

  const sp = await searchParams;
  const type = sp.type === 'frais' ? 'frais' : 'conge';
  const id = Number(sp.id) || 0;
  if (!id) return new Response('Pièce introuvable', { status: 404 });

  const row = type === 'frais'
    ? await one(
      `SELECT er.receipt_url AS key, er.receipt_name AS name, er.receipt_mime AS mime
       FROM expense_reports er
       JOIN companies c ON c.id = er.company_id
       WHERE er.id = $1 AND c.owner_id = $2`,
      [id, user.id],
    )
    : await one(
      `SELECT lr.document_url AS key, lr.document_name AS name, lr.document_mime AS mime
       FROM leave_requests lr
       JOIN companies c ON c.id = lr.company_id
       WHERE lr.id = $1 AND c.owner_id = $2`,
      [id, user.id],
    );

  if (!row || !row.key) return new Response('Pièce introuvable', { status: 404 });
  return fileResponse(row.key, row.name, row.mime);
}