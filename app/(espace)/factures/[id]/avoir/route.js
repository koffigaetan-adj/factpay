import { currentUser } from '@/lib/auth';
import { one } from '@/lib/db';
import { getInvoice } from '@/lib/invoices';
import { creditNotePdf } from '@/lib/pdf';

// Avoir d'une facture annulée, pour l'entreprise
export async function GET(_req, { params }) {
  const { id } = await params;
  const user = await currentUser();
  const company = user && await one('SELECT * FROM companies WHERE owner_id = $1', [user.id]);
  const inv = company && await getInvoice(company.id, id);
  if (!inv?.credit_number) return new Response('Avoir introuvable.', { status: 404 });
  return new Response(await creditNotePdf(inv, company), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${inv.credit_number}.pdf"` },
  });
}
