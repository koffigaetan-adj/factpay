import { notFound } from 'next/navigation';
import Flash from '@/components/Flash';
import CurrencySwitch from '@/components/CurrencySwitch';
import { declarePayment } from '@/app/actions';
import { getInvoiceByToken } from '@/lib/invoices';
import { money, moneyAlt, altOf, num, rateLabel } from '@/lib/money';
import { frDate } from '@/lib/dates';

export const metadata = { title: 'Facture', robots: { index: false } };

const CUR_LABEL = { EUR: 'EUR', XOF: 'F CFA' };

// Page publique de la facture, ouverte par le client avec le lien secret reçu par e-mail
export default async function Page({ params, searchParams }) {
  const { token } = await params;
  const found = await getInvoiceByToken(token);
  if (!found || !found.invoice.number) notFound();
  const { invoice: inv, company: co } = found;
  const cur = inv.currency;
  const withAlt = co.show_alt_currency && altOf(cur);

  // Chaque montant existe dans les deux devises ; le sélecteur choisit lequel est visible
  const Amount = ({ n }) => (withAlt
    ? <><span className="m-main">{money(n, cur)}</span><span className="m-alt">{moneyAlt(n, cur)}</span></>
    : money(n, cur));

  let action;
  if (inv.status === 'payee') {
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
        <label>Référence ou ID de transaction<input name="reference" required maxLength={120} placeholder="Ex. référence bancaire ou ID Flooz / T-Money" /></label>
        <label>Justificatif <span className="help">image ou PDF, 4 Mo maximum</span>
          <input name="justificatif" type="file" accept="image/*,application/pdf" required />
        </label>
        <button>Signaler la facture comme payée</button>
      </form>
    );
  }

  return (
    <main className="narrow">
      <article className="sheet">
        <header className="sheet-head">
          <div>
            <h1>Facture {inv.number}</h1>
            <p className="sub">Émise le {frDate(inv.issue_date)}</p>
          </div>
          <address>
            <strong>{co.name}</strong>
            {[co.address, co.phone, co.email, co.legal_ids].filter(Boolean).map((v) => <span key={v}><br />{v}</span>)}
          </address>
        </header>
        {withAlt && <CurrencySwitch main={CUR_LABEL[cur]} alt={CUR_LABEL[altOf(cur)]} />}
        <p className="billed"><span className="sub">Facturé à</span><strong>{inv.client_name}</strong>{inv.client_address && <><br />{inv.client_address}</>}</p>
        {inv.title && <p><strong>{inv.title}</strong></p>}
        <div className="scroll">
          <table>
            <thead><tr><th>Description</th><th className="n">Quantité</th><th className="n hide-sm">Prix unitaire</th><th className="n">Montant</th></tr></thead>
            <tbody>
              {inv.lines.map((l) => (
                <tr key={l.id}>
                  <td>{l.description}</td>
                  <td className="n">{num(l.quantity)} {l.unit}</td>
                  <td className="n hide-sm"><Amount n={l.unit_price} /></td>
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
        <div className="due">
          <span>Total à payer avant le {frDate(inv.due_date)}</span>
          <strong><Amount n={inv.total} /></strong>
        </div>
        {withAlt && (
          <p className="rate">
            soit <span className="m-main">{moneyAlt(inv.total, cur)}</span><span className="m-alt">{money(inv.total, cur)}</span>.
            {' '}Parité fixe {rateLabel()}, paiement accepté dans les deux devises.
          </p>
        )}
        <ul className="bank">
          {co.iban && <li>Virement bancaire{co.bank_name && ` (${co.bank_name})`} : <strong>{co.iban}</strong>{co.bic && <>, BIC/SWIFT <strong>{co.bic}</strong></>}</li>}
          {co.mobile_money && <li>Mobile Money : <strong>{co.mobile_money}</strong></li>}
          <li>Référence à indiquer : <strong>{inv.number}</strong></li>
        </ul>
        {inv.notes && <p className="muted">{inv.notes}</p>}
        <p className="pdf-link"><a href={`/f/${inv.token}/pdf`}>Télécharger la facture en PDF</a></p>
      </article>
      {action}
    </main>
  );
}
