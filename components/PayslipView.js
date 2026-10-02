'use client';

import Link from 'next/link';
import { money } from '@/lib/money';
import { MONTHS, PAYMENT_METHODS } from '@/lib/rh-constants';
import { frDate } from '@/lib/dates';
import Icon from '@/components/Icon';
import Modal from '@/components/Modal';
import { markPayslipPaidAction } from '@/app/actions';

export default function PayslipView({ company, payslip }) {
  const cur = payslip.currency || company.currency || 'XOF';
  const monthName = MONTHS[payslip.period_month - 1];

  return (
    <div className="payslip-container">
      {/* Barre d'actions non imprimable */}
      <div className="actions no-print" style={{ marginBottom: '24px', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <Link href="/fiches-de-paie" className="button secondary">
          <Icon name="chevron" size={16} /> Retour à la liste
        </Link>
        <div style={{ display: 'inline-flex', gap: '10px' }}>
          <button type="button" className="button secondary" onClick={() => window.print()}>
            <Icon name="download" size={16} /> Imprimer / PDF
          </button>
          {payslip.status !== 'paye' && (
            <Modal label="Marquer comme payé" icon="check" title={`Payer le bulletin ${payslip.number}`}>
              <form action={markPayslipPaidAction} className="form-stack">
                <input type="hidden" name="id" value={payslip.id} />
                <p>Confirmer le règlement de <strong>{money(payslip.net_salary, cur)}</strong> à <strong>{payslip.first_name} {payslip.last_name}</strong>.</p>
                <div className="field">
                  <label htmlFor="payment_date">Date de règlement</label>
                  <input id="payment_date" name="payment_date" type="date" defaultValue={new Date().toISOString().split('T')[0]} required />
                </div>
                <div className="field">
                  <label htmlFor="payment_method">Moyen de paiement</label>
                  <select id="payment_method" name="payment_method" defaultValue={payslip.payment_method || 'bank'}>
                    {Object.entries(PAYMENT_METHODS).map(([k, label]) => (
                      <option key={k} value={k}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="payment_reference">N° de transaction / Référence</label>
                  <input id="payment_reference" name="payment_reference" type="text" placeholder="Ex: TMoney TXN987213..." />
                </div>
                <div className="actions" style={{ marginTop: '16px' }}>
                  <button type="submit" className="button">Confirmer le paiement</button>
                </div>
              </form>
            </Modal>
          )}
        </div>
      </div>

      {/* Le Bulletin Officiel */}
      <div className="payslip-paper card" style={{ padding: '36px', background: '#fff', color: '#111827', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
        {/* En-tête */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #111827', paddingBottom: '20px', marginBottom: '20px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 4px', color: '#111827' }}>{company.name}</h1>
            {company.address && <div style={{ fontSize: '13px', color: '#4B5563' }}>{company.address}</div>}
            {company.phone && <div style={{ fontSize: '13px', color: '#4B5563' }}>Tél : {company.phone}</div>}
            {company.email && <div style={{ fontSize: '13px', color: '#4B5563' }}>Email : {company.email}</div>}
            {company.legal_ids && <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '4px' }}>{company.legal_ids}</div>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ display: 'inline-block', background: '#111827', color: '#fff', padding: '6px 14px', borderRadius: '4px', fontWeight: 700, fontSize: '14px', letterSpacing: '0.05em' }}>
              BULLETIN DE PAIE
            </span>
            <div style={{ fontSize: '15px', fontWeight: 700, marginTop: '8px' }}>N° {payslip.number}</div>
            <div style={{ fontSize: '13px', color: '#4B5563' }}>Période : <strong>{monthName} {payslip.period_year}</strong></div>
            {payslip.issue_date && <div style={{ fontSize: '12px', color: '#6B7280' }}>Édité le : {frDate(payslip.issue_date)}</div>}
          </div>
        </div>

        {/* Bloc Salarié */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
          <div>
            <div style={{ fontSize: '12px', textTransform: 'uppercase', color: '#6B7280', fontWeight: 600 }}>Salarié</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>{payslip.first_name} {payslip.last_name}</div>
            <div style={{ fontSize: '13.5px', color: '#374151' }}>{payslip.job_title || 'Salarié'} {payslip.department ? `(${payslip.department})` : ''}</div>
          </div>
          <div>
            <div style={{ fontSize: '12px', textTransform: 'uppercase', color: '#6B7280', fontWeight: 600 }}>Identifiants & Contrat</div>
            <div style={{ fontSize: '13px', color: '#374151' }}>N° CNSS : <strong>{payslip.cnss_number || 'Non renseigné'}</strong></div>
            <div style={{ fontSize: '13px', color: '#374151' }}>Contrat : <strong>{payslip.contract_type}</strong> {payslip.category ? `· ${payslip.category}` : ''}</div>
            {payslip.hire_date && <div style={{ fontSize: '12px', color: '#6B7280' }}>Embauché le : {frDate(payslip.hire_date)}</div>}
          </div>
          <div>
            <div style={{ fontSize: '12px', textTransform: 'uppercase', color: '#6B7280', fontWeight: 600 }}>Règlement</div>
            <div style={{ fontSize: '13px', color: '#374151' }}>Mode : <strong>{PAYMENT_METHODS[payslip.payment_method] || payslip.payment_method}</strong></div>
            {payslip.payment_reference && <div style={{ fontSize: '12px', color: '#6B7280' }}>Réf : {payslip.payment_reference}</div>}
            {payslip.payment_date && <div style={{ fontSize: '12px', color: '#059669', fontWeight: 600 }}>Payé le : {frDate(payslip.payment_date)}</div>}
          </div>
        </div>

        {/* Tableau des Rubriques */}
        <div className="scroll" style={{ marginBottom: '24px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
            <thead>
              <tr style={{ background: '#F3F4F6', borderTop: '1px solid #D1D5DB', borderBottom: '2px solid #9CA3AF' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Rubrique</th>
                <th style={{ textAlign: 'right', padding: '10px 12px' }}>Base</th>
                <th style={{ textAlign: 'right', padding: '10px 12px' }}>Taux</th>
                <th style={{ textAlign: 'right', padding: '10px 12px' }}>Part Salariale</th>
                <th style={{ textAlign: 'right', padding: '10px 12px' }}>Part Patronale</th>
              </tr>
            </thead>
            <tbody>
              {/* Gains */}
              <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                <td style={{ padding: '8px 12px' }}>Salaire de base</td>
                <td style={{ textAlign: 'right', padding: '8px 12px' }}>{money(payslip.base_salary, cur)}</td>
                <td style={{ textAlign: 'right', padding: '8px 12px' }}>—</td>
                <td style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600 }}>{money(payslip.base_salary, cur)}</td>
                <td style={{ textAlign: 'right', padding: '8px 12px', color: '#6B7280' }}>—</td>
              </tr>
              {payslip.seniority_bonus > 0 && (
                <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <td style={{ padding: '8px 12px' }}>Prime d'ancienneté</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600 }}>{money(payslip.seniority_bonus, cur)}</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px', color: '#6B7280' }}>—</td>
                </tr>
              )}
              {payslip.transport_allowance > 0 && (
                <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <td style={{ padding: '8px 12px' }}>Indemnité de transport</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600 }}>{money(payslip.transport_allowance, cur)}</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px', color: '#6B7280' }}>—</td>
                </tr>
              )}
              {payslip.function_allowance > 0 && (
                <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <td style={{ padding: '8px 12px' }}>Prime de fonction / Responsabilité</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600 }}>{money(payslip.function_allowance, cur)}</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px', color: '#6B7280' }}>—</td>
                </tr>
              )}
              {payslip.overtime_amount > 0 && (
                <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <td style={{ padding: '8px 12px' }}>Heures supplémentaires</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600 }}>{money(payslip.overtime_amount, cur)}</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px', color: '#6B7280' }}>—</td>
                </tr>
              )}
              {payslip.other_allowances > 0 && (
                <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <td style={{ padding: '8px 12px' }}>Autres primes & gratifications</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 600 }}>{money(payslip.other_allowances, cur)}</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px', color: '#6B7280' }}>—</td>
                </tr>
              )}

              {/* Ligne Brut */}
              <tr style={{ background: '#F9FAFB', fontWeight: 700, borderTop: '2px solid #9CA3AF', borderBottom: '2px solid #9CA3AF' }}>
                <td style={{ padding: '10px 12px' }}>SALAIRE BRUT TOTAL</td>
                <td style={{ textAlign: 'right', padding: '10px 12px' }}>{money(payslip.gross_salary, cur)}</td>
                <td style={{ textAlign: 'right', padding: '10px 12px' }}>—</td>
                <td style={{ textAlign: 'right', padding: '10px 12px' }}>{money(payslip.gross_salary, cur)}</td>
                <td style={{ textAlign: 'right', padding: '10px 12px', color: '#6B7280' }}>—</td>
              </tr>

              {/* Déductions & Cotisations */}
              <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                <td style={{ padding: '8px 12px' }}>Cotisation CNSS (Sécurité Sociale)</td>
                <td style={{ textAlign: 'right', padding: '8px 12px' }}>{money(payslip.gross_salary, cur)}</td>
                <td style={{ textAlign: 'right', padding: '8px 12px' }}>{payslip.cnss_employee_rate}% / {payslip.cnss_employer_rate}%</td>
                <td style={{ textAlign: 'right', padding: '8px 12px', color: '#DC2626' }}>− {money(payslip.cnss_employee_amount, cur)}</td>
                <td style={{ textAlign: 'right', padding: '8px 12px', color: '#4B5563' }}>{money(payslip.cnss_employer_amount, cur)}</td>
              </tr>
              {payslip.tax_salary_amount > 0 && (
                <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <td style={{ padding: '8px 12px' }}>Impôt sur salaire (IRPP)</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px', color: '#DC2626' }}>− {money(payslip.tax_salary_amount, cur)}</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px', color: '#6B7280' }}>—</td>
                </tr>
              )}
              {payslip.salary_advances > 0 && (
                <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <td style={{ padding: '8px 12px' }}>Acomptes versés sur salaire</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px', color: '#DC2626' }}>− {money(payslip.salary_advances, cur)}</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px', color: '#6B7280' }}>—</td>
                </tr>
              )}
              {payslip.other_deductions > 0 && (
                <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                  <td style={{ padding: '8px 12px' }}>Autres retenues</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px', color: '#DC2626' }}>− {money(payslip.other_deductions, cur)}</td>
                  <td style={{ textAlign: 'right', padding: '8px 12px', color: '#6B7280' }}>—</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Bloc Résumé Net & Coût */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', alignItems: 'center', background: '#F3F4F6', border: '2px solid #111827', borderRadius: '8px', padding: '20px', marginBottom: '28px' }}>
          <div>
            <span style={{ fontSize: '13px', textTransform: 'uppercase', color: '#4B5563', fontWeight: 700 }}>NET À PAYER AU SALARIÉ</span>
            <div style={{ fontSize: '30px', fontWeight: 900, color: '#111827', letterSpacing: '-0.02em', marginTop: '4px' }}>
              {money(payslip.net_salary, cur)}
            </div>
            <div style={{ fontSize: '12.5px', color: '#4B5563', marginTop: '4px' }}>
              Règlement : <strong>{PAYMENT_METHODS[payslip.payment_method] || payslip.payment_method}</strong>
            </div>
          </div>
          <div style={{ borderLeft: '1px solid #D1D5DB', paddingLeft: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
              <span>Total Retenues Salariales :</span>
              <strong style={{ color: '#DC2626' }}>− {money(payslip.total_deductions, cur)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
              <span>Cotisation Patronale CNSS ({payslip.cnss_employer_rate}%) :</span>
              <strong>{money(payslip.cnss_employer_amount, cur)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px', fontWeight: 700, borderTop: '1px solid #D1D5DB', paddingTop: '6px' }}>
              <span>Coût Total Employeur :</span>
              <span>{money(payslip.total_employer_cost, cur)}</span>
            </div>
          </div>
        </div>

        {/* Mentions légales et Signatures */}
        <div style={{ borderTop: '1px dashed #D1D5DB', paddingTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div>
            <p style={{ fontSize: '11.5px', color: '#6B7280', margin: '0 0 20px', lineHeight: 1.4 }}>
              Pour faire valoir ce que de droit. Conserver ce bulletin de paie sans limitation de durée.
            </p>
            <div style={{ fontSize: '12px', fontWeight: 600 }}>Signature & Cachet Employeur :</div>
            <div style={{ height: '60px' }}></div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ height: '36px' }}></div>
            <div style={{ fontSize: '12px', fontWeight: 600 }}>Signature / Émargement du Salarié :</div>
            <div style={{ height: '60px' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}
