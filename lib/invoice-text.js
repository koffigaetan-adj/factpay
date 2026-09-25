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

// L'entreprise telle qu'elle était à l'émission (identité figée) ; les moyens de paiement et le logo restent à jour
export function issuedCompany(inv, company) {
  if (!inv?.company_snapshot) return company;
  try {
    const snap = JSON.parse(inv.company_snapshot);
    return {
      ...company,
      ...snap,
      iban: company?.iban,
      bic: company?.bic,
      bank_name: company?.bank_name,
      account_holder: company?.account_holder,
      mobile_accounts: company?.mobile_accounts,
      mobile_money: company?.mobile_money,
      spi_alias: company?.spi_alias,
      payment_notes: company?.payment_notes,
      logo_key: company?.logo_key,
      country: company?.country,
    };
  } catch {
    return company;
  }
}

// « Facture » ou « Devis »
export const docLabel = (inv) => (inv?.doc_type === 'devis' ? 'Devis' : 'Facture');
