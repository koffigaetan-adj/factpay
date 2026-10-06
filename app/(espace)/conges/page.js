import Link from 'next/link';
import Flash from '@/components/Flash';
import Modal from '@/components/Modal';
import Icon from '@/components/Icon';
import ModuleLayout from '@/components/ModuleLayout';
import { requireCompany } from '@/lib/auth';
import { listLeaveRequests, LEAVE_TYPES } from '@/lib/leaves';
import { listEmployees, getRhNavCounts } from '@/lib/employees';
import { createLeaveRequestAction, reviewLeaveRequestAction } from '@/app/actions';
import { frDate } from '@/lib/dates';

export const metadata = { title: 'Congés & Absences' };

const FILTERS = {
  all: { label: 'Toutes', match: () => true },
  en_attente: { label: 'En attente', match: (r) => r.status === 'en_attente' },
  approuve: { label: 'Approuvés', match: (r) => r.status === 'approuve' },
  refuse: { label: 'Refusés', match: (r) => r.status === 'refuse' },
};

export default async function Page({ searchParams }) {
  const { company } = await requireCompany();
  const sp = await searchParams;
  const filterKey = FILTERS[sp.filtre] ? sp.filtre : 'all';

  const [allRequests, employees, rhCounts] = await Promise.all([
    listLeaveRequests(company.id),
    listEmployees(company.id, 'actif'),
    getRhNavCounts(company.id),
  ]);

  const filtered = allRequests.filter(FILTERS[filterKey].match);

  const pendingRequests = allRequests.filter((r) => r.status === 'en_attente');
  const approvedRequests = allRequests.filter((r) => r.status === 'approuve');
  const totalDays = allRequests.reduce((s, r) => s + (Number(r.days_count) || 0), 0);

  return (
    <ModuleLayout
      workspaceId="rh"
      title="Congés & absences"
      subtitle="Suivi des congés payés, permissions exceptionnelles et absences de l'équipe."
      actions={
        <Modal label="Poser une absence" icon="plus" title="Enregistrer une absence pour un salarié">
          <form action={createLeaveRequestAction} className="form-stack">
            <input type="hidden" name="return_url" value="/conges" />
            <div className="field">
              <label htmlFor="employee_id">Salarié <span className="req">*</span></label>
              <select id="employee_id" name="employee_id" required>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.first_name} {e.last_name} (Solde : {e.leave_balance} j)
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="type">Type d'absence</label>
              <select id="type" name="type" defaultValue="conge_paye">
                {Object.entries(LEAVE_TYPES).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </div>

            <div className="form-grid">
              <div className="field">
                <label htmlFor="start_date">Date de début <span className="req">*</span></label>
                <input id="start_date" name="start_date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} />
              </div>
              <div className="field">
                <label htmlFor="end_date">Date de fin <span className="req">*</span></label>
                <input id="end_date" name="end_date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} />
              </div>
            </div>

            <div className="field">
              <label htmlFor="days_count">Nombre de jours ouvrés <span className="req">*</span></label>
              <input id="days_count" name="days_count" type="number" step="0.5" min="0.5" defaultValue="1" required />
            </div>

            <div className="field">
              <label htmlFor="reason">Motif / Commentaire</label>
              <textarea id="reason" name="reason" rows={2} placeholder="Motif facultatif..." />
            </div>

            <div className="field">
              <label htmlFor="justificatif">Justificatif <span className="help">facultatif — PDF ou photo, 1 Mo max</span></label>
              <input id="justificatif" name="justificatif" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.txt" />
            </div>

            <div className="actions" style={{ marginTop: '16px' }}>
              <button type="submit" className="button">Enregistrer la demande</button>
            </div>
          </form>
        </Modal>
      }
      counts={rhCounts}
    >
      <Flash searchParams={searchParams} />

      {/* KPI Cards style PayFit compact */}
      <div className="page-kpi-grid">
        <div className={`page-kpi-card ${pendingRequests.length > 0 ? 'is-alert' : ''}`.trim()} data-tone={pendingRequests.length > 0 ? 'amber' : 'neutral'}>
          <div className="page-kpi-icon">
            <Icon name="clock" size={18} />
          </div>
          <div className="page-kpi-info">
            <span className="page-kpi-label">À valider</span>
            <span className="page-kpi-value" data-tint={pendingRequests.length > 0 ? 'true' : undefined}>
              {pendingRequests.length}
            </span>
            <span className="page-kpi-hint">
              {pendingRequests.length > 0 ? 'En attente' : 'À jour'}
            </span>
          </div>
        </div>

        <div className="page-kpi-card" data-tone="green">
          <div className="page-kpi-icon">
            <Icon name="check" size={18} />
          </div>
          <div className="page-kpi-info">
            <span className="page-kpi-label">Approuvés</span>
            <span className="page-kpi-value" data-tint>{approvedRequests.length}</span>
            <span className="page-kpi-hint">Validées</span>
          </div>
        </div>

        <div className="page-kpi-card" data-tone="sky">
          <div className="page-kpi-icon">
            <Icon name="calendar" size={18} />
          </div>
          <div className="page-kpi-info">
            <span className="page-kpi-label">Jours posés</span>
            <span className="page-kpi-value">{totalDays} j</span>
            <span className="page-kpi-hint">Volume cumulé</span>
          </div>
        </div>

        <div className="page-kpi-card" data-tone="violet">
          <div className="page-kpi-icon">
            <Icon name="people" size={18} />
          </div>
          <div className="page-kpi-info">
            <span className="page-kpi-label">Équipe</span>
            <span className="page-kpi-value">{employees.length}</span>
            <span className="page-kpi-hint">Salariés actifs</span>
          </div>
        </div>
      </div>

      {/* Section avec onglets style PayFit */}
      <section className="doc-section">
        <div className="doc-filter-header">
          <nav className="doc-tabs-bar" aria-label="Filtrer les congés">
            {Object.entries(FILTERS).map(([k, f]) => {
              const count = allRequests.filter(f.match).length;
              const isActive = k === filterKey;
              return (
                <Link
                  key={k}
                  href={`/conges${k === 'all' ? '' : `?filtre=${k}`}`}
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
                  <th>Type d'absence</th>
                  <th>Période</th>
                  <th className="n">Jours</th>
                  <th>Statut</th>
                  <th>Pièce</th>
                  <th className="n">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const initial = (r.first_name || 'S').charAt(0).toUpperCase();
                  return (
                    <tr key={r.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: 'color-mix(in srgb, var(--violet) 14%, var(--paper))',
                              color: 'var(--violet)',
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
                            <div style={{ fontWeight: 650, color: 'var(--ink)' }}>{r.first_name} {r.last_name}</div>
                            <span className="sub">{r.job_title || r.department || 'Salarié'}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 550 }}>{LEAVE_TYPES[r.type] || r.type}</div>
                        {r.reason && <span className="sub">"{r.reason}"</span>}
                      </td>
                      <td>
                        <div>Du {frDate(r.start_date)} au {frDate(r.end_date)}</div>
                      </td>
                      <td className="n" style={{ fontWeight: 750 }}>
                        {r.days_count} j
                      </td>
                      <td>
                        <span className={`status ${r.status === 'approuve' ? 'paid' : r.status === 'refuse' ? 'late' : 'wait'}`}>
                          {r.status === 'approuve' ? 'Approuvé' : r.status === 'refuse' ? 'Refusé' : 'En attente'}
                        </span>
                      </td>
                      <td>
                        {r.document_url ? (
                          <a className="button secondary small" href={`/rh/piece?type=conge&id=${r.id}`} target="_blank" rel="noreferrer">
                            <Icon name="file" size={14} /> Voir
                          </a>
                        ) : (
                          <span className="sub">—</span>
                        )}
                      </td>
                      <td className="n">
                        {r.status === 'en_attente' && (
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <form action={reviewLeaveRequestAction} style={{ display: 'inline' }}>
                              <input type="hidden" name="id" value={r.id} />
                              <input type="hidden" name="status" value="approuve" />
                              <button type="submit" className="button small" title="Approuver">
                                <Icon name="check" size={14} /> Valider
                              </button>
                            </form>
                            <form action={reviewLeaveRequestAction} style={{ display: 'inline' }}>
                              <input type="hidden" name="id" value={r.id} />
                              <input type="hidden" name="status" value="refuse" />
                              <button type="submit" className="button secondary small" title="Refuser">
                                <Icon name="close" size={14} /> Refuser
                              </button>
                            </form>
                          </div>
                        )}
                        {r.status !== 'en_attente' && r.review_note && (
                          <span className="sub">{r.review_note}</span>
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
              <Icon name="calendar" size={32} />
            </div>
            <p style={{ fontWeight: 650, color: 'var(--ink)', margin: '0 0 4px' }}>Aucune demande d'absence</p>
            <p className="sub" style={{ margin: 0 }}>Les demandes de congés ou permissions soumises apparaîtront ici.</p>
          </div>
        )}
      </section>
    </ModuleLayout>
  );
}
