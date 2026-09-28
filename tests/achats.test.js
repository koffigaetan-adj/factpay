// Achats : une entreprise FactPay peut aussi être cliente d'une autre entreprise FactPay.
// Quand l'e-mail du client correspond au compte (e-mail de l'entreprise ou de son propriétaire),
// la facture/le devis envoyé apparaît dans l'onglet « Achats » de l'autre compte, et le prévient.
// Base en mémoire. Lancer avec : npm test
process.env.PGLITE_DIR = 'memory://';
process.env.FACTPAY_QUIET = '1';
delete process.env.DATABASE_URL;
delete process.env.VAPID_PUBLIC_KEY;
delete process.env.VAPID_PRIVATE_KEY;

import { test, before } from 'node:test';
import assert from 'node:assert/strict';

let one, notif, inv;
const base = { title: 'Mission', currency: 'XOF', vat_rate: 0, withholding_rate: 0, withholding_label: '', notes: '', send_on: '' };
const lines = [{ kind: 'service', description: 'Dev', quantity: 1, unit: 'forfait', unit_price: 50000 }];

before(async () => {
  ({ one } = await import('../lib/db.js'));
  notif = await import('../lib/notifications.js');
  inv = await import('../lib/invoices.js');
});

async function makeCompany(ownerEmail, companyEmail = '') {
  const u = await one("INSERT INTO users (email, name, password_hash) VALUES ($1, 'U', 'x') RETURNING id", [ownerEmail]);
  return one('INSERT INTO companies (owner_id, name, currency, email) VALUES ($1, $2, $3, $4) RETURNING *',
    [u.id, `Studio ${ownerEmail}`, 'XOF', companyEmail]);
}

test("achat : trouvé par l'e-mail du propriétaire du compte destinataire", async () => {
  const seller = await makeCompany('seller1@x.tg');
  const buyer = await makeCompany('buyer1@x.tg');
  const clientId = (await one("INSERT INTO clients (company_id, name, email) VALUES ($1, 'Buyer', $2) RETURNING id",
    [seller.id, 'buyer1@x.tg'])).id;

  const before1 = await notif.unreadCount(buyer.owner_id);
  const id = await inv.saveDraft(seller, { ...base, client_id: clientId, lines });
  // Pas encore envoyée : ne doit pas apparaître comme achat
  let received = await inv.listReceivedInvoices(['buyer1@x.tg']);
  assert.equal(received.length, 0, 'un brouillon ne compte pas comme achat');

  await inv.sendInvoice(seller, id);
  received = await inv.listReceivedInvoices(['buyer1@x.tg']);
  assert.equal(received.length, 1);
  assert.equal(received[0].issuer_name, seller.name);
  assert.ok(received[0].token, "le jeton public est présent pour ouvrir /f/<token>");

  assert.equal(await notif.unreadCount(buyer.owner_id), before1 + 1, "l'achat prévient le compte destinataire");
});

test("achat : trouvé aussi par l'e-mail de l'entreprise destinataire (pas seulement celui du propriétaire)", async () => {
  const seller = await makeCompany('seller2@x.tg');
  const buyer = await makeCompany('buyer-owner2@x.tg', 'contact-buyer2@x.tg');
  const clientId = (await one("INSERT INTO clients (company_id, name, email) VALUES ($1, 'Buyer', $2) RETURNING id",
    [seller.id, 'contact-buyer2@x.tg'])).id;
  const id = await inv.saveDraft(seller, { ...base, client_id: clientId, lines });
  await inv.sendInvoice(seller, id);

  assert.equal((await inv.listReceivedInvoices(['contact-buyer2@x.tg'])).length, 1);
  // L'e-mail personnel du propriétaire seul ne doit rien donner ici : c'est bien l'e-mail entreprise qui a matché
  assert.equal((await inv.listReceivedInvoices(['buyer-owner2@x.tg'])).length, 0);
});

test('achat : une entreprise ne se voit jamais elle-même dans ses propres achats', async () => {
  const solo = await makeCompany('solo3@x.tg');
  const clientId = (await one("INSERT INTO clients (company_id, name, email) VALUES ($1, 'Moi-même', $2) RETURNING id",
    [solo.id, 'solo3@x.tg'])).id;
  const id = await inv.saveDraft(solo, { ...base, client_id: clientId, lines });
  await inv.sendInvoice(solo, id);
  assert.equal((await inv.listReceivedInvoices(['solo3@x.tg'], 'facture', solo.id)).length, 0);
});
