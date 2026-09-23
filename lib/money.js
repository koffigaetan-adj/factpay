// L'euro et le franc CFA (XOF) ont une parité fixe : 1 € = 655,957 F CFA.
export const XOF_PER_EUR = 655.957;
export const CURRENCIES = { XOF: 'Franc CFA (F CFA)', EUR: 'Euro (€)' };

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Le franc CFA n'a pas de centimes
export const roundFor = (n, currency) => (currency === 'XOF' ? Math.round(n) : round2(n));

export function money(n, currency) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'XOF' ? 0 : 2,
  }).format(Number(n) || 0);
}

// L'autre devise de la paire €/F CFA, ou null
export const altOf = (currency) => ({ EUR: 'XOF', XOF: 'EUR' })[currency] || null;

export function convert(n, from, to) {
  if (from === to) return n;
  if (from === 'EUR' && to === 'XOF') return Math.round(n * XOF_PER_EUR);
  if (from === 'XOF' && to === 'EUR') return round2(n / XOF_PER_EUR);
  return null;
}

// « 1 311 914 F CFA » pour 2 000 €, ou '' si pas d'équivalent
export function moneyAlt(n, currency) {
  const to = altOf(currency);
  return to ? money(convert(n, currency, to), to) : '';
}

export const rateLabel = () => '1 € = 655,957 F CFA';

export const num = (n) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(Number(n) || 0);

// Lignes de facture → sous-total, TVA, total
export function totals(lines, vatRate, currency) {
  const subtotal = roundFor(lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0), currency);
  const vat = roundFor((subtotal * (Number(vatRate) || 0)) / 100, currency);
  return { subtotal, vat, total: roundFor(subtotal + vat, currency) };
}
