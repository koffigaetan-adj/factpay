import Link from 'next/link';
import Flash from '@/components/Flash';
import InvoiceTable from '@/components/InvoiceTable';
import Icon from '@/components/Icon';
import ModuleLayout from '@/components/ModuleLayout';
import { requireCompany } from '@/lib/auth';
import { listInvoices, getSidebarCounts } from '@/lib/invoices';
import { money } from '@/lib/money';

export const metadata = { title: 'Devis' };

const FILTERS = {
  tous: { label: 'Tous', match: () => true },
  attente: { label: 'En attente de réponse', match: (i) => ['emise', 'envoyee'].includes(i.status) },
  acceptes: { label: 'Acceptés', match: (i) => ['acceptee', 'convertie'].includes(i.status) },
  refuses: { label: 'Refusés', match: (i) => i.status === 'refusee' },
  brouillons: { label: 'Brouillons', match: (i) => i.status === 'brouillon' },
};

export default async function Page({ searchParams }) {
  const { user, company } = await requireCompany();
  const sp = await searchParams;
  const key = FILTERS[sp.filtre] ? sp.filtre : 'tous';
  const [all, counts] = await Promise.all([
    listInvoices(company.id, 'devis'),
    getSidebarCounts(company, user),
  ]);
  const quotes = all.filter(FILTERS[key].match);

  const cur = company.currency || 'XOF';
  const totalQuotesAmount = all.reduce((s, i) => s + (i.amount_due || 0), 0);
  const waitingQuotes = all.filter((i) => ['emise', 'envoyee'].includes(i.status));
  const waitingAmount = waitingQuotes.reduce((s, i) => s + (i.amount_due || 0), 0);
  const acceptedQuotes = all.filter((i) => ['acceptee', 'convertie'].includes(i.status));
  const acceptedAmount = acceptedQuotes.reduce((s, i) => s + (i.amount_due || 0), 0);
  const totalDecided = acceptedQuotes.length + all.filter((i) => i.status === 'refusee').length;
  const conversionRate = totalDecided > 0 ? Math.round((acceptedQuotes.length / totalDecided) * 100) : 0;

  return (
    <ModuleLayout
      workspaceId="facturation"
      title="Mes devis"
      subtitle="Vos propositions commerciales avec signature en ligne et transformation directe en facture."
      actions={
        <Link className="button" href="/devis/nouveau">
          <Icon name="plus" size={16} />
          Nouveau devis
        </Link>
      }
      counts={counts}
    >
      <Flash searchParams={searchParams} />

      {/* KPI Cards style PayFit compact */}
      <div className="page-kpi-grid">
        <div className="page-kpi-card">
          <div className="page-kpi-icon" style={{ background: '#fef3c7', color: '#b45309' }}>
            <Icon name="quote" size={18} />
          </div>
          <div className="page-kpi-info">
            <span className="page-kpi-label">Total devis</span>
            <span className="page-kpi-value">{money(totalQuotesAmount, cur)}</span>
            <span className="page-kpi-hint">{all.length} émis</span>
          </div>
        </div>

        <div className="page-kpi-card">
          <div className="page-kpi-icon" style={{ background: '#eff6ff', color: '#2563eb' }}>
            <Icon name="clock" size={18} />
          </div>
          <div className="page-kpi-info">
            <span className="page-kpi-label">En attente</span>
            <span className="page-kpi-value" style={{ color: '#2563eb' }}>{money(waitingAmount, cur)}</span>
            <span className="page-kpi-hint">{waitingQuotes.length} en cours</span>
          </div>
        </div>

        <div className="page-kpi-card">
          <div className="page-kpi-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
            <Icon name="check" size={18} />
          </div>
          <div className="page-kpi-info">
            <span className="page-kpi-label">Acceptés</span>
            <span className="page-kpi-value" style={{ color: '#059669' }}>{money(acceptedAmount, cur)}</span>
            <span className="page-kpi-hint">{acceptedQuotes.length} signés</span>
          </div>
        </div>

        <div className="page-kpi-card">
          <div className="page-kpi-icon" style={{ background: '#f5f0ff', color: '#7c3aed' }}>
            <Icon name="percent" size={18} />
          </div>
          <div className="page-kpi-info">
            <span className="page-kpi-label">Conversion</span>
            <span className="page-kpi-value" style={{ color: '#7c3aed' }}>
              {totalDecided > 0 ? `${conversionRate}%` : '—'}
            </span>
            <span className="page-kpi-hint">
              {acceptedQuotes.length} sur {totalDecided} traité{totalDecided > 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Section avec onglets style PayFit */}
      <section className="doc-section">
        <div className="doc-filter-header">
          <nav className="doc-tabs-bar" aria-label="Filtrer les devis">
            {Object.entries(FILTERS).map(([k, f]) => {
              const count = all.filter(f.match).length;
              const isActive = k === key;
              return (
                <Link
                  key={k}
                  href={`/devis${k === 'tous' ? '' : `?filtre=${k}`}`}
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
          <InvoiceTable invoices={quotes} />
        ) : (
          <div className="doc-empty-state">
            <div className="doc-empty-icon">
              <Icon name="quote" size={32} />
            </div>
            <p style={{ fontWeight: 650, color: 'var(--ink)', margin: '0 0 4px' }}>Aucun devis dans cette catégorie</p>
            <p className="sub" style={{ margin: 0 }}>
              Créez votre première proposition commerciale en quelques clics.
            </p>
          </div>
        )}
      </section>
    </ModuleLayout>
  );
}
