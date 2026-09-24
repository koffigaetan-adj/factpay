import crypto from 'node:crypto';
import { q, one } from './db.js';
import { totals } from './money.js';
import { invoiceSentEmail, invoicePaidEmail, paymentDeclaredEmail, invoiceCancelledEmail, clientMessageEmail, withImages } from './emails.js';
import { today, addDays } from './dates.js';
import { invoicePdf } from './pdf.js';
import { sendMail } from './mail.js';
import { appUrl } from './url.js';

// Statuts d'une facture :
//   brouillon  → modifiable, pas encore de numéro
//   programmee → brouillon qui partira seul à la date send_on
//   emise      → numéro attribué, envoi en cours ou échoué (réessayé chaque jour)
//   envoyee    → reçue par le client, en attente de paiement
//   signalee   → le client a signalé le paiement avec un justificatif
//   payee      → paiement confirmé par l'entreprise
//   annulee    → annulée par l'entreprise avant tout signalement de paiement (le numéro reste utilisé)
export const EDITABLE = ['brouillon', 'programmee'];

export const payUrl = (inv) => `${appUrl()}/f/${inv.token}`;

async function withLines(inv) {
  if (!inv) return null;
  try { inv.period = inv.period ? JSON.parse(inv.period) : null; } catch { inv.period = null; }
  inv.lines = await q('SELECT * FROM invoice_lines WHERE invoice_id = $1 ORDER BY position', [inv.id]);
  return inv;
}

const selectFull = `
  SELECT i.*, c.name AS client_name, c.email AS client_email, c.address AS client_address, c.phone AS client_phone
  FROM invoices i JOIN clients c ON c.id = i.client_id`;

export async function getInvoice(companyId, id) {
  return withLines(await one(`${selectFull} WHERE i.company_id = $1 AND i.id = $2`, [companyId, Number(id) || 0]));
}

export async function getInvoiceByToken(token) {
  const inv = await one(`${selectFull} WHERE i.token = $1`, [String(token)]);
  if (!inv) return null;
  const company = await one('SELECT * FROM companies WHERE id = $1', [inv.company_id]);
  return { invoice: await withLines(inv), company };
}

export function listInvoices(companyId) {
  return q(`${selectFull} WHERE i.company_id = $1 ORDER BY i.created_at DESC, i.id DESC`, [companyId]);
}

// Nettoie les lignes saisies dans le formulaire
export function cleanLines(raw) {
  return raw
    .map((l) => ({
      description: String(l.description || '').trim().slice(0, 300),
      quantity: Number(String(l.quantity).replace(',', '.')) || 0,
      unit: String(l.unit || '').trim().slice(0, 20),
      unit_price: Number(String(l.unit_price).replace(',', '.')) || 0,
      kind: ['period', 'prime'].includes(l.kind) ? l.kind : 'service',
    }))
    .map((l) => (l.kind === 'prime' ? { ...l, unit: '' } : l))
    .filter((l) => l.description && l.quantity);
}

// Crée ou met à jour un brouillon. Renvoie son id.
export async function saveDraft(company, { id, client_id, title, lines, currency, alt_currency, alt_rate,
  vat_rate, withholding_rate, withholding_label, period, notes, send_on }) {
  const client = await one('SELECT id FROM clients WHERE id = $1 AND company_id = $2', [Number(client_id) || 0, company.id]);
  if (!client) throw new Error('Choisis un client.');
  if (!lines.length) throw new Error('Ajoute au moins une ligne avec une description et une quantité.');

  const t = totals(lines, vat_rate, withholding_rate, currency);
  const status = send_on ? 'programmee' : 'brouillon';
  const values = [client.id, title, vat_rate, t.subtotal, t.vat, t.total, notes, send_on || null, status,
    currency, alt_currency || null, alt_currency ? alt_rate : null,
    withholding_rate, withholding_rate ? withholding_label : '', t.withholding, t.due,
    t.base, period ? JSON.stringify(period) : null];

  let invoiceId;
  if (id) {
    const row = await one(`UPDATE invoices SET client_id = $1, title = $2, vat_rate = $3, subtotal = $4, vat_amount = $5,
      total = $6, notes = $7, send_on = $8, status = $9, currency = $10, alt_currency = $11, alt_rate = $12,
      withholding_rate = $13, withholding_label = $14, withholding_amount = $15, amount_due = $16,
      withholding_base = $17, period = $18
      WHERE id = $19 AND company_id = $20 AND status IN ('brouillon', 'programmee') RETURNING id`,
      [...values, Number(id), company.id]);
    if (!row) throw new Error('Cette facture a déjà été émise, elle ne peut plus être modifiée.');
    invoiceId = row.id;
    await q('DELETE FROM invoice_lines WHERE invoice_id = $1', [invoiceId]);
  } else {
    const row = await one(`INSERT INTO invoices (client_id, title, vat_rate, subtotal, vat_amount, total, notes, send_on, status,
      currency, alt_currency, alt_rate, withholding_rate, withholding_label, withholding_amount, amount_due,
      withholding_base, period, company_id, token)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) RETURNING id`,
      [...values, company.id, crypto.randomBytes(24).toString('base64url')]);
    invoiceId = row.id;
  }

  // Toutes les lignes en une seule requête
  const rows = lines.map((l, i) => ({ ...l, position: i, amount: l.quantity * l.unit_price }));
  await q(`INSERT INTO invoice_lines (invoice_id, position, description, quantity, unit, unit_price, amount, kind)
    SELECT $1, x.position, x.description, x.quantity, x.unit, x.unit_price, x.amount, x.kind
    FROM json_to_recordset($2::json) AS x(position int, description text, quantity float8, unit text, unit_price float8, amount float8, kind text)`,
  [invoiceId, JSON.stringify(rows)]);
  return invoiceId;
}

