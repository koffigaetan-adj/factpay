import Link from 'next/link';
import Flash from '@/components/Flash';
import Icon from '@/components/Icon';
import PayslipTable from '@/components/PayslipTable';
import PeriodSelector from '@/components/PeriodSelector';
import ModuleLayout from '@/components/ModuleLayout';
import { requireCompany } from '@/lib/auth';
import { listPayslips, MONTHS } from '@/lib/payroll';
import { listEmployees, getRhNavCounts } from '@/lib/employees';
import { generateMonthlyPayslipsAction } from '@/app/actions';
import { money } from '@/lib/money';

export const metadata = { title: 'Fiches de paie' };

const FILTERS = {
  all: { label: 'Tous', match: () => true },
  brouillon: { label: 'Brouillons', match: (p) => p.status === 'brouillon' },
  valide: { label: 'Validés', match: (p) => p.status === 'valide' },
  paye: { label: 'Payés', match: (p) => p.status === 'paye' },
};

export default async function Page({ searchParams }) {
  const { company } = await requireCompany();
  const sp = await searchParams;

  const now = new Date();
  const currentYear = Number(sp.annee) || now.getUTCFullYear();
  const currentMonth = Number(sp.mois) || (now.getUTCMonth() + 1);
  const filterKey = FILTERS[sp.filtre] ? sp.filtre : 'all';

  const [allPayslips, employees, rhCounts] = await Promise.all([
    listPayslips(company.id, { year: currentYear, month: currentMonth }),
    listEmployees(company.id, 'actif'),
    getRhNavCounts(company.id),
  ]);

  const filtered = allPayslips.filter(FILTERS[filterKey].match);

  // Totaux du mois
  const totalGross = allPayslips.reduce((s, p) => s + (p.gross_salary || 0), 0);
  const totalNet = allPayslips.reduce((s, p) => s + (p.net_salary || 0), 0);
  const totalCnss = allPayslips.reduce((s, p) => s + (p.cnss_employee_amount || 0) + (p.cnss_employer_amount || 0), 0);
  const totalPaid = allPayslips.filter((p) => p.status === 'paye').reduce((s, p) => s + (p.net_salary || 0), 0);
  const totalValidToPay = allPayslips.filter((p) => p.status === 'valide').length;

  return (
    <ModuleLayout
      workspaceId="rh"
      title="Fiches de paie"
      subtitle="Gestion des salaires, déclarations de cotisations et virements mensuels."
      actions={
        <>
          {employees.length > 0 && (
            <form action={generateMonthlyPayslipsAction} style={{ display: 'inline' }}>
              <input type="hidden" name="period_year" value={currentYear} />
              <input type="hidden" name="period_month" value={currentMonth} />
              <button type="submit" className="button secondary">
                <Icon name="repeat" size={16} />
                Générer pour {MONTHS[currentMonth - 1]} ({employees.length} salariés)
              </button>
            </form>
          )}
          <Link href="/fiches-de-paie/nouvelle" className="button">
            <Icon name="plus" size={16} />
            Nouveau bulletin
          </Link>
        </>
      }
      counts={rhCounts}
    >
      <Flash searchParams={searchParams} />

      {/* 1. Sélecteur de période PayFit (Année + Ruban 12 mois) */}
      <PeriodSelector currentMonth={currentMonth} currentYear={currentYear} />

      {/* 2. Métriques mensuelles PayFit compact */}
      {allPayslips.length > 0 && (
        <div className="page-kpi-grid">
          <div className="page-kpi-card">
            <div className="page-kpi-icon" style={{ background: '#f5f0ff', color: '#6e39c4' }}>
              <Icon name="payslip" size={18} />
            </div>
            <div className="page-kpi-info">
              <span className="page-kpi-label">Masse brute</span>
              <span className="page-kpi-value">{money(totalGross, company.currency)}</span>
              <span className="page-kpi-hint">{allPayslips.length} bulletin{allPayslips.length > 1 ? 's' : ''}</span>
            </div>
          </div>

          <div className="page-kpi-card">
            <div className="page-kpi-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
              <Icon name="check" size={18} />
            </div>
            <div className="page-kpi-info">
              <span className="page-kpi-label">Net à verser</span>
              <span className="page-kpi-value" style={{ color: '#059669' }}>{money(totalNet, company.currency)}</span>
              <span className="page-kpi-hint">
                {totalPaid > 0 ? `${money(totalPaid, company.currency)} payés` : `${totalValidToPay} prêts`}
              </span>
            </div>
          </div>

          <div className="page-kpi-card">
            <div className="page-kpi-icon" style={{ background: '#fef3c7', color: '#b45309' }}>
              <Icon name="cash" size={18} />
            </div>
            <div className="page-kpi-info">
              <span className="page-kpi-label">Cotisations CNSS</span>
              <span className="page-kpi-value" style={{ color: '#b45309' }}>{money(totalCnss, company.currency)}</span>
              <span className="page-kpi-hint">Part salariale & patronale</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Section tableau et filtres pilules */}
      <section className="doc-section" style={{ padding: '20px' }}>
        <div className="doc-filter-header">
          <nav className="doc-tabs-bar" aria-label="Filtrer les bulletins">
            {Object.entries(FILTERS).map(([k, f]) => {
              const count = allPayslips.filter(f.match).length;
              return (
                <Link
                  key={k}
                  href={`/fiches-de-paie?annee=${currentYear}&mois=${currentMonth}${k === 'all' ? '' : `&filtre=${k}`}`}
                  className={`doc-tab-pill${k === filterKey ? ' is-active' : ''}`}
                >
                  {f.label}
                  <span className="doc-tab-count">{count}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <PayslipTable payslips={filtered} companyCurrency={company.currency} />
      </section>
    </ModuleLayout>
  );
}
