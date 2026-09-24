// Petits textes communs à la page client, au PDF et aux e-mails
import { money, num } from './money.js';
import { describePeriod, periodSummary } from './period.js';

// Sous-titre d'une ligne : la période travaillée, ou la mention « prime »
export function lineNote(line, inv) {
  if (line.kind === 'period' && inv.period) {
    const when = describePeriod(inv.period);
    return `${when.charAt(0).toUpperCase()}${when.slice(1)} · ${periodSummary(inv.period)}`;
  }
  if (line.kind === 'prime') return 'Prime, non soumise à la retenue';
  return '';
}

// « Retenue à la source (5 % de 1 500 000 F CFA) »
export function withholdingLabel(inv) {
  const base = inv.withholding_base ?? inv.subtotal;
  return `${inv.withholding_label || 'Retenue'} (${num(inv.withholding_rate)} % de ${money(base, inv.currency)})`;
}
