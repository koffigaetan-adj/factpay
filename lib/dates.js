// Dates au format AAAA-MM-JJ, en temps universel (Lomé est à UTC+0 toute l'année)
export const today = () => new Date().toISOString().slice(0, 10);

export function addDays(isoDate, days) {
  const d = new Date(isoDate + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function frDate(value) {
  if (!value) return '';
  const d = typeof value === 'string' && value.length <= 10 ? new Date(value + 'T12:00:00Z') : new Date(value);
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
}
