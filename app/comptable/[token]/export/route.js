import { companyByAccountantToken } from '@/lib/accountant';
import { listInvoices } from '@/lib/invoices';
import { invoicesCsv, csvResponse } from '@/lib/export';

// Accès comptable : factures de l'année en CSV
export async function GET(req, { params }) {
  const company = await companyByAccountantToken((await params).token);
  if (!company) return new Response('Lien non valable.', { status: 404 });
  const year = Number(new URL(req.url).searchParams.get('annee')) || new Date().getUTCFullYear();
  return csvResponse(invoicesCsv(await listInvoices(company.id), year), `factures-${year}.csv`);
}
