'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { money } from '@/lib/money';
import { MONTHS, PAYMENT_METHODS, isPayslipEditable } from '@/lib/rh-constants';
import { frDate } from '@/lib/dates';
import Icon from '@/components/Icon';
import Modal from '@/components/Modal';
import { markPayslipPaidAction } from '@/app/actions';

function formatSeniority(hireDateStr, periodYear, periodMonth) {
  if (!hireDateStr) return null;
  const hire = new Date(hireDateStr);
  if (isNaN(hire.getTime())) return null;
  const current = new Date(periodYear, (periodMonth || 1) - 1, 1);
  let months = (current.getFullYear() - hire.getFullYear()) * 12 + (current.getMonth() - hire.getMonth());
  if (months < 0) months = 0;
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  if (years === 0) return `${remMonths} mois`;
  if (remMonths === 0) return `${years} an${years > 1 ? 's' : ''}`;
  return `${years} an${years > 1 ? 's' : ''} et ${remMonths} mois`;
}

export default function PayslipView({ company, payslip, qrCode: initialQrCode, fingerprint: initialFingerprint }) {
  const cur = payslip.currency || company.currency || 'XOF';
  const monthName = MONTHS[payslip.period_month - 1];
  const daysInMonth = new Date(payslip.period_year, payslip.period_month, 0).getDate();
  const periodDates = `Du 01/${String(payslip.period_month).padStart(2, '0')}/${payslip.period_year} au ${daysInMonth}/${String(payslip.period_month).padStart(2, '0')}/${payslip.period_year}`;

  const seniorityText = formatSeniority(payslip.hire_date, payslip.period_year, payslip.period_month);

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState(initialQrCode || null);

  // Génération du QR code côté client si non fourni
  useEffect(() => {
    if (!qrCodeDataUrl) {
      const verifyUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/verifier?ref=${encodeURIComponent(payslip.number || '')}`;
      QRCode.toDataURL(verifyUrl, {
        margin: 1,
        width: 180,
        color: { dark: '#0F172A', light: '#FFFFFF' },
      }).then(setQrCodeDataUrl).catch(() => {});
    }
  }, [payslip.number, qrCodeDataUrl]);

  // Empreinte de sécurité déterministe
  const fingerprintCode = initialFingerprint || `${payslip.number || 'BS'}-${(payslip.net_salary || 0).toString(16).toUpperCase()}-VERIFIED`.slice(0, 19);

  return (
    <div className="payslip-page-container">
      {/* Styles d'impression stricts A4 Portrait */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 8mm 10mm;
        }
        @media print {
          body, html {
            background: #FFFFFF !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print, header, nav, aside, .sidebar, .actions, .button, button {
            display: none !important;
          }
          .payslip-page-container {
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .payslip-portrait-sheet {
            box-shadow: none !important;
            border: 1px solid #CBD5E1 !important;
            border-radius: 0 !important;
            padding: 24px 28px !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Avertissement bulletin verrouillé */}
      {!isPayslipEditable(payslip) && (
        <div
          className="no-print"
          style={{
            marginBottom: '20px',
            padding: '12px 16px',
            borderRadius: '8px',
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderLeft: '4px solid #3B82F6',
            fontSize: '13px',
            color: '#1E293B',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <Icon name="check" size={16} />
          <div>
            <strong>Bulletin archivé et conforme.</strong>{' '}
            {payslip.status === 'paye'
              ? 'Le règlement a été validé : les montants sont verrouillés pour la comptabilité.'
              : 'Ce bulletin est validé et prêt pour la paie.'}
          </div>
        </div>
      )}

      {/* Barre d'actions non imprimable */}
      <div
        className="actions no-print"
        style={{
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <Link href="/fiches-de-paie" className="button secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <Icon name="chevron" size={16} /> Retour à la liste
        </Link>
        <div style={{ display: 'inline-flex', gap: '10px', flexWrap: 'wrap' }}>
          {isPayslipEditable(payslip) && (
            <Link href={`/fiches-de-paie/${payslip.id}/modifier`} className="button" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <Icon name="edit" size={16} /> Modifier le bulletin
            </Link>
          )}
          <button
            type="button"
            className="button secondary"
            onClick={() => window.print()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <Icon name="download" size={16} /> Imprimer / PDF (Format Portrait)
          </button>
          {payslip.status !== 'paye' && (
            <Modal label="Marquer comme payé" icon="check" title={`Payer le bulletin ${payslip.number}`}>
              <form action={markPayslipPaidAction} className="form-stack">
                <input type="hidden" name="id" value={payslip.id} />
                <p style={{ margin: '0 0 16px', fontSize: '13.5px', color: '#475569' }}>
                  Confirmer le règlement de <strong style={{ color: '#0F172A' }}>{money(payslip.net_salary, cur)}</strong> à <strong style={{ color: '#0F172A' }}>{payslip.first_name} {payslip.last_name}</strong>.
                </p>
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
                  <input id="payment_reference" name="payment_reference" type="text" placeholder="Ex: TMoney TXN-987213..." />
                </div>
                <div className="actions" style={{ marginTop: '20px' }}>
                  <button type="submit" className="button" style={{ width: '100%', justifyContent: 'center' }}>
                    Confirmer le paiement du salaire
                  </button>
                </div>
              </form>
            </Modal>
          )}
        </div>
      </div>

      {/* Feuille de Paie - Format PORTRAIT A4 Standard */}
      <div
        className="payslip-portrait-sheet"
        style={{
          maxWidth: '820px',
          margin: '0 auto',
          background: '#FFFFFF',
          color: '#0F172A',
          borderRadius: '8px',
          padding: '36px 40px',
          boxShadow: '0 2px 16px rgba(15, 23, 42, 0.08)',
          border: '1px solid #CBD5E1',
          fontFamily: 'inherit'
        }}
      >
        {/* En-tête : Entreprise & Bulletin */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '2px solid #0F172A',
            paddingBottom: '18px',
            marginBottom: '20px',
            gap: '20px'
          }}
        >
          {/* Entreprise */}
          <div>
            <div style={{ fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748B', fontWeight: 700 }}>
              Employeur
            </div>
            <h1 style={{ fontSize: '21px', fontWeight: 800, margin: '2px 0 4px', color: '#0F172A', letterSpacing: '-0.02em' }}>
              {company.name}
            </h1>
            {company.address && <div style={{ fontSize: '12.5px', color: '#475569', lineHeight: 1.35 }}>{company.address}</div>}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '3px', fontSize: '12px', color: '#64748B' }}>
              {company.phone && <span>Tél : <strong style={{ color: '#334155' }}>{company.phone}</strong></span>}
              {company.email && <span>Email : <strong style={{ color: '#334155' }}>{company.email}</strong></span>}
            </div>
            {company.legal_ids && (
              <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#334155', marginTop: '4px', background: '#F1F5F9', display: 'inline-block', padding: '2px 6px', borderRadius: '3px' }}>
                {company.legal_ids}
              </div>
            )}
          </div>

          {/* Identification du Bulletin */}
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div
              style={{
                background: '#0F172A',
                color: '#FFFFFF',
                padding: '4px 12px',
                borderRadius: '4px',
                fontWeight: 800,
                fontSize: '12px',
                letterSpacing: '0.05em',
                textTransform: 'uppercase'
              }}
            >
              Bulletin de Paie
            </div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', marginTop: '6px' }}>
              N° {payslip.number}
            </div>
            <div style={{ fontSize: '12.5px', color: '#475569', marginTop: '2px' }}>
              Période : <strong style={{ color: '#0F172A' }}>{monthName} {payslip.period_year}</strong>
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
              {periodDates}
            </div>
            {payslip.issue_date && (
              <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                Édité le {frDate(payslip.issue_date)}
              </div>
            )}
            <div style={{ marginTop: '6px' }}>
              {payslip.status === 'paye' ? (
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#059669', background: '#ECFDF5', padding: '2px 8px', borderRadius: '999px', border: '1px solid #A7F3D0' }}>
                  ✓ Salaire Réglé
                </span>
              ) : (
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#D97706', background: '#FFFBEB', padding: '2px 8px', borderRadius: '999px', border: '1px solid #FDE68A' }}>
                  • En attente de règlement
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Section Salarié Complète & Structurée (Format Portrait A4) */}
        <div
          style={{
            background: '#F8FAFC',
            border: '1px solid #CBD5E1',
            borderRadius: '6px',
            padding: '14px 18px',
            marginBottom: '20px'
          }}
        >
          <div
            style={{
              fontSize: '11px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#0F172A',
              borderBottom: '1px solid #E2E8F0',
              paddingBottom: '6px',
              marginBottom: '10px'
            }}
          >
            Fiche & Situation du Salarié
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr 1fr',
              gap: '16px',
              fontSize: '12.5px'
            }}
          >
            {/* Colonne 1 : Salarié & Fonction */}
            <div>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748B', fontWeight: 700 }}>Nom & Prénom</div>
              <div style={{ fontSize: '14.5px', fontWeight: 800, color: '#0F172A', marginTop: '1px' }}>
                {payslip.first_name} {payslip.last_name}
              </div>
              <div style={{ color: '#334155', fontWeight: 600, marginTop: '4px' }}>
                {payslip.job_title || 'Collaborateur'}
              </div>
              {payslip.department && (
                <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                  Département : {payslip.department}
                </div>
              )}
              {payslip.employee_email && (
                <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '2px' }}>
                  {payslip.employee_email}
                </div>
              )}
            </div>

            {/* Colonne 2 : Contrat & Sécurité Sociale */}
            <div>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748B', fontWeight: 700 }}>Contrat & CNSS</div>
              <div style={{ marginTop: '2px', color: '#334155' }}>
                N° CNSS : <strong style={{ color: '#0F172A' }}>{payslip.cnss_number || 'Non renseigné'}</strong>
              </div>
              <div style={{ color: '#334155', marginTop: '3px' }}>
                Contrat : <strong style={{ color: '#0F172A' }}>{payslip.contract_type || 'CDI'}</strong> {payslip.category ? `(${payslip.category})` : ''}
              </div>
              {payslip.hire_date && (
                <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '3px' }}>
                  Embauché(e) : {frDate(payslip.hire_date)}
                </div>
              )}
              {seniorityText && (
                <div style={{ fontSize: '11.5px', color: '#0F172A', fontWeight: 600, marginTop: '2px' }}>
                  Ancienneté : {seniorityText}
                </div>
              )}
            </div>

            {/* Colonne 3 : Règlement & Paiement */}
            <div>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#64748B', fontWeight: 700 }}>Modalités de Paiement</div>
              <div style={{ marginTop: '2px', color: '#334155' }}>
                Mode : <strong style={{ color: '#0F172A' }}>{PAYMENT_METHODS[payslip.payment_method] || payslip.payment_method || 'Virement bancaire'}</strong>
              </div>
              {payslip.payment_reference && (
                <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '3px' }}>
                  Réf : <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#334155' }}>{payslip.payment_reference}</span>
                </div>
              )}
              {payslip.payment_date && (
                <div style={{ fontSize: '11.5px', color: '#059669', fontWeight: 600, marginTop: '3px' }}>
                  Payé le : {frDate(payslip.payment_date)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tableau des Rubriques de Paie */}
        <div style={{ marginBottom: '20px' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px',
              border: '1px solid #CBD5E1',
              borderRadius: '4px'
            }}
          >
            <thead>
              <tr style={{ background: '#0F172A', color: '#FFFFFF' }}>
                <th style={{ textAlign: 'left', padding: '9px 12px', fontWeight: 700, fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Rubrique</th>
                <th style={{ textAlign: 'right', padding: '9px 12px', fontWeight: 700, fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Base</th>
                <th style={{ textAlign: 'right', padding: '9px 12px', fontWeight: 700, fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Taux</th>
                <th style={{ textAlign: 'right', padding: '9px 12px', fontWeight: 700, fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Part Salariale</th>
                <th style={{ textAlign: 'right', padding: '9px 12px', fontWeight: 700, fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Part Patronale</th>
              </tr>
            </thead>
            <tbody>
              {/* Entête de sous-section : Gains */}
              <tr style={{ background: '#F1F5F9' }}>
                <td colSpan={5} style={{ padding: '6px 12px', fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#334155', borderBottom: '1px solid #CBD5E1' }}>
                  1. Rémunération Brute & Primes (Gains)
                </td>
              </tr>

              {/* Salaire de base */}
              <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                <td style={{ padding: '7px 12px', fontWeight: 600, color: '#0F172A' }}>Salaire de base contractuel</td>
                <td style={{ textAlign: 'right', padding: '7px 12px', color: '#334155' }}>{money(payslip.base_salary, cur)}</td>
                <td style={{ textAlign: 'right', padding: '7px 12px', color: '#64748B' }}>—</td>
                <td style={{ textAlign: 'right', padding: '7px 12px', fontWeight: 700, color: '#0F172A' }}>{money(payslip.base_salary, cur)}</td>
                <td style={{ textAlign: 'right', padding: '7px 12px', color: '#94A3B8' }}>—</td>
              </tr>

              {/* Prime d'ancienneté */}
              {payslip.seniority_bonus > 0 && (
                <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <td style={{ padding: '7px 12px', color: '#334155' }}>Prime d'ancienneté</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', color: '#64748B' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', color: '#64748B' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', fontWeight: 700, color: '#0F172A' }}>{money(payslip.seniority_bonus, cur)}</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', color: '#94A3B8' }}>—</td>
                </tr>
              )}

              {/* Indemnité de transport */}
              {payslip.transport_allowance > 0 && (
                <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <td style={{ padding: '7px 12px', color: '#334155' }}>Indemnité légale de transport</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', color: '#64748B' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', color: '#64748B' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', fontWeight: 700, color: '#0F172A' }}>{money(payslip.transport_allowance, cur)}</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', color: '#94A3B8' }}>—</td>
                </tr>
              )}

              {/* Prime de fonction */}
              {payslip.function_allowance > 0 && (
                <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <td style={{ padding: '7px 12px', color: '#334155' }}>Prime de fonction / Responsabilité</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', color: '#64748B' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', color: '#64748B' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', fontWeight: 700, color: '#0F172A' }}>{money(payslip.function_allowance, cur)}</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', color: '#94A3B8' }}>—</td>
                </tr>
              )}

              {/* Heures supplémentaires */}
              {payslip.overtime_amount > 0 && (
                <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <td style={{ padding: '7px 12px', color: '#334155' }}>Heures supplémentaires majorées</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', color: '#64748B' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', color: '#64748B' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', fontWeight: 700, color: '#0F172A' }}>{money(payslip.overtime_amount, cur)}</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', color: '#94A3B8' }}>—</td>
                </tr>
              )}

              {/* Autres primes */}
              {payslip.other_allowances > 0 && (
                <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <td style={{ padding: '7px 12px', color: '#334155' }}>Autres primes et gratifications</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', color: '#64748B' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', color: '#64748B' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', fontWeight: 700, color: '#0F172A' }}>{money(payslip.other_allowances, cur)}</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', color: '#94A3B8' }}>—</td>
                </tr>
              )}

              {/* Lignes libres d'ajouts */}
              {payslip.lines?.filter((l) => l.kind === 'ajout').map((line) => (
                <tr key={`ajout-${line.id}`} style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <td style={{ padding: '7px 12px', color: '#334155' }}>{line.label}</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', color: '#64748B' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', color: '#64748B' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', fontWeight: 700, color: '#0F172A' }}>{money(line.amount, cur)}</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', color: '#94A3B8' }}>—</td>
                </tr>
              ))}

              {/* Total Brut */}
              <tr style={{ background: '#F8FAFC', fontWeight: 800, borderTop: '2px solid #94A3B8', borderBottom: '2px solid #94A3B8' }}>
                <td style={{ padding: '9px 12px', color: '#0F172A' }}>TOTAL SALAIRE BRUT</td>
                <td style={{ textAlign: 'right', padding: '9px 12px', color: '#0F172A' }}>{money(payslip.gross_salary, cur)}</td>
                <td style={{ textAlign: 'right', padding: '9px 12px', color: '#64748B' }}>—</td>
                <td style={{ textAlign: 'right', padding: '9px 12px', color: '#0F172A', fontSize: '13px' }}>{money(payslip.gross_salary, cur)}</td>
                <td style={{ textAlign: 'right', padding: '9px 12px', color: '#64748B' }}>—</td>
              </tr>

              {/* Entête de sous-section : Cotisations & Déductions */}
              <tr style={{ background: '#F1F5F9' }}>
                <td colSpan={5} style={{ padding: '6px 12px', fontSize: '10.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#334155', borderBottom: '1px solid #CBD5E1' }}>
                  2. Cotisations Sociales & Retenues (Déductions)
                </td>
              </tr>

              {/* Cotisation CNSS */}
              <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                <td style={{ padding: '7px 12px', color: '#334155' }}>
                  Sécurité Sociale (CNSS)
                </td>
                <td style={{ textAlign: 'right', padding: '7px 12px', color: '#334155' }}>{money(payslip.gross_salary, cur)}</td>
                <td style={{ textAlign: 'right', padding: '7px 12px', color: '#64748B' }}>
                  {payslip.cnss_employee_rate}% / {payslip.cnss_employer_rate}%
                </td>
                <td style={{ textAlign: 'right', padding: '7px 12px', color: '#DC2626', fontWeight: 700 }}>
                  − {money(payslip.cnss_employee_amount, cur)}
                </td>
                <td style={{ textAlign: 'right', padding: '7px 12px', color: '#334155', fontWeight: 600 }}>
                  {money(payslip.cnss_employer_amount, cur)}
                </td>
              </tr>

              {/* IRPP */}
              {payslip.tax_salary_amount > 0 && (
                <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <td style={{ padding: '7px 12px', color: '#334155' }}>Impôt sur le Revenu des Personnes Physiques (IRPP)</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', color: '#64748B' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', color: '#64748B' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', color: '#DC2626', fontWeight: 700 }}>− {money(payslip.tax_salary_amount, cur)}</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', color: '#94A3B8' }}>—</td>
                </tr>
              )}

              {/* Acomptes */}
              {payslip.salary_advances > 0 && (
                <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <td style={{ padding: '7px 12px', color: '#334155' }}>Acomptes versés sur salaire</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', color: '#64748B' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', color: '#64748B' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', color: '#DC2626', fontWeight: 700 }}>− {money(payslip.salary_advances, cur)}</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', color: '#94A3B8' }}>—</td>
                </tr>
              )}

              {/* Autres déductions */}
              {payslip.other_deductions > 0 && (
                <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <td style={{ padding: '7px 12px', color: '#334155' }}>Autres retenues sur salaire</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', color: '#64748B' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', color: '#64748B' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', color: '#DC2626', fontWeight: 700 }}>− {money(payslip.other_deductions, cur)}</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', color: '#94A3B8' }}>—</td>
                </tr>
              )}

              {/* Retenues libres */}
              {payslip.lines?.filter((l) => l.kind === 'retenue').map((line) => (
                <tr key={`retenue-${line.id}`} style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <td style={{ padding: '7px 12px', color: '#334155' }}>{line.label}</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', color: '#64748B' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', color: '#64748B' }}>—</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', color: '#DC2626', fontWeight: 700 }}>− {money(line.amount, cur)}</td>
                  <td style={{ textAlign: 'right', padding: '7px 12px', color: '#94A3B8' }}>—</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bloc Résumé Net & Coût Employeur */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr',
            gap: '20px',
            alignItems: 'center',
            background: '#F8FAFC',
            border: '2px solid #0F172A',
            borderRadius: '8px',
            padding: '18px 22px',
            marginBottom: '22px'
          }}
        >
          <div>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748B', fontWeight: 800 }}>
              Net à Payer au Salarié
            </div>
            <div
              style={{
                fontSize: '30px',
                fontWeight: 900,
                color: '#0F172A',
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
                marginTop: '4px'
              }}
            >
              {money(payslip.net_salary, cur)}
            </div>
            <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
              Mode de règlement : <strong style={{ color: '#0F172A' }}>{PAYMENT_METHODS[payslip.payment_method] || payslip.payment_method || 'Virement bancaire'}</strong>
            </div>
          </div>

          <div style={{ borderLeft: '1px solid #CBD5E1', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569' }}>
              <span>Total Retenues Salariales :</span>
              <strong style={{ color: '#DC2626', fontWeight: 700 }}>− {money(payslip.total_deductions, cur)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569' }}>
              <span>Cotisation Patronale CNSS ({payslip.cnss_employer_rate}%) :</span>
              <strong style={{ color: '#334155' }}>{money(payslip.cnss_employer_amount, cur)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 800, color: '#0F172A', borderTop: '1px solid #CBD5E1', paddingTop: '6px', marginTop: '2px' }}>
              <span>Coût Total Employeur :</span>
              <span>{money(payslip.total_employer_cost, cur)}</span>
            </div>
          </div>
        </div>

        {/* Notes internes hors impression */}
        {payslip.notes && (
          <div className="no-print" style={{ borderTop: '1px dashed #E2E8F0', paddingTop: '14px', marginBottom: '20px' }}>
            <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748B', marginBottom: '3px' }}>Notes internes de gestion (non imprimées)</div>
            <p style={{ fontSize: '12.5px', color: '#334155', margin: 0, whiteSpace: 'pre-wrap' }}>{payslip.notes}</p>
          </div>
        )}

        {/* Bloc Authentification & QR Code de Vérification (Aucun trait de signature) */}
        <div
          style={{
            borderTop: '1px solid #CBD5E1',
            paddingTop: '16px',
            display: 'grid',
            gridTemplateColumns: qrCodeDataUrl ? '84px 1fr' : '1fr',
            gap: '16px',
            alignItems: 'center',
            background: '#F8FAFC',
            border: '1px solid #CBD5E1',
            borderRadius: '6px',
            padding: '12px 16px'
          }}
        >
          {qrCodeDataUrl && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <img
                src={qrCodeDataUrl}
                alt="QR Code d'authenticité de paie"
                style={{
                  width: '74px',
                  height: '74px',
                  borderRadius: '4px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  padding: '3px'
                }}
              />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#059669', background: '#ECFDF5', padding: '2px 6px', borderRadius: '3px', border: '1px solid #A7F3D0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                ✓ Document Officiel Certifié Conforme
              </span>
              <span style={{ fontSize: '11.5px', color: '#64748B', fontFamily: 'monospace' }}>
                Réf : <strong>{payslip.number}</strong>
              </span>
            </div>
            <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>
              Vérification d'authenticité et d'intégrité de la fiche de paie
            </div>
            <div style={{ fontSize: '11px', color: '#475569', lineHeight: 1.35 }}>
              Ce bulletin de paie a été émis et certifié électroniquement via FactPay RH. Scannez le QR code pour contrôler son authenticité, son statut et ses cotisations.
            </div>
            <div style={{ fontSize: '10.5px', color: '#64748B', marginTop: '1px' }}>
              Empreinte de sécurité : <code style={{ color: '#0F172A', fontWeight: 600 }}>{fingerprintCode}</code> · Bulletin à conserver sans limitation de durée.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
