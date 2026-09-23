// Adresse publique du site, pour les liens envoyés par e-mail
export function appUrl() {
  const url = process.env.APP_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
    || 'http://localhost:3000';
  return url.replace(/\/$/, '');
}
