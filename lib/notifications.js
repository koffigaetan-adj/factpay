import { q, one } from './db.js';
import { sendPush } from './push.js';

// Prévient le propriétaire d'une entreprise d'un événement (paiement signalé, devis répondu,
// message reçu...) : la notification reste dans la petite cloche de la barre latérale, et part
// aussi en push sur les appareils où il les a activées (silencieusement, s'il n'en a activé aucun).
export async function notifyOwner(company, { title, body = '', url = '/' }) {
  await q('INSERT INTO notifications (user_id, title, body, url) VALUES ($1, $2, $3, $4)', [company.owner_id, title, body, url]);
  await sendPush(company.owner_id, { title, body, url }).catch((e) => console.error('Notification push échouée :', e.message));
}

// Les plus récentes en premier, pour remplir le panneau de la cloche
export const listNotifications = (userId, limit = 20) =>
  q('SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2', [userId, limit]);

export const unreadCount = async (userId) =>
  (await one('SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL', [userId])).n;

// Tout marquer lu d'un coup, à l'ouverture du panneau (pas de « lu » notification par notification :
// ce serait plus de complexité que d'utilité ici)
export const markAllRead = (userId) =>
  q('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL', [userId]);
