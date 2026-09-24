import Flash from '@/components/Flash';
import YearReport from '@/components/YearReport';
import { requireCompany } from '@/lib/auth';
import { listInvoices } from '@/lib/invoices';
import { yearReport, yearsOf } from '@/lib/report';

export const metadata = { title: 'Rapports' };

export default async function Page({ searchParams }) {
  const { company } = await requireCompany();
  const sp = await searchParams;
  const invoices = await listInvoices(company.id);
  const years = yearsOf(invoices);
  const year = years.includes(Number(sp.annee)) ? Number(sp.annee) : years[0];
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Rapports</h1>
          <p className="hint" style={{ margin: '6px 0 0' }}>Le récapitulatif de ton année, pour ta déclaration et ton comptable. Montants en {company.currency}.</p>
        </div>
      </div>
      <Flash searchParams={searchParams} />
      <YearReport report={yearReport(company, invoices, year)} year={year} years={years} basePath="/rapports" exportHref={`/rapports/export?annee=${year}`} />
    </>
  );
}
