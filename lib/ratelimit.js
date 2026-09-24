import { q, one } from './db.js';

// Limite le nombre de coups (connexions, demandes d'e-mail…) par panier (bucket) et par clé
// (adresse e-mail, adresse IP, identifiant de compte…). Enregistre toujours le coup, puis dit
// s'il dépasse la limite : ainsi un compteur qui recommencerait à zéro ne redonne pas de solde.
export async function hitLimit(bucket, key, max, minutes) {
  await q('INSERT INTO rate_limits (bucket, key) VALUES ($1, $2)', [bucket, key]);
  const row = await one(
    `SELECT count(*)::int AS n FROM rate_limits WHERE bucket = $1 AND key = $2 AND at > now() - ($3 || ' minutes')::interval`,
    [bucket, key, minutes]);
  return row.n > max;
}

// Adresse de l'appareil qui fait la requête (Vercel pose x-forwarded-for). Sert à limiter les
// abus par appareil en plus des limites par adresse e-mail ou par compte.
// L'import de next/headers est différé : ce fichier reste utilisable tel quel dans les tests
// (exécutés en dehors du serveur Next), qui n'ont simplement pas d'adresse à lire.
export async function clientIp() {
  try {
    const { headers } = await import('next/headers');
    const h = await headers();
    const fwd = h.get('x-forwarded-for');
    if (fwd) return fwd.split(',')[0].trim();
    return h.get('x-real-ip') || 'inconnue';
  } catch {
    return 'inconnue';
  }
}
