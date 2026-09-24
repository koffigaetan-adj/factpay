import crypto from 'node:crypto';
import { q, one } from './db.js';
import { totals } from './money.js';
import { invoiceSentEmail, invoicePaidEmail, paymentDeclaredEmail, invoiceCancelledEmail, clientMessageEmail,
  reminderEmail, quoteSentEmail, quoteAnsweredEmail, withImages } from './emails.js';
import { today, addDays } from './dates.js';
import { invoicePdf, creditNotePdf } from './pdf.js';
import { shiftPeriod } from './period.js';
import { newVerifyCode, normalizeCode } from './verify.js';
import { sendMail } from './mail.js';
import { appUrl } from './url.js';

// Statuts d'une facture :
//   brouillon  → modifiable, pas encore de numéro
//   programmee → brouillon qui partira seul à la date send_on
//   emise      → numéro attribué, envoi en cours ou échoué (réessayé chaque jour)
//   envoyee    → reçue par le client, en attente de paiement
//   signalee   → le client a signalé le paiement avec un justificatif
//   payee      → paiement confirmé par l'entreprise
//   annulee    → annulée par l'entreprise avant tout signalement de paiement : le numéro reste utilisé
//                et un avoir (AV-2612-0001) est émis pour l'annuler en comptabilité
// Statuts d'un devis (doc_type « devis ») : brouillon → envoyee → acceptee / refusee → convertie (en facture)
export const EDITABLE = ['brouillon', 'programmee'];
export const isQuote = (inv) => inv?.doc_type === 'devis';

export const payUrl = (inv) => `${appUrl()}/f/${inv.token}`;

async function withLines(inv) {
  if (!inv) return null;
  try { inv.period = inv.period ? JSON.parse(inv.period) : null; } catch { inv.period = null; }
  inv.lines = await q('SELECT * FROM invoice_lines WHERE invoice_id = $1 ORDER BY position', [inv.id]);
  return inv;
}

// Après émission, le nom, l'adresse et le téléphone du client viennent de la copie figée sur la facture.
// L'e-mail reste celui de la fiche client : c'est là qu'on écrit (relances, facture payée…).
const selectFull = `
  SELECT i.*,
    COALESCE(i.client_snapshot::json->>'name', c.name) AS client_name, c.email AS client_email,
    COALESCE(i.client_snapshot::json->>'address', c.address) AS client_address,
    COALESCE(i.client_snapshot::json->>'phone', c.phone) AS client_phone
  FROM invoices i JOIN clients c ON c.id = i.client_id`;

export { issuedCompany } from './invoice-text.js';

export async function getInvoice(companyId, id) {
  return withLines(await one(`${selectFull} WHERE i.company_id = $1 AND i.id = $2`, [companyId, Number(id) || 0]));
}

export async function getInvoiceByToken(token) {
  const inv = await one(`${selectFull} WHERE i.token = $1`, [String(token)]);
  if (!inv) return null;
  const company = await one('SELECT * FROM companies WHERE id = $1', [inv.company_id]);
  return { invoice: await withLines(inv), company };
}

// Document émis retrouvé par son code de vérification (page publique /v/…), avec l'entreprise
export async function getByVerifyCode(code) {
  const clean = normalizeCode(code);
  if (clean.length < 8) return null;
  const inv = await one(`${selectFull} WHERE i.verify_code = $1 AND i.number IS NOT NULL`, [clean]);
  if (!inv) return null;
  const company = await one('SELECT * FROM companies WHERE id = $1', [inv.company_id]);
  return { invoice: await withLines(inv), company };
}

