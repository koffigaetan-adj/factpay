import crypto from 'node:crypto';
import { appSecret } from './secret.js';

// Identifiants publics : les numéros internes (1, 2, 3…) n'apparaissent jamais dans les adresses.
// Chaque numéro est chiffré (petit réseau de Feistel sur 64 bits, clé tirée de AUTH_SECRET)
// en un code de 11 caractères d'aspect aléatoire, par exemple /factures/4kQ9zT2mXbA.
// Le calcul se refait dans l'autre sens à la lecture : pas de colonne ni de requête en plus.
// Un code inventé ou modifié ne correspond à aucun numéro valide et est refusé (0).
// Attention : changer AUTH_SECRET change toutes ces adresses (les liens clients /f/… ne bougent pas).

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const LENGTH = 11; // 62^11 > 2^64
const ROUNDS = 4;
const MASK = 0xFFFFFFFFn;

const keys = new Map();
function keyFor(kind) {
  if (!keys.has(kind)) {
    keys.set(kind, crypto.createHmac('sha256', appSecret()).update(`ids:${kind}`).digest());
  }
  return keys.get(kind);
}

function round(kind, r, half) {
  const h = crypto.createHmac('sha256', keyFor(kind)).update(`${r}:${half}`).digest();
  return BigInt(h.readUInt32BE(0));
}

function encode(n) {
  let s = '';
  for (let i = 0; i < LENGTH; i++) { s = ALPHABET[Number(n % 62n)] + s; n /= 62n; }
  return s;
}

function decode(code) {
  let n = 0n;
  for (const ch of code) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) return null;
    n = n * 62n + BigInt(v);
  }
  return n < 1n << 64n ? n : null;
}

// Numéro interne → code public. kind : 'facture', 'client', 'document' ou 'logo'
// (chaque sorte a sa propre clé : le code d'une facture n'ouvre pas un client).
export function pubId(kind, id) {
  let left = 0n;
  let right = BigInt(id) & MASK;
  for (let r = 0; r < ROUNDS; r++) [left, right] = [right, left ^ round(kind, r, right)];
  return encode((left << 32n) | right);
}

// Code public → numéro interne, ou 0 si le code n'est pas valide
export function idFrom(kind, code) {
  if (typeof code !== 'string' || code.length !== LENGTH) return 0;
  const n = decode(code);
  if (n === null) return 0;
  let left = n >> 32n;
  let right = n & MASK;
  for (let r = ROUNDS - 1; r >= 0; r--) [left, right] = [right ^ round(kind, r, left), left];
  // Le bloc chiffré contient un numéro sur 32 bits : la moitié haute doit être nulle
  return left === 0n && right > 0n && right <= 0x7FFFFFFFn ? Number(right) : 0;
}
