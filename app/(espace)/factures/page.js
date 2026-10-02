import Link from 'next/link';
import Flash from '@/components/Flash';
import InvoiceTable from '@/components/InvoiceTable';
import Icon from '@/components/Icon';
import ModuleLayout from '@/components/ModuleLayout';
import { requireCompany } from '@/lib/auth';
import { listInvoices, getSidebarCounts } from '@/lib/invoices';
import { today } from '@/lib/dates';
import { money } from '@/lib/money';

export const metadata = { title: 'Factures' };

const FILTERS = {
  toutes: { label: 'Toutes', match: () => true },
  attente: { label: 'En attente', match: (i) => ['emise', 'envoyee', 'signalee'].includes(i.status) },
  retard: { label: 'En retard', match: (i) => ['emise', 'envoyee'].includes(i.status) && i.due_date && i.due_date < today() },
  payees: { label: 'Payées', match: (i) => i.status === 'payee' },
  brouillons: { label: 'Brouillons', match: (i) => ['brouillon', 'programmee'].includes(i.status) },
  annulees: { label: 'Annulées', match: (i) => i.status === 'annulee' },
};

export default async function Page({ searchParams }) {
  const { user, company } = await requireCompany();
  const sp = await searchParams;
  const key = FILTERS[sp.filtre] ? sp.filtre : 'toutes';
  const [all, counts] = await Promise.all([
    listInvoices(company.id),
    getSidebarCounts(company, user),
  ]);
  const invoices = all.filter(FILTERS[key].match);

  const cur = company.currency || 'XOF';
  const now = today();
  const validInvoices = all.filter((i) => !['brouillon', 'annulee'].includes(i.status));
  const totalBilled = validInvoices.reduce((s, i) => s + (i.amount_due || 0), 0);
  const paidInvoices = all.filter((i) => i.status === 'payee');
  const totalPaid = paidInvoices.reduce((s, i) => s + (i.amount_due || 0), 0);
  const waitingInvoices = all.filter((i) => ['emise', 'envoyee', 'signalee'].includes(i.status));
  const totalWaiting = waitingInvoices.reduce((s, i) => s + (i.amount_due || 0), 0);
  const lateInvoices = all.filter((i) => ['emise', 'envoyee'].includes(i.status) && i.due_date && i.due_date < now);
  const totalLate = lateInvoices.reduce((s, i) => s + (i.amount_due || 0), 0);

  return (
    <ModuleLayout
      workspaceId="facturation"
      title="Mes factures"
      subtitle="Factures émises à destination de vos clients et suivi des encaissements."
      actions={
        <>
          <a className="button secondary" href={`/factures/export?annee=${new Date().getUTCFullYear()}`}>
            <Icon name="download" size={16} />
            Exporter {new Date().getUTCFullYear()} (Excel)
          </a>
          <Link className="button" href="/factures/nouvelle">
            <Icon name="plus" size={16} />
            Nouvelle facture
          </Link>
        </>
      }
      counts={counts}
    >
      <Flash searchParams={searchParams} />

      {/* KPI Cards style PayFit compact */}
      <div className="page-kpi-grid">
        <div className="page-kpi-card">
          <div className="page-kpi-icon" style={{ background: '#eef2ff', color: '#4338ca' }}>
            <Icon name="invoice" size={18} />
          </div>
          <div className="page-kpi-info">
            <span className="page-kpi-label">Total facturé</span>
            <span className="page-kpi-value">{money(totalBilled, cur)}</span>
            <span className="page-kpi-hint">{validInvoices.length} émise{validInvoices.length > 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className="page-kpi-card">
          <div className="page-kpi-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
            <Icon name="check" size={18} />
          </div>
          <div className="page-kpi-info">
            <span className="page-kpi-label">Encaissé</span>
            <span className="page-kpi-value" style={{ color: '#059669' }}>{money(totalPaid, cur)}</span>
            <span className="page-kpi-hint">{paidInvoices.length} réglée{paidInvoices.length > 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className="page-kpi-card">
          <div className="page-kpi-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
            <Icon name="clock" size={18} />
          </div>
          <div className="page-kpi-info">
            <span className="page-kpi-label">En attente</span>
            <span className="page-kpi-value" style={{ color: '#2563eb' }}>{money(totalWaiting, cur)}</span>
            <span className="page-kpi-hint">{waitingInvoices.length} à encaisser</span>
          </div>
        </div>

        <div className="page-kpi-card" style={lateInvoices.length > 0 ? { borderColor: '#fecaca', background: '#fffaf0' } : {}}>
          <div className="page-kpi-icon" style={{ background: lateInvoices.length > 0 ? '#fee2e2' : '#f1f5f9', color: lateInvoices.length > 0 ? '#dc2626' : '#64748b' }}>
            <Icon name="alert" size={18} />
          </div>
          <div className="page-kpi-info">
            <span className="page-kpi-label">En retard</span>
            <span className="page-kpi-value" style={{ color: lateInvoices.length > 0 ? '#dc2626' : 'var(--ink)' }}>
              {money(totalLate, cur)}
            </span>
            <span className="page-kpi-hint" style={{ color: lateInvoices.length > 0 ? '#b91c1c' : 'var(--muted)' }}>
              {lateInvoices.length} en retard
            </span>
          </div>
        </div>
      </div>

      {/* Section principale avec filtres en pilules PayFit */}
      <section className="doc-section">
        <div className="doc-filter-header">
          <nav className="doc-tabs-bar" aria-label="Filtrer les factures">
            {Object.entries(FILTERS).map(([k, f]) => {
              const count = all.filter(f.match).length;
              const isActive = k === key;
              return (
                <Link
                  key={k}
                  href={`/factures${k === 'toutes' ? '' : `?filtre=${k}`}`}
                  className={`doc-tab-pill ${isActive ? 'is-active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span>{f.label}</span>
                  <span className={`doc-tab-count ${k === 'retard' && count > 0 ? 'count-late' : ''}`}>
                    {count}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        {invoices.length ? (
          <InvoiceTable invoices={invoices} />
        ) : (
          <div className="doc-empty-state">
            <div className="doc-empty-icon">
              <Icon name="invoice" size={32} />
            </div>
            <p style={{ fontWeight: 650, color: 'var(--ink)', margin: '0 0 4px' }}>Aucune facture dans cette catégorie</p>
            <p className="sub" style={{ margin: 0 }}>Modifiez vos filtres ou créez une nouvelle facture pour démarrer.</p>
          </div>
        )}
      </section>
    </ModuleLayout>
  );
}
