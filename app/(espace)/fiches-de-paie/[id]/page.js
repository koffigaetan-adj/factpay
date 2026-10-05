import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import Flash from '@/components/Flash';
import PayslipView from '@/components/PayslipView';
import { requireCompany } from '@/lib/auth';
import { getPayslip } from '@/lib/payroll';
import { payslipFingerprint, payslipVerifyUrl } from '@/lib/verify';

export async function generateMetadata({ params }) {
  const { id } = await params;
  return { title: `Bulletin de paie #${id}` };
}

export default async function Page({ params, searchParams }) {
  const { company } = await requireCompany();
  const { id } = await params;
  const payslip = await getPayslip(company.id, id);
  if (!payslip) notFound();

  const verifyUrl = payslipVerifyUrl(payslip);
  const qrCode = await QRCode.toDataURL(verifyUrl, {
    margin: 1,
    width: 200,
    color: { dark: '#0F172A', light: '#FFFFFF' },
  }).catch(() => null);
  const fp = payslipFingerprint(payslip, company.name);

  return (
    <>
      <Flash searchParams={searchParams} />
      <PayslipView company={company} payslip={payslip} qrCode={qrCode} fingerprint={fp} />
    </>
  );
}
