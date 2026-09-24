import Link from 'next/link';
import { notFound } from 'next/navigation';
import Flash from '@/components/Flash';
import { sendInvoiceNow, confirmInvoicePayment, deleteInvoice, resendReceipt, cancelInvoice, reopenPayment } from '@/app/actions';
import { requireCompany } from '@/lib/auth';
import { getInvoice, payUrl, EDITABLE, CANCELLABLE, listMessages } from '@/lib/invoices';
import { money, altMoney, num, rateLabel } from '@/lib/money';
import { frDate, today } from '@/lib/dates';
import { paymentMethodOptions } from '@/lib/payment';
import { lineNote, withholdingLabel } from '@/lib/invoice-text';
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
  const messages = inv.number ? await listMessages(inv.id) : [];

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
          {!['payee', 'annulee'].includes(inv.status) && (
            <form action={sendInvoiceNow} className="inline">{hidden}
              <button className={editable ? '' : 'secondary'}>{editable ? 'Envoyer maintenant' : 'Renvoyer au client'}</button>
            </form>
          )}
          {['emise', 'envoyee', 'signalee'].includes(inv.status) && <a className="button" href="#statut">Marquer comme payée</a>}
          {inv.status === 'payee' && (
            <form action={resendReceipt} className="inline">{hidden}<button className="secondary">Renvoyer la facture payée</button></form>
          )}
        </div>
      </div>
      <Flash searchParams={searchParams} />
      {inv.send_error && <p className="flash err">Dernier envoi échoué : {inv.send_error}. Nouvel essai automatique chaque jour, ou clique sur « Renvoyer ».</p>}

      <div className="grid2">
        <section>
          <h2><Link href={`/clients/${inv.client_id}`}>{inv.client_name}</Link></h2>
          <p className="muted" style={{ marginTop: 0 }}>{inv.client_email}</p>
          {inv.title && <p><strong>{inv.title}</strong></p>}
          <div className="scroll">
            <table>
              <thead><tr><th>Description</th><th className="n">Quantité</th><th className="n">Prix unitaire</th><th className="n">Montant</th></tr></thead>
              <tbody>
                {inv.lines.map((l) => (
                  <tr key={l.id}>
                    <td>{l.description}{lineNote(l, inv) && <span className="sub">{lineNote(l, inv)}</span>}</td>
                    <td className="n">{l.kind === 'prime' ? (l.quantity !== 1 ? `× ${num(l.quantity)}` : '') : `${num(l.quantity)} ${l.unit}`}</td>
                    <td className="n">{l.kind === 'prime' && l.quantity === 1 ? '' : money(l.unit_price, cur)}</td>
                    <td className="n">{money(l.amount, cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="sum">
            {inv.vat_rate > 0 && <div><span>Total HT</span><span>{money(inv.subtotal, cur)}</span></div>}
            {inv.vat_rate > 0 && <div><span>TVA {num(inv.vat_rate)} %</span><span>{money(inv.vat_amount, cur)}</span></div>}
            <div className="total"><span>Total{inv.vat_rate > 0 ? ' TTC' : ''}</span><span>{money(inv.total, cur)}</span></div>
            {inv.withholding_amount > 0 && (
              <>
                <div><span>{withholdingLabel(inv)}</span><span>− {money(inv.withholding_amount, cur)}</span></div>
                <div className="total"><span>Net à payer</span><span>{money(inv.amount_due, cur)}</span></div>
              </>
            )}
            {inv.alt_currency && (
              <div className="muted"><span>soit</span><span>{altMoney(inv.amount_due, inv)}</span></div>
            )}
            {inv.alt_currency && <p className="help" style={{ textAlign: 'right', margin: 0 }}>{rateLabel(cur, inv.alt_currency, inv.alt_rate)}</p>}
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
            {inv.confirmed_at && (
              <div><dt className="sub">Payée le</dt><dd style={{ margin: 0 }}>{frDate(inv.confirmed_at)}{inv.payment_method && ` · ${inv.payment_method}`}{inv.payment_ref && !inv.paid_declared_at && ` · réf. ${inv.payment_ref}`}</dd></div>
            )}
            {inv.receipt_sent_at && <div><dt className="sub">Facture payée envoyée au client</dt><dd style={{ margin: 0 }}>{frDate(inv.receipt_sent_at)}</dd></div>}
            {inv.cancelled_at && (
              <div><dt className="sub">Annulée</dt><dd style={{ margin: 0 }}>{frDate(inv.cancelled_at)}{inv.cancel_reason && <><br /><span className="muted">Motif : {inv.cancel_reason}</span></>}</dd></div>
            )}
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
          {['emise', 'envoyee', 'signalee'].includes(inv.status) && (
            <div className="status-box" id="statut">
              <h3>Marquer comme payée</h3>
              <p className="help">
                {inv.status === 'signalee'
                  ? "Le client a signalé son paiement. Vérifie que l'argent est arrivé, puis confirme."
                  : "Même si le client n'a rien signalé : par exemple un paiement en espèces ou un virement reçu directement."}
              </p>
              <form action={confirmInvoicePayment} className="stack">{hidden}
                <div className="row">
                  <label>Date du paiement<input type="date" name="paid_on" required defaultValue={today()} max={today()} /></label>
                  <label>Moyen
                    <select name="method" defaultValue="">
                      <option value="">Non précisé</option>
                      {paymentMethodOptions(company).map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </label>
                </div>
                <label>Référence <span className="help">facultatif</span>
                  <input name="reference" maxLength={120} defaultValue={inv.payment_ref || ''} placeholder="Ex. ID de transaction, numéro de reçu" />
                </label>
                <label className="check"><input type="checkbox" name="notify" defaultChecked /><span>Envoyer au client sa facture marquée « payée »</span></label>
                <div><button>Marquer comme payée</button></div>
              </form>
            </div>
          )}
          {inv.status === 'payee' && (
            <details className="cancel">
              <summary>Remettre en attente de paiement</summary>
              <form action={reopenPayment} className="stack">{hidden}
                <p className="help" style={{ margin: 0 }}>À utiliser si la facture a été marquée payée par erreur. Elle repasse en attente et sort de l'encaissé.{inv.receipt_sent_at ? ' Le client a déjà reçu la facture payée : préviens-le.' : ''}</p>
                <div><button className="danger">Remettre en attente</button></div>
              </form>
            </details>
          )}
          {CANCELLABLE.includes(inv.status) && (
            <details className="cancel">
              <summary>Annuler cette facture</summary>
              <form action={cancelInvoice} className="stack">{hidden}
                <p className="help" style={{ margin: 0 }}>Possible tant que le client n'a pas signalé de paiement. La facture garde son numéro, le lien de paiement est désactivé et le client est prévenu par e-mail.</p>
                <label>Motif <span className="help">facultatif, transmis au client</span>
                  <textarea name="reason" rows={2} maxLength={500} placeholder="Ex. Erreur sur le nombre de jours, une facture corrigée va suivre." />
                </label>
                <div><button className="danger">Annuler la facture</button></div>
              </form>
            </details>
          )}
        </section>
      </div>

      {messages.length > 0 && (
        <section className="messages">
          <h2>Messages du client</h2>
          <p className="hint">Envoyés depuis la page de la facture. Tu les as aussi reçus par e-mail : réponds depuis ta messagerie.</p>
          <ol>
            {messages.map((m) => (
              <li key={m.id}><span className="sub">{frDate(m.created_at)}</span><p>{m.body}</p></li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}
