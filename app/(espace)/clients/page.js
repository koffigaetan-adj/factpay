import Link from 'next/link';
import Flash from '@/components/Flash';
import ModuleLayout from '@/components/ModuleLayout';
import { createClient } from '@/app/actions';
import { requireCompany } from '@/lib/auth';
import { q } from '@/lib/db';
import { money } from '@/lib/money';
import ClientFields from '@/components/ClientFields';
import Modal from '@/components/Modal';
import Icon from '@/components/Icon';
import ListSearch from '@/components/ListSearch';
import { pubId } from '@/lib/ids';

export const metadata = { title: 'Clients' };

export default async function Page({ searchParams }) {
  const { company } = await requireCompany();
  const sp = await searchParams;
  const rows = await q(`SELECT c.*, count(i.id)::int AS invoice_count,
      coalesce(sum(i.amount_due) FILTER (WHERE i.status IN ('emise', 'envoyee', 'signalee')), 0) AS open_total
    FROM clients c LEFT JOIN invoices i ON i.client_id = c.id
    WHERE c.company_id = $1 GROUP BY c.id ORDER BY c.name`, [company.id]);
  const term = String(sp.q || '').trim().toLowerCase();
  // Les KPI restent calculés sur tout le répertoire ; la recherche ne filtre que le tableau
  const clients = rows.filter((c) => !term || [c.name, c.email].filter(Boolean)
    .some((s) => String(s).toLowerCase().includes(term)));

  const cur = company.currency || 'XOF';
  const totalOpen = rows.reduce((s, c) => s + (Number(c.open_total) || 0), 0);
  const activeClients = rows.filter((c) => c.invoice_count > 0);
  const totalInvoicesCount = rows.reduce((s, c) => s + (Number(c.invoice_count) || 0), 0);

  return (
    <ModuleLayout
      workspaceId="suivi"
      title="Clients"
      subtitle="Répertoire de vos clients, historique de facturation et encaissements en attente."
      actions={
        <Modal label="Nouveau client" icon="plus" title="Nouveau client">
          <form action={createClient} className="stack">
            <ClientFields />
            <div className="form-actions"><button><Icon name="plus" size={16} /> Ajouter le client</button></div>
          </form>
        </Modal>
      }
    >
      <Flash searchParams={searchParams} />

      {/* KPI Cards style PayFit compact */}
      <div className="page-kpi-grid">
        <div className="page-kpi-card" data-tone="brand">
          <div className="page-kpi-icon">
            <Icon name="user" size={18} />
          </div>
          <div className="page-kpi-info">
            <span className="page-kpi-label">Clients</span>
            <span className="page-kpi-value">{rows.length}</span>
            <span className="page-kpi-hint">{activeClients.length} actifs</span>
          </div>
        </div>

        <div className="page-kpi-card" data-tone="amber">
          <div className="page-kpi-icon">
            <Icon name="invoice" size={18} />
          </div>
          <div className="page-kpi-info">
            <span className="page-kpi-label">Factures</span>
            <span className="page-kpi-value">{totalInvoicesCount}</span>
            <span className="page-kpi-hint">Total générées</span>
          </div>
        </div>

        <div className="page-kpi-card" data-tone="brand">
          <div className="page-kpi-icon">
            <Icon name="clock" size={18} />
          </div>
          <div className="page-kpi-info">
            <span className="page-kpi-label">À encaisser</span>
            <span className="page-kpi-value" data-tint>{money(totalOpen, cur)}</span>
            <span className="page-kpi-hint">Solde en attente</span>
          </div>
        </div>
      </div>

      <section className="doc-section">
        <div className="doc-filter-header">
          <ListSearch action="/clients" query={String(sp.q || '')} placeholder="Nom ou e-mail…" />
        </div>
        {clients.length ? (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th className="n">Factures</th>
                  <th className="n">À encaisser</th>
                  <th className="n">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => {
                  const initial = (c.name || 'C').charAt(0).toUpperCase();
                  return (
                    <tr key={c.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: 'var(--bg)',
                              color: 'var(--muted)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '12px',
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {initial}
                          </div>
                          <div>
                            <Link className="row-link" href={`/clients/${pubId('client', c.id)}`} style={{ fontWeight: 650 }}>
                              {c.name}
                            </Link>
                            {c.email && <span className="sub">{c.email}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="n" style={{ fontWeight: 600 }}>{c.invoice_count}</td>
                      <td className="n" style={{ fontWeight: 750, color: c.open_total > 0 ? 'var(--brand-text)' : 'var(--ink)' }}>
                        {money(c.open_total, company.currency)}
                      </td>
                      <td className="n">
                        <Link className="button secondary small" href={`/clients/${pubId('client', c.id)}#modifier`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Icon name="edit" size={13} />
                          Modifier
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="doc-empty-state">
            <div className="doc-empty-icon">
              <Icon name="user" size={32} />
            </div>
            {term ? (
              <>
                <p style={{ fontWeight: 650, color: 'var(--ink)', margin: '0 0 4px' }}>Aucun client ne correspond à «&nbsp;{String(sp.q)}&nbsp;»</p>
                <p className="sub" style={{ margin: 0 }}>Vérifie le nom ou l'e-mail, ou efface la recherche.</p>
              </>
            ) : (
              <>
                <p style={{ fontWeight: 650, color: 'var(--ink)', margin: '0 0 4px' }}>Aucun client pour l'instant</p>
                <p className="sub" style={{ margin: 0 }}>Cliquez sur « Nouveau client » pour ajouter votre premier partenaire.</p>
              </>
            )}
          </div>
        )}
      </section>
    </ModuleLayout>
  );
}
