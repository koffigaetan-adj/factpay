import Link from 'next/link';
import Logo from '@/components/Logo';
import { getByVerifyCode, issuedCompany } from '@/lib/invoices';
import { fingerprint, formatCode, normalizeCode } from '@/lib/verify';
import { money } from '@/lib/money';
import { frDate } from '@/lib/dates';

export const metadata = { title: 'Vérification de document', robots: { index: false, follow: false } };

// Page publique ouverte par le QR code : le document existe-t-il, qui l'a émis, pour quel montant, où en est-il ?
export default async function Page({ params }) {
  const { code } = await params;
  const found = await getByVerifyCode(code);

  if (!found) {
    return (
      <main className="auth verify">
        <Link href="/" className="logo"><Logo height={44} /></Link>
        <div className="card">
          <p className="verify-badge bad">✕ Code inconnu</p>
          <h1>Document non reconnu</h1>
          <p className="hint">Aucun document émis via FactPay ne correspond au code <strong>{formatCode(normalizeCode(code))}</strong>. Vérifiez la saisie ; si le code est correct, ce document n'a pas été émis par FactPay et peut être un faux.</p>
          <Link className="button secondary" href="/verifier">Saisir un autre code</Link>
        </div>
      </main>
    );
  }

  const { invoice: inv } = found;
  const co = issuedCompany(inv, found.company);
  const quote = inv.doc_type === 'devis';
  const word = quote ? 'Devis' : 'Facture';
  const cur = inv.currency;
  const state = inv.status === 'annulee'
    ? { cls: 'bad', text: `Annulée le ${frDate(inv.cancelled_at)}${inv.credit_number ? ` par l'avoir ${inv.credit_number}` : ''} : plus rien n'est dû au titre de cette facture.` }
    : inv.status === 'payee' ? { cls: 'ok', text: `Payée le ${frDate(inv.confirmed_at)}.` }
      : ['acceptee', 'convertie'].includes(inv.status) ? { cls: 'ok', text: `Devis accepté le ${frDate(inv.accepted_at)}${inv.accepted_by ? ` par ${inv.accepted_by}` : ''}.` }
        : inv.status === 'refusee' ? { cls: 'bad', text: 'Devis refusé.' }
          : { cls: 'wait', text: quote ? `En attente de réponse, valable jusqu'au ${frDate(inv.due_date)}.` : `En attente de paiement, échéance le ${frDate(inv.due_date)}.` };

  return (
    <main className="auth verify">
      <Link href="/" className="logo"><Logo height={44} /></Link>
      <div className="card">
        <p className="verify-badge ok">✓ Document authentique</p>
        <h1>{word} {inv.number}</h1>
        <p className="hint">Ce document a bien été émis via FactPay. Comparez les informations ci-dessous avec celles de votre document : si elles diffèrent, il a été modifié.</p>
        <dl className="calc verify-facts">
          <div><dt>Émetteur</dt><dd>{co.name}{co.legal_ids && <span className="sub">{co.legal_ids}</span>}</dd></div>
          <div><dt>{quote ? 'Destinataire' : 'Client'}</dt><dd>{inv.client_name}</dd></div>
          <div><dt>{quote ? 'Émis le' : 'Émise le'}</dt><dd>{frDate(inv.issue_date)}</dd></div>
          {inv.vat_rate > 0 && <div><dt>Total HT</dt><dd>{money(inv.subtotal, cur)}</dd></div>}
          <div><dt>Total{inv.vat_rate > 0 ? ' TTC' : ''}</dt><dd>{money(inv.total, cur)}</dd></div>
          {inv.withholding_amount > 0 && <div><dt>Retenue</dt><dd>− {money(inv.withholding_amount, cur)}</dd></div>}
          <div className="calc-total"><dt>{inv.withholding_amount > 0 ? 'Net' : 'Montant'}</dt><dd>{money(inv.amount_due, cur)}</dd></div>
        </dl>
        <p className={`verify-state ${state.cls}`}>{state.text}</p>
        <p className="help" style={{ margin: 0 }}>Code {formatCode(inv.verify_code)} · Empreinte {fingerprint(inv, co.name)}</p>
      </div>
      <p className="below"><Link href="/verifier">Vérifier un autre document</Link></p>
    </main>
  );
}
