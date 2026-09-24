import { statusOf } from './status.js';

// Fichiers CSV au format Excel français : séparateur « ; », virgule décimale, UTF-8 avec BOM pour les accents
const cell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const amount = (n) => (n === null || n === undefined ? '' : String(Math.round(Number(n) * 100) / 100).replace('.', ','));
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export const toCsv = (rows) => '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n');

export function csvResponse(csv, filename) {
  return new Response(csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"` },
  });
}

// Toutes les factures émises dans l'année
export function invoicesCsv(invoices, year) {
  const rows = invoices.filter((i) => i.number && i.issue_date?.startsWith(String(year))).reverse();
  return toCsv([
    ['Numéro', "Date d'émission", 'Échéance', 'Client', 'Objet', 'Devise', 'Total HT', 'TVA', 'Total TTC',
      'Retenue', 'Net à payer', 'Statut', 'Payée le', 'Moyen de paiement', 'Référence', 'Avoir', 'Annulée le'],
    ...rows.map((i) => [
      i.number, i.issue_date, i.due_date, i.client_name, i.title, i.currency, amount(i.subtotal), amount(i.vat_amount), amount(i.total),
      amount(i.withholding_amount), amount(i.amount_due), statusOf(i).label, day(i.confirmed_at), i.payment_method, i.payment_ref,
      i.credit_number || '', day(i.cancelled_at),
    ]),
  ]);
}

// Récapitulatif par client (voir lib/report.js)
export function reportCsv(report, year) {
  const head = ['Client', 'Factures', 'Total HT', 'TVA', 'Total TTC', 'Retenues à la source', 'Net à payer', 'Encaissé'];
  const line = (name, r) => [name, r.count, amount(r.subtotal), amount(r.vat), amount(r.total), amount(r.withholding), amount(r.due), amount(r.cashed)];
  return toCsv([
    [`Récapitulatif ${year}, montants en ${report.currency}`],
    head,
    ...report.clients.map((c) => line(c.name, c)),
    line('Total', report.total),
  ]);
}
