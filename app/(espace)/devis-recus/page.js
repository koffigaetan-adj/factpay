import Link from 'next/link';
import Flash from '@/components/Flash';
import InvoiceTable from '@/components/InvoiceTable';
import { requireCompany } from '@/lib/auth';
import { listReceivedInvoices } from '@/lib/invoices';

export const metadata = { title: 'Devis reçus' };

const FILTERS = {
  tous: { label: 'Tous', match: () => true },
  attente: { label: 'En attente de réponse', match: (i) => ['emise', 'envoyee'].includes(i.status) },
  acceptes: { label: 'Acceptés', match: (i) => ['acceptee', 'convertie'].includes(i.status) },
  refuses: { label: 'Refusés', match: (i) => i.status === 'refusee' },
};

export default async function Page({ searchParams }) {
  const { user, company } = await requireCompany();
  const sp = await searchParams;
  const key = FILTERS[sp.filtre] ? sp.filtre : 'tous';
  const all = await listReceivedInvoices([company.email, user.email], 'devis', company.id);
  const quotes = all.filter(FILTERS[key].match);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Devis reçus</h1>
          <p className="hint" style={{ margin: '6px 0 0' }}>
            Devis envoyés par d'autres entreprises sur FactPay qui vous ont ajouté comme client.
          </p>
        </div>
      </div>
      <Flash searchParams={searchParams} />
      <nav className="tabs" aria-label="Filtrer les devis reçus">
        {Object.entries(FILTERS).map(([k, f]) => (
          <Link key={k} href={`/devis-recus?filtre=${k}`} aria-current={k === key ? 'page' : undefined}>
            {f.label}
            <span className="count">{all.filter(f.match).length}</span>
          </Link>
        ))}
      </nav>
      <section>
        {quotes.length ? (
          <InvoiceTable invoices={quotes} received />
        ) : (
          <p className="empty">Aucun devis reçu pour l’instant.</p>
        )}
      </section>
    </>
  );
}
