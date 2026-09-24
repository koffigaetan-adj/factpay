// Jours fériés, pour exclure automatiquement les jours non travaillés.
// Pour l'instant : France métropolitaine. D'autres pays pourront s'ajouter dans COUNTRIES.

const iso = (d) => d.toISOString().slice(0, 10);
const utc = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
const plusDays = (d, n) => new Date(d.getTime() + n * 86400000);

// Dimanche de Pâques (calendrier grégorien, algorithme de Meeus)
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(y, month, day);
}

function france(y) {
  const e = easter(y);
  return [
    [utc(y, 1, 1), "Jour de l'an"],
    [plusDays(e, 1), 'Lundi de Pâques'],
    [utc(y, 5, 1), 'Fête du Travail'],
    [utc(y, 5, 8), 'Victoire 1945'],
    [plusDays(e, 39), 'Ascension'],
    [plusDays(e, 50), 'Lundi de Pentecôte'],
    [utc(y, 7, 14), 'Fête nationale'],
    [utc(y, 8, 15), 'Assomption'],
    [utc(y, 11, 1), 'Toussaint'],
    [utc(y, 11, 11), 'Armistice 1918'],
    [utc(y, 12, 25), 'Noël'],
  ];
}

export const COUNTRIES = { FR: { label: 'France', rule: france } };

const cache = new Map();

// { 'AAAA-MM-JJ': 'Nom du jour férié' } pour une année
export function holidaysOf(year, country = 'FR') {
  const key = `${country}-${year}`;
  if (!cache.has(key)) cache.set(key, Object.fromEntries(COUNTRIES[country].rule(year).map(([d, name]) => [iso(d), name])));
  return cache.get(key);
}

// Nom du jour férié, ou undefined
export const holidayName = (isoDate, country = 'FR') => holidaysOf(Number(isoDate.slice(0, 4)), country)[isoDate];
