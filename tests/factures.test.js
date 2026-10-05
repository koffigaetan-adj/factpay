// Parcours complets sur une base en mémoire (rien n'est écrit sur le disque, aucun e-mail ne part).
// Lancer avec : npm test
process.env.PGLITE_DIR = 'memory://';
process.env.FACTPAY_QUIET = '1';
delete process.env.DATABASE_URL;
delete process.env.SMTP_USER;

import { test, before } from 'node:test';
import assert from 'node:assert/strict';

let q, one, inv, pdf, c, clientId;
const base = { title: 'Mission', currency: 'XOF', vat_rate: 0, withholding_rate: 5, withholding_label: 'Retenue à la source', notes: '', send_on: '' };
const lines = [{ kind: 'service', description: 'Dev', quantity: 10, unit: 'jour(s)', unit_price: 100000 }];
const newInvoice = async (extra = {}) => inv.saveDraft(c, { ...base, client_id: clientId, lines, ...extra });

before(async () => {
  ({ q, one } = await import('../lib/db.js'));
  inv = await import('../lib/invoices.js');
  pdf = await import('../lib/pdf.js');
  const u = await one("INSERT INTO users (email, name, password_hash) VALUES ('test@x.tg', 'Test', 'x') RETURNING id");
  c = await one("INSERT INTO companies (owner_id, name, currency, address) VALUES ($1, 'Studio Kodjo', 'XOF', 'Lomé') RETURNING *", [u.id]);
  clientId = (await one("INSERT INTO clients (company_id, name, email, address) VALUES ($1, 'Agence Lumière', 'c@x.com', 'Rue 1') RETURNING id", [c.id])).id;
});

test('numérotation sans trou et coordonnées figées à l\'émission', async () => {
  const a = await newInvoice();
  const b = await newInvoice();
  await inv.sendInvoice(c, a);
  await inv.sendInvoice(c, b);
  const [fa, fb] = [await inv.getInvoice(c.id, a), await inv.getInvoice(c.id, b)];
  const code = `FP${c.fp_code}`; // « FP » + code du compte (481 pour le premier)
  assert.equal(c.fp_code, 481, 'le premier compte reçoit le code 481');
  assert.equal(fa.number, `FAC-${code}-0001`);
  assert.equal(fb.number, `FAC-${code}-0002`);
  await q("UPDATE clients SET name = 'Autre nom' WHERE id = $1", [clientId]);
  assert.equal((await inv.getInvoice(c.id, a)).client_name, 'Agence Lumière');
  await q("UPDATE clients SET name = 'Agence Lumière' WHERE id = $1", [clientId]);
});

test('payée avec date et moyen, puis remise en attente', async () => {
  const id = await newInvoice();
  await inv.sendInvoice(c, id);
  const r = await inv.confirmPayment(c, id, { paidOn: '2026-09-15', method: 'Flooz', reference: 'TX-1', notify: false });
  assert.ok(r.confirmed);
  let f = await inv.getInvoice(c.id, id);
  assert.equal(f.status, 'payee');
  assert.equal(f.payment_method, 'Flooz');
  assert.equal(new Date(f.confirmed_at).toISOString().slice(0, 10), '2026-09-15');
  assert.equal((await inv.reopenInvoice(c, id)).status, 'envoyee');
});

test('annulation : avoir numéroté et PDF, client prévenu seulement si demandé', async () => {
  const id = await newInvoice();
  await inv.sendInvoice(c, id);
  // Par défaut (notify absent) : annulée et avoir émis, mais le client n'est pas prévenu
  const skip = await inv.cancelInvoice(c, id, 'Erreur');
  assert.ok(skip.cancelled);
  assert.ok(skip.skipped, "sans notify, le client n'est pas prévenu");
  assert.equal(skip.sent, false);
  const f = await inv.getInvoice(c.id, id);
  assert.match(f.credit_number, /^AV-FP\d{3,}-0001$/);
  const file = await pdf.creditNotePdf(f, c);
  assert.equal(file.subarray(0, 4).toString(), '%PDF');
  // Une facture payée ou annulée ne s'annule plus
  assert.equal((await inv.cancelInvoice(c, id, '')).cancelled, false);

  // Avec notify: true, le client reçoit l'avoir par e-mail
  const id2 = await newInvoice();
  await inv.sendInvoice(c, id2);
  const sent = await inv.cancelInvoice(c, id2, 'Erreur', { notify: true });
  assert.ok(sent.cancelled);
  assert.ok(sent.sent, 'avec notify: true, le client est prévenu');
  assert.ok(!sent.skipped);
});

