import { q } from './db.js';

// Fait le ménage dans les données qui n'ont plus d'utilité une fois expirées : sessions, liens et
// codes périmés, essais de connexion anciens. Appelé une fois par jour par la tâche planifiée
// (voir app/api/cron/route.js) : ces tables ne grossissent pas indéfiniment.
export async function cleanupExpired() {
  await q('DELETE FROM sessions WHERE expires_at < now()');
  await q('DELETE FROM password_resets WHERE expires_at < now()');
  await q('DELETE FROM email_verifications WHERE expires_at < now()');
  await q('DELETE FROM login_challenges WHERE expires_at < now()');
  await q(`DELETE FROM login_failures WHERE at < now() - interval '1 day'`);
  await q(`DELETE FROM rate_limits WHERE at < now() - interval '1 day'`);
}
