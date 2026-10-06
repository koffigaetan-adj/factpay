import Link from 'next/link';
import Flash from '@/components/Flash';
import InvoiceTable from '@/components/InvoiceTable';
import Icon from '@/components/Icon';
import ModuleLayout from '@/components/ModuleLayout';
import { requireCompany } from '@/lib/auth';
import { listReceivedInvoices, getSidebarCounts } from '@/lib/invoices';
import { today } from '@/lib/dates';
import { money } from '@/lib/money';

export const metadata = { title: 'Factures reçues' };

const FILTERS = {
  toutes: { label: 'Toutes', match: () => true },
  attente: { label: 'À payer', match: (i) => ['emise', 'envoyee', 'signalee'].includes(i.status) },
  retard: { label: 'En retard', match: (i) => ['emise', 'envoyee'].includes(i.status) && i.due_date && i.due_date < today() },
  payees: { label: 'Payées', match: (i) => i.status === 'payee' },
};

export default async function Page({ searchParams }) {
  const { user, company } = await requireCompany();
  const sp = await searchParams;
  const key = FILTERS[sp.filtre] ? sp.filtre : 'toutes';
  const [all, counts] = await Promise.all([
    listReceivedInvoices([company.email, user.email], 'facture', company.id),
    getSidebarCounts(company, user),
  ]);
  const invoices = all.filter(FILTERS[key].match);

  const cur = company.currency || 'XOF';
  const now = today();
  const totalReceived = all.reduce((s, i) => s + (i.amount_due || 0), 0);
  const pendingInvoices = all.filter((i) => ['emise', 'envoyee', 'signalee'].includes(i.status));
  const totalPending = pendingInvoices.reduce((s, i) => s + (i.amount_due || 0), 0);
  const paidInvoices = all.filter((i) => i.status === 'payee');
  const totalPaid = paidInvoices.reduce((s, i) => s + (i.amount_due || 0), 0);
  const lateInvoices = all.filter((i) => ['emise', 'envoyee'].includes(i.status) && i.due_date && i.due_date < now);
  const totalLate = lateInvoices.reduce((s, i) => s + (i.amount_due || 0), 0);

  return (
    <ModuleLayout
      workspaceId="facturation"
      title="Factures reçues"
      subtitle="Factures fournisseurs transmises par vos partenaires sur FactPay."
      counts={counts}
    >
      <Flash searchParams={searchParams} />

      {/* KPI Cards style PayFit compact */}
      <div className="page-kpi-grid">
        <div className="page-kpi-card" data-tone="brand">
          <div className="page-kpi-icon">
            <Icon name="inbox" size={18} />
          </div>
          <div className="page-kpi-info">
            <span className="page-kpi-label">Total reçu</span>
            <span className="page-kpi-value">{money(totalReceived, cur)}</span>
            <span className="page-kpi-hint">{all.length} facture{all.length > 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className="page-kpi-card" data-tone="brand">
          <div className="page-kpi-icon">
            <Icon name="clock" size={18} />
          </div>
          <div className="page-kpi-info">
            <span className="page-kpi-label">À régler</span>
            <span className="page-kpi-value" data-tint>{money(totalPending, cur)}</span>
            <span className="page-kpi-hint">{pendingInvoices.length} en attente</span>
          </div>
        </div>

        <div className="page-kpi-card" data-tone="green">
          <div className="page-kpi-icon">
            <Icon name="check" size={18} />
          </div>
          <div className="page-kpi-info">
            <span className="page-kpi-label">Payées</span>
            <span className="page-kpi-value" data-tint>{money(totalPaid, cur)}</span>
            <span className="page-kpi-hint">{paidInvoices.length} réglée{paidInvoices.length > 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className={`page-kpi-card ${lateInvoices.length > 0 ? 'is-alert' : ''}`.trim()} data-tone={lateInvoices.length > 0 ? 'red' : 'neutral'}>
          <div className="page-kpi-icon">
            <Icon name="alert" size={18} />
          </div>
          <div className="page-kpi-info">
            <span className="page-kpi-label">En retard</span>
            <span className="page-kpi-value" data-tint={lateInvoices.length > 0 ? 'true' : undefined}>
              {money(totalLate, cur)}
            </span>
            <span className="page-kpi-hint" data-tint={lateInvoices.length > 0 ? 'true' : undefined}>
              {lateInvoices.length} en retard
            </span>
          </div>
        </div>
      </div>

      {/* Section avec onglets style PayFit */}
      <section className="doc-section">
        <div className="doc-filter-header">
          <nav className="doc-tabs-bar" aria-label="Filtrer les factures reçues">
            {Object.entries(FILTERS).map(([k, f]) => {
              const count = all.filter(f.match).length;
              const isActive = k === key;
              return (
                <Link
                  key={k}
                  href={`/factures-recues${k === 'toutes' ? '' : `?filtre=${k}`}`}
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
          <InvoiceTable invoices={invoices} received />
        ) : (
          <div className="doc-empty-state">
            <div className="doc-empty-icon">
              <Icon name="invoice" size={32} />
            </div>
            <p style={{ fontWeight: 650, color: 'var(--ink)', margin: '0 0 4px' }}>Aucune facture reçue</p>
            <p className="sub" style={{ margin: 0 }}>Les factures envoyées par vos fournisseurs apparaîtront ici.</p>
          </div>
        )}
      </section>
    </ModuleLayout>
  );
}
