import Flash from '@/components/Flash';
import ModuleLayout from '@/components/ModuleLayout';
import YearReport from '@/components/YearReport';
import { requireCompany } from '@/lib/auth';
import { listInvoices, listReceivedInvoices } from '@/lib/invoices';
import { listPayslips } from '@/lib/payroll';
import { q } from '@/lib/db';
import {
  yearReport,
  payrollYearReport,
  expensesYearReport,
  annualSummary,
  yearsOf,
} from '@/lib/report';

export const metadata = { title: 'Rapports & Bilan' };

export default async function Page({ searchParams }) {
  const { user, company } = await requireCompany();
  const sp = await searchParams;

  const [invoices, allPayslips, receivedInvoices, expenseReports] = await Promise.all([
    listInvoices(company.id),
    listPayslips(company.id),
    listReceivedInvoices([company.email, user.email], 'facture', company.id),
    q('SELECT * FROM expense_reports WHERE company_id = $1 ORDER BY id DESC', [company.id]),
  ]);

  const years = yearsOf(invoices, allPayslips);
  const year = years.includes(Number(sp.annee)) ? Number(sp.annee) : years[0];
  const validViews = ['ventes', 'salaires', 'depenses', 'bilan'];
  const vue = validViews.includes(sp.vue) ? sp.vue : 'ventes';

  // Rapports pour l'année sélectionnée
  const salesRep = yearReport(company, invoices, year);
  const payrollRep = payrollYearReport(company, allPayslips, year);
  const expensesRep = expensesYearReport(company, receivedInvoices, expenseReports, year);
  const summaryRep = annualSummary(salesRep, payrollRep, expensesRep);

  return (
    <ModuleLayout
      workspaceId="suivi"
      title="Rapports & bilan"
      subtitle={`Ventes, cotisations CNSS & salaires, dépenses et résultat d'exploitation. Montants en ${company.currency}.`}
    >
      <Flash searchParams={searchParams} />
      <YearReport
        report={salesRep}
        payrollReport={payrollRep}
        expensesReport={expensesRep}
        summaryReport={summaryRep}
        year={year}
        years={years}
        basePath="/rapports"
        vue={vue}
      />
    </ModuleLayout>
  );
}
