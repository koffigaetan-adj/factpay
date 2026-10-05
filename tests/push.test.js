// Notifications push : inscriptions enregistrées, envoi qui ne plante jamais l'appelant même si un
// appareil a disparu (404/410, retiré) ou est injoignable (autre erreur, juste journalisée).
// Base en mémoire. Lancer avec : npm test
process.env.PGLITE_DIR = 'memory://';
process.env.FACTPAY_QUIET = '1';
delete process.env.DATABASE_URL;
delete process.env.VAPID_PUBLIC_KEY;
delete process.env.VAPID_PRIVATE_KEY;

import { test, before } from 'node:test';
import assert from 'node:assert/strict';

let q, one, push;
before(async () => {
  ({ q, one } = await import('../lib/db.js'));
  push = await import('../lib/push.js');
});

// D'abord sans les clés VAPID (module tout juste chargé) : le comportement « pas configuré » n'est
// vrai qu'avant le premier envoi réussi, la fonction retenant ensuite qu'elle est prête.
test('sans les clés VAPID : ne tente aucun envoi, ne plante pas', async () => {
  const u = await one("INSERT INTO users (email, name, password_hash) VALUES ('novapid@x.tg', 'V', 'x') RETURNING id");
  await q(`INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1, 'https://push.example.invalid/bbb', 'k', 'a')`, [u.id]);
  await assert.doesNotReject(push.sendPush(u.id, { title: 'Test', body: 'x' }));
  // Personne n'a pu essayer de la retirer : elle est toujours là
  assert.equal((await one('SELECT count(*)::int AS n FROM push_subscriptions WHERE user_id = $1', [u.id])).n, 1);
});

test("envoi : ne plante jamais l'appelant, même vers un appareil injoignable ou disparu", async () => {
  // Fausses clés, jamais utilisées pour un vrai envoi (l'appareil de test n'existe pas)
  process.env.VAPID_PUBLIC_KEY = 'BJsRinBbKTZEjeE0OyjHqYnkJwCMAKlEhdYVwhiIORIgkFimRMuJlJG9Z5fnUVONp_NvWBJXElnbayWnRIl20j8';
  process.env.VAPID_PRIVATE_KEY = 'tR1ALg-PnaTBJF-4QPAHZr5-5rnGNm-TiVp6LOBuRL0';

  const u = await one("INSERT INTO users (email, name, password_hash) VALUES ('push@x.tg', 'P', 'x') RETURNING id");
  await q(`INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1, 'https://push.example.invalid/aaa', 'k', 'a')`, [u.id]);

  // L'adresse n'existe pas (DNS) : l'erreur est journalisée, pas de plantage, l'inscription reste
  await assert.doesNotReject(push.sendPush(u.id, { title: 'Test', body: 'Un message', url: '/factures/x' }));
  assert.equal((await one('SELECT count(*)::int AS n FROM push_subscriptions WHERE user_id = $1', [u.id])).n, 1);

  // Aucune inscription pour cet utilisateur : ne fait rien, ne plante pas
  const other = await one("INSERT INTO users (email, name, password_hash) VALUES ('nopush@x.tg', 'N', 'x') RETURNING id");
  await assert.doesNotReject(push.sendPush(other.id, { title: 'Test', body: 'x' }));
});
