import fs from 'node:fs';
import path from 'node:path';

// Applications d'authentification proposées. Le logo s'affiche dès que son fichier
// est déposé dans public/brands ; sinon une pastille aux couleurs de l'application.
export const AUTH_APPS = [
  { id: 'google', name: 'Google Authenticator', file: 'google-authenticator.png', color: '#1A73E8', ink: '#fff', short: 'G' },
  { id: 'microsoft', name: 'Microsoft Authenticator', file: 'microsoft-authenticator.png', color: '#0078D4', ink: '#fff', short: 'MS' },
  { id: 'authy', name: 'Authy', file: 'authy.png', color: '#EC1C24', ink: '#fff', short: 'Au' },
  { id: 'autre', name: 'Autre application', file: null, color: '#5B6472', ink: '#fff', short: '•••' },
];

const hasFile = (file) => file && fs.existsSync(path.join(process.cwd(), 'public', 'brands', file));

// Application enregistrée (colonne users.totp_app), « Autre application » par défaut
export function authApp(id) {
  const app = AUTH_APPS.find((a) => a.id === id) || AUTH_APPS.at(-1);
  return { ...app, logo: hasFile(app.file) ? `/brands/${app.file}` : null };
}
