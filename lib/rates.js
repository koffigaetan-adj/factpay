import { fixedRate, CURRENCIES } from './money.js';

// Taux de change du jour. Google n'offre pas de service public pour ses taux : on utilise ExchangeRate-API
// (gratuit, mis à jour chaque jour, mêmes ordres de grandeur que le convertisseur de Google).
// Les parités fixes (€ / F CFA) ne sont jamais demandées en ligne.
const SOURCE = 'ExchangeRate-API';
const TTL = 6 * 3600 * 1000;
const cache = new Map();

async function ratesFrom(base) {
  const hit = cache.get(base);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  const res = await fetch(`https://open.er-api.com/v6/latest/${base}`, { next: { revalidate: 21600 } });
  if (!res.ok) throw new Error('Service de taux indisponible');
  const data = await res.json();
  if (data.result !== 'success') throw new Error('Service de taux indisponible');
  cache.set(base, { at: Date.now(), data });
  return data;
}

// { rate, date, source, fixed } : 1 « from » = rate « to »
export async function liveRate(from, to) {
  if (!CURRENCIES[from] || !CURRENCIES[to] || from === to) throw new Error('Devise inconnue');
  const fixed = fixedRate(from, to);
  if (fixed) return { rate: fixed, fixed: true, source: 'Parité fixe', date: null };
  // Taux croisé depuis une seule table en dollars (précise dans les deux sens, un seul appel mis en cache)
  const data = await ratesFrom('USD');
  const a = data.rates?.[from];
  const b = data.rates?.[to];
  if (!a || !b) throw new Error('Taux indisponible pour cette devise');
  return { rate: Number((b / a).toPrecision(8)), fixed: false, source: SOURCE, date: data.time_last_update_utc };
}
