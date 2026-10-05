// Factures récurrentes, devis signés, récapitulatif de l'année, accès comptable, lien WhatsApp.
// Base en mémoire, aucun e-mail envoyé. Lancer avec : npm test
process.env.PGLITE_DIR = 'memory://';
process.env.FACTPAY_QUIET = '1';
delete process.env.DATABASE_URL;
delete process.env.SMTP_USER;

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { whatsappLink } from '../lib/payment.js';
import { pubId, idFrom } from '../lib/ids.js';
import { addDays, today, frDateTime } from '../lib/dates.js';

let q, one, inv, report, acc, c, clientId;
const base = { title: 'Mission', currency: 'XOF', vat_rate: 18, withholding_rate: 5, withholding_label: 'Retenue à la source', notes: '', send_on: '' };
const lines = [{ kind: 'service', description: 'Dev', quantity: 1, unit: 'forfait', unit_price: 100000 }];

before(async () => {
  ({ q, one } = await import('../lib/db.js'));
  inv = await import('../lib/invoices.js');
  report = await import('../lib/report.js');
  acc = await import('../lib/accountant.js');
  const u = await one("INSERT INTO users (email, name, password_hash) VALUES ('x@x.tg', 'X', 'x') RETURNING id");
  c = await one("INSERT INTO companies (owner_id, name, currency) VALUES ($1, 'Studio', 'XOF') RETURNING *", [u.id]);
  clientId = (await one("INSERT INTO clients (company_id, name, email, phone) VALUES ($1, 'Client', 'c@x.com', '90 12 34 56') RETURNING id", [c.id])).id;
});

test('facture récurrente : copie envoyée à la date, période décalée, puis mois suivant', async () => {
  const period = { mode: 'mois', month: '2026-09', from: '', to: '', dates: [], hours_per_day: 8, exclude_weekends: true, exclude_holidays: false, country: 'FR' };
  const id = await inv.saveDraft(c, { ...base, client_id: clientId, period, lines: [{ kind: 'period', description: 'Dev', quantity: 176, unit: 'heure(s)', unit_price: 1000 }] });
  await inv.sendInvoice(c, id);
  const r = await inv.setRepeat(c, id, { active: true, day: 30 });
  assert.ok(r.active);
  assert.ok(r.next > today(), 'le premier envoi est dans le futur');
  await q('UPDATE invoices SET repeat_next = $1 WHERE id = $2', [today(), id]); // on avance l'horloge
  const run = await inv.runScheduled();
  const made = run.recurring.find((x) => x.template === id);
  assert.ok(made?.ok);
  const copy = await inv.getInvoice(c.id, made.id);
  assert.equal(copy.status, 'envoyee');
  assert.equal(copy.period.month, '2026-10');
  assert.equal(copy.repeat_source_id, id);
  const tpl = await inv.getInvoice(c.id, id);
  assert.equal(tpl.repeat_count, 1);
  assert.ok(tpl.repeat_next > today());
  assert.equal((await inv.runScheduled()).recurring.length, 0, 'pas de double envoi le même jour');
  await inv.setRepeat(c, id, { active: false });
  assert.equal((await inv.getInvoice(c.id, id)).repeat_active, false);
});

test('devis accepté avec signature', async () => {
  const id = await inv.saveDraft(c, { ...base, client_id: clientId, lines, doc_type: 'devis' });
  await inv.sendInvoice(c, id);
  const d = await inv.getInvoice(c.id, id);
  await inv.answerQuote(d.token, true, 'Afi Mensah');
  const after = await inv.getInvoice(c.id, id);
  assert.equal(after.status, 'acceptee');
  assert.equal(after.accepted_by, 'Afi Mensah');
});

test('récapitulatif de l\'année : HT, TVA, retenues, encaissé, annulées exclues', async () => {
  const all = await inv.listInvoices(c.id);
  const year = Number(today().slice(0, 4));
  const r = report.yearReport(c, all, year);
  const counted = all.filter((i) => i.number && i.status !== 'annulee' && i.issue_date.startsWith(String(year)));
  assert.equal(r.total.count, counted.length);
  assert.equal(r.total.subtotal, counted.reduce((s, i) => s + i.subtotal, 0));
  assert.equal(r.total.withholding, counted.reduce((s, i) => s + i.withholding_amount, 0));
  assert.equal(r.clients[0].name, 'Client');
  assert.deepEqual(report.yearsOf(all), [year]);
});

test('accès comptable : lien valable, puis désactivé', async () => {
  const token = await acc.createAccountantLink(c.id);
  const found = await acc.companyByAccountantToken(token);
  assert.equal(found.id, c.id);
  assert.equal(acc.accountantToken(found), token, 'le lien se réaffiche');
  assert.equal(await acc.companyByAccountantToken('faux-jeton'), null);
  await acc.revokeAccountantLink(c.id);
  assert.equal(await acc.companyByAccountantToken(token), null);
});

