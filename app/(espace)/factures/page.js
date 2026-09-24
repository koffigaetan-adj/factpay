import Link from 'next/link';
import Flash from '@/components/Flash';
import InvoiceTable from '@/components/InvoiceTable';
import { requireCompany } from '@/lib/auth';
import { listInvoices } from '@/lib/invoices';
import { today } from '@/lib/dates';

export const metadata = { title: 'Factures' };

const FILTERS = {
  toutes: { label: 'Toutes', match: () => true },
  attente: { label: 'En attente', match: (i) => ['emise', 'envoyee', 'signalee'].includes(i.status) },
  retard: { label: 'En retard', match: (i) => ['emise', 'envoyee'].includes(i.status) && i.due_date && i.due_date < today() },
  payees: { label: 'Payées', match: (i) => i.status === 'payee' },
  brouillons: { label: 'Brouillons', match: (i) => ['brouillon', 'programmee'].includes(i.status) },
  annulees: { label: 'Annulées', match: (i) => i.status === 'annulee' },
};

export default async function Page({ searchParams }) {
  const { company } = await requireCompany();
  const sp = await searchParams;
  const key = FILTERS[sp.filtre] ? sp.filtre : 'toutes';
  const all = await listInvoices(company.id);
  const invoices = all.filter(FILTERS[key].match);

  return (
    <>
      <div className="page-head">
        <h1>Factures</h1>
        <div className="actions"><Link className="button" href="/factures/nouvelle">Nouvelle facture</Link></div>
      </div>
      <Flash searchParams={searchParams} />
      <nav className="tabs" aria-label="Filtrer les factures">
        {Object.entries(FILTERS).map(([k, f]) => (
          <Link key={k} href={`/factures?filtre=${k}`} aria-current={k === key ? 'page' : undefined}>
            {f.label}<span className="count">{all.filter(f.match).length}</span>
          </Link>
        ))}
      </nav>
      <section>
        {invoices.length ? <InvoiceTable invoices={invoices} /> : <p className="empty">Aucune facture ici.</p>}
      </section>
    </>
  );
}
