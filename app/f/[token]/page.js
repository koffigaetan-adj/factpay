import { notFound } from 'next/navigation';
import Flash from '@/components/Flash';
import CurrencySwitch from '@/components/CurrencySwitch';
import { declarePayment, contactCompany, answerQuote } from '@/app/actions';
import { getInvoiceByToken, issuedCompany, isQuote } from '@/lib/invoices';
import { money, altMoney, short, num, rateLabel, fixedRate } from '@/lib/money';
import { frDate } from '@/lib/dates';
import { logoUrl } from '@/lib/url';
import { paymentItems } from '@/lib/payment';
import BrandBadge from '@/components/BrandBadge';
import SubmitButton from '@/components/SubmitButton';
import Logo from '@/components/Logo';
import { lineNote, withholdingLabel } from '@/lib/invoice-text';

export const metadata = { title: 'Facture', robots: { index: false } };

// Page publique de la facture, ouverte par le client avec le lien secret reçu par e-mail
export default async function Page({ params, searchParams }) {
  const { token } = await params;
  const found = await getInvoiceByToken(token);
  if (!found || !found.invoice.number) notFound();
  const { invoice: inv } = found;
  // Identité de l'entreprise telle qu'à l'émission ; moyens de paiement à jour
  const co = issuedCompany(inv, found.company);
  const quote = isQuote(inv);
  const word = quote ? 'Devis' : 'Facture';
  const cur = inv.currency;
  const withAlt = !!(inv.alt_currency && inv.alt_rate);

  // Chaque montant existe dans les deux devises ; le sélecteur choisit lequel est visible
  const Amount = ({ n }) => (withAlt
    ? <><span className="m-main">{money(n, cur)}</span><span className="m-alt">{altMoney(n, inv)}</span></>
    : money(n, cur));

  const sp = (await searchParams) || {};
  let action;
  if (quote) {
    // Devis : le client l'accepte ou le refuse
    if (['acceptee', 'convertie'].includes(inv.status)) {
      action = <div className="done paid"><h2>Devis accepté</h2><p>Vous avez accepté ce devis le {frDate(inv.accepted_at)}{inv.accepted_by ? `, signé « ${inv.accepted_by} »` : ''}. {co.name} a été prévenu et vous enverra la facture.</p></div>;
    } else if (inv.status === 'refusee') {
      action = <div className="done void"><h2>Devis refusé</h2><p>Vous avez refusé ce devis le {frDate(inv.refused_at)}. {co.name} a été prévenu.</p></div>;
    } else {
      action = (
        <form action={answerQuote} className="stack pay">
          <input type="hidden" name="token" value={inv.token} />
          <h2>Votre réponse</h2>
          <p className="hint">Ce devis est valable jusqu'au {frDate(inv.due_date)}. Pour l'accepter, signez-le en tapant votre nom : {co.name} sera prévenu.</p>
          <Flash searchParams={searchParams} />
          <label>Nom et prénom du signataire<input name="signed_by" maxLength={120} autoComplete="name" placeholder="Ex. Afi Mensah, directrice" /></label>
          <label className="check"><input type="checkbox" name="agree" /><span>Bon pour accord : j'accepte ce devis de {co.name} pour un montant de {money(inv.amount_due, cur)}.</span></label>
          <div className="answer">
            <SubmitButton name="answer" value="accepter" pendingText="Signature...">Signer et accepter le devis</SubmitButton>
            <SubmitButton name="answer" value="refuser" className="secondary" formNoValidate pendingText="Refus...">Refuser</SubmitButton>
          </div>
        </form>
      );
    }
  } else if (inv.status === 'annulee') {
    action = (
      <div className="done void"><h2>Facture annulée</h2>
        <p>{co.name} a annulé cette facture le {frDate(inv.cancelled_at)}. Vous n'avez rien à régler à ce titre.</p>
        {inv.credit_number && <p><a href={`/f/${inv.token}/avoir`}>Télécharger l'avoir {inv.credit_number}</a></p>}
        {inv.cancel_reason && <p className="muted">Motif : {inv.cancel_reason}</p>}
      </div>
    );
  } else if (inv.status === 'payee') {
    action = <div className="done paid"><h2>Paiement reçu</h2><p>{co.name} a confirmé la réception de votre paiement le {frDate(inv.confirmed_at)}. Merci.</p></div>;
  } else if (inv.status === 'signalee') {
    action = (
      <div className="done"><h2>Paiement signalé</h2>
        <p>Vous avez signalé ce paiement le {frDate(inv.paid_declared_at)} avec la référence <strong>{inv.payment_ref}</strong>. {co.name} a été prévenu et confirmera la réception.</p>
      </div>
    );
  } else {
    action = (
      <form action={declarePayment} className="stack pay">
        <input type="hidden" name="token" value={inv.token} />
        <h2>Vous avez payé ?</h2>
        <p className="hint">Indiquez la référence du virement ou l'ID de transaction Mobile Money, et joignez une capture ou le reçu.</p>
        <Flash searchParams={searchParams} />
        <label>Référence ou ID de transaction<input name="reference" required maxLength={120} placeholder="Ex. référence bancaire ou ID Flooz / Mixx by Yas" /></label>
        <label>Justificatif <span className="help">image ou PDF, 4 Mo maximum</span>
          <input name="justificatif" type="file" accept="image/*,application/pdf" required />
        </label>
        <SubmitButton pendingText="Signalement...">Signaler la facture comme payée</SubmitButton>
      </form>
    );
  }

  return (
    <main className="narrow">
      <article className="sheet">
        <header className="sheet-head">
          <div>
            <h1>{word} {inv.number}</h1>
            <p className="sub">{quote ? 'Émis' : 'Émise'} le {frDate(inv.issue_date)}</p>
          </div>
          <address>
            {logoUrl(co) && <img src={logoUrl(co)} alt={co.name} className="co-logo" />}
            <strong>{co.name}</strong>
            {[co.address, co.phone, co.email, co.legal_ids].filter(Boolean).map((v) => <span key={v}><br />{v}</span>)}
          </address>
        </header>
        {withAlt && <CurrencySwitch main={short(cur)} alt={short(inv.alt_currency)} />}
        <p className="billed"><span className="sub">{quote ? 'Destinataire' : 'Facturé à'}</span><strong>{inv.client_name}</strong>{inv.client_address && <><br />{inv.client_address}</>}</p>
        {inv.title && <p><strong>{inv.title}</strong></p>}
        <div className="scroll">
          <table>
            <thead><tr><th>Description</th><th className="n">Quantité</th><th className="n hide-sm">Prix unitaire</th><th className="n">Montant</th></tr></thead>
            <tbody>
              {inv.lines.map((l) => (
                <tr key={l.id}>
                  <td>{l.description}{lineNote(l, inv) && <span className="sub">{lineNote(l, inv)}</span>}</td>
                  <td className="n">{l.kind === 'prime' ? (l.quantity !== 1 ? `× ${num(l.quantity)}` : '') : `${num(l.quantity)} ${l.unit}`}</td>
                  <td className="n hide-sm">{(l.kind !== 'prime' || l.quantity !== 1) && <Amount n={l.unit_price} />}</td>
                  <td className="n"><Amount n={l.amount} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {inv.vat_rate > 0 && (
          <div className="subtotals">
            <span>Total HT : <Amount n={inv.subtotal} /></span>
            <span>TVA {num(inv.vat_rate)} % : <Amount n={inv.vat_amount} /></span>
          </div>
        )}
        {inv.withholding_amount > 0 && (
          <div className="subtotals">
            <span>Total{inv.vat_rate > 0 ? ' TTC' : ''} : <Amount n={inv.total} /></span>
            <span>{withholdingLabel(inv)}, retenue par vos soins : − <Amount n={inv.withholding_amount} /></span>
          </div>
        )}
        <div className="due">
          <span>{quote ? `${inv.withholding_amount > 0 ? 'Net' : 'Total'} · valable jusqu'au ${frDate(inv.due_date)}` : inv.status === 'annulee' ? 'Facture annulée, rien à régler' : inv.status === 'payee'
            ? `${inv.withholding_amount > 0 ? 'Net payé' : 'Total payé'} le ${frDate(inv.confirmed_at)}`
            : `${inv.withholding_amount > 0 ? 'Net à payer' : 'Total à payer'} avant le ${frDate(inv.due_date)}`}</span>
          <strong><Amount n={inv.amount_due} /></strong>
        </div>
        {withAlt && (
          <p className="rate">
            soit <span className="m-main">{altMoney(inv.amount_due, inv)}</span><span className="m-alt">{money(inv.amount_due, cur)}</span>.
            {' '}Taux : {rateLabel(cur, inv.alt_currency, inv.alt_rate)}.
          </p>
        )}
        {!quote && inv.status !== 'annulee' && <ul className="bank">
          {paymentItems(co).map((p) => (
            <li key={p.label + p.value} className="pay-item"><BrandBadge name={p.brand} size={26} /><span>{p.label} : <strong>{p.value}</strong></span></li>
          ))}
          <li>Référence à indiquer : <strong>{inv.number}</strong></li>
        </ul>}
        {inv.notes && <p className="muted">{inv.notes}</p>}
        <p className="pdf-link"><a href={`/f/${inv.token}/pdf`}>Télécharger {quote ? 'le devis' : 'la facture'} en PDF</a></p>
      </article>
      {action}

      <section className="contact" id="contact" aria-labelledby="contact-title">
        <h2 id="contact-title">Une question sur {quote ? 'ce devis' : 'cette facture'} ?</h2>
        <p className="hint">Écrivez directement à {co.name}. La réponse arrivera à {inv.client_email}.</p>
        {sp.contact && <p className="flash" role="status">{sp.contact}</p>}
        {sp.contact_erreur && <p className="flash err" role="alert">{sp.contact_erreur}</p>}
        <form action={contactCompany} className="stack">
          <input type="hidden" name="token" value={inv.token} />
          <label>Votre message<textarea name="message" rows={3} required minLength={3} maxLength={2000} placeholder="Ex. Pouvez-vous ajouter notre numéro de bon de commande ?" /></label>
          <div><SubmitButton className="secondary" pendingText="Envoi...">Envoyer le message</SubmitButton></div>
        </form>
      </section>
      <a href="/" className="made-with">Facture émise avec <Logo height={22} /></a>
    </main>
  );
}
