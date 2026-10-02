import { notFound } from 'next/navigation';
import Flash from '@/components/Flash';
import PayslipView from '@/components/PayslipView';
import { requireCompany } from '@/lib/auth';
import { getPayslip } from '@/lib/payroll';

export async function generateMetadata({ params }) {
  const { id } = await params;
  return { title: `Bulletin de paie #${id}` };
}

export default async function Page({ params, searchParams }) {
  const { company } = await requireCompany();
  const { id } = await params;
  const payslip = await getPayslip(company.id, id);
  if (!payslip) notFound();

  return (
    <>
      <Flash searchParams={searchParams} />
      <PayslipView company={company} payslip={payslip} />
    </>
  );
}
