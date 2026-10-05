import { notFound, redirect } from 'next/navigation';
import Flash from '@/components/Flash';
import ModuleLayout from '@/components/ModuleLayout';
import PayslipForm from '@/components/PayslipForm';
import { requireCompany } from '@/lib/auth';
import { getPayslip, isPayslipEditable } from '@/lib/payroll';
import { listEmployees } from '@/lib/employees';

export async function generateMetadata({ params }) {
  const { id } = await params;
  return { title: `Modifier le bulletin #${id}` };
}

export default async function Page({ params, searchParams }) {
  const { company } = await requireCompany();
  const { id } = await params;
  const payslip = await getPayslip(company.id, id);
  if (!payslip) notFound();

  // Un bulletin validé ou payé n'a plus de formulaire. On renvoie vers sa fiche, qui explique
  // pourquoi il est figé, plutôt que d'afficher un formulaire qui échouerait à l'enregistrement.
  if (!isPayslipEditable(payslip)) redirect(`/fiches-de-paie/${payslip.id}`);

  // Les salariés actifs suffisent pour un nouveau bulletin, mais pas pour en modifier un : le
  // salarié d'un bulletin de janvier a pu être archivé depuis. On l'ajoute donc s'il manque,
  // sinon le formulaire afficherait un nom vide sur une fiche existante.
  const employees = await listEmployees(company.id);
  const all = employees.some((e) => e.id === payslip.employee_id)
    ? employees
    : [...employees, {
      id: payslip.employee_id,
      first_name: payslip.first_name,
      last_name: payslip.last_name,
      job_title: payslip.job_title,
      base_salary: payslip.base_salary,
      status: payslip.status || 'archive',
    }];

  return (
    <ModuleLayout
      workspaceId="rh"
      title={`Modifier le bulletin ${payslip.number}`}
      subtitle="Un bulletin validé ou payé n'est plus modifiable : ici, il est encore en brouillon."
    >
      <Flash searchParams={searchParams} />
      <PayslipForm
        employees={all}
        payslip={payslip}
        companyCurrency={company.currency}
      />
    </ModuleLayout>
  );
}
