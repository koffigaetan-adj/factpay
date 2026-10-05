import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import Link from 'next/link';
import Flash from '@/components/Flash';
import CurrencySwitch from '@/components/CurrencySwitch';
import { declarePayment, contactCompany, answerQuote } from '@/app/actions';
import { getInvoiceByToken, issuedCompany, isQuote } from '@/lib/invoices';
import { money, altMoney, short, num, rateLabel } from '@/lib/money';
import { frDate } from '@/lib/dates';
import { logoUrl } from '@/lib/url';
import { verifyFlash } from '@/lib/flash';
import { paymentItems } from '@/lib/payment';
import { verifyUrl, formatCode, fingerprint } from '@/lib/verify';
import BrandBadge from '@/components/BrandBadge';
import SubmitButton from '@/components/SubmitButton';
import Logo from '@/components/Logo';
import Icon from '@/components/Icon';
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
  let enabledPayKeys = null;
  if (inv.payment_methods) {
    try { enabledPayKeys = JSON.parse(inv.payment_methods); } catch {}
  }
  const payItems = paymentItems(co, enabledPayKeys);

  // QR Code d'authenticité généré côté serveur
  const qrDataUrl = inv.verify_code
    ? await QRCode.toDataURL(verifyUrl(inv.verify_code), {
        margin: 1,
        width: 180,
        color: { dark: '#0F172A', light: '#FFFFFF' },
      }).catch(() => null)
    : null;

  const docFingerprint = inv.verify_code ? fingerprint(inv, co.name) : null;

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
          <p className="hint">Ce devis est valable jusqu'au {frDate(inv.due_date)}. Pour l'accepter, tapez votre nom et prénom : {co.name} sera prévenu immédiatement.</p>
          <Flash searchParams={searchParams} />
          <label>Nom et prénom du signataire<input name="signed_by" maxLength={120} autoComplete="name" placeholder="Ex. Afi Mensah, directrice" /></label>
          <label className="check"><input type="checkbox" name="agree" /><span>Bon pour accord : j'accepte ce devis de {co.name} pour un montant de {money(inv.amount_due, cur)}.</span></label>
          <div className="answer">
            <SubmitButton name="answer" value="accepter" pendingText="Validation...">Accepter le devis</SubmitButton>
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
        <label>Référence ou ID de transaction<input name="reference" required maxLength={120} placeholder="Ex. référence bancaire ou ID TMoney / Moov / Flooz" /></label>
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
            <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: '4px' }}>
              Document Officiel
            </div>
            <h1 style={{ margin: '0 0 4px', fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
              {word} {inv.number}
            </h1>
            <p className="sub" style={{ margin: 0, fontSize: '13.5px', color: 'var(--muted)' }}>
              {quote ? 'Émis' : 'Émise'} le {frDate(inv.issue_date)}
            </p>
          </div>
          <address>
            {logoUrl(co) && <img src={logoUrl(co)} alt={co.name} className="co-logo" />}
            <strong style={{ fontSize: '16px', color: 'var(--ink)' }}>{co.name}</strong>
            {[co.address, co.phone, co.email, co.legal_ids].filter(Boolean).flatMap((v) =>
              String(v).replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/Ð/g, '').split('\n').filter(Boolean)
            ).map((line, idx) => (
              <span key={idx}><br />{line}</span>
            ))}
          </address>
        </header>

        {withAlt && <CurrencySwitch main={short(cur)} alt={short(inv.alt_currency)} />}

        <div className="billed" style={{ background: '#F8FAFC', padding: '16px 20px', borderRadius: '8px', border: '1px solid var(--line)', marginBottom: '24px' }}>
          <span className="sub" style={{ fontSize: '11.5px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em', color: 'var(--muted)' }}>
            {quote ? 'Destinataire' : 'Facturé à'}
          </span>
          <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--ink)', marginTop: '2px' }}>
            {inv.client_name}
          </div>
          {inv.client_address && String(inv.client_address).replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/Ð/g, '').split('\n').filter(Boolean).map((line, idx) => (
            <div key={idx} style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>{line}</div>
          ))}
          {inv.client_email && <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginTop: '2px' }}>{inv.client_email}</div>}
        </div>

        {inv.title && <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 16px' }}>{inv.title}</p>}

        <div className="scroll" style={{ marginBottom: '24px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--ink)', background: 'transparent' }}>
                <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Description</th>
                <th className="n" style={{ padding: '10px 8px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Quantité</th>
                <th className="n hide-sm" style={{ padding: '10px 8px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Prix unitaire</th>
                <th className="n" style={{ padding: '10px 8px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Montant</th>
              </tr>
            </thead>
            <tbody>
              {inv.lines.map((l) => (
                <tr key={l.id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '12px 8px' }}>
                    <strong style={{ color: 'var(--ink)' }}>{l.description}</strong>
                    {lineNote(l, inv) && <span className="sub" style={{ display: 'block', fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{lineNote(l, inv)}</span>}
                  </td>
                  <td className="n" style={{ padding: '12px 8px' }}>{l.kind === 'prime' ? (l.quantity !== 1 ? `× ${num(l.quantity)}` : '') : `${num(l.quantity)} ${l.unit}`}</td>
                  <td className="n hide-sm" style={{ padding: '12px 8px' }}>{(l.kind !== 'prime' || l.quantity !== 1) && <Amount n={l.unit_price} />}</td>
                  <td className="n" style={{ padding: '12px 8px', fontWeight: 700, color: 'var(--ink)' }}><Amount n={l.amount} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {inv.vat_rate > 0 && (
          <div className="subtotals" style={{ fontSize: '13.5px', marginBottom: '8px' }}>
            <div>Total HT : <strong style={{ color: 'var(--ink)' }}><Amount n={inv.subtotal} /></strong></div>
            <div>TVA {num(inv.vat_rate)} % : <strong style={{ color: 'var(--ink)' }}><Amount n={inv.vat_amount} /></strong></div>
          </div>
        )}
        {inv.withholding_amount > 0 && (
          <div className="subtotals" style={{ fontSize: '13.5px', marginBottom: '8px' }}>
            <div>Total{inv.vat_rate > 0 ? ' TTC' : ''} : <strong style={{ color: 'var(--ink)' }}><Amount n={inv.total} /></strong></div>
            <div style={{ color: '#DC2626' }}>{withholdingLabel(inv)}, retenue à la source : − <Amount n={inv.withholding_amount} /></div>
          </div>
        )}

        <div className="due" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '2px solid var(--ink)' }}>
          <div>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {quote ? `${inv.withholding_amount > 0 ? 'Net' : 'Total'} · valable jusqu'au ${frDate(inv.due_date)}` : inv.status === 'annulee' ? 'Facture annulée, rien à régler' : inv.status === 'payee'
                ? `${inv.withholding_amount > 0 ? 'Net payé' : 'Total payé'} le ${frDate(inv.confirmed_at)}`
                : `${inv.withholding_amount > 0 ? 'Net à payer' : 'Total à payer'} avant le ${frDate(inv.due_date)}`}
            </span>
          </div>
          <strong style={{ fontSize: '36px', fontWeight: 900, color: 'var(--ink)', letterSpacing: '-0.02em' }}>
            <Amount n={inv.amount_due} />
          </strong>
        </div>

        {withAlt && (
          <p className="rate" style={{ textAlign: 'right', marginTop: '6px' }}>
            soit <span className="m-main">{altMoney(inv.amount_due, inv)}</span><span className="m-alt">{money(inv.amount_due, cur)}</span>.
            {' '}Taux : {rateLabel(cur, inv.alt_currency, inv.alt_rate)}.
          </p>
        )}

        {!quote && inv.status !== 'annulee' && payItems.length > 0 && (
          <div className="sheet-payment" aria-labelledby="pay-title">
            <h2 id="pay-title" className="pay-heading">Moyens de paiement acceptés</h2>
            <div className="scroll">
              <table className="pay-table">
                <thead>
                  <tr>
                    <th>Moyen de paiement</th>
                    <th>Coordonnées</th>
                  </tr>
                </thead>
                <tbody>
                  {payItems.map((p) => (
                    <tr key={p.label + p.value}>
                      <td className="pay-td-brand">
                        <div className="pay-brand-cell">
                          <BrandBadge name={p.brand} size={24} />
                          <strong>{p.label}</strong>
                        </div>
                      </td>
                      <td className="pay-td-details">
                        {p.details && p.details.length > 0 ? (
                          <div className="pay-details-list">
                            {p.details.map(([k, v]) => (
                              <div key={k} className="pay-detail-row">
                                <span className="pay-detail-label">{k} :</span>
                                <strong className="pay-detail-val">{v}</strong>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <strong className="pay-detail-val">{p.value}</strong>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {inv.number && (
              <div className="pay-ref">
                <span>Référence à indiquer lors du règlement :</span>
                <strong>{inv.number}</strong>
              </div>
            )}
          </div>
        )}

        {inv.notes && <p className="muted" style={{ margin: '16px 0', fontSize: '13px' }}>{inv.notes}</p>}

        {/* Bloc Authentification & QR Code de Vérification */}
        {qrDataUrl && (
          <div
            style={{
              marginTop: '28px',
              padding: '16px 20px',
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '10px',
              display: 'grid',
              gridTemplateColumns: '84px 1fr',
              gap: '16px',
              alignItems: 'center'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <img
                src={qrDataUrl}
                alt="QR code d'authenticité"
                style={{
                  width: '76px',
                  height: '76px',
                  borderRadius: '6px',
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  padding: '3px'
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#059669', background: '#ECFDF5', padding: '2px 8px', borderRadius: '4px', border: '1px solid #A7F3D0', textTransform: 'uppercase' }}>
                  ✓ Document Certifié Conforme
                </span>
                <Link href={`/v/${inv.verify_code}`} style={{ fontSize: '12px', fontWeight: 700, color: 'var(--brand-text)', textDecoration: 'underline' }}>
                  Vérifier l'authenticité
                </Link>
              </div>
              <div style={{ fontSize: '11.5px', color: '#475569', lineHeight: 1.35, marginTop: '2px' }}>
                Scannez le QR code pour attester de l'authenticité, du statut et de l'intégrité de ce document.
              </div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>
                Code : <strong style={{ color: '#0F172A', fontFamily: 'monospace' }}>{formatCode(inv.verify_code)}</strong>
                {docFingerprint && <> · Empreinte : <code style={{ color: '#0F172A', fontWeight: 600 }}>{docFingerprint}</code></>}
              </div>
            </div>
          </div>
        )}

        <p className="pdf-link" style={{ marginTop: '20px', textAlign: 'center' }}>
          <a href={`/f/${inv.token}/pdf`} className="button secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <Icon name="download" size={16} /> Télécharger {quote ? 'le devis' : 'la facture'} en PDF
          </a>
        </p>
      </article>

      {action}

      <section className="contact" id="contact" aria-labelledby="contact-title">
        <h2 id="contact-title">Une question sur {quote ? 'ce devis' : 'cette facture'} ?</h2>
        <p className="hint">Écrivez directement à {co.name}. La réponse arrivera à {inv.client_email}.</p>
        {sp.contact && verifyFlash('contact', sp.contact, sp.s) && <p className="flash" role="status">{sp.contact}</p>}
        {sp.contact_erreur && verifyFlash('contact_erreur', sp.contact_erreur, sp.s) && <p className="flash err" role="alert">{sp.contact_erreur}</p>}
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
