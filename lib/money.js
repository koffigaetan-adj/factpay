// Devises proposées sur les factures
export const CURRENCIES = {
  XOF: 'Franc CFA UEMOA (F CFA)',
  XAF: 'Franc CFA CEMAC (FCFA)',
  EUR: 'Euro (€)',
  USD: 'Dollar américain ($ US)',
  GBP: 'Livre sterling (£)',
  CAD: 'Dollar canadien ($ CA)',
  CHF: 'Franc suisse (CHF)',
  GHS: 'Cedi ghanéen (GHS)',
  NGN: 'Naira nigérian (NGN)',
  MAD: 'Dirham marocain (MAD)',
};

// Nom court, pour le sélecteur de devise et les taux
export const SHORT = { XOF: 'F CFA', XAF: 'FCFA', EUR: '€', USD: '$ US', GBP: '£', CAD: '$ CA' };
export const short = (c) => SHORT[c] || c;

// Les francs CFA n'ont pas de centimes
const decimals = (c) => (c === 'XOF' || c === 'XAF' ? 0 : 2);

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const roundFor = (n, currency) => (decimals(currency) ? round2(n) : Math.round(n));

export function money(n, currency) {
  const d = decimals(currency);
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency, minimumFractionDigits: d, maximumFractionDigits: d,
  }).format(Number(n) || 0);
}

export const num = (n) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 6 }).format(Number(n) || 0);

// Parités fixes : les deux francs CFA valent 1 € = 655,957 F CFA.
// Pour les autres devises, le taux change chaque jour : il est saisi sur la facture.
const PER_EUR = { EUR: 1, XOF: 655.957, XAF: 655.957 };

export function fixedRate(from, to) {
  if (from === to) return 1;
  return PER_EUR[from] && PER_EUR[to] ? PER_EUR[to] / PER_EUR[from] : null;
}

// Équivalent proposé par défaut quand l'entreprise affiche l'autre devise
export const altOf = (currency) => ({ EUR: 'XOF', XOF: 'EUR', XAF: 'EUR' })[currency] || null;

// Montant converti avec le taux de la facture (1 devise = rate autre devise)
export const convert = (n, rate, to) => roundFor(Number(n) * Number(rate), to);

// Taux affiché arrondi, dans le sens qui donne un nombre supérieur à 1 :
// « 1 € ≈ 656 F CFA (parité fixe 655,957) », « 1 $ US ≈ 604 F CFA », « 1 £ ≈ 1,17 € ».
// Les calculs, eux, utilisent toujours le taux exact.
export function rateLabel(from, to, rate) {
  const [a, b, r] = rate >= 1 ? [from, to, rate] : [to, from, 1 / rate];
  const exact = Number(r.toPrecision(7));
  const shown = r >= 10 ? Math.round(r) : Math.round(r * 100) / 100;
  const label = `1 ${short(a)} ${shown === exact ? '=' : '≈'} ${num(shown)} ${short(b)}`;
  return fixedRate(from, to) && shown !== exact ? `${label} (parité fixe ${num(exact)})` : label;
}

// Équivalent d'un montant de la facture dans sa seconde devise, ou ''
export const altMoney = (n, inv) => (inv.alt_currency && inv.alt_rate
  ? money(convert(n, inv.alt_rate, inv.alt_currency), inv.alt_currency) : '');

// Équivalent pour l'entreprise (tableau de bord), à parité fixe uniquement
export function moneyAlt(n, currency) {
  const to = altOf(currency);
  return to ? money(convert(n, fixedRate(currency, to), to), to) : '';
}

// Les primes (kind « prime ») ne subissent pas la retenue
export const isPrime = (l) => l.kind === 'prime';

// Lignes → sous-total HT, TVA, total TTC, base de la retenue (hors primes), retenue et net à payer
export function totals(lines, vatRate, withholdingRate, currency) {
  const sum = (ls) => ls.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0);
  const subtotal = roundFor(sum(lines), currency);
  const vat = roundFor((subtotal * (Number(vatRate) || 0)) / 100, currency);
  const total = roundFor(subtotal + vat, currency);
  const base = roundFor(sum(lines.filter((l) => !isPrime(l))), currency);
  const withholding = roundFor((base * (Number(withholdingRate) || 0)) / 100, currency);
  return { subtotal, vat, total, base, withholding, due: roundFor(total - withholding, currency) };
}
