import { getInvoiceByToken } from '@/lib/invoices';
import { creditNotePdf } from '@/lib/pdf';

// Avoir d'une facture annulée, pour le client (lien secret de la facture)
export async function GET(_req, { params }) {
  const { token } = await params;
  const found = await getInvoiceByToken(token);
  if (!found?.invoice.credit_number) return new Response('Avoir introuvable.', { status: 404 });
  return new Response(await creditNotePdf(found.invoice, found.company), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${found.invoice.credit_number}.pdf"` },
  });
}
