import BackButton from '@/components/BackButton';
import { notFound } from 'next/navigation';
import Flash from '@/components/Flash';
import EmployeeFields from '@/components/EmployeeFields';
import { updateEmployee, deleteEmployee, sendPortalInvite } from '@/app/actions';
import { requireCompany } from '@/lib/auth';
import { one } from '@/lib/db';
import Modal from '@/components/Modal';
import SubmitButton from '@/components/SubmitButton';
import { pubId, idFrom } from '@/lib/ids';

export const metadata = { title: 'Fiche salarié' };

export default async function Page({ params, searchParams }) {
  const { id } = await params;
  const { company } = await requireCompany();
  const emp = await one('SELECT * FROM employees WHERE id = $1 AND company_id = $2', [idFrom('employee', id), company.id]);
  if (!emp) notFound();

  const inviteSentDate = emp.portal_invite_sent_at
    ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Africa/Abidjan' }).format(new Date(emp.portal_invite_sent_at))
    : null;

  return (
    <>
      <div className="page-head">
        <div>
          <BackButton href="/salaries">Salariés</BackButton>
          <h1>{emp.first_name} {emp.last_name}</h1>
        </div>
        {emp.portal_enabled && emp.email && (
          <div className="actions">
            <form action={sendPortalInvite}>
              <input type="hidden" name="id" value={emp.id} />
              <SubmitButton className="secondary" pendingText="Envoi…">
                ✉️ {inviteSentDate ? 'Renvoyer l\'invitation' : 'Envoyer l\'invitation portail'}
              </SubmitButton>
            </form>
          </div>
        )}
      </div>
      <Flash searchParams={searchParams} />

      <form action={updateEmployee} className="stack">
        <input type="hidden" name="id" value={emp.id} />
        <EmployeeFields e={emp} mode="edit" />
        <div className="form-foot">
          <SubmitButton pendingText="Enregistrement…">Enregistrer les modifications</SubmitButton>
        </div>
      </form>

      {/* Zone de suppression */}
      <section className="card danger-zone" style={{ padding: '24px', marginTop: 24 }}>
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>Supprimer ce salarié</h3>
        <p className="hint">Cette action est irréversible. Toutes les données de la fiche seront effacées.</p>
        <details className="cancel">
          <summary className="neutral">Supprimer ce salarié</summary>
          <form action={deleteEmployee} style={{ marginTop: 12 }}>
            <input type="hidden" name="id" value={emp.id} />
            <SubmitButton className="danger" pendingText="Suppression…">Confirmer la suppression</SubmitButton>
          </form>
        </details>
      </section>
    </>
  );
}
