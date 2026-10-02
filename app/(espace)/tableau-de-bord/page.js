import Flash from '@/components/Flash';
import Dashboard from '@/components/Dashboard';
import { requireCompany } from '@/lib/auth';
import { listInvoices, listReceivedInvoices } from '@/lib/invoices';
import { q } from '@/lib/db';
import { listDocuments, expiryState } from '@/lib/documents';
import { getRhNavCounts } from '@/lib/employees';

export const metadata = { title: 'Tableau de bord' };

export default async function Page({ searchParams }) {
  const { user, company } = await requireCompany();
  const nowMonth = new Date().getUTCMonth() + 1;
  const nowYear = new Date().getUTCFullYear();

  const [
    invoices,
    quotes,
    receivedInvoices,
    receivedQuotes,
    clients,
    docs,
    rhCounts,
    payrollMonthRows,
    pendingExpensesRows,
  ] = await Promise.all([
    listInvoices(company.id),
    listInvoices(company.id, 'devis'),
    listReceivedInvoices([company.email, user.email], 'facture', company.id),
    listReceivedInvoices([company.email, user.email], 'devis', company.id),
    q('SELECT count(*)::int AS n FROM clients WHERE company_id = $1', [company.id]),
    listDocuments(company.id),
    getRhNavCounts(company.id),
    q(`
      SELECT
        count(*)::int AS total_payslips,
        count(*) FILTER (WHERE status = 'paye')::int AS paid_payslips,
        count(*) FILTER (WHERE status = 'valide')::int AS valid_payslips,
        count(*) FILTER (WHERE status = 'brouillon')::int AS draft_payslips,
        coalesce(sum(gross_salary), 0)::float AS gross_total,
        coalesce(sum(net_salary), 0)::float AS net_total,
        coalesce(sum(cnss_employer_amount + cnss_employee_amount), 0)::float AS cnss_total,
        coalesce(sum(total_employer_cost), 0)::float AS employer_cost_total
      FROM payslips
      WHERE company_id = $1 AND period_year = $2 AND period_month = $3
    `, [company.id, nowYear, nowMonth]),
    q(`
      SELECT count(*)::int AS count, coalesce(sum(amount), 0)::float AS total
      FROM expense_reports
      WHERE company_id = $1 AND status = 'en_attente'
    `, [company.id]),
  ]);

  return (
    <Dashboard
      user={user}
      company={company}
      invoices={invoices}
      quotes={quotes}
      receivedInvoices={receivedInvoices}
      receivedQuotes={receivedQuotes}
      expiring={docs.filter((d) => expiryState(d))}
      clientCount={clients[0].n}
      rhCounts={rhCounts}
      sansPortail={rhCounts.sansPortail}
      payrollMonth={payrollMonthRows[0]}
      expensesPending={pendingExpensesRows[0]}
      nowMonth={nowMonth}
      nowYear={nowYear}
      flash={<Flash searchParams={searchParams} />}
    />
  );
}
