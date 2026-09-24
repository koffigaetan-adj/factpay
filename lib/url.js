import { pubId } from './ids.js';
// Adresse publique du site, pour les liens envoyés par e-mail
export function appUrl() {
  const url = process.env.APP_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
    || 'http://localhost:3000';
  return url.replace(/\/$/, '');
}

// Adresse du logo de l'entreprise (null sans logo). Le paramètre v change à chaque nouveau logo.
export function logoUrl(company, { absolute = false } = {}) {
  if (!company?.logo_key) return null;
  const v = company.logo_updated_at ? new Date(company.logo_updated_at).getTime() : 0;
  return `${absolute ? appUrl() : ''}/logo/${pubId('logo', company.id)}?v=${v}`;
}
