import Link from 'next/link';
import Flash from '@/components/Flash';
import InvoiceTable from '@/components/InvoiceTable';
import { requireCompany } from '@/lib/auth';
import { listInvoices } from '@/lib/invoices';
import { q } from '@/lib/db';
import { money, moneyAlt, round2 } from '@/lib/money';

export const metadata = { title: 'Tableau de bord' };

export default async function Page({ searchParams }) {
  const { company } = await requireCompany();
  const [invoices, clients] = await Promise.all([
    listInvoices(company.id),
    q('SELECT count(*)::int AS n FROM clients WHERE company_id = $1', [company.id]),
  ]);
  const cur = company.currency;
  const year = String(new Date().getUTCFullYear());

  // Les totaux ne comptent que les factures dans la devise actuelle de l'entreprise
  const mine = invoices.filter((i) => i.currency === cur);
  const open = mine.filter((i) => ['emise', 'envoyee', 'signalee'].includes(i.status));
  const toCollect = open.reduce((s, i) => s + i.total, 0);
  const paidYear = mine.filter((i) => i.status === 'payee' && new Date(i.confirmed_at).getUTCFullYear() === Number(year));
  const cashed = paidYear.reduce((s, i) => s + i.total, 0);
  // Impôts à mettre de côté : sur le montant hors TVA (la TVA est reversée à l'État)
  const reserve = round2(paidYear.reduce((s, i) => s + i.subtotal, 0) * (company.tax_reserve_rate / 100));
  const vatDue = paidYear.reduce((s, i) => s + i.vat_amount, 0);
  const net = cashed - reserve - vatDue;
  const toCheck = invoices.filter((i) => i.status === 'signalee');

  return (
    <>
      <div className="page-head">
        <h1>Tableau de bord</h1>
        <div className="actions"><Link className="button" href="/factures/nouvelle">Nouvelle facture</Link></div>
      </div>
      <Flash searchParams={searchParams} />

      {clients[0].n === 0 && (
        <section>
          <h2>Pour commencer</h2>
          <p className="hint">Ajoute ton premier client, puis crée ta première facture.</p>
          <Link className="button" href="/clients">Ajouter un client</Link>
        </section>
      )}

      <section>
        <dl className="totals">
          <div><dt>À encaisser</dt><dd>{money(toCollect, cur)}</dd>{company.show_alt_currency && <span className="sub">{moneyAlt(toCollect, cur)}</span>}</div>
          <div><dt>Net pour toi en {year}</dt><dd className="big">{money(net, cur)}</dd>{company.show_alt_currency && <span className="sub">{moneyAlt(net, cur)}</span>}</div>
          <div><dt>Encaissé en {year}</dt><dd>{money(cashed, cur)}</dd></div>
          {company.tax_reserve_rate > 0 && <div><dt>Mis de côté pour les impôts ({company.tax_reserve_rate} %)</dt><dd>{money(reserve, cur)}</dd></div>}
          {vatDue > 0 && <div><dt>TVA collectée</dt><dd>{money(vatDue, cur)}</dd></div>}
        </dl>
      </section>

      {toCheck.length > 0 && (
        <section>
          <h2>Paiements à vérifier</h2>
          <p className="hint">Ces clients ont signalé leur paiement. Vérifie que l'argent est arrivé, puis confirme.</p>
          <InvoiceTable invoices={toCheck} />
        </section>
      )}

      <section>
        <h2>Dernières factures</h2>
        {invoices.length
          ? <InvoiceTable invoices={invoices.slice(0, 8)} />
          : <p className="empty">Pas encore de facture.</p>}
        {invoices.length > 8 && <Link href="/factures">Voir toutes les factures</Link>}
      </section>
    </>
  );
}
