import { currentUser } from '@/lib/auth';
import { one, q } from '@/lib/db';
import { listInvoices, listReceivedInvoices } from '@/lib/invoices';
import { listPayslips } from '@/lib/payroll';
import { yearReport, payrollYearReport, expensesYearReport } from '@/lib/report';
import { reportCsv, payrollCsv, expensesCsv, csvResponse } from '@/lib/export';

// Récapitulatif annuel en CSV (Excel) : Ventes, Masse Salariale & Cotisations, ou Dépenses
export async function GET(req) {
  const user = await currentUser();
  const company = user && await one('SELECT * FROM companies WHERE owner_id = $1', [user.id]);
  if (!company) return new Response('Non autorisé.', { status: 401 });

  const url = new URL(req.url);
  const year = Number(url.searchParams.get('annee')) || new Date().getUTCFullYear();
  const vue = url.searchParams.get('vue') || 'ventes';

  if (vue === 'salaires') {
    const payslips = await listPayslips(company.id, { year });
    const rep = payrollYearReport(company, payslips, year);
    return csvResponse(payrollCsv(rep, year), `recapitulatif-salaires-cnss-${year}.csv`);
  }

  if (vue === 'depenses') {
    const [receivedInvoices, expenseReports] = await Promise.all([
      listReceivedInvoices([company.email, user.email], 'facture', company.id),
      q('SELECT * FROM expense_reports WHERE company_id = $1', [company.id]),
    ]);
    const rep = expensesYearReport(company, receivedInvoices, expenseReports, year);
    return csvResponse(expensesCsv(rep, year), `recapitulatif-depenses-${year}.csv`);
  }

  return csvResponse(reportCsv(yearReport(company, await listInvoices(company.id), year), year), `recapitulatif-ventes-${year}.csv`);
}

