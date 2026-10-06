import Link from 'next/link';
import Flash from '@/components/Flash';
import InvoiceTable from '@/components/InvoiceTable';
import Icon from '@/components/Icon';
import ModuleLayout from '@/components/ModuleLayout';
import { requireCompany } from '@/lib/auth';
import { listReceivedInvoices, getSidebarCounts } from '@/lib/invoices';
import { money } from '@/lib/money';

export const metadata = { title: 'Devis reçus' };

const FILTERS = {
  tous: { label: 'Tous', match: () => true },
  attente: { label: 'En attente de réponse', match: (i) => ['emise', 'envoyee'].includes(i.status) },
  acceptes: { label: 'Acceptés', match: (i) => ['acceptee', 'convertie'].includes(i.status) },
  refuses: { label: 'Refusés', match: (i) => i.status === 'refusee' },
};

export default async function Page({ searchParams }) {
  const { user, company } = await requireCompany();
  const sp = await searchParams;
  const key = FILTERS[sp.filtre] ? sp.filtre : 'tous';
  const [all, counts] = await Promise.all([
    listReceivedInvoices([company.email, user.email], 'devis', company.id),
    getSidebarCounts(company, user),
  ]);
  const quotes = all.filter(FILTERS[key].match);

  const cur = company.currency || 'XOF';
  const totalReceivedAmount = all.reduce((s, i) => s + (i.amount_due || 0), 0);
  const waitingQuotes = all.filter((i) => ['emise', 'envoyee'].includes(i.status));
  const waitingAmount = waitingQuotes.reduce((s, i) => s + (i.amount_due || 0), 0);
  const acceptedQuotes = all.filter((i) => ['acceptee', 'convertie'].includes(i.status));
  const acceptedAmount = acceptedQuotes.reduce((s, i) => s + (i.amount_due || 0), 0);

  return (
    <ModuleLayout
      workspaceId="facturation"
      title="Devis reçus"
      subtitle="Devis envoyés par d'autres entreprises sur FactPay qui vous ont ajouté comme client."
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
            <span className="page-kpi-label">Total reçus</span>
            <span className="page-kpi-value">{money(totalReceivedAmount, cur)}</span>
            <span className="page-kpi-hint">{all.length} devis</span>
          </div>
        </div>

        <div className="page-kpi-card" data-tone="brand">
          <div className="page-kpi-icon">
            <Icon name="clock" size={18} />
          </div>
          <div className="page-kpi-info">
            <span className="page-kpi-label">À examiner</span>
            <span className="page-kpi-value" data-tint>{money(waitingAmount, cur)}</span>
            <span className="page-kpi-hint">{waitingQuotes.length} en attente</span>
          </div>
        </div>

        <div className="page-kpi-card" data-tone="green">
          <div className="page-kpi-icon">
            <Icon name="check" size={18} />
          </div>
          <div className="page-kpi-info">
            <span className="page-kpi-label">Validés par vous</span>
            <span className="page-kpi-value" data-tint>{money(acceptedAmount, cur)}</span>
            <span className="page-kpi-hint">{acceptedQuotes.length} approuvé{acceptedQuotes.length > 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {/* Section avec onglets style PayFit */}
      <section className="doc-section">
        <div className="doc-filter-header">
          <nav className="doc-tabs-bar" aria-label="Filtrer les devis reçus">
            {Object.entries(FILTERS).map(([k, f]) => {
              const count = all.filter(f.match).length;
              const isActive = k === key;
              return (
                <Link
                  key={k}
                  href={`/devis-recus${k === 'tous' ? '' : `?filtre=${k}`}`}
                  className={`doc-tab-pill ${isActive ? 'is-active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span>{f.label}</span>
                  <span className="doc-tab-count">{count}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {quotes.length ? (
          <InvoiceTable invoices={quotes} received />
        ) : (
          <div className="doc-empty-state">
            <div className="doc-empty-icon">
              <Icon name="quote" size={32} />
            </div>
            <p style={{ fontWeight: 650, color: 'var(--ink)', margin: '0 0 4px' }}>Aucun devis reçu</p>
            <p className="sub" style={{ margin: 0 }}>Les propositions commerciales de vos partenaires apparaîtront ici.</p>
          </div>
        )}
      </section>
    </ModuleLayout>
  );
}
