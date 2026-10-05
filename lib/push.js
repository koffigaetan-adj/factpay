import { q } from './db.js';

// Notifications push : arrivent sur le téléphone ou l'ordinateur même app fermée, comme une appli
// installée. Chaque appareil qui active les notifications a sa propre inscription (endpoint).
let configured = false;
let webpushLib = null;

async function configure() {
  if (configured && webpushLib) return true;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  try {
    const mod = await import('web-push');
    webpushLib = mod.default || mod;
    webpushLib.setVapidDetails('mailto:contact@factpay.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    configured = true;
    return true;
  } catch (err) {
    console.error('Impossible de charger web-push :', err.message);
    return false;
  }
}

// Envoie une notification à tous les appareils d'un utilisateur. Un appareil qui a désactivé les
// notifications ou désinstallé l'appli répond 404/410 : son inscription est retirée au passage.
export async function sendPush(userId, { title, body, url = '/' }) {
  if (!(await configure()) || !webpushLib) return;
  const subs = await q('SELECT * FROM push_subscriptions WHERE user_id = $1', [userId]);
  if (!subs.length) return;
  const payload = JSON.stringify({ title, body, url });
  await Promise.all(subs.map(async (s) => {
    try {
      await webpushLib.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await q('DELETE FROM push_subscriptions WHERE id = $1', [s.id]);
      } else {
        console.error('Notification push non envoyée :', err.message);
      }
    }
  }));
}

// Notifie le propriétaire d'une entreprise (celui qui reçoit les factures, devis...)
export const sendPushToOwner = (company, notif) => sendPush(company.owner_id, notif);
