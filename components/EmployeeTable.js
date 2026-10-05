'use client';

import Link from 'next/link';
import { money } from '@/lib/money';
import { PAYMENT_METHODS } from '@/lib/rh-constants';
import Modal from '@/components/Modal';
import EmployeeForm from '@/components/EmployeeForm';
import Icon from '@/components/Icon';
import { deleteEmployeeAction, generateEmployeePortalTokenAction } from '@/app/actions';
import { portalAccessState, portalLastSeenLabel, PORTAL_ACTIVE, PORTAL_PENDING, PORTAL_STATE_LABEL } from '@/lib/portal-state';

const STATUS_MAP = {
  actif: { label: 'Actif', cls: 'paid' },
  conge: { label: 'En congé', cls: 'wait' },
  inactif: { label: 'Inactif', cls: 'draft' },
  archive: { label: 'Archivé', cls: 'late' },
};

const PORTAL_CLS = { [PORTAL_ACTIVE]: 'paid', [PORTAL_PENDING]: 'wait', expire: 'late', aucun: 'draft' };

function getInitials(first, last) {
  const f = (first || '').trim()[0] || '';
  const l = (last || '').trim()[0] || '';
  return (f + l).toUpperCase() || 'EM';
}

export default function EmployeeTable({ employees, companyCurrency = 'XOF', returnTo = '/employes' }) {
  if (!employees.length) {
    return (
      <div className="doc-empty-state">
        <div className="doc-empty-icon">
          <Icon name="people" size={32} />
        </div>
        <h3>Aucun salarié dans cette catégorie</h3>
        <p>Ajoutez les membres de votre équipe pour gérer leurs contrats, salaires et congés.</p>
      </div>
    );
  }

  return (
    <div className="scroll">
      <table className="table-payfit">
        <thead>
          <tr>
            <th>Salarié</th>
            <th>Poste & Département</th>
            <th>Contrat</th>
            <th className="n">Salaire de base</th>
            <th>Paiement</th>
            <th>Statut</th>
            <th>Espace portail</th>
            <th className="n">Actions</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => {
            const st = STATUS_MAP[emp.status] || STATUS_MAP.actif;
            const portal = portalAccessState(emp);
            const initials = getInitials(emp.first_name, emp.last_name);

            return (
              <tr key={emp.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="table-avatar" aria-hidden="true">
                      {initials}
                    </span>
                    <div>
                      <Link href={`/employes/${emp.id}`} className="row-link" style={{ fontWeight: 650, color: 'var(--ink)' }}>
                        {emp.first_name} {emp.last_name}
                      </Link>
                      {emp.cnss_number && <span className="sub" style={{ fontSize: '11.5px' }}>CNSS : {emp.cnss_number}</span>}
                    </div>
                  </div>
                </td>
                <td>
                  <div style={{ fontWeight: 550 }}>{emp.job_title || '—'}</div>
                  {emp.department && <span className="sub" style={{ fontSize: '12px' }}>{emp.department}</span>}
                </td>
                <td>
                  <span className="doc-cat-tag" style={{ fontSize: '12px' }}>
                    {emp.contract_type}
                  </span>
                </td>
                <td className="n" style={{ fontWeight: 700, color: 'var(--ink)', fontSize: '14px' }}>
                  {money(emp.base_salary, companyCurrency)}
                </td>
                <td>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>
                    {PAYMENT_METHODS[emp.payment_method] || emp.payment_method}
                  </div>
                  {emp.payment_details && <span className="sub" style={{ fontSize: '11.5px' }}>{emp.payment_details}</span>}
                </td>
                <td>
                  <span className={`status ${st.cls}`}>{st.label}</span>
                </td>
                <td>
                  <span className={`status ${PORTAL_CLS[portal]}`}>{PORTAL_STATE_LABEL[portal]}</span>
                  {portal !== 'aucun' && <span className="sub" style={{ fontSize: '11.5px', marginTop: '2px' }}>{portalLastSeenLabel(emp)}</span>}
                </td>
                <td className="n">
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    {portal === 'aucun' && (
                      <form action={generateEmployeePortalTokenAction} style={{ display: 'inline' }}>
                        <input type="hidden" name="employee_id" value={emp.id} />
                        <input type="hidden" name="return_to" value={returnTo} />
                        <button type="submit" className="button secondary small icon-only" title="Créer son lien d'accès au portail">
                          <Icon name="link" size={14} />
                        </button>
                      </form>
                    )}
                    <Modal
                      label=""
                      icon="edit"
                      title={`Modifier ${emp.first_name} ${emp.last_name}`}
                      buttonClass="button secondary small icon-only"
                    >
                      <EmployeeForm employee={emp} companyCurrency={companyCurrency} />
                    </Modal>

                    <form action={deleteEmployeeAction} style={{ display: 'inline' }}>
                      <input type="hidden" name="id" value={emp.id} />
                      <button
                        type="submit"
                        className="button danger small icon-only"
                        title="Supprimer la fiche"
                        onClick={(e) => {
                          if (!confirm(`Supprimer la fiche de ${emp.first_name} ${emp.last_name} ?`)) e.preventDefault();
                        }}
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </form>
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