test('lien WhatsApp : indicatif ajouté aux numéros locaux', () => {
  assert.equal(whatsappLink('90 12 34 56', 'Bonjour', 'TG'), 'https://wa.me/22890123456?text=Bonjour');
  assert.equal(whatsappLink('+33 6 12 34 56 78', 'Salut', 'TG'), 'https://wa.me/33612345678?text=Salut');
  assert.equal(whatsappLink('', 'Merci', 'TG'), 'https://wa.me/?text=Merci');
  assert.ok(addDays('2026-01-31', 1) === '2026-02-01');
});

test('vérification : code posé à l\'émission, document retrouvé, empreinte stable, faux code refusé', async () => {
  const { fingerprint, normalizeCode, formatCode } = await import('../lib/verify.js');
  const id = await inv.saveDraft(c, { ...base, client_id: clientId, lines });
  await inv.sendInvoice(c, id);
  const f = await inv.getInvoice(c.id, id);
  assert.match(f.verify_code, /^[A-Z2-9]{12}$/);
  const found = await inv.getByVerifyCode(formatCode(f.verify_code).toLowerCase());
  assert.equal(found.invoice.id, id, 'retrouvé même tapé en minuscules avec tirets');
  const fp = fingerprint(found.invoice, 'Studio');
  await inv.confirmPayment(c, id, { notify: false });
  assert.equal(fingerprint(await inv.getInvoice(c.id, id), 'Studio'), fp, 'le statut ne change pas l\'empreinte');
  assert.notEqual(fingerprint({ ...found.invoice, amount_due: 1 }, 'Studio'), fp, 'un montant modifié change l\'empreinte');
  assert.equal(await inv.getByVerifyCode('AAAA-BBBB-CCCC'), null);
  assert.equal(normalizeCode(' ab-cd '), 'ABCD');
  const { invoicePdf } = await import('../lib/pdf.js');
  assert.equal((await invoicePdf(f, c)).subarray(0, 4).toString(), '%PDF');
});

test('numérotation : FP481 puis FP482 pour le compte suivant, compteur continu d\'une année sur l\'autre', async () => {
  assert.equal(c.fp_code, 481);
  const u2 = await one("INSERT INTO users (email, name, password_hash) VALUES ('deux@x.tg', 'Deux', 'x') RETURNING id");
  const c2 = await one("INSERT INTO companies (owner_id, name, currency) VALUES ($1, 'Autre', 'XOF') RETURNING *", [u2.id]);
  assert.equal(c2.fp_code, 482);
  const cl2 = (await one("INSERT INTO clients (company_id, name, email) VALUES ($1, 'Cli', 'c@x.com') RETURNING id", [c2.id])).id;
  const a = await inv.saveDraft(c2, { ...base, client_id: cl2, lines });
  await inv.sendInvoice(c2, a);
  assert.equal((await inv.getInvoice(c2.id, a)).number, 'FAC-FP482-0001');
  await q('UPDATE companies SET invoice_seq_year = invoice_seq_year - 1 WHERE id = $1', [c2.id]); // on change d'année
  const b = await inv.saveDraft(c2, { ...base, client_id: cl2, lines });
  await inv.sendInvoice(c2, b);
  assert.equal((await inv.getInvoice(c2.id, b)).number, 'FAC-FP482-0002', 'pas de remise à zéro au 1er janvier');
});

test('identifiants publics : aucun numéro visible, aller-retour exact, faux codes refusés', () => {
  const code = pubId('facture', 1);
  assert.match(code, /^[0-9A-Za-z]{11}$/);
  assert.notEqual(code, pubId('facture', 2));
  for (const id of [1, 2, 481, 123456, 2147483647]) assert.equal(idFrom('facture', pubId('facture', id)), id);
  // Le code d'une facture n'ouvre pas un client, et l'ancien format est refusé
  assert.equal(idFrom('client', code), 0);
  assert.equal(idFrom('facture', '1'), 0);
  assert.equal(idFrom('facture', code.slice(0, 10) + (code[10] === 'a' ? 'b' : 'a')), 0);
  assert.equal(idFrom('facture', undefined), 0);
});

