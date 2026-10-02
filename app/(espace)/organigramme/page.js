import Flash from '@/components/Flash';
import OrgChartView from '@/components/OrgChartView';
import ModuleLayout from '@/components/ModuleLayout';
import { requireCompany } from '@/lib/auth';
import { getCompanyOrgChart } from '@/lib/orgchart';
import { getRhNavCounts } from '@/lib/employees';

export const metadata = { title: 'Organigramme' };

export default async function Page({ searchParams }) {
  const { company } = await requireCompany();
  const [orgChart, rhCounts] = await Promise.all([
    getCompanyOrgChart(company.id),
    getRhNavCounts(company.id),
  ]);

  return (
    <ModuleLayout
      workspaceId="rh"
      title="Organigramme"
      subtitle={`Structure organisationnelle, départements et annuaire de l'entreprise (${orgChart.totalEmployees} collaborateur${orgChart.totalEmployees > 1 ? 's' : ''}).`}
      counts={rhCounts}
    >
      <Flash searchParams={searchParams} />

      <section>
        <OrgChartView orgChart={orgChart} />
      </section>
    </ModuleLayout>
  );
}
