import Link from 'next/link';
import { notFound } from 'next/navigation';
import Flash from '@/components/Flash';
import Modal from '@/components/Modal';
import EmployeeForm from '@/components/EmployeeForm';
import CopyButton from '@/components/CopyButton';
import Icon from '@/components/Icon';
import { requireCompany } from '@/lib/auth';
import { getEmployee, CONTRACT_TYPES, PAYMENT_METHODS } from '@/lib/employees';
import { listPayslips, MONTHS } from '@/lib/payroll';
import { money } from '@/lib/money';
import { appUrl } from '@/lib/url';
import { frDate, frDateTime } from '@/lib/dates';
import { TOKEN_DAYS, recentPortalAccess } from '@/lib/portal';
import { generateEmployeePortalTokenAction, revokeEmployeePortalAccessAction } from '@/app/actions';

export const metadata = ({ params }) => ({ title: `Fiche salarié` });

const STATUS_LABELS = {
  actif: 'Actif',
  conge: 'En congé',
  inactif: 'Inactif',
  archive: 'Archivé',
};

export default async function Page({ params, searchParams }) {
  const { company } = await requireCompany();
  const { id } = await params;
  const employee = await getEmployee(company.id, id);
  if (!employee) notFound();

  const payslips = await listPayslips(company.id, { employeeId: employee.id });
  const visits = employee.portal_token ? await recentPortalAccess(employee.id, 5) : [];

  return (
    <>
      <div className="page-head">
        <div>
          <Link href="/employes" className="back-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <Icon name="chevron" size={16} /> Retour aux employés
          </Link>
          <h1>{employee.first_name} {employee.last_name}</h1>
          <p className="hint" style={{ margin: '4px 0 0' }}>
            {employee.job_title || 'Salarié'} {employee.department ? `· ${employee.department}` : ''} · Statut : <strong>{STATUS_LABELS[employee.status] || employee.status}</strong>
          </p>
        </div>
        <div className="actions">
          <Modal label="Modifier la fiche" icon="edit" title={`Modifier ${employee.first_name} ${employee.last_name}`} buttonClass="button secondary">
            <EmployeeForm employee={employee} companyCurrency={company.currency} />
          </Modal>
          <Link className="button" href={`/fiches-de-paie/nouvelle?employee_id=${employee.id}`}>
            <Icon name="plus" size={16} /> Nouveau bulletin
          </Link>
        </div>
      </div>

      <Flash searchParams={searchParams} />

      <div className="dash" style={{ marginBottom: '32px' }}>
        <section className="dash-card">
          <div className="dash-card-header">
            <div className="dash-card-icon"><Icon name="user" size={20} /></div>
            <h2 style={{ margin: 0 }}>Informations Salarié</h2>
          </div>
          <dl className="calc">
            <div><dt>Nom complet</dt><dd>{employee.first_name} {employee.last_name}</dd></div>
            <div><dt>Contrat</dt><dd>{CONTRACT_TYPES[employee.contract_type] || employee.contract_type}</dd></div>
            {employee.category && <div><dt>Catégorie / Échelon</dt><dd>{employee.category}</dd></div>}
            {employee.hire_date && <div><dt>Date d'embauche</dt><dd>{frDate(employee.hire_date)}</dd></div>}
            {employee.end_date && <div><dt>Fin de contrat</dt><dd>{frDate(employee.end_date)}</dd></div>}
            {employee.cnss_number && <div><dt>N° CNSS</dt><dd>{employee.cnss_number}</dd></div>}
            {employee.id_card_number && <div><dt>N° Pièce d'identité</dt><dd>{employee.id_card_number}</dd></div>}
            <div><dt>Solde congés</dt><dd><strong style={{ color: '#059669' }}>{employee.leave_balance || 0} jours</strong></dd></div>
          </dl>
        </section>

        <section className="dash-card">
          <div className="dash-card-header">
            <div className="dash-card-icon"><Icon name="report" size={20} /></div>
            <h2 style={{ margin: 0 }}>Rémunération & Paiement</h2>
          </div>
          <p className="net-figure">{money(employee.base_salary, company.currency)}</p>
          <span className="sub" style={{ marginTop: '-8px', marginBottom: '16px' }}>Salaire de base mensuel</span>
          <dl className="calc">
            <div><dt>Mode de règlement</dt><dd>{PAYMENT_METHODS[employee.payment_method] || employee.payment_method}</dd></div>
            {employee.payment_details && <div><dt>Coordonnées</dt><dd>{employee.payment_details}</dd></div>}
            {employee.phone && <div><dt>Téléphone</dt><dd>{employee.phone}</dd></div>}
            {employee.email && <div><dt>E-mail</dt><dd>{employee.email}</dd></div>}
          </dl>
        </section>
      </div>

      {/* Portail Collaborateur (Self-Service) */}
      <section className="card" style={{ padding: '24px', marginBottom: '32px', borderLeft: '4px solid var(--brand)' }}>
        <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', 'flex-wrap': 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ margin: '0 0 6px', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon name="link" size={18} /> Espace Collaborateur (Self-Service)
            </h3>
            <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--sub)' }}>
              Permet à {employee.first_name} de consulter ses bulletins, poser ses congés, demander des acomptes et télécharger son attestation de travail.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {employee.portal_token ? (
              <>
                <Link
                  href={`/portail/${employee.portal_token}`}
                  target="_blank"
                  rel="noreferrer"
                  className="button secondary small"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Icon name="external" size={14} /> Ouvrir le portail
                </Link>
                <CopyButton text={`${appUrl()}/portail/${employee.portal_token}`} label="Copier le lien" />
                <form action={generateEmployeePortalTokenAction} style={{ display: 'inline' }}>
                  <input type="hidden" name="employee_id" value={employee.id} />
                  <input type="hidden" name="regen" value="1" />
                  <button type="submit" className="button ghost small" title="Coupe l'ancien lien et en crée un nouveau">
                    Régénérer le lien
                  </button>
                </form>
                <form action={revokeEmployeePortalAccessAction} style={{ display: 'inline' }}>
                  <input type="hidden" name="employee_id" value={employee.id} />
                  <button type="submit" className="button ghost small danger-text" title="Coupe définitivement l'accès du salarié">
                    <Icon name="close" size={14} /> Révoquer
                  </button>
                </form>
              </>
            ) : (
              <form action={generateEmployeePortalTokenAction} style={{ display: 'inline' }}>
                <input type="hidden" name="employee_id" value={employee.id} />
                <button type="submit" className="button small">
                  Activer l'accès portail
                </button>
              </form>
            )}
          </div>
        </div>

        {employee.portal_token && (
          <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--line)', fontSize: '13px' }}>
            {employee.portal_token_expires_at && new Date(employee.portal_token_expires_at) <= new Date() ? (
              <p style={{ margin: 0, color: '#D97706' }}>
                <strong>Ce lien est expiré.</strong> Le salarié ne peut plus ouvrir son portail.
                Régénérez le lien pour lui en donner un nouveau.
              </p>
            ) : (
              <p style={{ margin: 0, color: 'var(--sub)' }}>
                Le lien reste valable {TOKEN_DAYS} jours après chaque visite : un salarié qui l'ouvre
                régulièrement ne le voit jamais expirer.
                {employee.portal_last_seen_at
                  ? <> Dernière visite : <strong>{frDateTime(employee.portal_last_seen_at)}</strong>.</>
                  : <> Jamais ouvert pour l'instant.</>}
                {visits.length > 1 && (
                  <> · {visits.length} ouvertures récentes journalisées.</>
                )}
              </p>
            )}
          </div>
        )}
      </section>

      <section>
        <div className="chart-head">
          <h2>Historique des bulletins de paie ({payslips.length})</h2>
        </div>
        {payslips.length ? (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>N° Bulletin</th>
                  <th>Période</th>
                  <th className="n">Salaire Brut</th>
                  <th className="n">Retenues</th>
                  <th className="n">Net à Payer</th>
                  <th>Statut</th>
                  <th className="n">Action</th>
                </tr>
              </thead>
              <tbody>
                {payslips.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/fiches-de-paie/${p.id}`} className="row-link" style={{ fontWeight: 600 }}>
                        {p.number}
                      </Link>
                    </td>
                    <td>{MONTHS[p.period_month - 1]} {p.period_year}</td>
                    <td className="n">{money(p.gross_salary, p.currency)}</td>
                    <td className="n muted">{money(p.total_deductions, p.currency)}</td>
                    <td className="n" style={{ fontWeight: 700, color: 'var(--brand-text)' }}>
                      {money(p.net_salary, p.currency)}
                    </td>
                    <td>
                      <span className={`status ${p.status === 'paye' ? 'paid' : p.status === 'valide' ? 'check' : 'draft'}`}>
                        {p.status === 'paye' ? 'Payé' : p.status === 'valide' ? 'Validé' : 'Brouillon'}
                      </span>
                    </td>
                    <td className="n">
                      <Link href={`/fiches-de-paie/${p.id}`} className="button secondary small">
                        Voir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">Aucun bulletin de paie émis pour ce salarié pour le moment.</p>
        )}
      </section>
    </>
  );
}
