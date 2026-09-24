// Secret de l'application : AUTH_SECRET s'il est défini. Sinon, en ligne, on se replie sur
// DATABASE_URL (secrète elle aussi, jamais envoyée au navigateur) plutôt que de faire planter
// toutes les pages ; un avertissement part dans les journaux pour penser à définir AUTH_SECRET.
// En local et dans les tests, une valeur fixe de développement.
let warned = false;

export function appSecret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
    if (!warned) { console.warn('AUTH_SECRET manque : clé tirée de DATABASE_URL. Définis AUTH_SECRET sur Vercel.'); warned = true; }
    return `db:${process.env.DATABASE_URL}`;
  }
  if (process.env.NODE_ENV === 'production') throw new Error('AUTH_SECRET manque dans les variables d\'environnement.');
  return 'factpay-dev-uniquement';
}
