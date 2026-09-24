import crypto from 'node:crypto';

// Signature des messages affichés après une action (?ok=…, ?erreur=…) : sans elle, n'importe qui
// pourrait fabriquer un lien vers notre propre site affichant le message de son choix (par exemple
// un faux avertissement de compte suspendu) pour une arnaque crédible. Seuls nos redirections,
// signées avec ce secret, sont affichées ; un message ajouté ou changé dans l'adresse est ignoré.
function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') throw new Error('AUTH_SECRET manque dans les variables d\'environnement.');
  return crypto.createHash('sha256').update(`flash:${secret || 'factpay-dev-uniquement'}`).digest();
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
