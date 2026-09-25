// La petite cloche : une notification par événement client (paiement signalé, devis répondu,
// message reçu), comptée puis marquée lue à l'ouverture du panneau.
// Base en mémoire. Lancer avec : npm test
process.env.PGLITE_DIR = 'memory://';
process.env.FACTPAY_QUIET = '1';
delete process.env.DATABASE_URL;
delete process.env.VAPID_PUBLIC_KEY;
delete process.env.VAPID_PRIVATE_KEY;

import { test, before } from 'node:test';
import assert from 'node:assert/strict';

let one, notif, inv, c, clientId;
const base = { title: 'Mission', currency: 'XOF', vat_rate: 0, withholding_rate: 0, withholding_label: '', notes: '', send_on: '' };
const lines = [{ kind: 'service', description: 'Dev', quantity: 1, unit: 'forfait', unit_price: 100000 }];

before(async () => {
  ({ one } = await import('../lib/db.js'));
  notif = await import('../lib/notifications.js');
  inv = await import('../lib/invoices.js');
  const u = await one("INSERT INTO users (email, name, password_hash) VALUES ('owner@x.tg', 'O', 'x') RETURNING id");
  c = await one("INSERT INTO companies (owner_id, name, currency) VALUES ($1, 'Studio', 'XOF') RETURNING *", [u.id]);
  clientId = (await one("INSERT INTO clients (company_id, name, email) VALUES ($1, 'Client', 'c@x.com') RETURNING id", [c.id])).id;
});

test('notifyOwner : compteur non lu, panneau, tout marqué lu en un coup', async () => {
  assert.equal(await notif.unreadCount(c.owner_id), 0);
  await notif.notifyOwner(c, { title: 'Titre 1', body: 'Un', url: '/a' });
  await notif.notifyOwner(c, { title: 'Titre 2', body: 'Deux', url: '/b' });
  assert.equal(await notif.unreadCount(c.owner_id), 2);

  const list = await notif.listNotifications(c.owner_id);
  assert.equal(list.length, 2);
  assert.equal(list[0].title, 'Titre 2', 'les plus récentes en premier');

  await notif.markAllRead(c.owner_id);
  assert.equal(await notif.unreadCount(c.owner_id), 0);
  assert.ok((await notif.listNotifications(c.owner_id)).every((n) => n.read_at));
});

test('paiement signalé, devis répondu, message client : chacun crée une notification pour le propriétaire', async () => {
  const before = await notif.unreadCount(c.owner_id);

  const id1 = await inv.saveDraft(c, { ...base, client_id: clientId, lines });
  await inv.sendInvoice(c, id1);
  const f = await inv.getInvoice(c.id, id1);
  await inv.declarePayment(f.token, { reference: 'REF-1', proofKey: null, proofName: null, proofMime: null });

  const id2 = await inv.saveDraft(c, { ...base, client_id: clientId, lines, doc_type: 'devis' });
  await inv.sendInvoice(c, id2);
  const d = await inv.getInvoice(c.id, id2);
  await inv.answerQuote(d.token, true, 'Ama Client');

  await inv.sendClientMessage(f.token, 'Une question sur la facture');

  assert.equal(await notif.unreadCount(c.owner_id), before + 3);
  const titles = (await notif.listNotifications(c.owner_id)).slice(0, 3).map((n) => n.title);
  assert.deepEqual(titles, ['Nouveau message', 'Devis accepté', 'Paiement signalé']);
});
