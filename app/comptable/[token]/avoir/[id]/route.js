import { companyByAccountantToken } from '@/lib/accountant';
import { getInvoice } from '@/lib/invoices';
import { creditNotePdf } from '@/lib/pdf';

// Accès comptable : avoir d'une facture annulée
export async function GET(_req, { params }) {
  const { token, id } = await params;
  const company = await companyByAccountantToken(token);
  const inv = company && await getInvoice(company.id, id);
  if (!inv?.credit_number) return new Response('Avoir introuvable.', { status: 404 });
  return new Response(await creditNotePdf(inv, company), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${inv.credit_number}.pdf"`, 'Cache-Control': 'private, no-store' },
  });
}
