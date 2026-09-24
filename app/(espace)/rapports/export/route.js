import { currentUser } from '@/lib/auth';
import { one } from '@/lib/db';
import { listInvoices } from '@/lib/invoices';
import { yearReport } from '@/lib/report';
import { reportCsv, csvResponse } from '@/lib/export';

// Récapitulatif de l'année par client, en CSV (Excel)
export async function GET(req) {
  const user = await currentUser();
  const company = user && await one('SELECT * FROM companies WHERE owner_id = $1', [user.id]);
  if (!company) return new Response('Non autorisé.', { status: 401 });
  const year = Number(new URL(req.url).searchParams.get('annee')) || new Date().getUTCFullYear();
  return csvResponse(reportCsv(yearReport(company, await listInvoices(company.id), year), year), `recapitulatif-${year}.csv`);
}
