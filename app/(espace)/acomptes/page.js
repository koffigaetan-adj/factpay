import Link from 'next/link';
import Flash from '@/components/Flash';
import Modal from '@/components/Modal';
import Icon from '@/components/Icon';
import ModuleLayout from '@/components/ModuleLayout';
import { requireCompany } from '@/lib/auth';
import { listAdvances } from '@/lib/advances';
import { listEmployees, PAYMENT_METHODS, getRhNavCounts } from '@/lib/employees';
import { MONTHS } from '@/lib/rh-constants';
import { requestSalaryAdvanceAction, reviewSalaryAdvanceAction } from '@/app/actions';
import { money } from '@/lib/money';

export const metadata = { title: 'Acomptes sur salaire' };

const FILTERS = {
  all: { label: 'Tous', match: () => true },
  en_attente: { label: 'En attente', match: (a) => a.status === 'en_attente' },
  approuve: { label: 'Approuvés', match: (a) => a.status === 'approuve' },
  paye: { label: 'Payés', match: (a) => a.status === 'paye' },
  refuse: { label: 'Refusés', match: (a) => a.status === 'refuse' },
};

export default async function Page({ searchParams }) {
  const { company } = await requireCompany();
  const sp = await searchParams;
  const filterKey = FILTERS[sp.filtre] ? sp.filtre : 'all';

  const [allAdvances, employees, rhCounts] = await Promise.all([
    listAdvances(company.id),
    listEmployees(company.id, 'actif'),
    getRhNavCounts(company.id),
  ]);

  const filtered = allAdvances.filter(FILTERS[filterKey].match);
  const cur = company.currency || 'XOF';
  const now = new Date();

  const totalAdvancesAmount = allAdvances.reduce((s, a) => s + (a.amount || 0), 0);
  const pendingAdvances = allAdvances.filter((a) => a.status === 'en_attente');
  const pendingAmount = pendingAdvances.reduce((s, a) => s + (a.amount || 0), 0);
  const paidAdvances = allAdvances.filter((a) => a.status === 'paye');
  const paidAmount = paidAdvances.reduce((s, a) => s + (a.amount || 0), 0);

  return (
    <ModuleLayout
      workspaceId="rh"
      title="Acomptes sur salaire"
      subtitle="Demandes d'avances sur salaire en cours de mois, déduites automatiquement des bulletins de paie."
      actions={
        <Modal label="Nouvel acompte" icon="plus" title="Enregistrer un acompte sur salaire">
          <form action={requestSalaryAdvanceAction} className="form-stack">
            <input type="hidden" name="return_url" value="/acomptes" />
            <div className="field">
              <label htmlFor="employee_id">Salarié <span className="req">*</span></label>
              <select id="employee_id" name="employee_id" required>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.first_name} {e.last_name} (Salaire de base : {money(e.base_salary, cur)})
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="amount">Montant de l'acompte ({cur}) <span className="req">*</span></label>
              <input id="amount" name="amount" type="number" step="any" min="1000" placeholder="Ex: 50000" required />
            </div>

            <div className="form-grid">
              <div className="field">
                <label htmlFor="period_month">Mois de déduction</label>
                <select id="period_month" name="period_month" defaultValue={now.getUTCMonth() + 1}>
                  {MONTHS.map((m, idx) => (
                    <option key={idx + 1} value={idx + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="period_year">Année</label>
                <input id="period_year" name="period_year" type="number" defaultValue={now.getUTCFullYear()} />
              </div>
            </div>

            <div className="field">
              <label htmlFor="payment_method">Mode de versement</label>
              <select id="payment_method" name="payment_method" defaultValue="tmoney">
                {Object.entries(PAYMENT_METHODS).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="reason">Motif / Justification</label>
              <textarea id="reason" name="reason" rows="2" placeholder="Urgence familiale, frais médicaux..." />
            </div>

            <div className="actions" style={{ marginTop: '16px' }}>
              <button type="submit" className="button">Enregistrer l'acompte</button>
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
            <Icon name="cash" size={18} />
          </div>
          <div className="page-kpi-info">
            <span className="page-kpi-label">Total avances</span>
            <span className="page-kpi-value">{money(totalAdvancesAmount, cur)}</span>
            <span className="page-kpi-hint">{allAdvances.length} demandés</span>
          </div>
        </div>

        <div className="page-kpi-card" style={pendingAdvances.length > 0 ? { borderColor: '#fed7aa', background: '#fffaf0' } : {}}>
          <div className="page-kpi-icon" style={{ background: pendingAdvances.length > 0 ? '#ffedd5' : '#f1f5f9', color: pendingAdvances.length > 0 ? '#ea580c' : '#64748b' }}>
            <Icon name="clock" size={18} />
          </div>
          <div className="page-kpi-info">
            <span className="page-kpi-label">À régler</span>
            <span className="page-kpi-value" style={{ color: pendingAdvances.length > 0 ? '#ea580c' : 'var(--ink)' }}>
              {money(pendingAmount, cur)}
            </span>
            <span className="page-kpi-hint">
              {pendingAdvances.length} en attente
            </span>
          </div>
        </div>

        <div className="page-kpi-card">
          <div className="page-kpi-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
            <Icon name="check" size={18} />
          </div>
          <div className="page-kpi-info">
            <span className="page-kpi-label">Versés</span>
            <span className="page-kpi-value" style={{ color: '#059669' }}>{money(paidAmount, cur)}</span>
            <span className="page-kpi-hint">{paidAdvances.length} payé{paidAdvances.length > 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {/* Section avec onglets style PayFit */}
      <section className="doc-section">
        <div className="doc-filter-header">
          <nav className="doc-tabs-bar" aria-label="Filtrer les acomptes">
            {Object.entries(FILTERS).map(([k, f]) => {
              const count = allAdvances.filter(f.match).length;
              const isActive = k === filterKey;
              return (
                <Link
                  key={k}
                  href={`/acomptes${k === 'all' ? '' : `?filtre=${k}`}`}
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
                  <th>Salarié</th>
                  <th className="n">Montant Acompte</th>
                  <th>Mois concerné</th>
                  <th>Moyen de règlement</th>
                  <th>Statut</th>
                  <th className="n">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const initial = (a.first_name || 'A').charAt(0).toUpperCase();
                  return (
                    <tr key={a.id}>
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
                            <div style={{ fontWeight: 650, color: 'var(--ink)' }}>{a.first_name} {a.last_name}</div>
                            {a.reason && <span className="sub">"{a.reason}"</span>}
                          </div>
                        </div>
                      </td>
                      <td className="n" style={{ fontWeight: 750, fontSize: '15px' }}>
                        {money(a.amount, cur)}
                      </td>
                      <td>
                        <div style={{ fontWeight: 550 }}>{MONTHS[a.period_month - 1]} {a.period_year}</div>
                      </td>
                      <td>
                        <span className="doc-cat-tag" style={{ fontSize: '12px' }}>
                          {PAYMENT_METHODS[a.payment_method] || a.payment_method}
                        </span>
                        {a.payment_reference && <span className="sub" style={{ display: 'block', marginTop: '2px' }}>Réf : {a.payment_reference}</span>}
                      </td>
                      <td>
                        <span className={`status ${a.status === 'paye' ? 'paid' : a.status === 'approuve' ? 'check' : a.status === 'refuse' ? 'late' : 'wait'}`}>
                          {a.status === 'paye' ? 'Payé' : a.status === 'approuve' ? 'Approuvé' : a.status === 'refuse' ? 'Refusé' : 'En attente'}
                        </span>
                      </td>
                      <td className="n">
                        {a.status === 'en_attente' && (
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <form action={reviewSalaryAdvanceAction} style={{ display: 'inline' }}>
                              <input type="hidden" name="id" value={a.id} />
                              <input type="hidden" name="status" value="paye" />
                              <input type="hidden" name="payment_method" value={a.payment_method} />
                              <button type="submit" className="button small" title="Payer maintenant">
                                <Icon name="cash" size={14} /> Payer
                              </button>
                            </form>
                            <form action={reviewSalaryAdvanceAction} style={{ display: 'inline' }}>
                              <input type="hidden" name="id" value={a.id} />
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
              <Icon name="cash" size={32} />
            </div>
            <p style={{ fontWeight: 650, color: 'var(--ink)', margin: '0 0 4px' }}>Aucune demande d'acompte</p>
            <p className="sub" style={{ margin: 0 }}>Les demandes d'avances sur salaire de vos collaborateurs apparaîtront ici.</p>
          </div>
        )}
      </section>
    </ModuleLayout>
  );
}
