import { currentUser } from '@/lib/auth';
import { one } from '@/lib/db';
import { getInvoice } from '@/lib/invoices';
import { invoicePdf } from '@/lib/pdf';

export async function GET(_req, { params }) {
  const { id } = await params;
  const user = await currentUser();
  const company = user && await one('SELECT * FROM companies WHERE owner_id = $1', [user.id]);
  const inv = company && await getInvoice(company.id, id);
  if (!inv) return new Response('Facture introuvable.', { status: 404 });
  const pdf = await invoicePdf(inv, company);
  return new Response(pdf, {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${inv.number || 'brouillon'}.pdf"` },
  });
}
