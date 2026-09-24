// Correctifs de sécurité : limites de tentatives, signature des messages, contenu réel des
// fichiers, nettoyage des données expirées, changement d'adresse e-mail.
// Base en mémoire. Lancer avec : npm test
process.env.PGLITE_DIR = 'memory://';
process.env.FACTPAY_QUIET = '1';
delete process.env.DATABASE_URL;

import { test, before } from 'node:test';
import assert from 'node:assert/strict';

let q, one, hitLimit, signFlash, verifyFlash, matchesType, cleanupExpired;
before(async () => {
  ({ q, one } = await import('../lib/db.js'));
  ({ hitLimit } = await import('../lib/ratelimit.js'));
  ({ signFlash, verifyFlash } = await import('../lib/flash.js'));
  ({ matchesType } = await import('../lib/filetype.js'));
  ({ cleanupExpired } = await import('../lib/cleanup.js'));
});

test('limite de tentatives : bloque au-delà du seuil, une autre clé garde son solde', async () => {
  for (let i = 0; i < 3; i++) assert.equal(await hitLimit('test-bucket', 'a@x.tg', 3, 15), false);
  assert.equal(await hitLimit('test-bucket', 'a@x.tg', 3, 15), true);
  // Une autre clé (autre adresse, autre IP…) n'est pas affectée par les coups précédents
  assert.equal(await hitLimit('test-bucket', 'b@x.tg', 3, 15), false);
});

test('messages signés : lisibles tels quels, refusés si le message ou la signature changent', () => {
  const sig = signFlash('ok', 'Facture envoyée.');
  assert.equal(verifyFlash('ok', 'Facture envoyée.', sig), true);
  assert.equal(verifyFlash('ok', 'Compte suspendu, appelez le +228...', sig), false, 'un message différent avec la même signature est refusé');
  assert.equal(verifyFlash('erreur', 'Facture envoyée.', sig), false, 'un genre différent (ok / erreur) est refusé');
  assert.equal(verifyFlash('ok', 'Facture envoyée.', 'AAAAAAAAAAAAAAAAAAAAAA'), false, 'une signature inventée est refusée');
  assert.equal(verifyFlash('ok', 'Facture envoyée.', ''), false, 'aucune signature n\'est refusée');
});

test('contenu réel des fichiers : accepté si le contenu correspond, refusé sinon', async () => {
  const realPng = new File([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])], 'photo.png', { type: 'image/png' });
  assert.equal(await matchesType(realPng), true);
  const fakePng = new File([Buffer.from('pas une image')], 'photo.png', { type: 'image/png' });
  assert.equal(await matchesType(fakePng), false);
  const realPdf = new File([Buffer.from('%PDF-1.4\n...')], 'doc.pdf', { type: 'application/pdf' });
  assert.equal(await matchesType(realPdf), true);
  // Format sans signature vérifiable (texte brut) : laissé passer, un autre contrôle s'en charge
  const txt = new File([Buffer.from('bonjour')], 'notes.txt', { type: 'text/plain' });
  assert.equal(await matchesType(txt), true);
});

test('nettoyage : les sessions et liens expirés disparaissent, les valables restent', async () => {
  const u = await one("INSERT INTO users (email, name, password_hash) VALUES ('clean@x.tg', 'C', 'x') RETURNING id");
  await q(`INSERT INTO sessions (id, user_id, expires_at) VALUES ('expiree', $1, now() - interval '1 day')`, [u.id]);
  await q(`INSERT INTO sessions (id, user_id, expires_at) VALUES ('valable', $1, now() + interval '1 day')`, [u.id]);
  await q(`INSERT INTO password_resets (id, user_id, expires_at) VALUES ('reset-expire', $1, now() - interval '1 hour')`, [u.id]);
  await cleanupExpired();
  assert.equal(await one('SELECT 1 FROM sessions WHERE id = $1', ['expiree']), null);
  assert.ok(await one('SELECT 1 FROM sessions WHERE id = $1', ['valable']));
  assert.equal(await one('SELECT 1 FROM password_resets WHERE id = $1', ['reset-expire']), null);
});
