import crypto from 'crypto';
import { q, one } from './db.js';
import { totals, money } from './money.js';
import { invoiceSentEmail, invoicePaidEmail, paymentDeclaredEmail, invoiceCancelledEmail, clientMessageEmail,
  reminderEmail, quoteSentEmail, quoteAnsweredEmail, withImages } from './emails.js';
import { today, addDays } from './dates.js';
import { invoicePdf, creditNotePdf } from './pdf.js';
import { shiftPeriod } from './period.js';
import { newVerifyCode, normalizeCode } from './verify.js';
import { sendMail } from './mail.js';
import { appUrl } from './url.js';
import { safeError } from './safeerror.js';
import { notifyOwner } from './notifications.js';
import { pubId } from './ids.js';

// Statuts d'une facture :
//   brouillon  → modifiable, pas encore de numéro
//   programmee → brouillon qui partira seul à la date send_on
//   emise      → numéro attribué, envoi en cours ou échoué (réessayé chaque jour)
//   envoyee    → reçue par le client, en attente de paiement
//   signalee   → le client a signalé le paiement avec un justificatif
//   payee      → paiement confirmé par l'entreprise
//   annulee    → annulée par l'entreprise avant tout signalement de paiement : le numéro reste utilisé
//                et un avoir (AV-FP481-0001) est émis pour l'annuler en comptabilité
// Statuts d'un devis (doc_type « devis ») : brouillon → envoyee → acceptee / refusee → convertie (en facture)
// Modifiable (lignes, montants…) tant que le client n'a rien signalé. Le numéro et la date d'émission
// d'une facture déjà émise ne bougent pas ; DRAFTLIKE distingue les vrais brouillons (supprimables,
// avec un envoi encore programmable) des factures déjà émises qu'on corrige.
export const EDITABLE = ['brouillon', 'programmee', 'emise', 'envoyee'];
export const DRAFTLIKE = ['brouillon', 'programmee'];
export const isQuote = (inv) => inv?.doc_type === 'devis';

export const payUrl = (inv) => `${appUrl()}/f/${inv.token}`;

// Nombre d'e-mails envoyés en même temps. Assez pour absorber un lot sans être lentes,
// pas assez pour se faire refuser par le serveur SMTP.
const PARALLEL = 5;

// Une facture en attente ne bloque pas les suivantes, et une erreur isolée ne fait pas tomber le lot.
async function inParallel(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      try {
        out[i] = await fn(items[i], i);
      } catch (err) {
        out[i] = { id: items[i]?.id, ok: false, error: String(err?.message || err).slice(0, 200) };
      }
    }
  }));
  return out;
}

// Les entreprises de tout un lot en une seule requête, au lieu d'une requête par facture
async function companiesById(ids) {
  const list = [...new Set(ids.filter(Boolean))];
  if (!list.length) return new Map();
  const rows = await q(`SELECT * FROM companies WHERE id IN (${list.map((_, i) => `$${i + 1}`).join(',')})`, list);
  return new Map(rows.map((r) => [r.id, r]));
}

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

