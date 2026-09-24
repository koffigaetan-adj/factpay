import crypto from 'node:crypto';
import { appSecret } from './secret.js';

// Signature des messages affichés après une action (?ok=…, ?erreur=…) : sans elle, n'importe qui
// pourrait fabriquer un lien vers notre propre site affichant le message de son choix (par exemple
// un faux avertissement de compte suspendu) pour une arnaque crédible. Seuls nos redirections,
// signées avec ce secret, sont affichées ; un message ajouté ou changé dans l'adresse est ignoré.
function key() {
  return crypto.createHash('sha256').update(`flash:${appSecret()}`).digest();
}

export function signFlash(kind, message) {
  return crypto.createHmac('sha256', key()).update(`${kind}:${message}`).digest('base64url').slice(0, 22);
}

export function verifyFlash(kind, message, sig) {
  if (typeof sig !== 'string' || !sig) return false;
  const expected = signFlash(kind, message);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
