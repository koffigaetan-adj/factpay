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
  return one(`SELECT u.id, u.email, u.name FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.id = $1 AND s.expires_at > now()`, [sha256(token)]);
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect('/connexion');
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

// Après un changement de mot de passe : toutes les sessions sont fermées
export const endAllSessions = (userId) => q('DELETE FROM sessions WHERE user_id = $1', [userId]);
