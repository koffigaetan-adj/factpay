import { companyByAccountantToken } from '@/lib/accountant';
import { listInvoices } from '@/lib/invoices';
import { yearReport } from '@/lib/report';
import { reportCsv, csvResponse } from '@/lib/export';

// Accès comptable : récapitulatif de l'année par client, en CSV
export async function GET(req, { params }) {
  const company = await companyByAccountantToken((await params).token);
  if (!company) return new Response('Lien non valable.', { status: 404 });
  const year = Number(new URL(req.url).searchParams.get('annee')) || new Date().getUTCFullYear();
  return csvResponse(reportCsv(yearReport(company, await listInvoices(company.id), year), year), `recapitulatif-${year}.csv`);
}
