import Link from 'next/link';
import Logo from '@/components/Logo';
import { getByVerifyCode, issuedCompany } from '@/lib/invoices';
import { getPayslipByNumber } from '@/lib/payroll';
import { MONTHS } from '@/lib/rh-constants';
import { fingerprint, payslipFingerprint, formatCode, normalizeCode } from '@/lib/verify';
import { money } from '@/lib/money';
import { frDate } from '@/lib/dates';

export const metadata = { title: 'Vérification de document', robots: { index: false, follow: false } };

// Page publique ouverte par le QR code : le document existe-t-il, qui l'a émis, pour quel montant, où en est-il ?
export default async function Page({ params }) {
  const { code } = await params;
  const decodedCode = decodeURIComponent(code || '');
  const invoiceFound = await getByVerifyCode(decodedCode);

  if (invoiceFound) {
    const { invoice: inv } = invoiceFound;
    const co = issuedCompany(inv, invoiceFound.company);
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

  // Vérification d'un bulletin de paie par son numéro
  const payslipFound = await getPayslipByNumber(decodedCode);
  if (payslipFound) {
    const cur = payslipFound.currency || payslipFound.company_currency || 'XOF';
    const monthName = MONTHS[payslipFound.period_month - 1];
    const isPaid = payslipFound.status === 'paye';

    return (
      <main className="auth verify">
        <Link href="/" className="logo"><Logo height={44} /></Link>
        <div className="card">
          <p className="verify-badge ok">✓ Bulletin de paie authentique</p>
          <h1>Bulletin {payslipFound.number}</h1>
          <p className="hint">Ce bulletin de salaire a été certifié par FactPay RH. Comparez les montants et informations avec le document physique.</p>
          <dl className="calc verify-facts">
            <div><dt>Employeur</dt><dd>{payslipFound.company_name}{payslipFound.company_legal_ids && <span className="sub">{payslipFound.company_legal_ids}</span>}</dd></div>
            <div><dt>Salarié</dt><dd>{payslipFound.first_name} {payslipFound.last_name}{payslipFound.cnss_number && <span className="sub">CNSS : {payslipFound.cnss_number}</span>}</dd></div>
            <div><dt>Période</dt><dd>{monthName} {payslipFound.period_year}</dd></div>
            <div><dt>Salaire Brut</dt><dd>{money(payslipFound.gross_salary, cur)}</dd></div>
            <div><dt>Retenues / Cotisations</dt><dd style={{ color: '#DC2626' }}>− {money(payslipFound.total_deductions, cur)}</dd></div>
            <div className="calc-total"><dt>Net à payer</dt><dd>{money(payslipFound.net_salary, cur)}</dd></div>
          </dl>
          <p className={`verify-state ${isPaid ? 'ok' : 'wait'}`}>
            {isPaid ? `Salaire réglé le ${frDate(payslipFound.payment_date)}.` : 'Bulletin validé en attente de règlement.'}
          </p>
          <p className="help" style={{ margin: 0 }}>
            Réf. {payslipFound.number} · Empreinte {payslipFingerprint(payslipFound, payslipFound.company_name)}
          </p>
        </div>
        <p className="below"><Link href="/verifier">Vérifier un autre document</Link></p>
      </main>
    );
  }

  // Document non reconnu
  return (
    <main className="auth verify">
      <Link href="/" className="logo"><Logo height={44} /></Link>
      <div className="card">
        <p className="verify-badge bad">✕ Document non reconnu</p>
        <h1>Document non reconnu</h1>
        <p className="hint">Aucun document émis via FactPay ne correspond à la référence <strong>{decodedCode}</strong>. Vérifiez la saisie ; si le code est correct, ce document n'a pas été émis par FactPay et peut être un faux.</p>
        <Link className="button secondary" href="/verifier">Saisir un autre code</Link>
      </div>
    </main>
  );
}