test('relances automatiques : paliers et écart minimum', async () => {
  await q("UPDATE companies SET reminders_enabled = true, reminder_days = '3,10' WHERE id = $1", [c.id]);
  c = await one('SELECT * FROM companies WHERE id = $1', [c.id]);
  const id = await newInvoice();
  await inv.sendInvoice(c, id);
  await q("UPDATE invoices SET due_date = to_char(now() - interval '14 days', 'YYYY-MM-DD') WHERE id = $1", [id]);
  const mine = (run) => run.reminders.filter((x) => x.id === id);
  assert.equal(mine(await inv.runScheduled()).length, 1);
  assert.equal(mine(await inv.runScheduled()).length, 0); // moins de 3 jours après la précédente
  await q("UPDATE invoices SET last_reminder_at = now() - interval '4 days' WHERE id = $1", [id]);
  assert.equal(mine(await inv.runScheduled())[0].reminder, 2);
});

test('duplication vers le mois suivant', async () => {
  const period = { mode: 'mois', month: '2026-09', from: '', to: '', dates: [], hours_per_day: 8, exclude_weekends: true, exclude_holidays: true, country: 'FR' };
  const id = await newInvoice({ period, lines: [{ kind: 'period', description: 'Dev', quantity: 176, unit: 'heure(s)', unit_price: 5000 }] });
  const copy = await inv.getInvoice(c.id, await inv.duplicate(c, id));
  assert.equal(copy.status, 'brouillon');
  assert.equal(copy.period.month, '2026-10');
});

test('devis : numéro, acceptation par le client, transformation en facture', async () => {
  const id = await newInvoice({ doc_type: 'devis' });
  await inv.sendInvoice(c, id);
  let d = await inv.getInvoice(c.id, id);
  assert.match(d.number, /^DEV-FP\d{3,}-0001$/);
  assert.ok(!(await inv.listInvoices(c.id)).some((x) => x.id === id), 'un devis ne figure pas dans les factures');
  await inv.answerQuote(d.token, true);
  const invoiceId = await inv.convertQuote(c, id);
  d = await inv.getInvoice(c.id, id);
  const f = await inv.getInvoice(c.id, invoiceId);
  assert.equal(d.status, 'convertie');
  assert.equal(f.doc_type, 'facture');
  assert.equal(f.source_quote_id, id);
});

test("modification d'une facture déjà émise : numéro et statut gardés, lignes et montants à jour", async () => {
  const id = await newInvoice();
  await inv.sendInvoice(c, id);
  const before = await inv.getInvoice(c.id, id);
  assert.equal(before.status, 'envoyee');

  await inv.saveDraft(c, {
    ...base, id, client_id: clientId,
    lines: [{ kind: 'service', description: 'Dev (corrigé)', quantity: 12, unit: 'jour(s)', unit_price: 100000 }],
  });
  const after = await inv.getInvoice(c.id, id);
  assert.equal(after.number, before.number, 'le numéro ne change pas');
  assert.equal(after.status, 'envoyee', 'le statut ne revient pas en brouillon');
  assert.equal(after.issue_date, before.issue_date, "la date d'émission ne change pas");
  assert.equal(after.lines.length, 1);
  assert.equal(after.lines[0].description, 'Dev (corrigé)');
  assert.equal(after.total, 1200000);

  // Une fois le paiement signalé ou confirmé, la facture n'est plus modifiable
  await inv.confirmPayment(c, id, { notify: false });
  await assert.rejects(
    inv.saveDraft(c, { ...base, id, client_id: clientId, lines }),
    /ne peut plus être modifié/,
  );
});
