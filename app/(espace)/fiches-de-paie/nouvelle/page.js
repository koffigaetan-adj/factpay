import Link from 'next/link';
import Flash from '@/components/Flash';
import PayslipForm from '@/components/PayslipForm';
import Icon from '@/components/Icon';
import { requireCompany } from '@/lib/auth';
import { listEmployees } from '@/lib/employees';

export const metadata = { title: 'Nouveau bulletin de paie' };

export default async function Page({ searchParams }) {
  const { company } = await requireCompany();
  const sp = await searchParams;
  const employees = await listEmployees(company.id, 'actif');

  return (
    <>
      <div className="page-head">
        <div>
          <Link href="/fiches-de-paie" className="back-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <Icon name="chevron" size={16} /> Retour aux fiches de paie
          </Link>
          <h1>Nouveau bulletin de paie</h1>
          <p className="hint" style={{ margin: '4px 0 0' }}>
            Édition d'un bulletin mensuel avec calcul automatique des cotisations CNSS et du net.
          </p>
        </div>
      </div>

      <Flash searchParams={searchParams} />

      {employees.length === 0 ? (
        <section className="card" style={{ padding: '32px', textAlign: 'center' }}>
          <h2>Aucun salarié actif</h2>
          <p className="hint">Pour créer un bulletin de paie, vous devez d'abord enregistrer un salarié.</p>
          <div style={{ marginTop: '16px' }}>
            <Link href="/employes" className="button">
              <Icon name="plus" size={16} /> Ajouter un salarié
            </Link>
          </div>
        </section>
      ) : (
        <section style={{ maxWidth: '800px' }}>
          <PayslipForm
            employees={employees}
            defaultEmployeeId={sp.employee_id}
            companyCurrency={company.currency}
          />
        </section>
      )}
    </>
  );
}
