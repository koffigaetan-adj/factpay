import Link from 'next/link';
import BackButton from '@/components/BackButton';
import { notFound } from 'next/navigation';
import Flash from '@/components/Flash';
import {
  sendInvoiceNow, confirmInvoicePayment, deleteInvoice, resendReceipt, cancelInvoice, reopenPayment,
  remindNow, duplicateDocument, convertQuote, setRepeat,
} from '@/app/actions';
import { requireCompany } from '@/lib/auth';
import { getInvoice, payUrl, EDITABLE, DRAFTLIKE, CANCELLABLE, listMessages, isQuote, reminderDays } from '@/lib/invoices';
import { money, altMoney, num, rateLabel } from '@/lib/money';
import { frDate, frDateTime, today } from '@/lib/dates';
import DatePicker from '@/components/DatePicker';
import { paymentMethodOptions, paymentItems, whatsappLink } from '@/lib/payment';
import BrandBadge from '@/components/BrandBadge';
import Icon from '@/components/Icon';
import Modal from '@/components/Modal';
import SubmitButton from '@/components/SubmitButton';
import QRCode from 'qrcode';
import { shiftPeriod, describePeriod } from '@/lib/period';
import { lineNote, withholdingLabel } from '@/lib/invoice-text';
import { statusOf } from '@/lib/status';
import { pubId, idFrom } from '@/lib/ids';
import { verifyUrl, formatCode, fingerprint } from '@/lib/verify';

export const metadata = { title: 'Facture' };

// Une ligne « intitulé : valeur » du suivi
const Fact = ({ label, children }) => <div><dt className="sub">{label}</dt><dd style={{ margin: 0 }}>{children}</dd></div>;

