import Link from 'next/link';
import Flash from '@/components/Flash';
import Modal from '@/components/Modal';
import Icon from '@/components/Icon';
import ModuleLayout from '@/components/ModuleLayout';
import { requireCompany } from '@/lib/auth';
import { listExpenses, EXPENSE_CATEGORIES } from '@/lib/expenses';
import { listEmployees, getRhNavCounts } from '@/lib/employees';
import { createExpenseReportAction, reviewExpenseReportAction } from '@/app/actions';
import { money } from '@/lib/money';
import { frDate } from '@/lib/dates';

export const metadata = { title: 'Notes de frais' };

const FILTERS = {
  all: { label: 'Toutes', match: () => true },
  en_attente: { label: 'En attente', match: (e) => e.status === 'en_attente' },
  approuve: { label: 'Approuvées', match: (e) => e.status === 'approuve' },
  rembourse: { label: 'Remboursées', match: (e) => e.status === 'rembourse' },
  refuse: { label: 'Refusées', match: (e) => e.status === 'refuse' },
};

export default async function Page({ searchParams }) {
  const { company } = await requireCompany();
  const sp = await searchParams;
  const filterKey = FILTERS[sp.filtre] ? sp.filtre : 'all';

  const [allExpenses, employees, rhCounts] = await Promise.all([
    listExpenses(company.id),
    listEmployees(company.id, 'actif'),
    getRhNavCounts(company.id),
  ]);

  const filtered = allExpenses.filter(FILTERS[filterKey].match);
  const cur = company.currency || 'XOF';

  const totalExpenseAmount = allExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const pendingExpenses = allExpenses.filter((e) => e.status === 'en_attente');
  const pendingAmount = pendingExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const reimbursedExpenses = allExpenses.filter((e) => e.status === 'rembourse');
  const reimbursedAmount = reimbursedExpenses.reduce((s, e) => s + (e.amount || 0), 0);

  return (
    <ModuleLayout
      workspaceId="rh"
      title="Notes de frais"
      subtitle="Gestion des remboursements de frais professionnels (déplacements, carburant, restauration, télécoms)."
      actions={
        <Modal label="Nouvelle dépense" icon="plus" title="Ajouter une note de frais">
          <form action={createExpenseReportAction} className="form-stack">
            <input type="hidden" name="return_url" value="/notes-de-frais" />
            <div className="field">
              <label htmlFor="employee_id">Salarié <span className="req">*</span></label>
              <select id="employee_id" name="employee_id" required>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.first_name} {e.last_name} ({e.department || e.job_title})
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="title">Objet / Libellé de la dépense <span className="req">*</span></label>
              <input id="title" name="title" type="text" placeholder="Ex: Déplacement client Lomé-Kpalimé" required />
            </div>

            <div className="form-grid">
              <div className="field">
                <label htmlFor="amount">Montant ({cur}) <span className="req">*</span></label>
                <input id="amount" name="amount" type="number" step="any" min="100" placeholder="Ex: 15000" required />
              </div>
              <div className="field">
                <label htmlFor="category">Catégorie</label>
                <select id="category" name="category" defaultValue="transport">
                  {Object.entries(EXPENSE_CATEGORIES).map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <label htmlFor="expense_date">Date de la dépense</label>
              <input id="expense_date" name="expense_date" type="date" defaultValue={new Date().toISOString().split('T')[0]} />
            </div>

            <div className="field">
              <label htmlFor="recu">Reçu / facture <span className="help">facultatif — PDF ou photo, 1 Mo max</span></label>
              <input id="recu" name="recu" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.txt" />
            </div>

            <div className="actions" style={{ marginTop: '16px' }}>
              <button type="submit" className="button">Enregistrer la note de frais</button>
            </div>
          </form>
        </Modal>
      }
      counts={rhCounts}
    >
      <Flash searchParams={searchParams} />

      {/* KPI Cards style PayFit compact */}
      <div className="page-kpi-grid">
        <div className="page-kpi-card">
          <div className="page-kpi-icon" style={{ background: '#eef2ff', color: '#4338ca' }}>
            <Icon name="report" size={18} />
          </div>
          <div className="page-kpi-info">
            <span className="page-kpi-label">Total frais</span>
            <span className="page-kpi-value">{money(totalExpenseAmount, cur)}</span>
            <span className="page-kpi-hint">{allExpenses.length} déclarée{allExpenses.length > 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className="page-kpi-card" style={pendingExpenses.length > 0 ? { borderColor: '#fed7aa', background: '#fffaf0' } : {}}>
          <div className="page-kpi-icon" style={{ background: pendingExpenses.length > 0 ? '#ffedd5' : '#f1f5f9', color: pendingExpenses.length > 0 ? '#ea580c' : '#64748b' }}>
            <Icon name="clock" size={18} />
          </div>
          <div className="page-kpi-info">
            <span className="page-kpi-label">À valider</span>
            <span className="page-kpi-value" style={{ color: pendingExpenses.length > 0 ? '#ea580c' : 'var(--ink)' }}>
              {money(pendingAmount, cur)}
            </span>
            <span className="page-kpi-hint">
              {pendingExpenses.length} en attente
            </span>
          </div>
        </div>

        <div className="page-kpi-card">
          <div className="page-kpi-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
            <Icon name="check" size={18} />
          </div>
          <div className="page-kpi-info">
            <span className="page-kpi-label">Remboursées</span>
            <span className="page-kpi-value" style={{ color: '#059669' }}>{money(reimbursedAmount, cur)}</span>
            <span className="page-kpi-hint">{reimbursedExpenses.length} payée{reimbursedExpenses.length > 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {/* Section avec onglets style PayFit */}
      <section className="doc-section">
        <div className="doc-filter-header">
          <nav className="doc-tabs-bar" aria-label="Filtrer les notes de frais">
            {Object.entries(FILTERS).map(([k, f]) => {
              const count = allExpenses.filter(f.match).length;
              const isActive = k === filterKey;
              return (
                <Link
                  key={k}
                  href={`/notes-de-frais${k === 'all' ? '' : `?filtre=${k}`}`}
                  className={`doc-tab-pill ${isActive ? 'is-active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span>{f.label}</span>
                  <span className={`doc-tab-count ${k === 'en_attente' && count > 0 ? 'count-late' : ''}`}>
                    {count}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        {filtered.length ? (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Salarié & Dépense</th>
                  <th>Catégorie</th>
                  <th>Date</th>
                  <th className="n">Montant</th>
                  <th>Statut</th>
                  <th>Reçu</th>
                  <th className="n">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  const initial = (e.first_name || 'E').charAt(0).toUpperCase();
                  return (
                    <tr key={e.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: '#f1f5f9',
                              color: '#475569',
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
                            <div style={{ fontWeight: 650, color: 'var(--ink)' }}>{e.title}</div>
                            <span className="sub">{e.first_name} {e.last_name}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="doc-cat-tag" style={{ fontSize: '12px' }}>
                          {EXPENSE_CATEGORIES[e.category] || e.category}
                        </span>
                      </td>
                      <td>{e.expense_date ? frDate(e.expense_date) : '—'}</td>
                      <td className="n" style={{ fontWeight: 750, fontSize: '15px' }}>
                        {money(e.amount, cur)}
                      </td>
                      <td>
                        <span className={`status ${e.status === 'rembourse' ? 'paid' : e.status === 'approuve' ? 'check' : e.status === 'refuse' ? 'late' : 'wait'}`}>
                          {e.status === 'rembourse' ? 'Remboursé' : e.status === 'approuve' ? 'Approuvé' : e.status === 'refuse' ? 'Refusé' : 'En attente'}
                        </span>
                      </td>
                      <td>
                        {e.receipt_url ? (
                          <a className="button secondary small" href={`/rh/piece?type=frais&id=${e.id}`} target="_blank" rel="noreferrer">
                            <Icon name="file" size={14} /> Voir
                          </a>
                        ) : (
                          <span className="sub">—</span>
                        )}
                      </td>
                      <td className="n">
                        {e.status === 'en_attente' && (
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <form action={reviewExpenseReportAction} style={{ display: 'inline' }}>
                              <input type="hidden" name="id" value={e.id} />
                              <input type="hidden" name="status" value="rembourse" />
                              <button type="submit" className="button small" title="Rembourser">
                                <Icon name="check" size={14} /> Rembourser
                              </button>
                            </form>
                            <form action={reviewExpenseReportAction} style={{ display: 'inline' }}>
                              <input type="hidden" name="id" value={e.id} />
                              <input type="hidden" name="status" value="refuse" />
                              <button type="submit" className="button secondary small" title="Refuser">
                                <Icon name="close" size={14} /> Refuser
                              </button>
                            </form>
                          </div>
                        )}
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
              <Icon name="report" size={32} />
            </div>
            <p style={{ fontWeight: 650, color: 'var(--ink)', margin: '0 0 4px' }}>Aucune note de frais</p>
            <p className="sub" style={{ margin: 0 }}>Les justificatifs et demandes de remboursements apparaîtront ici.</p>
          </div>
        )}
      </section>
    </ModuleLayout>
  );
}
