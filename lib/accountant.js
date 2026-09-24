import crypto from 'node:crypto';
import { q, one } from './db.js';
import { encrypt, decrypt } from './twofa.js';

// Accès comptable : un lien secret, en lecture seule, que l'entreprise donne à son comptable.
// Le jeton est gardé haché (pour retrouver l'entreprise) et chiffré (pour réafficher le lien).
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

export async function createAccountantLink(companyId) {
  const token = crypto.randomBytes(24).toString('base64url');
  await q('UPDATE companies SET accountant_token_hash = $1, accountant_token_enc = $2, accountant_since = now() WHERE id = $3',
    [sha256(token), encrypt(token), companyId]);
  return token;
}

export const revokeAccountantLink = (companyId) =>
  q('UPDATE companies SET accountant_token_hash = NULL, accountant_token_enc = NULL, accountant_since = NULL WHERE id = $1', [companyId]);

// Jeton en clair pour l'afficher dans les paramètres (ou null)
export function accountantToken(company) {
  try { return company.accountant_token_enc ? decrypt(company.accountant_token_enc) : null; } catch { return null; }
}

export const companyByAccountantToken = (token) =>
  (token ? one('SELECT * FROM companies WHERE accountant_token_hash = $1', [sha256(String(token))]) : null);
