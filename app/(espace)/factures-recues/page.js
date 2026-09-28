import Link from 'next/link';
import Flash from '@/components/Flash';
import InvoiceTable from '@/components/InvoiceTable';
import { requireCompany } from '@/lib/auth';
import { listReceivedInvoices } from '@/lib/invoices';
import { today } from '@/lib/dates';

export const metadata = { title: 'Factures reçues' };

const FILTERS = {
  toutes: { label: 'Toutes', match: () => true },
  attente: { label: 'À payer', match: (i) => ['emise', 'envoyee', 'signalee'].includes(i.status) },
  retard: { label: 'En retard', match: (i) => ['emise', 'envoyee'].includes(i.status) && i.due_date && i.due_date < today() },
  payees: { label: 'Payées', match: (i) => i.status === 'payee' },
};

export default async function Page({ searchParams }) {
  const { user, company } = await requireCompany();
  const sp = await searchParams;
  const key = FILTERS[sp.filtre] ? sp.filtre : 'toutes';
  const all = await listReceivedInvoices([company.email, user.email], 'facture', company.id);
  const invoices = all.filter(FILTERS[key].match);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Factures reçues</h1>
          <p className="hint" style={{ margin: '6px 0 0' }}>
            Factures envoyées par d'autres entreprises sur FactPay qui vous ont ajouté comme client.
          </p>
        </div>
      </div>
      <Flash searchParams={searchParams} />
      <nav className="tabs" aria-label="Filtrer les factures reçues">
        {Object.entries(FILTERS).map(([k, f]) => (
          <Link key={k} href={`/factures-recues?filtre=${k}`} aria-current={k === key ? 'page' : undefined}>
            {f.label}
            <span className="count">{all.filter(f.match).length}</span>
          </Link>
        ))}
      </nav>
      <section>
        {invoices.length ? (
          <InvoiceTable invoices={invoices} received />
        ) : (
          <p className="empty">Aucune facture reçue pour l’instant.</p>
        )}
      </section>
    </>
  );
}
