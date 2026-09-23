import Link from 'next/link';
import Flash from '@/components/Flash';
import InvoiceTable from '@/components/InvoiceTable';
import { requireCompany } from '@/lib/auth';
import { listInvoices } from '@/lib/invoices';

export const metadata = { title: 'Factures' };

const FILTERS = {
  toutes: { label: 'Toutes', match: () => true },
  attente: { label: 'En attente', match: (i) => ['emise', 'envoyee', 'signalee'].includes(i.status) },
  payees: { label: 'Payées', match: (i) => i.status === 'payee' },
  brouillons: { label: 'Brouillons', match: (i) => ['brouillon', 'programmee'].includes(i.status) },
};

export default async function Page({ searchParams }) {
  const { company } = await requireCompany();
  const sp = await searchParams;
  const key = FILTERS[sp.filtre] ? sp.filtre : 'toutes';
  const invoices = (await listInvoices(company.id)).filter(FILTERS[key].match);

  return (
    <>
      <div className="page-head">
        <h1>Factures</h1>
        <div className="actions"><Link className="button" href="/factures/nouvelle">Nouvelle facture</Link></div>
      </div>
      <Flash searchParams={searchParams} />
      <nav className="actions" aria-label="Filtrer" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {Object.entries(FILTERS).map(([k, f]) => (
          <Link key={k} href={`/factures?filtre=${k}`} className={`button ${k === key ? '' : 'secondary'}`} aria-current={k === key ? 'page' : undefined}>{f.label}</Link>
        ))}
      </nav>
      <section>
        {invoices.length ? <InvoiceTable invoices={invoices} /> : <p className="empty">Aucune facture ici.</p>}
      </section>
    </>
  );
}
