import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { q, one } from './db.js';

const scrypt = promisify(crypto.scrypt);
const SESSION_DAYS = 30;
const COOKIE = 'session';

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function checkPassword(password, stored) {
  const [, salt, key] = String(stored).split('$');
  if (!salt || !key) return false;
  const derived = await scrypt(password, Buffer.from(salt, 'base64'), 64);
  return crypto.timingSafeEqual(derived, Buffer.from(key, 'base64'));
}

// Seul le hash du jeton est en base : une fuite de la base ne donne pas accès aux sessions.
export async function startSession(userId) {
  const token = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86400 * 1000);
  await q('INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)', [sha256(token), userId, expires]);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', expires,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await q('DELETE FROM sessions WHERE id = $1', [sha256(token)]);
  jar.delete(COOKIE);
}

export async function currentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  return one(`SELECT u.id, u.email, u.name, u.first_name, u.email_verified_at, u.avatar_key, u.avatar_updated_at FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.id = $1 AND s.expires_at > now()`, [sha256(token)]);
}

// Utilisateur connecté dont l'adresse e-mail est confirmée
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect('/connexion');
  if (!user.email_verified_at) redirect('/confirmer-email');
  return user;
}

// Utilisateur connecté + son entreprise. Sans entreprise, direction la page d'accueil du compte.
export async function requireCompany() {
  const user = await requireUser();
  const company = await one('SELECT * FROM companies WHERE owner_id = $1', [user.id]);
  if (!company) redirect('/bienvenue');
  return { user, company };
}

// 5 échecs en 15 minutes pour une adresse e-mail : on bloque
export async function tooManyFailures(email) {
  const row = await one(`SELECT count(*)::int AS n FROM login_failures WHERE email = $1 AND at > now() - interval '15 minutes'`, [email]);
  return row.n >= 5;
}
export const recordFailure = (email) => q('INSERT INTO login_failures (email) VALUES ($1)', [email]);
export const clearFailures = (email) => q('DELETE FROM login_failures WHERE email = $1', [email]);

export async function createPasswordReset(userId) {
  const token = randomToken();
  await q(`INSERT INTO password_resets (id, user_id, expires_at) VALUES ($1, $2, now() + interval '1 hour')`, [sha256(token), userId]);
  return token;
}

export const findPasswordReset = (token) =>
  one('SELECT * FROM password_resets WHERE id = $1 AND NOT used AND expires_at > now()', [sha256(String(token))]);

export const markResetUsed = (token) => q('UPDATE password_resets SET used = true WHERE id = $1', [sha256(String(token))]);

// Confirmation de l'adresse e-mail : lien valable 24 heures
// newEmail : pour un changement d'adresse, la nouvelle adresse à confirmer
export async function createEmailVerification(userId, newEmail = null) {
  const token = randomToken();
  await q(`INSERT INTO email_verifications (id, user_id, expires_at, new_email) VALUES ($1, $2, now() + interval '24 hours', $3)`,
    [sha256(token), userId, newEmail]);
  return token;
}

// Un lien envoyé il y a moins d'une minute : on n'en renvoie pas un autre
export const verificationSentRecently = async (userId) => !!(await one(
  `SELECT 1 FROM email_verifications WHERE user_id = $1 AND created_at > now() - interval '1 minute'`, [userId]));

// Confirme l'adresse si le lien est valable (inscription, ou nouvelle adresse). Renvoie true si c'est le cas.
export async function confirmEmail(token) {
  const row = await one('SELECT user_id, new_email FROM email_verifications WHERE id = $1 AND expires_at > now()', [sha256(String(token))]);
  if (!row) return false;
  if (row.new_email) {
    // Adresse prise entre-temps par un autre compte : le changement n'a pas lieu
    if (await one('SELECT 1 FROM users WHERE email = $1 AND id <> $2', [row.new_email, row.user_id])) return false;
    await q('UPDATE users SET email = $1, email_verified_at = now() WHERE id = $2', [row.new_email, row.user_id]);
  } else {
    await q('UPDATE users SET email_verified_at = coalesce(email_verified_at, now()) WHERE id = $1', [row.user_id]);
  }
  await q('DELETE FROM email_verifications WHERE user_id = $1', [row.user_id]);
  return true;
}

// Après un changement de mot de passe : toutes les sessions sont fermées
export const endAllSessions = (userId) => q('DELETE FROM sessions WHERE user_id = $1', [userId]);
