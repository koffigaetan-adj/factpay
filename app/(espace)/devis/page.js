import Link from 'next/link';
import Flash from '@/components/Flash';
import InvoiceTable from '@/components/InvoiceTable';
import Icon from '@/components/Icon';
import { requireCompany } from '@/lib/auth';
import { listInvoices } from '@/lib/invoices';

export const metadata = { title: 'Devis' };

const FILTERS = {
  tous: { label: 'Tous', match: () => true },
  attente: { label: 'En attente de réponse', match: (i) => ['emise', 'envoyee'].includes(i.status) },
  acceptes: { label: 'Acceptés', match: (i) => ['acceptee', 'convertie'].includes(i.status) },
  refuses: { label: 'Refusés', match: (i) => i.status === 'refusee' },
  brouillons: { label: 'Brouillons', match: (i) => i.status === 'brouillon' },
};

export default async function Page({ searchParams }) {
  const { company } = await requireCompany();
  const sp = await searchParams;
  const key = FILTERS[sp.filtre] ? sp.filtre : 'tous';
  const all = await listInvoices(company.id, 'devis');
  const quotes = all.filter(FILTERS[key].match);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Devis</h1>
          <p className="hint" style={{ margin: '6px 0 0' }}>Ton client l'accepte en ligne, puis tu le transformes en facture en un clic.</p>
        </div>
        <div className="actions">
          <Link className="button" href="/devis/nouveau">
            <Icon name="plus" size={16} />
            Nouveau devis
          </Link>
        </div>
      </div>
      <Flash searchParams={searchParams} />
      <nav className="tabs" aria-label="Filtrer les devis">
        {Object.entries(FILTERS).map(([k, f]) => (
          <Link key={k} href={`/devis?filtre=${k}`} aria-current={k === key ? 'page' : undefined}>
            {f.label}<span className="count">{all.filter(f.match).length}</span>
          </Link>
        ))}
      </nav>
      <section>
        {quotes.length ? <InvoiceTable invoices={quotes} /> : <p className="empty">Aucun devis ici. <Link href="/devis/nouveau">Crée le premier</Link>.</p>}
      </section>
    </>
  );
}