export default async function Page({ params, searchParams }) {
  const { id } = await params;
  const { company } = await requireCompany();
  const inv = await getInvoice(company.id, idFrom('facture', id));
  if (!inv) notFound();
  const quote = isQuote(inv);
  const word = quote ? 'Devis' : 'Facture';
  const st = statusOf(inv);
  const cur = inv.currency;
  const editable = EDITABLE.includes(inv.status);
  const draftlike = DRAFTLIKE.includes(inv.status);
  const neverSent = inv.status === 'emise';
  const hidden = <input type="hidden" name="id" value={inv.id} />;
  const messagesPromise = inv.number ? listMessages(inv.id) : Promise.resolve([]);
  const open = ['emise', 'envoyee'].includes(inv.status);
  const late = !quote && open && inv.due_date && inv.due_date < today();
  const canResend = quote ? ['brouillon', 'emise', 'envoyee'].includes(inv.status) : !['payee', 'annulee'].includes(inv.status);
  // « Dupliquer pour octobre 2026 » quand la facture porte sur un mois entier
  const nextMonth = inv.period?.mode === 'mois' ? describePeriod(shiftPeriod(inv.period, 1)) : '';
  const steps = reminderDays(company);
  // Message WhatsApp prêt à envoyer, avec le lien de la facture ou du devis
  const wa = inv.number && !['annulee', 'refusee', 'convertie'].includes(inv.status) && whatsappLink(inv.client_phone, quote
    ? `Bonjour ${inv.client_name}, voici notre devis ${inv.number} de ${money(inv.amount_due, cur)}, valable jusqu'au ${frDate(inv.due_date)}. Vous pouvez le consulter et l'accepter ici : ${payUrl(inv)}`
    : inv.status === 'payee'
      ? `Bonjour ${inv.client_name}, merci pour votre paiement de la facture ${inv.number}. Vous pouvez télécharger la facture payée ici : ${payUrl(inv)}`
      : `Bonjour ${inv.client_name}, voici la facture ${inv.number} de ${money(inv.amount_due, cur)}, à régler avant le ${frDate(inv.due_date)}. Vous pouvez la consulter et signaler votre paiement ici : ${payUrl(inv)}`,
  company.country);

  let enabledPayKeys = null;
  if (inv.payment_methods) {
    try { enabledPayKeys = JSON.parse(inv.payment_methods); } catch {}
  }
  const payItems = paymentItems(company, enabledPayKeys);

  // Noir/blanc stricts : un lecteur de QR code ne tolère ni thème ni couleur d'accent.
  // Le fond reste blanc via le style de l'image, y compris en thème sombre.
  const qrDataUrl = inv.verify_code
    ? await QRCode.toDataURL(verifyUrl(inv.verify_code), {
        margin: 1,
        width: 160,
        color: { dark: '#0F172A', light: '#FFFFFF' },
      }).catch(() => null)
    : null;
  const docFingerprint = inv.verify_code ? fingerprint(inv, company.name) : null;

  const messages = await messagesPromise;
  return (
    <>
      <div className="page-head">
        <div>
          <BackButton href={quote ? '/devis' : '/factures'}>{quote ? 'Devis' : 'Factures'}</BackButton>
          <h1>{inv.number ? `${word} ${inv.number}` : `Brouillon de ${word.toLowerCase()}`}</h1>
          <span className={`status ${st.cls}`}>{st.label}</span>
        </div>
        <div className="actions">
          <a className="button secondary" href={`/factures/${pubId('facture', inv.id)}/pdf`} target="_blank" rel="noopener">
            <Icon name="download" size={16} />PDF
          </a>
          {inv.paid_declared_at && (
            <a className="button secondary" href={`/factures/${pubId('facture', inv.id)}/justificatif`} target="_blank" rel="noopener">
              <Icon name="file" size={16} />Justificatif
            </a>
          )}
          {wa && <a className="button whatsapp" href={wa} target="_blank" rel="noopener"><Icon name="whatsapp" size={18} />WhatsApp</a>}
          {inv.credit_number && (
            <a className="button secondary" href={`/factures/${pubId('facture', inv.id)}/avoir`} target="_blank" rel="noopener">
              <Icon name="file" size={16} />Avoir {inv.credit_number}
            </a>
          )}
          {editable && (
            <Link className="button secondary" href={`/factures/${pubId('facture', inv.id)}/modifier`}>
              <Icon name="edit" size={16} />Modifier
            </Link>
          )}
          <form action={duplicateDocument} className="inline">{hidden}
            <SubmitButton className="secondary" pendingText="Duplication...">
              <Icon name="copy" size={16} />{nextMonth ? `Dupliquer pour ${nextMonth}` : 'Dupliquer'}
            </SubmitButton>
          </form>
          {canResend && (
            <form action={sendInvoiceNow} className="inline">{hidden}
              <SubmitButton className={neverSent ? '' : 'secondary'} pendingText={neverSent ? 'Envoi…' : 'Renvoi…'}>
                <Icon name="send" size={16} />{neverSent ? 'Envoyer maintenant' : 'Renvoyer au client'}
              </SubmitButton>
            </form>
          )}
          {quote && ['emise', 'envoyee', 'acceptee'].includes(inv.status) && (
            <form action={convertQuote} className="inline">{hidden}
              <SubmitButton pendingText="Transformation...">
                <Icon name="invoice" size={16} />Transformer en facture
              </SubmitButton>
            </form>
          )}
          {!quote && ['emise', 'envoyee', 'signalee'].includes(inv.status) && (
            <Modal label={inv.status === 'signalee' ? 'Valider le paiement signalé' : 'Marquer comme payée'} icon="check" title="Enregistrer le paiement" buttonClass="">
              <form action={confirmInvoicePayment} className="stack">{hidden}
                <div className="row">
                  <div className="field"><span className="field-title">Date du paiement</span><DatePicker name="paid_on" required defaultValue={today()} max={today()} label="Date du paiement" /></div>
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
                <div><SubmitButton pendingText="Enregistrement..."><Icon name="check" size={16} /> Confirmer le paiement</SubmitButton></div>
              </form>
            </Modal>
          )}
          {!quote && inv.status === 'payee' && (
            <form action={resendReceipt} className="inline">{hidden}
              <SubmitButton className="secondary" pendingText="Renvoi...">
                <Icon name="send" size={16} />Renvoyer la facture payée
              </SubmitButton>
            </form>
          )}
        </div>
      </div>
      <Flash searchParams={searchParams} />
      {inv.send_error && <p className="flash err">Dernier envoi échoué : {inv.send_error}. Nouvel essai automatique chaque jour, ou clique sur « Renvoyer ».</p>}

      <div className="grid2">
        <section>
          <h2><Link href={`/clients/${pubId('client', inv.client_id)}`}>{inv.client_name}</Link></h2>
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

          {!quote && inv.status !== 'annulee' && payItems.length > 0 && (
            <div className="sheet-payment" aria-labelledby="pay-title" style={{ marginTop: '24px' }}>
              <h3 id="pay-title" className="pay-heading">Moyens de paiement</h3>
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
            </div>
          )}

          {qrDataUrl && (
            <div
              style={{
                marginTop: '24px',
                padding: '16px 20px',
                background: 'color-mix(in srgb, var(--brand) 4%, var(--paper))',
                border: '1px solid var(--line)',
                borderRadius: '10px',
                display: 'grid',
                gridTemplateColumns: '76px 1fr',
                gap: '16px',
                alignItems: 'center'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <img
                  src={qrDataUrl}
                  alt="QR code d'authenticité"
                  style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '6px',
                    border: '1px solid var(--line)',
                    background: '#FFFFFF',
                    padding: '3px'
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '10.5px', fontWeight: 800, color: 'var(--paid)', background: 'color-mix(in srgb, var(--paid) 10%, var(--paper))', padding: '2px 8px', borderRadius: '4px', border: '1px solid color-mix(in srgb, var(--paid) 30%, var(--paper))', textTransform: 'uppercase' }}>
                    ✓ Certifié Conforme
                  </span>
                  <Link href={`/v/${inv.verify_code}`} target="_blank" rel="noopener" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--brand-text)', textDecoration: 'underline' }}>
                    Tester la vérification en ligne
                  </Link>
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--muted)', lineHeight: 1.35, marginTop: '2px' }}>
                  Le QR code imprimé en bas du document permet à votre client ou sa banque de vérifier instantanément l'authenticité de la facture.
                </div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                  Code : <strong style={{ color: 'var(--ink)', fontFamily: 'monospace' }}>{formatCode(inv.verify_code)}</strong>
                  {docFingerprint && <> · Empreinte : <code style={{ color: 'var(--ink)', fontWeight: 600 }}>{docFingerprint}</code></>}
                </div>
              </div>
            </div>
          )}
        </section>

        <section>
          <h2>Suivi</h2>
          <dl className="stack" style={{ margin: 0 }}>
            {inv.send_on && inv.status === 'programmee' && <Fact label="Envoi automatique prévu">{frDateTime(inv.send_on, inv.send_tz)}</Fact>}
            {inv.issue_date && <Fact label={quote ? 'Émis le' : 'Émise le'}>{frDate(inv.issue_date)}</Fact>}
            {inv.due_date && <Fact label={quote ? "Valable jusqu'au" : 'Échéance'}>{frDate(inv.due_date)}</Fact>}
            {inv.sent_at && <Fact label={quote ? 'Envoyé au client' : 'Envoyée au client'}>{frDate(inv.sent_at)}</Fact>}
            {inv.reminders_sent > 0 && <Fact label="Relances envoyées">{inv.reminders_sent}, la dernière le {frDate(inv.last_reminder_at)}</Fact>}
            {inv.accepted_at && <Fact label="Accepté par le client">{frDate(inv.accepted_at)}{inv.accepted_by && <>, signé « {inv.accepted_by} »</>}</Fact>}
            {inv.refused_at && <Fact label="Refusé par le client">{frDate(inv.refused_at)}</Fact>}
            {inv.converted_invoice_id && <Fact label="Facture créée"><Link href={`/factures/${pubId('facture', inv.converted_invoice_id)}`}>Voir la facture</Link></Fact>}
            {inv.repeat_source_id && <Fact label="Facture récurrente"><Link href={`/factures/${pubId('facture', inv.repeat_source_id)}`}>Voir le modèle</Link></Fact>}
            {inv.source_quote_id && <Fact label="Issue du devis"><Link href={`/factures/${pubId('facture', inv.source_quote_id)}`}>Voir le devis</Link></Fact>}
            {inv.paid_declared_at && (
              <Fact label="Paiement signalé par le client">
                Signalé le {frDate(inv.paid_declared_at)}{inv.payment_ref ? <> avec la référence <strong>{inv.payment_ref}</strong></> : ''}
                <div style={{ marginTop: '8px' }}>
                  <a className="button secondary small" href={`/factures/${pubId('facture', inv.id)}/justificatif`} target="_blank" rel="noopener" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Icon name="file" size={14} /> Voir le justificatif
                  </a>
                </div>
              </Fact>
            )}
            {inv.confirmed_at && (
              <Fact label="Payée le">{frDate(inv.confirmed_at)}{inv.payment_method && ` · ${inv.payment_method}`}{inv.payment_ref && ` · réf. ${inv.payment_ref}`}</Fact>
            )}
            {inv.receipt_sent_at && <Fact label="Facture payée envoyée au client">{frDate(inv.receipt_sent_at)}</Fact>}
            {inv.cancelled_at && (
              <Fact label="Annulée">
                {frDate(inv.cancelled_at)}{inv.credit_number && <>, avoir <a href={`/factures/${pubId('facture', inv.id)}/avoir`} target="_blank" rel="noopener">{inv.credit_number}</a></>}
                {inv.cancel_reason && <><br /><span className="muted">Motif : {inv.cancel_reason}</span></>}
              </Fact>
            )}
          </dl>
          {inv.number && (
            <p style={{ marginTop: 20 }}>
              <span className="sub">Lien envoyé au client</span>
              <a href={payUrl(inv)} target="_blank" rel="noopener" style={{ wordBreak: 'break-all' }}>{payUrl(inv)}</a>
            </p>
          )}
          {draftlike && (
            <div style={{ marginTop: 20 }}>
              {/* Suppression irréversible : jamais un clic seul, toujours une confirmation comme pour l'annulation */}
              <Modal label="Supprimer le brouillon" icon="trash" title="Supprimer le brouillon" buttonClass="danger">
                <form action={deleteInvoice} className="stack">{hidden}
                  <p className="help" style={{ margin: 0 }}>Le document, ses lignes et son numéro seront définitivement supprimés. Cette action est irréversible.</p>
                  <div><SubmitButton className="danger" pendingText="Suppression..."><Icon name="trash" size={16} /> Supprimer définitivement</SubmitButton></div>
                </form>
              </Modal>
            </div>
          )}

          {late && (
            <div className="status-box">
              <h3>En retard depuis le {frDate(inv.due_date)}</h3>
              <p className="help">
                {company.reminders_enabled && steps.length
                  ? `Relances automatiques ${steps.map((d) => `J+${d}`).join(' et ')} après l'échéance${inv.reminders_sent >= steps.length ? ' : toutes envoyées.' : '.'}`
                  : 'Les relances automatiques sont désactivées (Paramètres → Factures).'}
              </p>
              <form action={remindNow}>{hidden}
                <SubmitButton className="secondary" pendingText="Relance...">
                  <Icon name="bell" size={16} />Relancer maintenant
                </SubmitButton>
              </form>
            </div>
          )}

          {!quote && inv.number && inv.status !== 'annulee' && inv.repeat_active && (
            <div className="status-box" id="recurrence">
              <h3>Facture récurrente</h3>
              <p className="help">Une copie part automatiquement le {inv.repeat_day} de chaque mois{inv.period ? ', avec la période du mois suivant' : ''}. Prochain envoi : <strong>{frDate(inv.repeat_next)}</strong>.{inv.repeat_count > 0 ? ` ${inv.repeat_count} déjà envoyée${inv.repeat_count > 1 ? 's' : ''}.` : ''}</p>
              <form action={setRepeat}>{hidden}
                <input type="hidden" name="active" value="0" />
                <SubmitButton className="secondary" pendingText="Arrêt...">
                  <Icon name="close" size={16} />Arrêter la récurrence
                </SubmitButton>
              </form>
            </div>
          )}
          {/* Le paiement ne se déclenche qu'à un seul endroit, dans la barre d'actions du haut :
              cet encart ne fait que relayer le signal du client tant qu'il n'est pas validé. */}
          {!quote && inv.status === 'signalee' && (
            <div className="status-box" id="statut">
              <h3>Paiement signalé par le client</h3>
              <div style={{ padding: '14px 16px', background: 'color-mix(in srgb, var(--brand) 10%, var(--paper))', border: '1.5px solid var(--brand)', borderRadius: '8px' }}>
                <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--muted)' }}>
                  Signalé le <strong>{frDate(inv.paid_declared_at)}</strong>{inv.payment_ref ? <> avec la référence <strong>{inv.payment_ref}</strong></> : ''}.
                  Valide-le depuis « Valider le paiement signalé » en haut de page.
                </p>
              </div>
            </div>
          )}
          <div className="actions" style={{ marginTop: '20px', flexWrap: 'wrap' }}>
            {!quote && inv.number && inv.status !== 'annulee' && !inv.repeat_active && (
              <Modal label="Répéter chaque mois" icon="repeat" title="Facture récurrente mensuelle" buttonClass="secondary">
                <form action={setRepeat} className="stack">
                  {hidden}
                  <input type="hidden" name="active" value="1" />
                  <p className="help" style={{ margin: 0 }}>Pour un client facturé chaque mois : FactPay recopie cette facture{inv.period ? ' (période décalée au mois suivant)' : ''} et l'envoie toute seule.</p>
                  <label>Jour d'envoi
                    <select name="day" defaultValue="28">
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>le {d} du mois</option>)}
                    </select>
                  </label>
                  <div><SubmitButton pendingText="Activation..."><Icon name="repeat" size={16} /> Activer la récurrence</SubmitButton></div>
                </form>
              </Modal>
            )}
            {!quote && inv.status === 'payee' && (
              <Modal label="Remettre en attente de paiement" icon="repeat" title="Remettre en attente de paiement" buttonClass="secondary">
                <form action={reopenPayment} className="stack">
                  {hidden}
                  <p className="help" style={{ margin: 0 }}>À utiliser si la facture a été marquée payée par erreur. Elle repasse en attente et sort de l'encaissé.{inv.receipt_sent_at ? ' Le client a déjà reçu la facture payée : préviens-le.' : ''}</p>
                  <div><SubmitButton className="danger" pendingText="Validation..."><Icon name="repeat" size={16} /> Confirmer la remise en attente</SubmitButton></div>
                </form>
              </Modal>
            )}
            {!quote && CANCELLABLE.includes(inv.status) && (
              <Modal label="Annuler cette facture" icon="trash" title="Annuler cette facture" buttonClass="danger">
                <form action={cancelInvoice} className="stack">
                  {hidden}
                  <p className="help" style={{ margin: 0 }}>Possible tant que le client n'a pas signalé de paiement. La facture garde son numéro, et un avoir est émis pour l'annuler dans les comptes.</p>
                  <label>Motif <span className="help">facultatif, transmis au client si tu le préviens</span>
                    <textarea name="reason" rows={3} maxLength={500} placeholder="Ex. Erreur sur le nombre de jours, une facture corrigée va suivre." />
                  </label>
                  <label className="check"><input type="checkbox" name="notify" /><span>Prévenir le client par e-mail (avec l'avoir en pièce jointe)</span></label>
                  <div><SubmitButton className="danger" pendingText="Annulation..."><Icon name="trash" size={16} /> Confirmer l'annulation</SubmitButton></div>
                </form>
              </Modal>
            )}
          </div>
        </section>
      </div>

      {messages.length > 0 && (
        <section className="messages">
          <h2>Messages du client</h2>
          <p className="hint">Envoyés depuis la page du document. Tu les as aussi reçus par e-mail : réponds depuis ta messagerie.</p>
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
