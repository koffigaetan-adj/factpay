import { getInvoiceByToken } from '@/lib/invoices';
import { invoicePdf } from '@/lib/pdf';

export async function GET(_req, { params }) {
  const { token } = await params;
  const found = await getInvoiceByToken(token);
  if (!found || !found.invoice.number) return new Response('Facture introuvable.', { status: 404 });
  const pdf = await invoicePdf(found.invoice, found.company);
  return new Response(pdf, {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${found.invoice.number}.pdf"` },
  });
}
