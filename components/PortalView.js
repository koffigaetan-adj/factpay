'use client';

import { useState } from 'react';
import Link from 'next/link';
import { money } from '@/lib/money';
import { MONTHS, LEAVE_TYPES, EXPENSE_CATEGORIES, PAYMENT_METHODS } from '@/lib/rh-constants';
import { frDate } from '@/lib/dates';
import { getWorkCertificateText } from '@/lib/certificates';
import Icon from '@/components/Icon';
import OrgChartView from '@/components/OrgChartView';
import { portalLeaveRequestAction, portalAdvanceRequestAction, portalExpenseReportAction } from '@/app/actions';

export default function PortalView({ data, token, flash, expired = false, tokenDays = 90 }) {
  const { employee, payslips, leaves, advances, expenses, orgChart, announcements } = data;
  const [activeTab, setActiveTab] = useState('accueil');
  const cur = employee.currency || 'XOF';
  // L'attestation est rédigée au nom de l'entreprise : c'est elle l'employeur, pas le salarié.
  const cert = getWorkCertificateText(
    { name: employee.company_name, address: employee.company_address, legal_ids: employee.company_legal_ids },
    employee,
  );

  return (
    <div className="portal-layout" style={{ maxWidth: '1040px', margin: '0 auto', padding: '24px 16px 64px' }}>
      {expired && (
        <div className="card" style={{ padding: '16px 20px', marginBottom: '16px', borderLeft: '4px solid #D97706', background: 'color-mix(in srgb, #D97706 8%, var(--paper))' }}>
          <strong>Votre lien d'accès a expiré.</strong>{' '}
          <span className="sub">
            Pour votre sécurité, les liens d'accès au portail collaborateur sont valables {tokenDays} jours.
            Demandez-en un nouveau à votre service RH : il vous enverra un lien neuf par e-mail.
          </span>
        </div>
      )}

      {flash}

      {/* En-tête Salarié */}
      <header className="card" style={{ padding: '24px', marginBottom: '24px', background: 'linear-gradient(135deg, var(--sb-bg) 0%, color-mix(in srgb, var(--sb-bg) 85%, var(--brand)) 100%)', color: '#fff', border: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'var(--brand)',
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontSize: '22px',
                fontWeight: 800,
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              }}
            >
              {employee.first_name[0]}{employee.last_name[0]}
            </div>
            <div>
              <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.8 }}>Espace Collaborateur · {employee.company_name}</div>
              <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '2px 0 0', color: '#fff' }}>
                Bonjour {employee.first_name} !
              </h1>
              <div style={{ fontSize: '13.5px', opacity: 0.9 }}>
                {employee.job_title || 'Collaborateur'} {employee.department ? `· ${employee.department}` : ''} ({employee.contract_type})
              </div>
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.1)', padding: '12px 18px', borderRadius: '10px', backdropFilter: 'blur(8px)', textAlign: 'right' }}>
            <span style={{ fontSize: '12px', opacity: 0.8, display: 'block' }}>Solde de congés payés</span>
            <strong style={{ fontSize: '22px', color: '#6EE7B7' }}>{employee.leave_balance || 0} jours</strong>
          </div>
        </div>
      </header>

      {/* Navigation par onglets */}
      <nav className="tabs" style={{ marginBottom: '24px' }}>
        {[
          ['accueil', 'Accueil', 'dashboard'],
          ['bulletins', `Bulletins (${payslips.length})`, 'payslip'],
          ['conges', `Congés (${leaves.length})`, 'calendar'],
          ['finances', `Acomptes & Frais (${advances.length + expenses.length})`, 'cash'],
          ['attestation', 'Attestation de travail', 'file'],
          ['equipe', `L'Équipe (${orgChart.totalEmployees})`, 'people'],
        ].map(([key, label, icon]) => (
          <button
            key={key}
            type="button"
            className="tab-button"
            onClick={() => setActiveTab(key)}
            aria-current={activeTab === key ? 'page' : undefined}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
          >
            <Icon name={icon} size={16} />
            {label}
          </button>
        ))}
      </nav>

      {/* VUE 1 : ACCUEIL */}
      {activeTab === 'accueil' && (
        <div>
          {/* Annonces d'entreprise si existantes */}
          {announcements.length > 0 && (
            <div className="card" style={{ padding: '20px', marginBottom: '24px', borderLeft: '4px solid var(--brand)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Icon name="bell" size={18} />
                <strong style={{ fontSize: '16px' }}>{announcements[0].title}</strong>
              </div>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--ink)' }}>{announcements[0].content}</p>
            </div>
          )}

          {/* Raccourcis d'actions rapides */}
          <h2 style={{ fontSize: '17px', marginBottom: '14px' }}>Actions rapides</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '32px' }}>
            <button
              type="button"
              className="card"
              onClick={() => setActiveTab('conges')}
              style={{ padding: '20px', textAlign: 'left', cursor: 'pointer', border: '1px solid var(--line)', background: 'var(--paper)' }}
            >
              <div className="dash-card-icon" style={{ background: 'color-mix(in srgb, #059669 15%, transparent)', color: '#059669', marginBottom: '12px' }}>
                <Icon name="calendar" size={20} />
              </div>
              <strong style={{ display: 'block', fontSize: '15px' }}>Demander un congé</strong>
              <span className="sub">Solde restant : {employee.leave_balance} j</span>
            </button>

            <button
              type="button"
              className="card"
              onClick={() => setActiveTab('finances')}
              style={{ padding: '20px', textAlign: 'left', cursor: 'pointer', border: '1px solid var(--line)', background: 'var(--paper)' }}
            >
              <div className="dash-card-icon" style={{ background: 'color-mix(in srgb, #E0823D 15%, transparent)', color: '#E0823D', marginBottom: '12px' }}>
                <Icon name="cash" size={20} />
              </div>
              <strong style={{ display: 'block', fontSize: '15px' }}>Demander un acompte</strong>
              <span className="sub">Avance sur salaire du mois</span>
            </button>

            <button
              type="button"
              className="card"
              onClick={() => setActiveTab('finances')}
              style={{ padding: '20px', textAlign: 'left', cursor: 'pointer', border: '1px solid var(--line)', background: 'var(--paper)' }}
            >
              <div className="dash-card-icon" style={{ background: 'color-mix(in srgb, #2563EB 15%, transparent)', color: '#2563EB', marginBottom: '12px' }}>
                <Icon name="file" size={20} />
              </div>
              <strong style={{ display: 'block', fontSize: '15px' }}>Note de frais</strong>
              <span className="sub">Remboursement de dépenses</span>
            </button>

            <button
              type="button"
              className="card"
              onClick={() => setActiveTab('attestation')}
              style={{ padding: '20px', textAlign: 'left', cursor: 'pointer', border: '1px solid var(--line)', background: 'var(--paper)' }}
            >
              <div className="dash-card-icon" style={{ background: 'color-mix(in srgb, #7C3AED 15%, transparent)', color: '#7C3AED', marginBottom: '12px' }}>
                <Icon name="download" size={20} />
              </div>
              <strong style={{ display: 'block', fontSize: '15px' }}>Attestation de travail</strong>
              <span className="sub">Génération immédiate PDF</span>
            </button>
          </div>

          {/* Dernier bulletin reçu */}
          {payslips.length > 0 && (
            <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <h2 style={{ fontSize: '16px', margin: 0 }}>Dernier bulletin de paie</h2>
                  <span className="sub">{MONTHS[payslips[0].period_month - 1]} {payslips[0].period_year} · N° {payslips[0].number}</span>
                </div>
                <button type="button" className="button small" onClick={() => setActiveTab('bulletins')}>
                  Voir tous mes bulletins
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg)', padding: '16px', borderRadius: '8px' }}>
                <div>
                  <span className="sub">Net versé :</span>
                  <strong style={{ fontSize: '20px', color: 'var(--brand-text)' }}>{money(payslips[0].net_salary, cur)}</strong>
                </div>
                <div>
                  <span className={`status ${payslips[0].status === 'paye' ? 'paid' : 'wait'}`}>
                    {payslips[0].status === 'paye' ? 'Payé' : 'Validé'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VUE 2 : MES BULLETINS DE PAIE */}
      {activeTab === 'bulletins' && (
        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Mes Bulletins de paie ({payslips.length})</h2>
          {payslips.length ? (
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>N° Bulletin</th>
                    <th>Période</th>
                    <th className="n">Salaire Brut</th>
                    <th className="n">Retenues (CNSS/IRPP)</th>
                    <th className="n">Net Payé</th>
                    <th>Statut</th>
                    <th className="n">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payslips.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 700 }}>{p.number}</td>
                      <td>{MONTHS[p.period_month - 1]} {p.period_year}</td>
                      <td className="n">{money(p.gross_salary, cur)}</td>
                      <td className="n muted">− {money(p.total_deductions, cur)}</td>
                      <td className="n" style={{ fontWeight: 800, color: 'var(--brand-text)' }}>
                        {money(p.net_salary, cur)}
                      </td>
                      <td>
                        <span className={`status ${p.status === 'paye' ? 'paid' : 'wait'}`}>
                          {p.status === 'paye' ? 'Payé' : 'En attente'}
                        </span>
                      </td>
                      <td className="n">
                        <Link href={`/fiches-de-paie/${p.id}`} className="button secondary small" target="_blank">
                          <Icon name="download" size={14} /> Voir / Imprimer
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty">Aucun bulletin de paie disponible pour le moment.</p>
          )}
        </div>
      )}

      {/* VUE 3 : MES CONGÉS & ABSENCES */}
      {activeTab === 'conges' && (
        <div>
          <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Nouvelle demande de congé ou d'absence</h2>
            <form action={portalLeaveRequestAction} className="form-stack">
              <input type="hidden" name="portal_token" value={token} />

              <div className="field">
                <label htmlFor="p_type">Type d'absence</label>
                <select id="p_type" name="type" defaultValue="conge_paye">
                  {Object.entries(LEAVE_TYPES).map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="form-grid">
                <div className="field">
                  <label htmlFor="p_start">Date de début</label>
                  <input id="p_start" name="start_date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} />
                </div>
                <div className="field">
                  <label htmlFor="p_end">Date de fin</label>
                  <input id="p_end" name="end_date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} />
                </div>
              </div>

              <div className="field">
                <label htmlFor="p_days">Nombre de jours ouvrés</label>
                <input id="p_days" name="days_count" type="number" step="0.5" min="0.5" defaultValue="1" required />
              </div>

<div className="field">
                <label htmlFor="p_reason">Motif / Commentaire</label>
                <textarea id="p_reason" name="reason" rows={2} placeholder="Précisez votre demande..." />
              </div>

              <div className="field">
                <label htmlFor="p_doc">Justificatif <span className="help">facultatif — certificat médical, convocation…</span></label>
                <input id="p_doc" name="justificatif" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.txt" />
              </div>

              <div className="actions" style={{ marginTop: '16px' }}>
                <button type="submit" className="button">Soumettre ma demande</button>
              </div>
            </form>
          </div>

          <div className="card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Historique de mes demandes ({leaves.length})</h2>
            {leaves.length ? (
              <div className="scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Période</th>
                      <th className="n">Jours</th>
                      <th>Motif</th>
                      <th>Statut</th>
                      <th>Pièce</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaves.map((l) => (
                      <tr key={l.id}>
                        <td style={{ fontWeight: 600 }}>{LEAVE_TYPES[l.type] || l.type}</td>
                        <td>Du {frDate(l.start_date)} au {frDate(l.end_date)}</td>
                        <td className="n" style={{ fontWeight: 700 }}>{l.days_count} j</td>
                        <td>{l.reason || '—'}</td>
                        <td>
                          <span className={`status ${l.status === 'approuve' ? 'paid' : l.status === 'refuse' ? 'late' : 'wait'}`}>
                            {l.status === 'approuve' ? 'Approuvé' : l.status === 'refuse' ? 'Refusé' : 'En attente'}
                          </span>
                        </td>
                        <td>
                          {l.document_url
                            ? <a href={`/portail/${token}/piece?type=conge&id=${l.id}`} target="_blank" rel="noreferrer" className="button secondary small">Voir</a>
                            : <span className="sub">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty">Aucune demande enregistrée.</p>
            )}
          </div>
        </div>
      )}

      {/* VUE 4 : ACOMPTES & NOTES DE FRAIS */}
      {activeTab === 'finances' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          {/* Acomptes */}
          <div className="card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '17px', marginBottom: '14px' }}>Demande d'acompte sur salaire</h2>
            <form action={portalAdvanceRequestAction} className="form-stack" style={{ marginBottom: '24px' }}>
              <input type="hidden" name="portal_token" value={token} />
              <div className="field">
                <label htmlFor="adv_amt">Montant souhaité ({cur})</label>
                <input id="adv_amt" name="amount" type="number" step="any" min="1000" placeholder="Ex: 50000" required />
              </div>
              <div className="field">
                <label htmlFor="adv_method">Mode de versement préféré</label>
                <select id="adv_method" name="payment_method" defaultValue={employee.payment_method || 'tmoney'}>
                  {Object.entries(PAYMENT_METHODS).map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="adv_reason">Motif de l'avance</label>
                <input id="adv_reason" name="reason" type="text" placeholder="Urgence, frais imprévus..." />
              </div>
              <button type="submit" className="button small">Envoyer la demande</button>
            </form>

            <h3 style={{ fontSize: '14px', borderTop: '1px solid var(--line)', paddingTop: '16px' }}>Historique acomptes ({advances.length})</h3>
            {advances.map((a) => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--line)', fontSize: '13px' }}>
                <div>
                  <strong>{money(a.amount, cur)}</strong> ({MONTHS[a.period_month - 1]} {a.period_year})
                  {a.reason && <div className="sub">"{a.reason}"</div>}
                </div>
                <span className={`status ${a.status === 'paye' ? 'paid' : a.status === 'refuse' ? 'late' : 'wait'}`}>
                  {a.status === 'paye' ? 'Versé' : a.status === 'refuse' ? 'Refusé' : 'En attente'}
                </span>
              </div>
            ))}
          </div>

          {/* Notes de frais */}
          <div className="card" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '17px', marginBottom: '14px' }}>Déposer une note de frais</h2>
            <form action={portalExpenseReportAction} className="form-stack" style={{ marginBottom: '24px' }}>
              <input type="hidden" name="portal_token" value={token} />
              <div className="field">
                <label htmlFor="exp_title">Objet de la dépense</label>
                <input id="exp_title" name="title" type="text" placeholder="Ex: Déplacement taxi Lomé" required />
              </div>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="exp_amt">Montant ({cur})</label>
                  <input id="exp_amt" name="amount" type="number" min="100" placeholder="Ex: 10000" required />
                </div>
                <div className="field">
                  <label htmlFor="exp_cat">Catégorie</label>
                  <select id="exp_cat" name="category" defaultValue="transport">
                    {Object.entries(EXPENSE_CATEGORIES).map(([k, label]) => (
                      <option key={k} value={k}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="field">
                <label htmlFor="exp_date">Date de la dépense</label>
                <input id="exp_date" name="expense_date" type="date" defaultValue={new Date().toISOString().split('T')[0]} />
              </div>

              <div className="field">
                <label htmlFor="exp_doc">Reçu / facture <span className="help">facultatif mais recommandé — photo du ticket, 1 Mo max</span></label>
                <input id="exp_doc" name="recu" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.txt" />
              </div>
              <button type="submit" className="button small">Envoyer la note</button>
            </form>

            <h3 style={{ fontSize: '14px', borderTop: '1px solid var(--line)', paddingTop: '16px' }}>Historique dépenses ({expenses.length})</h3>
            {expenses.map((e) => (
              <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid var(--line)', fontSize: '13px' }}>
                <div>
                  <strong>{money(e.amount, cur)}</strong> · {e.title}
                  <div className="sub">{EXPENSE_CATEGORIES[e.category] || e.category}</div>
                  {e.receipt_url && (
                    <a href={`/portail/${token}/piece?type=frais&id=${e.id}`} target="_blank" rel="noreferrer" className="sub" style={{ textDecoration: 'underline' }}>
                      Voir le reçu
                    </a>
                  )}
                </div>
                <span className={`status ${e.status === 'rembourse' ? 'paid' : e.status === 'refuse' ? 'late' : 'wait'}`}>
                  {e.status === 'rembourse' ? 'Remboursé' : e.status === 'refuse' ? 'Refusé' : 'En attente'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VUE 5 : ATTESTATION DE TRAVAIL */}
      {activeTab === 'attestation' && (
        <div>
          <div className="no-print actions" style={{ marginBottom: '16px', justifyContent: 'flex-end' }}>
            <button type="button" className="button" onClick={() => window.print()}>
              <Icon name="download" size={16} /> Imprimer mon attestation (PDF)
            </button>
          </div>

          <div className="card payslip-paper" style={{ padding: '48px', background: '#fff', color: '#111827', lineHeight: 1.8 }}>
            <div style={{ textAlign: 'center', marginBottom: '36px', borderBottom: '2px solid #111827', paddingBottom: '20px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 900, margin: '0 0 6px', letterSpacing: '0.05em' }}>{cert.title}</h2>
              <div style={{ fontSize: '14px', color: '#4B5563' }}>{employee.company_name} · {employee.company_address || 'Lomé, Togo'}</div>
              {employee.company_legal_ids && <div style={{ fontSize: '13px', fontWeight: 600 }}>{employee.company_legal_ids}</div>}
            </div>

            <p style={{ fontSize: '15px', marginBottom: '24px' }}>
              {cert.statement}
            </p>

            <p style={{ fontSize: '15px', marginBottom: '40px' }}>
              {cert.closing}
            </p>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '60px' }}>
              <div style={{ fontSize: '13px', color: '#6B7280' }}>
                Document officiel généré par le portail RH FactPay.
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '60px' }}>{cert.dateText}</div>
                <div style={{ fontSize: '14px', fontWeight: 800 }}>La Direction Générale</div>
                <div style={{ fontSize: '12px', color: '#6B7280' }}>[Signature & Cachet]</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VUE 6 : L'ÉQUIPE & ORGANIGRAMME */}
      {activeTab === 'equipe' && (
        <div>
          <OrgChartView orgChart={orgChart} isPortal portalToken={token} />
        </div>
      )}
    </div>
  );
}