export function listInvoices(companyId, docType = 'facture') {
  return q(`${selectFull} WHERE i.company_id = $1 AND i.doc_type = $2 ORDER BY i.created_at DESC, i.id DESC`, [companyId, docType]);
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
  vat_rate, withholding_rate, withholding_label, period, notes, send_on, doc_type = 'facture', source_quote_id = null }) {
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
    if (!row) throw new Error('Ce document a déjà été émis, il ne peut plus être modifié.');
    invoiceId = row.id;
    await q('DELETE FROM invoice_lines WHERE invoice_id = $1', [invoiceId]);
  } else {
    const row = await one(`INSERT INTO invoices (client_id, title, vat_rate, subtotal, vat_amount, total, notes, send_on, status,
      currency, alt_currency, alt_rate, withholding_rate, withholding_label, withholding_amount, amount_due,
      withholding_base, period, company_id, token, doc_type, source_quote_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22) RETURNING id`,
      [...values, company.id, crypto.randomBytes(24).toString('base64url'), doc_type === 'devis' ? 'devis' : 'facture', source_quote_id]);
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

// Milieu des numéros : l'année sur 2 chiffres suivie du numéro du compte.
// Compte n° 12 en 2026 → « 2612 », d'où FAC-2612-0001, DEV-2612-0001, AV-2612-0001.
const numberCode = (company, year) => `${String(year).slice(-2)}${company.owner_id}`;

// Prochain numéro d'une suite (avoirs, devis), qui repart à 1 chaque année
async function nextNumber(company, kind, prefix) {
  const year = new Date().getUTCFullYear();
  const row = await one(`INSERT INTO sequences (company_id, kind, year, value) VALUES ($1, $2, $3, 1)
    ON CONFLICT (company_id, kind, year) DO UPDATE SET value = sequences.value + 1 RETURNING value`, [company.id, kind, year]);
  return `${prefix}-${numberCode(company, year)}-${String(row.value).padStart(4, '0')}`;
}

// Copie figée des coordonnées, posée une seule fois à l'émission
const SNAPSHOTS = `
  client_snapshot = (SELECT json_build_object('name', c.name, 'address', c.address, 'phone', c.phone)::text FROM clients c WHERE c.id = invoices.client_id),
  company_snapshot = (SELECT json_build_object('name', co.name, 'address', co.address, 'phone', co.phone, 'email', co.email, 'legal_ids', co.legal_ids)::text
    FROM companies co WHERE co.id = invoices.company_id)`;

// Attribue le numéro (FAC-2612-0001…) une seule fois, au moment de l'émission.
// Les numéros de facture se suivent sans trou, comme l'exige la loi. Les devis ont leur propre suite.
async function issue(company, invoiceId) {
  const year = new Date().getUTCFullYear();
  const issued = today();
  const doc = await one('SELECT doc_type, number FROM invoices WHERE id = $1 AND company_id = $2', [invoiceId, company.id]);
  if (!doc || doc.number) return;
  if (doc.doc_type === 'devis') {
    const number = await nextNumber(company, 'devis', company.quote_prefix || 'DEV');
    await q(`UPDATE invoices SET number = $1, issue_date = $2, due_date = $3, status = 'emise', verify_code = $5, ${SNAPSHOTS}
      WHERE id = $4 AND number IS NULL`, [number, issued, addDays(issued, Number(company.quote_validity) || 30), invoiceId, newVerifyCode()]);
    return;
  }
  await q(`
    WITH seq AS (
      UPDATE companies SET
        invoice_seq = CASE WHEN invoice_seq_year = $2 THEN invoice_seq + 1 ELSE 1 END,
        invoice_seq_year = $2
      WHERE id = $1 AND EXISTS (SELECT 1 FROM invoices WHERE id = $3 AND company_id = $1 AND number IS NULL)
      RETURNING invoice_prefix, invoice_seq
    )
    UPDATE invoices SET
      number = seq.invoice_prefix || '-' || $6 || '-' || lpad(seq.invoice_seq::text, 4, '0'),
      issue_date = $4, due_date = $5, status = 'emise', verify_code = $7, ${SNAPSHOTS}
    FROM seq WHERE invoices.id = $3 AND invoices.number IS NULL`,
  [company.id, year, invoiceId, issued, addDays(issued, Number(company.payment_terms) || 0), numberCode(company, year), newVerifyCode()]);
}

// Émet la facture si besoin, puis l'envoie au client avec le PDF. Renvoie { ok, error }.
export async function sendInvoice(company, invoiceId) {
  await issue(company, invoiceId);
  const inv = await getInvoice(company.id, invoiceId);
  try {
    const pdf = await invoicePdf(inv, company);
    const email = isQuote(inv) ? quoteSentEmail(inv, company, payUrl(inv)) : invoiceSentEmail(inv, company, payUrl(inv));
    await sendMail({
      to: inv.client_email,
      replyTo: company.email || undefined,
      ...(await withImages(email, company)),
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

// Marque la facture payée, que le client ait signalé son paiement ou non.
// paidOn : date du paiement (AAAA-MM-JJ), method / reference : facultatifs, notify : envoyer la facture payée au client.
// Renvoie { confirmed, sent, error, invoice } : le paiement reste confirmé même si l'e-mail échoue.
export async function confirmPayment(company, id, { paidOn, method = '', reference = '', notify = true } = {}) {
  const row = await one(`UPDATE invoices SET status = 'payee',
      confirmed_at = CASE WHEN $3::text <> '' THEN ($3::text || 'T12:00:00Z')::timestamptz ELSE now() END,
      payment_method = $4, payment_ref = COALESCE(NULLIF($5, ''), payment_ref)
    WHERE id = $1 AND company_id = $2 AND doc_type = 'facture' AND status IN ('envoyee', 'signalee', 'emise') RETURNING id`,
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

// Annule la facture, émet l'avoir correspondant (AV-2612-0001) et prévient le client avec le PDF de l'avoir.
// Renvoie { cancelled, sent, error, invoice }.
export async function cancelInvoice(company, id, reason) {
  const row = await one(`UPDATE invoices SET status = 'annulee', cancelled_at = now(), cancel_reason = $1
    WHERE id = $2 AND company_id = $3 AND doc_type = 'facture' AND status IN ('emise', 'envoyee') RETURNING id`, [reason, Number(id), company.id]);
  if (!row) return { cancelled: false };
  const credit = await nextNumber(company, 'avoir', 'AV');
  await q('UPDATE invoices SET credit_number = $1, credit_date = $2 WHERE id = $3', [credit, today(), row.id]);
  const inv = await getInvoice(company.id, row.id);
  try {
    const pdf = await creditNotePdf(inv, company);
    await sendMail({
      to: inv.client_email,
      replyTo: company.email || undefined,
      ...(await withImages(invoiceCancelledEmail(inv, company), company)),
      attachments: [{ filename: `${inv.credit_number}.pdf`, content: pdf }],
    });
    return { cancelled: true, sent: true, invoice: inv };
  } catch (err) {
    return { cancelled: true, sent: false, error: err.message, invoice: inv };
  }
}

// ---------- Relances ----------

// Jours de relance après l'échéance, par exemple « 3,10 » → [3, 10]
export const reminderDays = (company) => String(company.reminder_days || '')
  .split(/[^\d]+/).map(Number).filter((n) => n > 0 && n <= 365).sort((a, b) => a - b).slice(0, 5);

// Envoie une relance pour une facture en retard (automatique ou à la main). Renvoie { ok, error }.
export async function sendReminder(company, id) {
  const inv = await getInvoice(company.id, id);
  if (!inv || isQuote(inv) || !['emise', 'envoyee'].includes(inv.status)) return { ok: false, error: 'Cette facture ne peut pas être relancée.' };
  try {
    const pdf = await invoicePdf(inv, company);
    await sendMail({
      to: inv.client_email,
      replyTo: company.email || undefined,
      ...(await withImages(reminderEmail(inv, company, payUrl(inv)), company)),
      attachments: [{ filename: `${inv.number}.pdf`, content: pdf }],
    });
    await q('UPDATE invoices SET reminders_sent = reminders_sent + 1, last_reminder_at = now() WHERE id = $1', [inv.id]);
    return { ok: true, invoice: inv };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Relances automatiques : une par facture et par passage, quand le palier suivant est atteint,
// et jamais deux relances à moins de 3 jours d'écart (même si le retard est déjà ancien)
async function runReminders() {
  const late = await q(`SELECT i.id, i.company_id, i.due_date, i.reminders_sent FROM invoices i JOIN companies co ON co.id = i.company_id
    WHERE i.doc_type = 'facture' AND i.status = 'envoyee' AND i.due_date < $1 AND co.reminders_enabled
      AND (i.last_reminder_at IS NULL OR i.last_reminder_at < now() - interval '3 days')`, [today()]);
  const results = [];
  for (const row of late) {
    const company = await one('SELECT * FROM companies WHERE id = $1', [row.company_id]);
    const step = reminderDays(company)[row.reminders_sent];
    if (step === undefined || addDays(row.due_date, step) > today()) continue;
    const r = await sendReminder(company, row.id);
    results.push({ id: row.id, reminder: row.reminders_sent + 1, ok: r.ok });
  }
  return results;
}

// ---------- Duplication et devis ----------

// Copie un document en nouveau brouillon (facture ou devis). La période avance de « months » mois (1 par défaut).
export async function duplicate(company, id, { docType, months = 1 } = {}) {
  const src = await getInvoice(company.id, id);
  if (!src) return null;
  const type = docType || src.doc_type;
  const lines = src.lines.map((l) => ({ description: l.description, quantity: l.quantity, unit: l.unit, unit_price: l.unit_price, kind: l.kind }));
  return saveDraft(company, {
    client_id: src.client_id, title: src.title, lines, currency: src.currency, alt_currency: src.alt_currency, alt_rate: src.alt_rate,
    vat_rate: src.vat_rate, withholding_rate: src.withholding_rate, withholding_label: src.withholding_label,
    period: type === src.doc_type && src.period ? shiftPeriod(src.period, months) : src.period,
    notes: src.notes, send_on: '', doc_type: type, source_quote_id: isQuote(src) && type === 'facture' ? src.id : null,
  });
}

// Le client accepte ou refuse le devis depuis sa page. Renvoie le devis, ou null.
export async function answerQuote(token, accepted, signedBy = '') {
  const found = await getInvoiceByToken(token);
  if (!found || !isQuote(found.invoice)) return null;
  const { invoice: inv, company } = found;
  const row = await one(`UPDATE invoices SET status = $1, ${accepted ? 'accepted_at' : 'refused_at'} = now(), accepted_by = $3
    WHERE id = $2 AND status IN ('emise', 'envoyee') RETURNING id`, [accepted ? 'acceptee' : 'refusee', inv.id, accepted ? signedBy : null]);
  if (!row) return inv;
  const owner = await one('SELECT email FROM users WHERE id = $1', [company.owner_id]);
  await sendMail({ to: company.email || owner.email, ...(await withImages(quoteAnsweredEmail(inv, accepted))) })
    .catch((e) => console.error('Notification devis échouée :', e.message));
  return { ...inv, status: accepted ? 'acceptee' : 'refusee', accepted_by: accepted ? signedBy : null };
}

// Transforme un devis en brouillon de facture, et marque le devis « transformé »
export async function convertQuote(company, id) {
  const quote = await getInvoice(company.id, id);
  if (!quote || !isQuote(quote) || !['emise', 'envoyee', 'acceptee'].includes(quote.status)) return null;
  const invoiceId = await duplicate(company, id, { docType: 'facture' });
  await q(`UPDATE invoices SET status = 'convertie', converted_invoice_id = $1, accepted_at = COALESCE(accepted_at, now()) WHERE id = $2`, [invoiceId, id]);
  return invoiceId;
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

// ---------- Factures récurrentes ----------

// Date du prochain envoi : le jour « day » du mois qui suit le plus tardif entre aujourd'hui et l'émission du modèle
export function firstRepeatDate(issueDate, day) {
  const base = [today(), issueDate || today()].sort().pop();
  const [y, m] = base.split('-').map(Number);
  const next = new Date(Date.UTC(y, m, Math.min(Math.max(day, 1), 28)));
  return next.toISOString().slice(0, 10);
}

const nextMonth = (d) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m, day)).toISOString().slice(0, 10);
};

// Active, modifie ou arrête la récurrence d'une facture émise (le « modèle »)
export async function setRepeat(company, id, { active, day }) {
  const inv = await getInvoice(company.id, id);
  if (!inv || isQuote(inv) || !inv.number) return null;
  if (!active) {
    await q('UPDATE invoices SET repeat_active = false, repeat_next = NULL WHERE id = $1', [inv.id]);
    return { active: false };
  }
  const d = Math.min(Math.max(Number(day) || 28, 1), 28);
  const next = firstRepeatDate(inv.issue_date, d);
  await q('UPDATE invoices SET repeat_active = true, repeat_day = $1, repeat_next = $2 WHERE id = $3', [d, next, inv.id]);
  return { active: true, next };
}

// Chaque jour : recopie les modèles arrivés à échéance (période décalée d'autant de mois) et envoie la copie
async function runRecurring() {
  const due = await q(`SELECT id, company_id, repeat_count, repeat_next FROM invoices
    WHERE repeat_active AND doc_type = 'facture' AND repeat_next <= $1`, [today()]);
  const results = [];
  for (const t of due) {
    const company = await one('SELECT * FROM companies WHERE id = $1', [t.company_id]);
    const newId = await duplicate(company, t.id, { months: t.repeat_count + 1 });
    await q('UPDATE invoices SET repeat_source_id = $1 WHERE id = $2', [t.id, newId]);
    await q('UPDATE invoices SET repeat_count = repeat_count + 1, repeat_next = $1 WHERE id = $2', [nextMonth(t.repeat_next), t.id]);
    const r = await sendInvoice(company, newId);
    results.push({ template: t.id, id: newId, ok: r.ok });
  }
  return results;
}

// Tâche quotidienne : envoie les factures programmées, réessaie les envois échoués, puis relance les retards.
export async function runScheduled() {
  const due = await q(`SELECT id, company_id FROM invoices
    WHERE (status = 'programmee' AND send_on <= $1) OR status = 'emise'`, [today()]);
  const results = [];
  for (const row of due) {
    const company = await one('SELECT * FROM companies WHERE id = $1', [row.company_id]);
    const r = await sendInvoice(company, row.id);
    results.push({ id: row.id, ok: r.ok });
  }
  return { sent: results, recurring: await runRecurring(), reminders: await runReminders() };
}
