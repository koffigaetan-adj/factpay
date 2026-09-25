// Dates au format AAAA-MM-JJ, en temps universel (Lomé est à UTC+0 toute l'année)
export const today = () => new Date().toISOString().slice(0, 10);

export function addDays(isoDate, days) {
  const d = new Date(isoDate + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Date et heure d'un envoi programmé, dans le fuseau où elle a été choisie
// (« 25 septembre 2026 à 08:00, heure de Paris »). Une ancienne programmation n'a que la date.
export function frDateTime(value, tz) {
  if (!value) return '';
  if (typeof value === 'string' && value.length <= 10) return frDate(value);
  let zone = 'UTC';
  try { if (tz) { new Intl.DateTimeFormat('fr', { timeZone: tz }); zone = tz; } } catch { /* fuseau inconnu */ }
  const text = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: zone }).format(new Date(value));
  return `${text}, heure de ${zone === 'UTC' ? 'Lomé' : zone.split('/').pop().replace(/_/g, ' ')}`;
}

export function frDate(value) {
  if (!value) return '';
  const d = typeof value === 'string' && value.length <= 10 ? new Date(value + 'T12:00:00Z') : new Date(value);
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
}

// « à l'instant », « il y a 5 min », « il y a 3 h », puis la date à partir d'hier
export function timeAgo(value) {
  const d = new Date(value);
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(d);
}
