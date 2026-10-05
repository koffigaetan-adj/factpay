import crypto from 'crypto';
import { promisify } from 'util';

const scrypt = typeof crypto !== 'undefined' && typeof crypto.scrypt === 'function' ? promisify(crypto.scrypt) : null;

// Règles du mot de passe, partagées par le formulaire (coches en direct) et le serveur
export const PASSWORD_RULES = [
  { label: '8 caractères minimum', test: (p) => p.length >= 8 },
  { label: 'Une lettre majuscule', test: (p) => /\p{Lu}/u.test(p) },
  { label: 'Une lettre minuscule', test: (p) => /\p{Ll}/u.test(p) },
  { label: 'Un chiffre', test: (p) => /\d/.test(p) },
  { label: 'Un caractère spécial (! ? @ # $ % …)', test: (p) => /[^\p{L}\d\s]/u.test(p) },
];

// Message d'erreur, ou null si le mot de passe est valable
export function passwordProblem(password, confirm) {
  const missing = PASSWORD_RULES.filter((r) => !r.test(password));
  if (missing.length) return `Mot de passe trop faible. Il manque : ${missing.map((r) => r.label.toLowerCase()).join(', ')}.`;
  if (password !== confirm) return 'Les deux mots de passe ne sont pas identiques.';
  return null;
}

export async function hashPassword(password) {
  const scryptFn = scrypt || (typeof crypto !== 'undefined' && typeof crypto.scrypt === 'function' ? promisify(crypto.scrypt) : null);
  if (!scryptFn) throw new Error('scrypt is not available in this environment');
  const salt = crypto.randomBytes(16);
  const key = await scryptFn(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function checkPassword(password, stored) {
  const scryptFn = scrypt || (typeof crypto !== 'undefined' && typeof crypto.scrypt === 'function' ? promisify(crypto.scrypt) : null);
  if (!scryptFn) return false;
  const [, salt, key] = String(stored).split('$');
  if (!salt || !key) return false;
  const derived = await scryptFn(password, Buffer.from(salt, 'base64'), 64);
  return crypto.timingSafeEqual(derived, Buffer.from(key, 'base64'));
}
