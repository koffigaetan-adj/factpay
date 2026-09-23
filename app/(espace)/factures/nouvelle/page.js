import Link from 'next/link';
import Flash from '@/components/Flash';
import InvoiceEditor from '@/components/InvoiceEditor';
import ClientFields from '@/components/ClientFields';
import { createClient } from '@/app/actions';
import { requireCompany } from '@/lib/auth';
import { q } from '@/lib/db';
import { addDays, today } from '@/lib/dates';

export const metadata = { title: 'Nouvelle facture' };

export default async function Page({ searchParams }) {
  const { company } = await requireCompany();
  const sp = await searchParams;
  const clients = await q('SELECT id, name, email FROM clients WHERE company_id = $1 ORDER BY name', [company.id]);

  return (
    <>
      <div className="page-head">
        <div><Link href="/factures">← Factures</Link><h1>Nouvelle facture</h1></div>
      </div>
      <Flash searchParams={searchParams} />
      {clients.length ? (
        <InvoiceEditor
          clients={clients}
          invoice={sp.client ? { client_id: Number(sp.client) } : null}
          currency={company.currency}
          showAlt={company.show_alt_currency}
          defaultVat={company.default_vat_rate}
          tomorrow={addDays(today(), 1)}
        />
      ) : (
        <section>
          <h2>D'abord, ton client</h2>
          <p className="hint">Il faut un client pour créer une facture.</p>
          <form action={createClient} className="stack" style={{ maxWidth: 480 }}>
            <input type="hidden" name="next" value="facture" />
            <ClientFields />
            <div><button>Ajouter le client</button></div>
          </form>
        </section>
      )}
    </>
  );
}
