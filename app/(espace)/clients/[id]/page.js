import Link from 'next/link';
import BackButton from '@/components/BackButton';
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
import Modal from '@/components/Modal';
import SubmitButton from '@/components/SubmitButton';
import { pubId, idFrom } from '@/lib/ids';

export const metadata = { title: 'Client' };

export default async function Page({ params, searchParams }) {
  const { id } = await params;
  const { company } = await requireCompany();
  const client = await one('SELECT * FROM clients WHERE id = $1 AND company_id = $2', [idFrom('client', id), company.id]);
  if (!client) notFound();
  const invoices = (await listInvoices(company.id)).filter((i) => i.client_id === client.id);
  const docs = await listDocuments(company.id, { clientId: client.id });

  return (
    <>
      <div className="page-head">
        <div><BackButton href="/clients">Clients</BackButton><h1>{client.name}</h1></div>
        <div className="actions"><Link className="button" href={`/factures/nouvelle?client=${pubId('client', client.id)}`}>Nouvelle facture</Link></div>
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
            <div><SubmitButton pendingText="Enregistrement...">Enregistrer les modifications</SubmitButton></div>
          </form>
          {!invoices.length && (
            <form action={deleteClient} style={{ marginTop: 20 }}>
              <input type="hidden" name="id" value={client.id} />
              <SubmitButton className="danger" pendingText="Suppression...">Supprimer ce client</SubmitButton>
            </form>
          )}
        </section>
      </div>

      <section id="documents">
        <div className="chart-head">
          <h2>Documents de ce client</h2>
          <Modal label="Ajouter un document" title={`Ajouter un document pour ${client.name}`} buttonClass="secondary">
            <DocumentForm clientId={client.id} />
          </Modal>
        </div>
        <p className="hint">Contrat, bon de commande, devis signé… rangés avec sa fiche.</p>
        <DocumentList docs={docs} showClient={false} clientId={client.id} />
      </section>
    </>
  );
}
