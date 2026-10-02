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

// Récapitulatif Masse salariale et cotisations CNSS (voir lib/report.js)
export function payrollCsv(report, year) {
  const head = ['Salarié', 'Poste', 'N° CNSS', 'Bulletins', 'Salaire Brut', 'CNSS Salariale (4%)', 'Net Versé', 'CNSS Patronale (17.5%)', 'Coût Total Employeur'];
  const line = (e) => [
    e.name,
    e.job_title || '',
    e.cnss_number || '',
    e.count,
    amount(e.gross),
    amount(e.cnssEmployee),
    amount(e.net),
    amount(e.cnssEmployer),
    amount(e.employerCost),
  ];
  return toCsv([
    [`Récapitulatif Masse Salariale & Cotisations CNSS ${year}, montants en ${report.currency}`],
    head,
    ...report.employees.map(line),
    [
      'Total',
      '',
      '',
      report.total.count,
      amount(report.total.gross),
      amount(report.total.cnssEmployee),
      amount(report.total.net),
      amount(report.total.cnssEmployer),
      amount(report.total.employerCost),
    ],
  ]);
}

// Récapitulatif Dépenses et Achats
export function expensesCsv(report, year) {
  const head = ['Catégorie', 'Montant'];
  return toCsv([
    [`Récapitulatif Dépenses & Achats ${year}, montants en ${report.currency}`],
    head,
    ...report.categories.map((c) => [c.name, amount(c.amount)]),
    ['Total Général', amount(report.total.grandTotal)],
  ]);
}