// La facture et ses lignes sont lues en même temps (une seule attente au lieu de deux)
export async function getInvoice(companyId, id) {
  const [inv, lines] = await Promise.all([
    one(`${selectFull} WHERE i.company_id = $1 AND i.id = $2`, [companyId, Number(id) || 0]),
    q('SELECT * FROM invoice_lines WHERE invoice_id = $1 ORDER BY position', [Number(id) || 0]),
  ]);
  if (!inv) return null;
  try { inv.period = inv.period ? JSON.parse(inv.period) : null; } catch { inv.period = null; }
  inv.lines = lines;
  inv.pub_id = pubId('facture', inv.id);
  return inv;
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

export async function listInvoices(companyId, docType = 'facture') {
  const rows = await q(`${selectFull} WHERE i.company_id = $1 AND i.doc_type = $2 ORDER BY i.created_at DESC, i.id DESC`, [companyId, docType]);
  return rows.map((i) => ({ ...i, pub_id: pubId('facture', i.id) }));
}

// Retrouve, par e-mail, l'entreprise FactPay (avec son compte) à qui un document est adressé —
// pour la lister dans son onglet « Achats » et la prévenir, en plus de l'e-mail classique au client.
async function matchRecipientCompany(email, excludeCompanyId) {
  if (!email) return null;
  return one(`SELECT co.* FROM companies co JOIN users u ON u.id = co.owner_id
    WHERE (lower(co.email) = lower($1) OR lower(u.email) = lower($1)) AND co.id <> $2 LIMIT 1`, [email, excludeCompanyId]);
}

// Achats : factures/devis reçus d'autres entreprises FactPay qui nous ont ajoutés comme client avec
// l'e-mail du compte ou celui de l'entreprise. Lecture seule ici : l'action (payer, répondre, écrire)
// se fait sur la page publique /f/<token>, la même que reçoit n'importe quel client par e-mail.
export async function listReceivedInvoices(emails, docType = 'facture', excludeCompanyId = null) {
  const clean = [...new Set(emails.filter(Boolean).map((e) => String(e).toLowerCase()))];
  if (!clean.length) return [];
  const rows = await q(`
    SELECT i.*, co.name AS issuer_name,
      COALESCE(i.client_snapshot::json->>'name', c.name) AS client_name, c.email AS client_email
    FROM invoices i JOIN clients c ON c.id = i.client_id JOIN companies co ON co.id = i.company_id
    WHERE lower(c.email) = ANY($1::text[]) AND i.doc_type = $2 AND i.status NOT IN ('brouillon', 'programmee')
      AND ($3::int IS NULL OR i.company_id <> $3)
    ORDER BY i.created_at DESC, i.id DESC`, [clean, docType, excludeCompanyId]);
  return rows.map((i) => ({ ...i, pub_id: pubId('facture', i.id) }));
}

// Récupère les compteurs d'actions pour les badges de la barre latérale (menus et sous-menus)
export async function getSidebarCounts(company, user) {
  const cleanEmails = [...new Set([company.email, user.email].filter(Boolean).map((e) => String(e).toLowerCase()))];

  const [mesFacturesSignalees, mesDevisAcceptes, receivedFactures, receivedDevis] = await Promise.all([
    one(`SELECT COUNT(*)::int AS count FROM invoices WHERE company_id = $1 AND doc_type = 'facture' AND status = 'signalee'`, [company.id]),
    one(`SELECT COUNT(*)::int AS count FROM invoices WHERE company_id = $1 AND doc_type = 'devis' AND status = 'acceptee'`, [company.id]),
    cleanEmails.length ? q(`
      SELECT COUNT(*)::int AS count
      FROM invoices i JOIN clients c ON c.id = i.client_id
      WHERE lower(c.email) = ANY($1::text[]) AND i.doc_type = 'facture'
        AND i.status IN ('emise', 'envoyee', 'signalee')
        AND i.company_id <> $2`, [cleanEmails, company.id]) : [{ count: 0 }],
    cleanEmails.length ? q(`
      SELECT COUNT(*)::int AS count
      FROM invoices i JOIN clients c ON c.id = i.client_id
      WHERE lower(c.email) = ANY($1::text[]) AND i.doc_type = 'devis'
        AND i.status IN ('emise', 'envoyee')
        AND i.company_id <> $2`, [cleanEmails, company.id]) : [{ count: 0 }],
  ]);

  const mesFactures = Number(mesFacturesSignalees?.count) || 0;
  const mesDevis = Number(mesDevisAcceptes?.count) || 0;
  const facturesRecues = Number(receivedFactures?.[0]?.count) || 0;
  const devisRecus = Number(receivedDevis?.[0]?.count) || 0;

  return {
    mesFactures,
    facturesRecues,
    facturesTotal: mesFactures + facturesRecues,
    mesDevis,
    devisRecus,
    devisTotal: mesDevis + devisRecus,
  };
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
  vat_rate, withholding_rate, withholding_label, period, notes, send_on, send_tz = '', doc_type = 'facture', source_quote_id = null, payment_methods = null }) {
  const client = await one('SELECT id FROM clients WHERE id = $1 AND company_id = $2', [Number(client_id) || 0, company.id]);
  if (!client) throw new Error('Choisis un client.');
  if (!lines.length) throw new Error('Ajoute au moins une ligne avec une description et une quantité.');

  const t = totals(lines, vat_rate, withholding_rate, currency);
  const status = send_on ? 'programmee' : 'brouillon';
  const values = [client.id, title, vat_rate, t.subtotal, t.vat, t.total, notes, send_on || null, status,
    currency, alt_currency || null, alt_currency ? alt_rate : null,
    withholding_rate, withholding_rate ? withholding_label : '', t.withholding, t.due,
    t.base, period ? JSON.stringify(period) : null, payment_methods || null];

  let invoiceId;
  if (id) {
    // Une facture déjà émise (numéro attribué) reste modifiable tant que le client n'a rien signalé :
    // le numéro, la date d'émission et le statut ne bougent pas, seuls le contenu et les montants changent.
    const row = await one(`UPDATE invoices SET client_id = $1, title = $2, vat_rate = $3, subtotal = $4, vat_amount = $5,
      total = $6, notes = $7,
      send_on = CASE WHEN status IN ('brouillon', 'programmee') THEN $8 ELSE send_on END,
      status = CASE WHEN status IN ('brouillon', 'programmee') THEN $9 ELSE status END,
      currency = $10, alt_currency = $11, alt_rate = $12,
      withholding_rate = $13, withholding_label = $14, withholding_amount = $15, amount_due = $16,
      withholding_base = $17, period = $18, payment_methods = $19
      WHERE id = $20 AND company_id = $21 AND status IN ('brouillon', 'programmee', 'emise', 'envoyee') RETURNING id`,
      [...values, Number(id), company.id]);
    if (!row) throw new Error('Ce document ne peut plus être modifié : le client a déjà signalé ou confirmé le paiement.');
    invoiceId = row.id;
    await q('DELETE FROM invoice_lines WHERE invoice_id = $1', [invoiceId]);
  } else {
    const row = await one(`INSERT INTO invoices (client_id, title, vat_rate, subtotal, vat_amount, total, notes, send_on, status,
      currency, alt_currency, alt_rate, withholding_rate, withholding_label, withholding_amount, amount_due,
      withholding_base, period, payment_methods, company_id, token, doc_type, source_quote_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23) RETURNING id`,
      [...values, company.id, crypto.randomBytes(24).toString('base64url'), doc_type === 'devis' ? 'devis' : 'facture', source_quote_id]);
    invoiceId = row.id;
  }

  await q(`UPDATE invoices SET send_tz = CASE WHEN status IN ('brouillon', 'programmee') THEN $1 ELSE send_tz END WHERE id = $2`,
    [send_on ? send_tz : '', invoiceId]);

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

// Milieu des numéros : « FP » suivi du code du compte (481 pour le premier compte, puis 482, 483…).
// D'où FAC-FP481-0001, DEV-FP481-0001, AV-FP481-0001. Le compteur ne repart jamais à zéro.
const numberCode = async (company) => {
  const code = company.fp_code ?? (await one('SELECT fp_code FROM companies WHERE id = $1', [company.id]))?.fp_code;
  return `FP${code}`;
};

// Prochain numéro d'une suite (avoirs, devis) : compteur continu, sans remise à zéro annuelle (« année » 0)
async function nextNumber(company, kind, prefix) {
  const row = await one(`INSERT INTO sequences (company_id, kind, year, value) VALUES ($1, $2, 0, 1)
    ON CONFLICT (company_id, kind, year) DO UPDATE SET value = sequences.value + 1 RETURNING value`, [company.id, kind]);
  return `${prefix}-${await numberCode(company)}-${String(row.value).padStart(4, '0')}`;
}

// Copie figée des coordonnées, posée une seule fois à l'émission
const SNAPSHOTS = `
  client_snapshot = (SELECT json_build_object('name', c.name, 'address', c.address, 'phone', c.phone)::text FROM clients c WHERE c.id = invoices.client_id),
  company_snapshot = (SELECT json_build_object('name', co.name, 'address', co.address, 'phone', co.phone, 'email', co.email, 'legal_ids', co.legal_ids)::text
    FROM companies co WHERE co.id = invoices.company_id)`;

// Attribue le numéro (FAC-FP481-0001…) une seule fois, au moment de l'émission.
// Les numéros de facture se suivent sans trou et sans remise à zéro. Les devis ont leur propre suite.
async function issue(company, invoiceId) {
  const year = new Date().getUTCFullYear();
  const issued = today();
  const doc = await one('SELECT doc_type, number, status FROM invoices WHERE id = $1 AND company_id = $2', [invoiceId, company.id]);
  if (!doc) return;
  if (doc.number) {
    if (doc.status === 'programmee') {
      await q(`UPDATE invoices SET status = 'emise' WHERE id = $1`, [invoiceId]);
    }
    return;
  }
  if (doc.doc_type === 'devis') {
    const number = await nextNumber(company, 'devis', company.quote_prefix || 'DEV');
    await q(`UPDATE invoices SET number = $1, issue_date = $2, due_date = $3, status = 'emise', verify_code = $5, ${SNAPSHOTS}
      WHERE id = $4 AND number IS NULL`, [number, issued, addDays(issued, Number(company.quote_validity) || 30), invoiceId, newVerifyCode()]);
    return;
  }
  await q(`
    WITH seq AS (
      UPDATE companies SET
        invoice_seq = invoice_seq + 1,
        invoice_seq_year = $2
      WHERE id = $1 AND EXISTS (SELECT 1 FROM invoices WHERE id = $3 AND company_id = $1 AND number IS NULL)
      RETURNING invoice_prefix, invoice_seq, fp_code
    )
    UPDATE invoices SET
      number = seq.invoice_prefix || '-FP' || seq.fp_code || '-' || lpad(seq.invoice_seq::text, 4, '0'),
      issue_date = $4, due_date = $5, status = 'emise', verify_code = $6, ${SNAPSHOTS}
    FROM seq WHERE invoices.id = $3 AND invoices.number IS NULL`,
  [company.id, year, invoiceId, issued, addDays(issued, Number(company.payment_terms) || 0), newVerifyCode()]);
}

// Émet la facture si besoin, puis l'envoie au client avec le PDF. Renvoie { ok, error, testMode }.
export async function sendInvoice(company, invoiceId) {
  await issue(company, invoiceId);
  const inv = await getInvoice(company.id, invoiceId);
  try {
    const pdf = await invoicePdf(inv, company);
    const email = isQuote(inv) ? quoteSentEmail(inv, company, payUrl(inv)) : invoiceSentEmail(inv, company, payUrl(inv));
    const result = await sendMail({
      to: inv.client_email,
      replyTo: company.email || undefined,
      ...(await withImages(email, company)),
      attachments: [{ filename: `${inv.number}.pdf`, content: pdf }],
    });
    await q(`UPDATE invoices SET status = CASE WHEN status IN ('emise', 'programmee', 'brouillon') THEN 'envoyee' ELSE status END,
      sent_at = now(), send_error = NULL, sending_at = NULL WHERE id = $1`, [inv.id]);
    const recipientCompany = await matchRecipientCompany(inv.client_email, company.id);
    if (recipientCompany) {
      await notifyOwner(recipientCompany, {
        title: isQuote(inv) ? 'Nouveau devis reçu' : 'Nouvelle facture reçue',
        body: `${company.name} vous a ${isQuote(inv) ? 'envoyé un devis de' : 'envoyé une facture de'} ${money(inv.amount_due, inv.currency)}.`,
        url: isQuote(inv) ? '/devis?vue=achats' : '/factures?vue=achats',
      }).catch((e) => console.error('Notification achat échouée :', e.message));
    }
    return { ok: true, invoice: inv, testMode: !result?.sent };
  } catch (err) {
    console.error(`Envoi de ${inv.number} échoué :`, err);
    await q(`UPDATE invoices SET status = CASE WHEN status = 'programmee' THEN 'emise' ELSE status END,
      send_error = $1, sending_at = NULL WHERE id = $2`,
      [String(err.message).slice(0, 300), inv.id]);
    return { ok: false, error: safeError(err), invoice: inv };
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
  await notifyOwner(company, {
    title: 'Paiement signalé',
    body: `${inv.client_name} a signalé le paiement de la facture ${inv.number}.`,
    url: `/factures/${pubId('facture', inv.id)}`,
  });
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
    return { sent: false, error: safeError(err), invoice: inv };
  }
}

// Statuts dans lesquels l'entreprise peut encore annuler : envoyée, sans paiement signalé
export const CANCELLABLE = ['emise', 'envoyee'];

// Annule la facture et émet l'avoir correspondant (AV-FP481-0001) dans tous les cas, pour que les
// comptes restent justes. Le client n'est prévenu par e-mail (avec le PDF de l'avoir) que si demandé.
// Renvoie { cancelled, sent, skipped, error, invoice }.
export async function cancelInvoice(company, id, reason, { notify = false } = {}) {
  const row = await one(`UPDATE invoices SET status = 'annulee', cancelled_at = now(), cancel_reason = $1
    WHERE id = $2 AND company_id = $3 AND doc_type = 'facture' AND status IN ('emise', 'envoyee') RETURNING id`, [reason, Number(id), company.id]);
  if (!row) return { cancelled: false };
  const credit = await nextNumber(company, 'avoir', 'AV');
  await q('UPDATE invoices SET credit_number = $1, credit_date = $2 WHERE id = $3', [credit, today(), row.id]);
  const inv = await getInvoice(company.id, row.id);
  if (!notify) return { cancelled: true, sent: false, skipped: true, invoice: inv };
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
    console.error(`Avoir de ${inv.number} non envoyé :`, err);
    return { cancelled: true, sent: false, error: safeError(err), invoice: inv };
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
    console.error(`Relance de ${inv.number} non envoyée :`, err);
    return { ok: false, error: safeError(err) };
  }
}

