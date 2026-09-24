import Link from 'next/link';
import { notFound } from 'next/navigation';
import Flash from '@/components/Flash';
import InvoiceTable from '@/components/InvoiceTable';
import ClientFields from '@/components/ClientFields';
import { updateClient, deleteClient } from '@/app/actions';
import { requireCompany } from '@/lib/auth';
import { one } from '@/lib/db';
import { listInvoices } from '@/lib/invoices';
import { listDocuments } from '@/lib/documents';
import { DocumentForm, DocumentList } from '@/components/Documents';

export const metadata = { title: 'Client' };

export default async function Page({ params, searchParams }) {
  const { id } = await params;
  const { company } = await requireCompany();
  const client = await one('SELECT * FROM clients WHERE id = $1 AND company_id = $2', [Number(id) || 0, company.id]);
  if (!client) notFound();
  const invoices = (await listInvoices(company.id)).filter((i) => i.client_id === client.id);
  const docs = await listDocuments(company.id, { clientId: client.id });

  return (
    <>
      <div className="page-head">
        <div><Link href="/clients">← Clients</Link><h1>{client.name}</h1></div>
        <div className="actions"><Link className="button" href={`/factures/nouvelle?client=${client.id}`}>Nouvelle facture</Link></div>
      </div>
      <Flash searchParams={searchParams} />
      <div className="grid2">
        <section>
          <h2>Factures</h2>
          {invoices.length ? <InvoiceTable invoices={invoices} /> : <p className="empty">Aucune facture pour ce client.</p>}
        </section>
        <section id="modifier">
          <h2>Modifier le client</h2>
          <p className="hint">Les factures déjà émises gardent les coordonnées du jour de leur émission ; les prochaines utiliseront celles-ci.</p>
          <form action={updateClient} className="stack">
            <input type="hidden" name="id" value={client.id} />
            <ClientFields c={client} />
            <div><button>Enregistrer les modifications</button></div>
          </form>
          {!invoices.length && (
            <form action={deleteClient} style={{ marginTop: 20 }}>
              <input type="hidden" name="id" value={client.id} />
              <button className="danger">Supprimer ce client</button>
            </form>
          )}
        </section>
      </div>

      <section id="documents">
        <h2>Documents de ce client</h2>
        <p className="hint">Contrat, bon de commande, devis signé… rangés avec sa fiche.</p>
        <div className="grid2 docs-layout">
          <DocumentList docs={docs} showClient={false} clientId={client.id} />
          <details className="add-doc">
            <summary>Ajouter un document</summary>
            <DocumentForm clientId={client.id} />
          </details>
        </div>
      </section>
    </>
  );
}
