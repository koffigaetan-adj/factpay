import Link from 'next/link';
import Flash from '@/components/Flash';
import { createClient } from '@/app/actions';
import { requireCompany } from '@/lib/auth';
import { q } from '@/lib/db';
import { money } from '@/lib/money';
import ClientFields from '@/components/ClientFields';

export const metadata = { title: 'Clients' };

export default async function Page({ searchParams }) {
  const { company } = await requireCompany();
  const clients = await q(`SELECT c.*, count(i.id)::int AS invoice_count,
      coalesce(sum(i.total) FILTER (WHERE i.status IN ('emise', 'envoyee', 'signalee')), 0) AS open_total
    FROM clients c LEFT JOIN invoices i ON i.client_id = c.id
    WHERE c.company_id = $1 GROUP BY c.id ORDER BY c.name`, [company.id]);

  return (
    <>
      <div className="page-head"><h1>Clients</h1></div>
      <Flash searchParams={searchParams} />
      <div className="grid2">
        <section>
          {clients.length ? (
            <div className="scroll">
              <table>
                <thead><tr><th>Client</th><th className="n">Factures</th><th className="n">À encaisser</th></tr></thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id}>
                      <td><Link className="row-link" href={`/clients/${c.id}`}>{c.name}</Link><span className="sub">{c.email}</span></td>
                      <td className="n">{c.invoice_count}</td>
                      <td className="n">{money(c.open_total, company.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="empty">Aucun client pour l'instant. Ajoute le premier avec le formulaire.</p>}
        </section>
        <section>
          <h2>Nouveau client</h2>
          <form action={createClient} className="stack">
            <ClientFields />
            <div><button>Ajouter le client</button></div>
          </form>
        </section>
      </div>
    </>
  );
}
