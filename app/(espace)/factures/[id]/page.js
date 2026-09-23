import Link from 'next/link';
import { notFound } from 'next/navigation';
import Flash from '@/components/Flash';
import { sendInvoiceNow, confirmInvoicePayment, deleteInvoice } from '@/app/actions';
import { requireCompany } from '@/lib/auth';
import { getInvoice, payUrl, EDITABLE } from '@/lib/invoices';
import { money, moneyAlt, num } from '@/lib/money';
import { frDate } from '@/lib/dates';
import { statusOf } from '@/lib/status';

export const metadata = { title: 'Facture' };

export default async function Page({ params, searchParams }) {
  const { id } = await params;
  const { company } = await requireCompany();
  const inv = await getInvoice(company.id, id);
  if (!inv) notFound();
  const st = statusOf(inv);
  const cur = inv.currency;
  const editable = EDITABLE.includes(inv.status);
  const hidden = <input type="hidden" name="id" value={inv.id} />;

  return (
    <>
      <div className="page-head">
        <div>
          <Link href="/factures">← Factures</Link>
          <h1>{inv.number ? `Facture ${inv.number}` : 'Brouillon'}</h1>
          <span className={`status ${st.cls}`}>{st.label}</span>
        </div>
        <div className="actions">
          <a className="button secondary" href={`/factures/${inv.id}/pdf`} target="_blank" rel="noopener">PDF</a>
          {editable && <Link className="button secondary" href={`/factures/${inv.id}/modifier`}>Modifier</Link>}
          {inv.status !== 'payee' && (
            <form action={sendInvoiceNow} className="inline">{hidden}
              <button className={editable ? '' : 'secondary'}>{editable ? 'Envoyer maintenant' : 'Renvoyer au client'}</button>
            </form>
          )}
          {['emise', 'envoyee', 'signalee'].includes(inv.status) && (
            <form action={confirmInvoicePayment} className="inline">{hidden}<button>Confirmer le paiement</button></form>
          )}
        </div>
      </div>
      <Flash searchParams={searchParams} />
      {inv.send_error && <p className="flash err">Dernier envoi échoué : {inv.send_error}. Nouvel essai automatique chaque jour, ou clique sur « Renvoyer ».</p>}

      <div className="grid2">
        <section>
          <h2>{inv.client_name}</h2>
          <p className="muted" style={{ marginTop: 0 }}>{inv.client_email}</p>
          {inv.title && <p><strong>{inv.title}</strong></p>}
          <div className="scroll">
            <table>
              <thead><tr><th>Description</th><th className="n">Quantité</th><th className="n">Prix unitaire</th><th className="n">Montant</th></tr></thead>
              <tbody>
                {inv.lines.map((l) => (
                  <tr key={l.id}>
                    <td>{l.description}</td>
                    <td className="n">{num(l.quantity)} {l.unit}</td>
                    <td className="n">{money(l.unit_price, cur)}</td>
                    <td className="n">{money(l.amount, cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="sum">
            {inv.vat_rate > 0 && <div><span>Total HT</span><span>{money(inv.subtotal, cur)}</span></div>}
            {inv.vat_rate > 0 && <div><span>TVA {num(inv.vat_rate)} %</span><span>{money(inv.vat_amount, cur)}</span></div>}
            <div className="total"><span>Total</span><span>{money(inv.total, cur)}</span></div>
            {company.show_alt_currency && <div className="muted"><span>soit</span><span>{moneyAlt(inv.total, cur)}</span></div>}
          </div>
          {inv.notes && <p className="muted">{inv.notes}</p>}
        </section>

        <section>
          <h2>Suivi</h2>
          <dl className="stack" style={{ margin: 0 }}>
            {inv.send_on && editable && <div><dt className="sub">Envoi automatique prévu</dt><dd style={{ margin: 0 }}>{frDate(inv.send_on)}</dd></div>}
            {inv.issue_date && <div><dt className="sub">Émise le</dt><dd style={{ margin: 0 }}>{frDate(inv.issue_date)}</dd></div>}
            {inv.due_date && <div><dt className="sub">Échéance</dt><dd style={{ margin: 0 }}>{frDate(inv.due_date)}</dd></div>}
            {inv.sent_at && <div><dt className="sub">Envoyée au client</dt><dd style={{ margin: 0 }}>{frDate(inv.sent_at)}</dd></div>}
            {inv.paid_declared_at && (
              <div>
                <dt className="sub">Paiement signalé par le client</dt>
                <dd style={{ margin: 0 }}>
                  {frDate(inv.paid_declared_at)}, référence <strong>{inv.payment_ref}</strong><br />
                  <a href={`/factures/${inv.id}/justificatif`} target="_blank" rel="noopener">Voir le justificatif</a>
                </dd>
              </div>
            )}
            {inv.confirmed_at && <div><dt className="sub">Paiement confirmé</dt><dd style={{ margin: 0 }}>{frDate(inv.confirmed_at)}</dd></div>}
          </dl>
          {inv.number && (
            <p style={{ marginTop: 20 }}>
              <span className="sub">Lien envoyé au client</span>
              <a href={payUrl(inv)} target="_blank" rel="noopener" style={{ wordBreak: 'break-all' }}>{payUrl(inv)}</a>
            </p>
          )}
          {editable && (
            <form action={deleteInvoice} style={{ marginTop: 20 }}>{hidden}<button className="danger">Supprimer le brouillon</button></form>
          )}
        </section>
      </div>
    </>
  );
}