export async function deleteDraft(companyId, id) {
  await q(`DELETE FROM invoices WHERE id = $1 AND company_id = $2 AND status IN ('brouillon', 'programmee')`, [Number(id), companyId]);
}

// Attribue le numéro (FAC-2026-0001…) une seule fois, au moment de l'émission.
// Les numéros se suivent sans trou, comme l'exige la loi.
async function issue(company, invoiceId) {
  const year = new Date().getUTCFullYear();
  const issued = today();
  await q(`
    WITH seq AS (
      UPDATE companies SET
        invoice_seq = CASE WHEN invoice_seq_year = $2 THEN invoice_seq + 1 ELSE 1 END,
        invoice_seq_year = $2
      WHERE id = $1 AND EXISTS (SELECT 1 FROM invoices WHERE id = $3 AND company_id = $1 AND number IS NULL)
      RETURNING invoice_prefix, invoice_seq
    )
    UPDATE invoices SET
      number = seq.invoice_prefix || '-' || $2 || '-' || lpad(seq.invoice_seq::text, 4, '0'),
      issue_date = $4, due_date = $5, status = 'emise'
    FROM seq WHERE invoices.id = $3 AND invoices.number IS NULL`,
  [company.id, year, invoiceId, issued, addDays(issued, Number(company.payment_terms) || 0)]);
}

// Émet la facture si besoin, puis l'envoie au client avec le PDF. Renvoie { ok, error }.
export async function sendInvoice(company, invoiceId) {
  await issue(company, invoiceId);
  const inv = await getInvoice(company.id, invoiceId);
  try {
    const pdf = await invoicePdf(inv, company);
    await sendMail({
      to: inv.client_email,
      replyTo: company.email || undefined,
      ...(await withImages(invoiceSentEmail(inv, company, payUrl(inv)), company)),
      attachments: [{ filename: `${inv.number}.pdf`, content: pdf }],
    });
    await q(`UPDATE invoices SET status = CASE WHEN status = 'emise' THEN 'envoyee' ELSE status END,
      sent_at = now(), send_error = NULL WHERE id = $1`, [inv.id]);
    return { ok: true, invoice: inv };
  } catch (err) {
    console.error(`Envoi de ${inv.number} échoué :`, err);
    await q('UPDATE invoices SET send_error = $1 WHERE id = $2', [String(err.message).slice(0, 300), inv.id]);
    return { ok: false, error: err.message, invoice: inv };
  }
}

export async function declarePayment(token, { reference, proofKey, proofName, proofMime }) {
  const found = await getInvoiceByToken(token);
  if (!found) throw new Error('Facture introuvable');
  const { invoice: inv, company } = found;
  await q(`UPDATE invoices SET status = 'signalee', payment_ref = $1, proof_key = $2, proof_name = $3, proof_mime = $4,
    paid_declared_at = now() WHERE id = $5 AND status IN ('emise', 'envoyee')`,
  [reference, proofKey, proofName, proofMime, inv.id]);

  const owner = await one('SELECT email FROM users WHERE id = $1', [company.owner_id]);
  await sendMail({ to: company.email || owner.email, ...(await withImages(paymentDeclaredEmail(inv, reference))) })
    .catch((e) => console.error('Notification échouée :', e.message));
}

