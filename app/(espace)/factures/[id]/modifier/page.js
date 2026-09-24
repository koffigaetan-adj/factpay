import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import Flash from '@/components/Flash';
import InvoiceEditor from '@/components/InvoiceEditor';
import { requireCompany } from '@/lib/auth';
import { q } from '@/lib/db';
import { getInvoice, EDITABLE } from '@/lib/invoices';
import { addDays, today } from '@/lib/dates';

export const metadata = { title: 'Modifier la facture' };

export default async function Page({ params, searchParams }) {
  const { id } = await params;
  const { company } = await requireCompany();
  const invoice = await getInvoice(company.id, id);
  if (!invoice) notFound();
  if (!EDITABLE.includes(invoice.status)) redirect(`/factures/${invoice.id}`);
  const clients = await q('SELECT id, name, email FROM clients WHERE company_id = $1 ORDER BY name', [company.id]);

  return (
    <>
      <div className="page-head">
        <div><Link href={`/factures/${invoice.id}`}>← Retour</Link><h1>Modifier le brouillon</h1></div>
      </div>
      <Flash searchParams={searchParams} />
      <InvoiceEditor
        clients={clients}
        invoice={invoice}
        defaultCurrency={company.currency}
        defaultVat={company.default_vat_rate}
        tomorrow={addDays(today(), 1)}
        thisMonth={today().slice(0, 7)}
      />
    </>
  );
}
