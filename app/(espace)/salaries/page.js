import Link from 'next/link';
import Flash from '@/components/Flash';
import { createEmployee } from '@/app/actions';
import { requireCompany } from '@/lib/auth';
import { q } from '@/lib/db';
import EmployeeFields from '@/components/EmployeeFields';
import Modal from '@/components/Modal';
import { pubId } from '@/lib/ids';

export const metadata = { title: 'Salariés' };

const CONTRACT_COLORS = {
  CDI: 'paid',
  CDD: 'wait',
  Intérim: 'check',
  Stage: 'check',
  Apprentissage: 'check',
  Freelance: 'draft',
  Autre: 'draft',
};

export default async function Page({ searchParams }) {
  const { company } = await requireCompany();
  const employees = await q(
    `SELECT * FROM employees WHERE company_id = $1 ORDER BY last_name, first_name`,
    [company.id]
  );

  return (
    <>
      <div className="page-head">
        <h1>Salariés</h1>
        <div className="actions">
          <Modal label="Nouveau salarié" title="Nouveau salarié">
            <form action={createEmployee} className="stack">
              <EmployeeFields />
              <div className="form-actions"><button>Ajouter le salarié</button></div>
            </form>
          </Modal>
        </div>
      </div>
      <Flash searchParams={searchParams} />
      <section>
        {employees.length ? (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Salarié</th>
                  <th>Poste</th>
                  <th className="hide-sm">Contrat</th>
                  <th className="hide-sm">Embauche</th>
                  <th>Portail</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id}>
                    <td>
                      {/* row-link : toute la ligne devient cliquable */}
                      <Link className="row-link" href={`/salaries/${pubId('employee', emp.id)}`}>
                        {emp.last_name} {emp.first_name}
                      </Link>
                      {emp.email && <span className="sub">{emp.email}</span>}
                    </td>
                    <td>
                      {emp.job_title || <span className="muted">—</span>}
                      {emp.department && <span className="sub">{emp.department}</span>}
                    </td>
                    <td className="hide-sm">
                      <span className={`status ${CONTRACT_COLORS[emp.contract_type] || 'draft'}`}>
                        {emp.contract_type}
                      </span>
                    </td>
                    <td className="hide-sm">
                      {emp.hired_on
                        ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(emp.hired_on))
                        : <span className="muted">—</span>}
                    </td>
                    <td>
                      {emp.portal_enabled
                        ? <span className="status paid">Actif</span>
                        : <span className="status draft">Inactif</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">Aucun salarié pour l'instant. Clique sur « Nouveau salarié » pour ajouter le premier.</p>
        )}
      </section>
    </>
  );
}