test("envoi programmé à une heure précise : part quand l'heure est passée, pas avant", async () => {
  const soon = new Date(Date.now() + 3600 * 1000).toISOString();
  const later = await inv.saveDraft(c, { ...base, client_id: clientId, lines, send_on: soon, send_tz: 'Europe/Paris' });
  const past = new Date(Date.now() - 60 * 1000).toISOString();
  const due = await inv.saveDraft(c, { ...base, client_id: clientId, lines, send_on: past, send_tz: 'Europe/Paris' });
  assert.equal((await one('SELECT send_tz FROM invoices WHERE id = $1', [due])).send_tz, 'Europe/Paris');
  const run = await inv.runScheduled();
  const sentIds = run.sent.map((r) => r.id);
  assert.ok(sentIds.includes(due), "l'heure est passée : la facture part");
  assert.ok(!sentIds.includes(later), 'dans une heure : elle attend');
  assert.equal((await one('SELECT status FROM invoices WHERE id = $1', [later])).status, 'programmee');
});

test('réservation d\'envoi : une facture déjà en cours n\'est pas réexpédiée, une réservation périmée est reprise', async () => {
  const u = await one("INSERT INTO users (email, name, password_hash) VALUES ('trois@x.tg', 'Trois', 'x') RETURNING id");
  const co = await one("INSERT INTO companies (owner_id, name, currency) VALUES ($1, 'Encore', 'XOF') RETURNING *", [u.id]);
  const cl = (await one("INSERT INTO clients (company_id, name, email) VALUES ($1, 'Cli3', 'c3@x.com') RETURNING id", [co.id])).id;
  const id = await inv.saveDraft(co, { ...base, client_id: cl, lines, send_on: new Date(Date.now() - 60_000).toISOString(), send_tz: 'Europe/Paris' });
  assert.equal((await one('SELECT status FROM invoices WHERE id = $1', [id])).status, 'programmee');

  // Envoi déjà commencé par un autre passage : la réservation empêche le doublon
  await q('UPDATE invoices SET sending_at = now() WHERE id = $1', [id]);
  const skipped = await inv.runScheduled();
  assert.ok(!skipped.sent.some((r) => r.id === id), 'une facture réservée n\'est pas réexpédiée');
  assert.equal((await one('SELECT status FROM invoices WHERE id = $1', [id])).status, 'programmee');

  // Réservation vieille de plus de dix minutes : l'envoi avait été interrompu, il repart
  await q("UPDATE invoices SET sending_at = now() - interval '20 minutes' WHERE id = $1", [id]);
  const run = await inv.runScheduled();
  assert.ok(run.sent.some((r) => r.id === id && r.ok), 'une réservation périmée est reprise');
  const done = await one('SELECT status, sending_at FROM invoices WHERE id = $1', [id]);
  assert.equal(done.status, 'envoyee');
  assert.equal(done.sending_at, null, 'la réservation est levée une fois l\'envoi fait');
});

test('rattrapage à l\'ouverture : chaque entreprise ne traite que ses propres factures', async () => {
  const mk = async (mail, name) => {
    const u = await one('INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id', [mail, name, 'x']);
    const co = await one("INSERT INTO companies (owner_id, name, currency) VALUES ($1, $2, 'XOF') RETURNING *", [u.id, name]);
    const cl = (await one('INSERT INTO clients (company_id, name, email) VALUES ($1, $2, $3) RETURNING id', [co.id, `Cli ${name}`, `c-${mail}`])).id;
    const id = await inv.saveDraft(co, { ...base, client_id: cl, lines, send_on: new Date(Date.now() - 60_000).toISOString(), send_tz: 'Europe/Paris' });
    return { co, id };
  };
  const a = await mk('quatre@x.tg', 'Quatre');
  const b = await mk('cinq@x.tg', 'Cinq');

  const run = await inv.opportunisticScheduledCheck(a.co.id);
  assert.ok(run.sent.some((r) => r.id === a.id && r.ok), 'la facture échue part');
  assert.ok(!run.sent.some((r) => r.id === b.id), 'l\'autre entreprise n\'est pas touchée');
  assert.equal((await one('SELECT status FROM invoices WHERE id = $1', [b.id])).status, 'programmee');
  // Deuxième appel immédiat : rien n'est renvoyé, le serveur s'épargne le travail
  assert.equal(await inv.opportunisticScheduledCheck(a.co.id), null, 'au plus un passage par minute');
});

test('heure affichée dans le fuseau choisi', () => {
  // 06:00 UTC = 08:00 à Paris en été, 06:00 à Lomé
  assert.match(frDateTime('2026-09-25T06:00:00.000Z', 'Europe/Paris'), /25 septembre 2026 à 08:00, heure de Paris/);
  assert.match(frDateTime('2026-09-25T06:00:00.000Z', 'Africa/Lome'), /à 06:00, heure de Lome/);
  assert.equal(frDateTime('2026-09-25', ''), '25 septembre 2026', 'ancienne programmation : la date seule');
});
