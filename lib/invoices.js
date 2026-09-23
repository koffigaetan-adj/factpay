import crypto from 'node:crypto';
import { q, one } from './db.js';
import { totals, money, moneyAlt, rateLabel } from './money.js';
import { today, addDays, frDate } from './dates.js';
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
export const EDITABLE = ['brouillon', 'programmee'];

export const payUrl = (inv) => `${appUrl()}/f/${inv.token}`;

async function withLines(inv) {
  if (!inv) return null;
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
    }))
    .filter((l) => l.description && l.quantity);
}

// Crée ou met à jour un brouillon. Renvoie son id.
export async function saveDraft(company, { id, client_id, title, lines, vat_rate, notes, send_on }) {
  const client = await one('SELECT id FROM clients WHERE id = $1 AND company_id = $2', [Number(client_id) || 0, company.id]);
  if (!client) throw new Error('Choisis un client.');
  if (!lines.length) throw new Error('Ajoute au moins une ligne avec une description et une quantité.');

  const t = totals(lines, vat_rate, company.currency);
  const status = send_on ? 'programmee' : 'brouillon';
  const values = [client.id, title, vat_rate, t.subtotal, t.vat, t.total, notes, send_on || null, status];

  let invoiceId;
  if (id) {
    const row = await one(`UPDATE invoices SET client_id = $1, title = $2, vat_rate = $3, subtotal = $4, vat_amount = $5,
      total = $6, notes = $7, send_on = $8, status = $9
      WHERE id = $10 AND company_id = $11 AND status IN ('brouillon', 'programmee') RETURNING id`,
      [...values, Number(id), company.id]);
    if (!row) throw new Error('Cette facture a déjà été émise, elle ne peut plus être modifiée.');
    invoiceId = row.id;
    await q('DELETE FROM invoice_lines WHERE invoice_id = $1', [invoiceId]);
  } else {
    const row = await one(`INSERT INTO invoices (client_id, title, vat_rate, subtotal, vat_amount, total, notes, send_on, status,
      company_id, token, currency) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      [...values, company.id, crypto.randomBytes(24).toString('base64url'), company.currency]);
    invoiceId = row.id;
  }

  // Toutes les lignes en une seule requête
  const rows = lines.map((l, i) => ({ ...l, position: i, amount: l.quantity * l.unit_price }));
  await q(`INSERT INTO invoice_lines (invoice_id, position, description, quantity, unit, unit_price, amount)
    SELECT $1, x.position, x.description, x.quantity, x.unit, x.unit_price, x.amount
    FROM json_to_recordset($2::json) AS x(position int, description text, quantity float8, unit text, unit_price float8, amount float8)`,
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
    const alt = company.show_alt_currency ? moneyAlt(inv.total, inv.currency) : '';
    const ways = [
      company.iban && `- Virement bancaire${company.bank_name ? ` (${company.bank_name})` : ''} : ${company.iban}${company.bic ? `, BIC/SWIFT ${company.bic}` : ''}`,
      company.mobile_money && `- Mobile Money : ${company.mobile_money}`,
    ].filter(Boolean).join('\n');

    await sendMail({
      to: inv.client_email,
      replyTo: company.email || undefined,
      subject: `Facture ${inv.number}${inv.title ? ` – ${inv.title}` : ''} (${company.name})`,
      text: `Bonjour ${inv.client_name},

Veuillez trouver ci-joint la facture ${inv.number} de ${company.name}.

Montant à payer : ${money(inv.total, inv.currency)}${alt ? `, soit ${alt} (parité fixe ${rateLabel()})` : ''}
À régler avant le : ${frDate(inv.due_date)}
${ways ? `\nModes de paiement :\n${ways}\n` : ''}Référence à indiquer : ${inv.number}

Voir la facture et signaler votre paiement (référence + justificatif) :
${payUrl(inv)}

Cordialement,
${company.name}`,
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
  await sendMail({
    to: company.email || owner.email,
    subject: `Paiement signalé : ${inv.number} (${inv.client_name})`,
    text: `${inv.client_name} a signalé le paiement de la facture ${inv.number}.

Montant : ${money(inv.total, inv.currency)}
Référence du paiement : ${reference}

Vérifie que l'argent est bien arrivé, puis confirme le paiement ici :
${appUrl()}/factures/${inv.id}`,
  }).catch((e) => console.error('Notification échouée :', e.message));
}

export async function confirmPayment(companyId, id) {
  await q(`UPDATE invoices SET status = 'payee', confirmed_at = now()
    WHERE id = $1 AND company_id = $2 AND status IN ('envoyee', 'signalee', 'emise')`, [Number(id), companyId]);
}

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
