import Link from 'next/link';
import Flash from '@/components/Flash';
import { DocumentForm, DocumentList } from '@/components/Documents';
import Modal from '@/components/Modal';
import { requireCompany } from '@/lib/auth';
import { q } from '@/lib/db';
import { listDocuments, CATEGORIES } from '@/lib/documents';

export const metadata = { title: 'Documents' };

export default async function Page({ searchParams }) {
  const { company } = await requireCompany();
  const sp = await searchParams;
  const category = CATEGORIES[sp.type] ? sp.type : '';
  const [all, clients] = await Promise.all([
    listDocuments(company.id),
    q('SELECT id, name FROM clients WHERE company_id = $1 ORDER BY name', [company.id]),
  ]);
  const docs = category ? all.filter((d) => d.category === category) : all;
  const used = Object.entries(CATEGORIES).filter(([k]) => all.some((d) => d.category === k));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Documents</h1>
          <p className="hint" style={{ margin: '6px 0 0' }}>Contrats, bons de commande, attestations, papiers de l'entreprise : tout au même endroit, visible par toi seul.</p>
        </div>
        <div className="actions">
          <Modal label="Ajouter un document" title="Ajouter un document">
            <DocumentForm clients={clients} defaultClient={sp.client || ''} />
          </Modal>
        </div>
      </div>
      <Flash searchParams={searchParams} />
      <section>
          {used.length > 1 && (
            <nav className="tabs" aria-label="Filtrer par type">
              <Link href="/documents" aria-current={!category ? 'page' : undefined}>Tous<span className="count">{all.length}</span></Link>
              {used.map(([k, label]) => (
                <Link key={k} href={`/documents?type=${k}`} aria-current={category === k ? 'page' : undefined}>
                  {label.split(' (')[0]}<span className="count">{all.filter((d) => d.category === k).length}</span>
                </Link>
              ))}
            </nav>
          )}
        <DocumentList docs={docs} />
      </section>
    </>
  );
}
