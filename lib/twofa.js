import crypto from 'node:crypto';
import { q, one } from './db.js';
import { verifyCode, currentStep } from './totp.js';

// Double authentification : code par e-mail ou application d'authentification (TOTP), plus codes de secours.
// Après le mot de passe, une « vérification en attente » (login_challenges) attend le second code
// avant d'ouvrir la session.

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// ---------- Secret de l'application, chiffré en base (AES-256-GCM) ----------
// La clé vient de AUTH_SECRET : une fuite de la base seule ne donne pas les secrets.
function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') throw new Error('AUTH_SECRET manque dans les variables d\'environnement.');
  return crypto.createHash('sha256').update(secret || 'factpay-dev-uniquement').digest();
}

export function encrypt(text) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
}

export function decrypt(payload) {
  const [iv, tag, data] = String(payload).split('.').map((s) => Buffer.from(s, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString('utf8');
}

// ---------- Codes de secours : 8 codes à usage unique, gardés hachés ----------
export function newBackupCodes() {
  const codes = Array.from({ length: 8 }, () => {
    const raw = crypto.randomBytes(5).toString('hex').toUpperCase(); // 10 caractères
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
  return { codes, hashes: codes.map((c) => sha256(c.replace('-', ''))) };
}

async function useBackupCode(user, code) {
  const clean = String(code || '').toUpperCase().replace(/[^0-9A-F]/g, '');
  if (clean.length !== 10) return false;
  const hashes = JSON.parse(user.backup_codes || '[]');
  const h = sha256(clean);
  if (!hashes.includes(h)) return false;
  await q('UPDATE users SET backup_codes = $1 WHERE id = $2', [JSON.stringify(hashes.filter((x) => x !== h)), user.id]);
  return true;
}

// ---------- Vérification d'un code (application ou secours) ----------

// Code de l'application : refuse un code déjà utilisé (même pas de 30 s ou antérieur)
export async function checkTotp(user, code) {
  if (!user.totp_secret) return false;
  const step = verifyCode(decrypt(user.totp_secret), code);
  if (step === null || step <= (user.totp_last_step || 0)) return false;
  await q('UPDATE users SET totp_last_step = $1 WHERE id = $2', [step, user.id]);
  return true;
}

// ---------- Vérification en attente, à la connexion ----------

const MAX_ATTEMPTS = 5;

// Crée la vérification (et le code e-mail si besoin). Renvoie { token, emailCode }.
export async function createChallenge(user) {
  const token = crypto.randomBytes(32).toString('base64url');
  const emailCode = user.twofa_method === 'email' ? String(crypto.randomInt(0, 1e6)).padStart(6, '0') : null;
  await q('DELETE FROM login_challenges WHERE user_id = $1', [user.id]);
  await q(`INSERT INTO login_challenges (id, user_id, code_hash, expires_at) VALUES ($1, $2, $3, now() + interval '10 minutes')`,
    [sha256(token), user.id, emailCode ? sha256(emailCode) : null]);
  return { token, emailCode };
}

export const findChallenge = (token) => one(`SELECT c.*, u.email, u.name, u.first_name, u.twofa_method, u.totp_secret, u.totp_last_step, u.backup_codes
  FROM login_challenges c JOIN users u ON u.id = c.user_id
  WHERE c.id = $1 AND c.expires_at > now() AND c.attempts < ${MAX_ATTEMPTS}`, [sha256(String(token || ''))]);

// Nouveau code e-mail pour la même vérification (pas plus d'un toutes les 30 secondes)
export async function renewEmailCode(token) {
  const code = String(crypto.randomInt(0, 1e6)).padStart(6, '0');
  const row = await one(`UPDATE login_challenges SET code_hash = $2, created_at = now(), expires_at = now() + interval '10 minutes'
    WHERE id = $1 AND created_at < now() - interval '30 seconds' AND attempts < ${MAX_ATTEMPTS} AND code_hash IS NOT NULL RETURNING user_id`,
  [sha256(String(token || '')), sha256(code)]);
  return row ? code : null;
}

// Vérifie le second code. Renvoie { ok, userId, usedBackup } ou { ok: false, left }.
export async function verifyChallenge(token, code) {
  const ch = await findChallenge(token);
  if (!ch) return { ok: false, expired: true };
  const clean = String(code || '').trim();
  let ok = false;
  let usedBackup = false;
  if (ch.twofa_method === 'email' && ch.code_hash && /^\d{6}$/.test(clean.replace(/\s/g, ''))) {
    ok = crypto.timingSafeEqual(Buffer.from(sha256(clean.replace(/\s/g, ''))), Buffer.from(ch.code_hash));
  } else if (ch.twofa_method === 'totp' && /^\d{3}\s?\d{3}$/.test(clean)) {
    ok = await checkTotp({ id: ch.user_id, totp_secret: ch.totp_secret, totp_last_step: ch.totp_last_step }, clean);
  }
  if (!ok) {
    usedBackup = await useBackupCode({ id: ch.user_id, backup_codes: ch.backup_codes }, clean);
    ok = usedBackup;
  }
  if (!ok) {
    const row = await one('UPDATE login_challenges SET attempts = attempts + 1 WHERE id = $1 RETURNING attempts', [ch.id]);
    return { ok: false, left: Math.max(0, MAX_ATTEMPTS - row.attempts) };
  }
  await q('DELETE FROM login_challenges WHERE user_id = $1', [ch.user_id]);
  return { ok: true, userId: ch.user_id, usedBackup };
}

export { currentStep };
