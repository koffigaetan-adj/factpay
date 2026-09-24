import Link from 'next/link';
import BackButton from '@/components/BackButton';
import { notFound, redirect } from 'next/navigation';
import Flash from '@/components/Flash';
import InvoiceEditor from '@/components/InvoiceEditor';
import { requireCompany } from '@/lib/auth';
import { q } from '@/lib/db';
import { getInvoice, EDITABLE } from '@/lib/invoices';
import { addDays, today } from '@/lib/dates';
import { pubId, idFrom } from '@/lib/ids';

export const metadata = { title: 'Modifier la facture' };

export default async function Page({ params, searchParams }) {
  const { id } = await params;
  const { company } = await requireCompany();
  const invoice = await getInvoice(company.id, idFrom('facture', id));
  if (!invoice) notFound();
  if (!EDITABLE.includes(invoice.status)) redirect(`/factures/${pubId('facture', invoice.id)}`);
  const clients = await q('SELECT id, name, email FROM clients WHERE company_id = $1 ORDER BY name', [company.id]);

  return (
    <>
      <div className="page-head">
        <div><BackButton href={`/factures/${pubId('facture', invoice.id)}`}>Retour</BackButton><h1>{invoice.doc_type === 'devis' ? 'Modifier le devis' : 'Modifier la facture'}</h1></div>
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