// Relances automatiques : une par facture et par passage, quand le palier suivant est atteint,
// et jamais deux relances à moins de 3 jours d'écart (même si le retard est déjà ancien)
async function runReminders(companyId = null) {
  const params = [today()];
  let filter = '';
  if (companyId) { params.push(companyId); filter = ` AND i.company_id = $${params.length}`; }
  const late = await q(`SELECT i.id, i.company_id, i.due_date, i.reminders_sent FROM invoices i JOIN companies co ON co.id = i.company_id
    WHERE i.doc_type = 'facture' AND i.status = 'envoyee' AND i.due_date < $1 AND co.reminders_enabled${filter}
      AND (i.last_reminder_at IS NULL OR i.last_reminder_at < now() - interval '3 days')`, params);
  const companies = await companiesById(late.map((row) => row.company_id));
  return inParallel(late, PARALLEL, async (row) => {
    const company = companies.get(row.company_id);
    if (!company) return null;
    const step = reminderDays(company)[row.reminders_sent];
    if (step === undefined || addDays(row.due_date, step) > today()) return null;
    const r = await sendReminder(company, row.id);
    return { id: row.id, reminder: row.reminders_sent + 1, ok: r.ok };
  }).then((rows) => rows.filter(Boolean));
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
  await notifyOwner(company, {
    title: accepted ? 'Devis accepté' : 'Devis refusé',
    body: `${inv.client_name} a ${accepted ? 'accepté' : 'refusé'} le devis ${inv.number}.`,
    url: `/factures/${pubId('facture', inv.id)}`,
  });
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
  await notifyOwner(company, {
    title: 'Nouveau message',
    body: `${inv.client_name} : ${body.slice(0, 120)}`,
    url: `/factures/${pubId('facture', inv.id)}`,
  });
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
async function runRecurring(companyId = null) {
  const params = [today()];
  let filter = '';
  if (companyId) { params.push(companyId); filter = ` AND company_id = $${params.length}`; }
  const due = await q(`SELECT id, company_id, repeat_count, repeat_next FROM invoices
    WHERE repeat_active AND doc_type = 'facture' AND repeat_next <= $1${filter}`, params);
  const companies = await companiesById(due.map((t) => t.company_id));
  return inParallel(due, PARALLEL, async (t) => {
    const company = companies.get(t.company_id);
    if (!company) return { template: t.id, ok: false };
    // La date suivante est avancée avant la copie : deux exécutions rapprochées ne dupliquent pas
    await q('UPDATE invoices SET repeat_count = repeat_count + 1, repeat_next = $1 WHERE id = $2', [nextMonth(t.repeat_next), t.id]);
    const newId = await duplicate(company, t.id, { months: t.repeat_count + 1 });
    await q('UPDATE invoices SET repeat_source_id = $1 WHERE id = $2', [t.id, newId]);
    const r = await sendInvoice(company, newId);
    return { template: t.id, id: newId, ok: r.ok };
  });
}

// Tâche quotidienne : envoie les factures programmées, réessaie les envois échoués, puis relance les retards.
// Instant d'envoi : les anciennes programmations (date seule) partent à 7 h UTC ce jour-là
const SEND_AT = `(CASE WHEN length(send_on) = 10 THEN (send_on || 'T07:00:00Z')::timestamptz ELSE send_on::timestamptz END)`;

// Une réservation périmée (envoi interrompu par la fin de la fonction) est réutilisable au tour suivant.
const FREE_TO_SEND = `(sending_at IS NULL OR sending_at < now() - interval '10 minutes')`;

// Réserve le lot à envoyer avant de lancer quoi que ce soit : la sélection et la pose de la
// réservation tiennent dans une seule requête, sous verrou (SKIP LOCKED). Deux exécutions
// concurrentes — la navigation et la tâche quotidienne — ne se partagent donc jamais une facture.
async function claimDue({ companyId = null, retryFailed = true, limit = 60 }) {
  const params = [];
  const due = [`status = 'programmee' AND ${SEND_AT} <= now()`];
  if (retryFailed) due.push(`status = 'emise'`);
  let where = `(${due.join(' OR ')}) AND ${FREE_TO_SEND}`;
  if (companyId) { params.push(companyId); where += ` AND company_id = $${params.length}`; }
  params.push(limit);
  return q(`UPDATE invoices SET sending_at = now(),
      status = CASE WHEN status = 'programmee' THEN 'emise' ELSE status END
    WHERE id IN (SELECT id FROM invoices WHERE ${where}
      ORDER BY send_on NULLS LAST, id FOR UPDATE SKIP LOCKED LIMIT $${params.length})
    RETURNING id, company_id`, params);
}

export async function runScheduled({ companyId = null, retryFailed = true, limit = 60 } = {}) {
  const claimed = await claimDue({ companyId, retryFailed, limit });
  const companies = await companiesById(claimed.map((row) => row.company_id));
  const sent = await inParallel(claimed, PARALLEL, async (row) => {
    const company = companies.get(row.company_id);
    if (!company) return { id: row.id, ok: false, error: 'Entreprise introuvable' };
    const r = await sendInvoice(company, row.id);
    return { id: row.id, ok: r.ok };
  });
  return { sent, recurring: await runRecurring(companyId), reminders: await runReminders(companyId) };
}

// La tâche quotidienne ne passe qu'une fois par jour (Vercel ne déclenche les crons qu'à 7 h UTC,
// et une seule fois par jour sur l'offre gratuite) : une facture programmée pour 15 h ne partirait
// que le lendemain. Ce passage, appelé à l'ouverture de l'espace connecté, rattrape ce qui vient
// d'échoir — une fois par minute et par entreprise suffit, la réservation ci-dessus évite les doublons.
const lastCheck = new Map();
export async function opportunisticScheduledCheck(companyId) {
  if (!companyId) return null;
  const now = Date.now();
  if (now - (lastCheck.get(companyId) || 0) < 60_000) return null;
  lastCheck.set(companyId, now);
  try {
    return await runScheduled({ companyId, retryFailed: false });
  } catch (err) {
    console.error('Envois programmés :', err.message);
    return null;
  }
}


