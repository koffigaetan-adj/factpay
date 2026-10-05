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
  // Journal des ouvertures du portail salarié : on garde 180 jours, le temps de remonter une
  // contestation sur une consultation de bulletin de paie.
  await q(`DELETE FROM portal_access_log WHERE seen_at < now() - interval '180 days'`);
}