// Confirme le paiement, puis envoie au client sa facture marquée « payée ».
// Renvoie { confirmed, sent, error } : le paiement reste confirmé même si l'e-mail échoue.
// Marque la facture payée, que le client ait signalé son paiement ou non.
// paidOn : date du paiement (AAAA-MM-JJ), method / reference : facultatifs, notify : envoyer la facture payée au client.
// Renvoie { confirmed, sent, error, invoice } : le paiement reste confirmé même si l'e-mail échoue.
export async function confirmPayment(company, id, { paidOn, method = '', reference = '', notify = true } = {}) {
  const row = await one(`UPDATE invoices SET status = 'payee',
      confirmed_at = CASE WHEN $3::text <> '' THEN ($3::text || 'T12:00:00Z')::timestamptz ELSE now() END,
      payment_method = $4, payment_ref = COALESCE(NULLIF($5, ''), payment_ref)
    WHERE id = $1 AND company_id = $2 AND status IN ('envoyee', 'signalee', 'emise') RETURNING id`,
  [Number(id), company.id, /^\d{4}-\d{2}-\d{2}$/.test(paidOn || '') ? paidOn : '', method, reference]);
  if (!row) return { confirmed: false };
  if (!notify) return { confirmed: true, sent: false, skipped: true, invoice: await getInvoice(company.id, row.id) };
  return { confirmed: true, ...(await sendReceipt(company, row.id)) };
}

// Annule un « payée » posé par erreur : la facture revient en attente (ou « paiement signalé » si le client l'avait signalé)
export async function reopenInvoice(company, id) {
  const row = await one(`UPDATE invoices SET
      status = CASE WHEN paid_declared_at IS NOT NULL THEN 'signalee' ELSE 'envoyee' END,
      confirmed_at = NULL, receipt_sent_at = NULL, payment_method = ''
    WHERE id = $1 AND company_id = $2 AND status = 'payee' RETURNING id, status`, [Number(id), company.id]);
  return row;
}

export async function sendReceipt(company, id) {
  const inv = await getInvoice(company.id, id);
  try {
    const pdf = await invoicePdf(inv, company);
    await sendMail({
      to: inv.client_email,
      replyTo: company.email || undefined,
      ...(await withImages(invoicePaidEmail(inv, company, payUrl(inv)), company)),
      attachments: [{ filename: `${inv.number}-payee.pdf`, content: pdf }],
    });
    await q('UPDATE invoices SET receipt_sent_at = now() WHERE id = $1', [inv.id]);
    return { sent: true, invoice: inv };
  } catch (err) {
    console.error(`Reçu de ${inv.number} non envoyé :`, err);
    return { sent: false, error: err.message, invoice: inv };
  }
}

// Statuts dans lesquels l'entreprise peut encore annuler : envoyée, sans paiement signalé
export const CANCELLABLE = ['emise', 'envoyee'];

// Annule la facture et prévient le client. Renvoie { cancelled, sent, error, invoice }.
export async function cancelInvoice(company, id, reason) {
  const row = await one(`UPDATE invoices SET status = 'annulee', cancelled_at = now(), cancel_reason = $1
    WHERE id = $2 AND company_id = $3 AND status IN ('emise', 'envoyee') RETURNING id`, [reason, Number(id), company.id]);
  if (!row) return { cancelled: false };
  const inv = await getInvoice(company.id, row.id);
  try {
    await sendMail({ to: inv.client_email, replyTo: company.email || undefined, ...(await withImages(invoiceCancelledEmail(inv, company), company)) });
    return { cancelled: true, sent: true, invoice: inv };
  } catch (err) {
    return { cancelled: true, sent: false, error: err.message, invoice: inv };
  }
}

// Message du client depuis la page de la facture : enregistré, puis envoyé à l'entreprise (5 par jour au plus)
export async function sendClientMessage(token, body) {
  const found = await getInvoiceByToken(token);
  if (!found) return { ok: false, error: 'Facture introuvable.' };
  const { invoice: inv, company } = found;
  const recent = await one(`SELECT count(*)::int AS n FROM invoice_messages WHERE invoice_id = $1 AND created_at > now() - interval '1 day'`, [inv.id]);
  if (recent.n >= 5) return { ok: false, error: "Vous avez déjà envoyé plusieurs messages aujourd'hui. Réessayez demain ou répondez à l'e-mail de la facture." };
  await q('INSERT INTO invoice_messages (invoice_id, body) VALUES ($1, $2)', [inv.id, body]);
  const owner = await one('SELECT email FROM users WHERE id = $1', [company.owner_id]);
  try {
    await sendMail({ to: company.email || owner.email, replyTo: inv.client_email, ...(await withImages(clientMessageEmail(inv, body))) });
  } catch (err) {
    console.error('Message client non transmis :', err.message);
  }
  return { ok: true, company, invoice: inv };
}

export const listMessages = (invoiceId) => q('SELECT * FROM invoice_messages WHERE invoice_id = $1 ORDER BY created_at DESC', [invoiceId]);

// Tâche quotidienne : envoie les factures programmées et réessaie les envois échoués.
export async function runScheduled() {
  const due = await q(`SELECT id, company_id FROM invoices
    WHERE (status = 'programmee' AND send_on <= $1) OR status = 'emise'`, [today()]);
  const results = [];
  for (const row of due) {
    const company = await one('SELECT * FROM companies WHERE id = $1', [row.company_id]);
    const r = await sendInvoice(company, row.id);
    results.push({ id: row.id, ok: r.ok });
  }
  return results;
}
