import { roundFor, fixedRate } from './money.js';

// Récapitulatif d'une année, dans la devise de l'entreprise :
// factures émises dans l'année (hors annulées), par client et par mois, avec TVA, retenues et encaissé.
export function yearReport(company, invoices, year) {
  const cur = company.currency;
  // Taux vers la devise de l'entreprise : identique, parité fixe, ou taux saisi sur la facture
  const rateOf = (i) => (i.currency === cur ? 1 : fixedRate(i.currency, cur) ?? (i.alt_currency === cur ? i.alt_rate : null));
  const y = String(year);
  const issued = invoices.filter((i) => i.number && i.issue_date?.startsWith(y) && i.status !== 'annulee');
  const counted = issued.filter((i) => rateOf(i));
  const skipped = issued.length - counted.length;

  const empty = () => ({ count: 0, subtotal: 0, vat: 0, total: 0, withholding: 0, due: 0, cashed: 0 });
  const add = (acc, i) => {
    const r = rateOf(i);
    acc.count += 1;
    acc.subtotal += i.subtotal * r;
    acc.vat += i.vat_amount * r;
    acc.total += i.total * r;
    acc.withholding += i.withholding_amount * r;
    acc.due += i.amount_due * r;
    if (i.status === 'payee') acc.cashed += i.amount_due * r;
    return acc;
  };
  const round = (acc) => Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, k === 'count' ? v : roundFor(v, cur)]));

  const byClient = new Map();
  for (const i of counted) byClient.set(i.client_name, add(byClient.get(i.client_name) || empty(), i));
  const months = Array.from({ length: 12 }, () => empty());
  for (const i of counted) add(months[Number(i.issue_date.slice(5, 7)) - 1], i);

  return {
    currency: cur,
    total: round(counted.reduce(add, empty())),
    clients: [...byClient.entries()].map(([name, acc]) => ({ name, ...round(acc) })).sort((a, b) => b.subtotal - a.subtotal),
    months: months.map(round),
    skipped,
  };
}

// Années proposées : de la première facture émise à l'année en cours (la plus récente d'abord)
export function yearsOf(invoices) {
  const now = new Date().getUTCFullYear();
  const first = Math.min(now, ...invoices.filter((i) => i.issue_date).map((i) => Number(i.issue_date.slice(0, 4))));
  return Array.from({ length: now - first + 1 }, (_, k) => now - k);
}
