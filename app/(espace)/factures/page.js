import Link from 'next/link';
import Flash from '@/components/Flash';
import InvoiceTable from '@/components/InvoiceTable';
import Icon from '@/components/Icon';
import ModuleLayout from '@/components/ModuleLayout';
import ListSearch from '@/components/ListSearch';
import { requireCompany } from '@/lib/auth';
import { listInvoices, getSidebarCounts } from '@/lib/invoices';
import { today } from '@/lib/dates';
import { money, fixedRate, roundFor } from '@/lib/money';

export const metadata = { title: 'Factures' };

const FILTERS = {
  toutes: { label: 'Toutes', match: () => true },
  attente: { label: 'En attente', match: (i) => ['emise', 'envoyee', 'signalee'].includes(i.status) },
  retard: { label: 'En retard', match: (i) => ['emise', 'envoyee'].includes(i.status) && i.due_date && i.due_date < today() },
  payees: { label: 'Payées', match: (i) => i.status === 'payee' },
  brouillons: { label: 'Brouillons', match: (i) => i.status === 'brouillon' },
  // Un envoi programmé n'est plus un brouillon : il a sa propre pastille, comme le badge du tableau
  programmees: { label: 'Programmées', match: (i) => i.status === 'programmee' },
  echec: { label: "Échec d'envoi", match: (i) => !!i.send_error },
  annulees: { label: 'Annulées', match: (i) => i.status === 'annulee' },
};

export default async function Page({ searchParams }) {
  const { user, company } = await requireCompany();
  const sp = await searchParams;
  const key = FILTERS[sp.filtre] ? sp.filtre : 'toutes';
  const q = String(sp.q || '').trim().toLowerCase();
  const [all, counts] = await Promise.all([
    listInvoices(company.id),
    getSidebarCounts(company, user),
  ]);
  // La recherche porte sur le numéro, le client et l'objet — les trois choses qu'on retient
  const hitsQuery = (i) => !q || [i.number, i.client_name, i.title]
    .filter(Boolean).some((s) => String(s).toLowerCase().includes(q));
  const invoices = all.filter(FILTERS[key].match).filter(hitsQuery);

  const cur = company.currency || 'XOF';
  const now = today();
  // Les totaux sont dans la devise d'entreprise : chaque facture convertit avec le taux fixe
  // ou le taux alternatif, sinon on l'écarte plutôt que d'additionner des devises différentes.
  const rateOf = (i) => (i.currency === cur ? 1 : fixedRate(i.currency, cur) ?? (i.alt_currency === cur ? i.alt_rate : null));
  const sum = (list) => roundFor(list.reduce((s, i) => s + (i.amount_due || 0) * (rateOf(i) || 0), 0), cur);
  const validInvoices = all.filter((i) => !['brouillon', 'annulee'].includes(i.status) && rateOf(i));
  const totalBilled = sum(validInvoices);
  const paidInvoices = all.filter((i) => i.status === 'payee' && rateOf(i));
  const totalPaid = sum(paidInvoices);
  const waitingInvoices = all.filter((i) => ['emise', 'envoyee', 'signalee'].includes(i.status) && rateOf(i));
  const totalWaiting = sum(waitingInvoices);
  const lateInvoices = all.filter((i) => ['emise', 'envoyee'].includes(i.status) && i.due_date && i.due_date < now && rateOf(i));
  const totalLate = sum(lateInvoices);

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
        <div className="page-kpi-card" data-tone="brand">
          <div className="page-kpi-icon">
            <Icon name="invoice" size={18} />
          </div>
          <div className="page-kpi-info">
            <span className="page-kpi-label">Total facturé</span>
            <span className="page-kpi-value">{money(totalBilled, cur)}</span>
            <span className="page-kpi-hint">{validInvoices.length} émise{validInvoices.length > 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className="page-kpi-card" data-tone="green">
          <div className="page-kpi-icon">
            <Icon name="check" size={18} />
          </div>
          <div className="page-kpi-info">
            <span className="page-kpi-label">Encaissé</span>
            <span className="page-kpi-value" data-tint>{money(totalPaid, cur)}</span>
            <span className="page-kpi-hint">{paidInvoices.length} réglée{paidInvoices.length > 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className="page-kpi-card" data-tone="brand">
          <div className="page-kpi-icon">
            <Icon name="clock" size={18} />
          </div>
          <div className="page-kpi-info">
            <span className="page-kpi-label">En attente</span>
            <span className="page-kpi-value" data-tint>{money(totalWaiting, cur)}</span>
            <span className="page-kpi-hint">{waitingInvoices.length} à encaisser</span>
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

      {/* Section principale avec filtres en pilules PayFit */}
      <section className="doc-section">
        <div className="doc-filter-header">
          <nav className="doc-tabs-bar" aria-label="Filtrer les factures">
            {Object.entries(FILTERS).map(([k, f]) => {
              const count = all.filter(f.match).length;
              const isActive = k === key;
              const params = new URLSearchParams();
              if (k !== 'toutes') params.set('filtre', k);
              if (q) params.set('q', q);
              const qs = params.toString();
              return (
                <Link
                  key={k}
                  href={`/factures${qs ? `?${qs}` : ''}`}
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
          <ListSearch action="/factures" query={String(sp.q || '')} placeholder="Numéro, client ou objet…"
            keep={key !== 'toutes' ? { filtre: key } : {}} />
        </div>

        {invoices.length ? (
          <InvoiceTable invoices={invoices} />
        ) : (
          <div className="doc-empty-state">
            <div className="doc-empty-icon">
              <Icon name="invoice" size={32} />
            </div>
            {q ? (
              <>
                <p style={{ fontWeight: 650, color: 'var(--ink)', margin: '0 0 4px' }}>Aucune facture ne correspond à «&nbsp;{String(sp.q)}&nbsp;»</p>
                <p className="sub" style={{ margin: 0 }}>Vérifie le numéro ou le nom du client, ou efface la recherche.</p>
              </>
            ) : (
              <>
                <p style={{ fontWeight: 650, color: 'var(--ink)', margin: '0 0 4px' }}>Aucune facture dans cette catégorie</p>
                <p className="sub" style={{ margin: 0 }}>Modifiez vos filtres ou créez une nouvelle facture pour démarrer.</p>
              </>
            )}
          </div>
        )}
      </section>
    </ModuleLayout>
  );
}
