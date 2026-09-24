import { companyByAccountantToken } from '@/lib/accountant';
import { getInvoice } from '@/lib/invoices';
import { invoicePdf } from '@/lib/pdf';

// Accès comptable : PDF d'une facture émise de l'entreprise
export async function GET(_req, { params }) {
  const { token, id } = await params;
  const company = await companyByAccountantToken(token);
  const inv = company && await getInvoice(company.id, id);
  if (!inv?.number) return new Response('Facture introuvable.', { status: 404 });
  return new Response(await invoicePdf(inv, company), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${inv.number}.pdf"`, 'Cache-Control': 'private, no-store' },
  });
}
