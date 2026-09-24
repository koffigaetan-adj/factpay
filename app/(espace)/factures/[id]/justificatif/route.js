import { currentUser } from '@/lib/auth';
import { one } from '@/lib/db';
import { readFile } from '@/lib/storage';
import { idFrom } from '@/lib/ids';

// Justificatif de paiement : visible uniquement par l'entreprise qui a émis la facture
export async function GET(_req, { params }) {
  const { id } = await params;
  const user = await currentUser();
  const inv = user && await one(`SELECT i.proof_key, i.proof_name, i.proof_mime FROM invoices i
    JOIN companies c ON c.id = i.company_id WHERE i.id = $1 AND c.owner_id = $2`, [idFrom('facture', id), user.id]);
  if (!inv?.proof_key) return new Response('Aucun justificatif.', { status: 404 });
  const body = await readFile(inv.proof_key);
  return new Response(body, {
    headers: {
      'Content-Type': inv.proof_mime || 'application/octet-stream',
      'Content-Disposition': `inline; filename="${encodeURIComponent(inv.proof_name || 'justificatif')}"`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
