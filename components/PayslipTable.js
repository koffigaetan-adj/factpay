'use client';

import Link from 'next/link';
import { money } from '@/lib/money';
import { MONTHS } from '@/lib/rh-constants';
import Icon from '@/components/Icon';
import { deletePayslipAction } from '@/app/actions';

const STATUS_MAP = {
  brouillon: { label: 'Brouillon', cls: 'draft', dotColor: 'var(--muted)' },
  valide: { label: 'Validé', cls: 'check', dotColor: '#059669' },
  paye: { label: 'Payé', cls: 'paid', dotColor: 'var(--brand)' },
};

function getInitials(first, last) {
  const f = (first || '').trim()[0] || '';
  const l = (last || '').trim()[0] || '';
  return (f + l).toUpperCase() || 'EM';
}

export default function PayslipTable({ payslips, companyCurrency = 'XOF' }) {
  if (!payslips.length) {
    return (
      <div className="doc-empty-state">
        <div className="doc-empty-icon">
          <Icon name="payslip" size={32} />
        </div>
        <h3>Aucun bulletin de paie pour cette sélection</h3>
        <p>Générez les bulletins du mois en un clic ou créez un bulletin individuel.</p>
      </div>
    );
  }

  return (
    <div className="scroll">
      <table className="table-payfit">
        <thead>
          <tr>
            <th>N° Bulletin</th>
            <th>Salarié</th>
            <th>Période</th>
            <th className="n">Salaire Brut</th>
            <th className="n">Retenues</th>
            <th className="n">Net à Payer</th>
            <th>Statut</th>
            <th className="n">Actions</th>
          </tr>
        </thead>
        <tbody>
          {payslips.map((p) => {
            const st = STATUS_MAP[p.status] || STATUS_MAP.brouillon;
            const initials = getInitials(p.first_name, p.last_name);

            return (
              <tr key={p.id}>
                <td>
                  <Link href={`/fiches-de-paie/${p.id}`} className="row-link" style={{ fontWeight: 700 }}>
                    {p.number}
                  </Link>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="table-avatar" aria-hidden="true">
                      {initials}
                    </span>
                    <div>
                      <div style={{ fontWeight: 650, color: 'var(--ink)' }}>
                        {p.first_name} {p.last_name}
                      </div>
                      <span className="sub" style={{ fontSize: '12px' }}>
                        {p.job_title || p.department || 'Salarié'}
                      </span>
                    </div>
                  </div>
                </td>
                <td>
                  <div style={{ fontWeight: 550 }}>{MONTHS[p.period_month - 1]} {p.period_year}</div>
                  {p.payment_date && <span className="sub" style={{ fontSize: '11.5px' }}>Payé le {p.payment_date}</span>}
                </td>
                <td className="n" style={{ fontWeight: 500 }}>
                  {money(p.gross_salary, p.currency || companyCurrency)}
                </td>
                <td className="n muted" style={{ fontSize: '13px' }}>
                  − {money(p.total_deductions, p.currency || companyCurrency)}
                </td>
                <td className="n" style={{ fontWeight: 750, color: 'var(--ink)', fontSize: '14.5px' }}>
                  {money(p.net_salary, p.currency || companyCurrency)}
                </td>
                <td>
                  <span className={`status ${st.cls}`}>
                    {st.label}
                  </span>
                </td>
                <td className="n">
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Link href={`/fiches-de-paie/${p.id}`} className="button secondary small">
                      Voir
                    </Link>
                    {p.status !== 'paye' && (
                      <form action={deletePayslipAction} style={{ display: 'inline' }}>
                        <input type="hidden" name="id" value={p.id} />
                        <button
                          type="submit"
                          className="button danger small icon-only"
                          title="Supprimer le bulletin"
                          onClick={(e) => {
                            if (!confirm(`Supprimer le bulletin ${p.number} ?`)) e.preventDefault();
                          }}
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
