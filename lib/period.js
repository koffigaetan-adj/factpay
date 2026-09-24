import { holidayName } from './holidays.js';

// Période travaillée d'une facture. Enregistrée en JSON sur la facture :
// { mode: 'mois' | 'periode' | 'jours', month: 'AAAA-MM', from, to, dates: ['AAAA-MM-JJ', …],
//   hours_per_day: 8, exclude_weekends: true, exclude_holidays: true, country: 'FR' }

const parse = (d) => new Date(d + 'T12:00:00Z');
const iso = (d) => d.toISOString().slice(0, 10);

export const isWeekend = (d) => [0, 6].includes(parse(d).getUTCDay());

// Tous les jours entre deux dates incluses (366 au maximum)
export function daysBetween(from, to) {
  const out = [];
  if (!from || !to || from > to) return out;
  for (let d = parse(from); iso(d) <= to && out.length < 366; d.setUTCDate(d.getUTCDate() + 1)) out.push(iso(d));
  return out;
}

export function daysOfMonth(month) {
  if (!/^\d{4}-\d{2}$/.test(month || '')) return [];
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return daysBetween(`${month}-01`, `${month}-${String(last).padStart(2, '0')}`);
}

// Jour non travaillé d'après les options : 'week-end', le nom du jour férié, ou null
export function offReason(d, p) {
  if (p.exclude_weekends && isWeekend(d)) return 'week-end';
  if (p.exclude_holidays) return holidayName(d, p.country || 'FR') || null;
  return null;
}

// Jours travaillés de la période, triés, sans les jours exclus
export function workedDays(p) {
  if (!p) return [];
  const base = p.mode === 'mois' ? daysOfMonth(p.month) : p.mode === 'periode' ? daysBetween(p.from, p.to) : (p.dates || []);
  return [...new Set(base)].filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !offReason(d, p)).sort();
}

const hpd = (p) => Number(String(p?.hours_per_day ?? '').replace(',', '.')) || 0;

export const periodHours = (p) => workedDays(p).length * hpd(p);

const fmt = (d, opts) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', ...opts }).format(parse(d));
const dayLabel = (d) => (d.endsWith('-01') ? '1er' : String(Number(d.slice(8))));

// « septembre 2026 », « du 3 au 28 septembre 2026 », « du 28 septembre au 9 octobre 2026 »
export function describePeriod(p) {
  const days = workedDays(p);
  if (!days.length) return '';
  if (p.mode === 'mois') return fmt(`${p.month}-01`, { month: 'long', year: 'numeric' });
  const first = p.mode === 'periode' ? p.from : days[0];
  const last = p.mode === 'periode' ? p.to : days[days.length - 1];
  if (first === last) return `le ${dayLabel(first)} ${fmt(first, { month: 'long', year: 'numeric' })}`;
  const sameMonth = first.slice(0, 7) === last.slice(0, 7);
  const sameYear = first.slice(0, 4) === last.slice(0, 4);
  const start = sameMonth ? dayLabel(first) : `${dayLabel(first)} ${fmt(first, sameYear ? { month: 'long' } : { month: 'long', year: 'numeric' })}`;
  return `du ${start} au ${dayLabel(last)} ${fmt(last, { month: 'long', year: 'numeric' })}`;
}

// « 21 jours travaillés × 8 h »
export function periodSummary(p) {
  const n = workedDays(p).length;
  if (!n) return '';
  return `${n} jour${n > 1 ? 's' : ''} travaillé${n > 1 ? 's' : ''} × ${String(hpd(p)).replace('.', ',')} h`;
}

// Nettoie une période reçue du formulaire (ou null si vide)
export function cleanPeriod(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const p = {
    mode: ['mois', 'periode', 'jours'].includes(raw.mode) ? raw.mode : 'mois',
    month: String(raw.month || '').slice(0, 7),
    from: String(raw.from || '').slice(0, 10),
    to: String(raw.to || '').slice(0, 10),
    dates: Array.isArray(raw.dates) ? raw.dates.map(String).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(0, 366) : [],
    hours_per_day: Math.min(24, Math.max(0, Number(String(raw.hours_per_day).replace(',', '.')) || 0)),
    exclude_weekends: !!raw.exclude_weekends,
    exclude_holidays: !!raw.exclude_holidays,
    country: 'FR',
  };
  if (p.mode === 'jours') p.dates = workedDays(p);
  return workedDays(p).length ? p : null;
}
