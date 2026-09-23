import PDFDocument from 'pdfkit';
import * as m from './money.js';
import { frDate } from './dates.js';
import { appUrl } from './url.js';

// Les polices PDF standard n'ont pas l'espace fine insécable utilisée en français
const plain = (s) => String(s ?? '').replace(/[  ]/g, ' ');

export function invoicePdf(inv, company) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56, info: { Title: `Facture ${inv.number || ''}`, Author: company.name } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const cur = inv.currency;
    const money = (n) => plain(m.money(n, cur));
    const alt = (n) => (company.show_alt_currency ? plain(m.moneyAlt(n, cur)) : '');
    const ink = '#1C2536';
    const muted = '#5B6576';
    const rule = '#D5DAE1';
    const left = 56;
    const right = doc.page.width - 56;
    const width = right - left;
    const bottom = doc.page.height - 110;

    // En-tête
    doc.fillColor(ink).font('Helvetica-Bold').fontSize(22).text('Facture', left, 56);
    doc.font('Helvetica').fontSize(10).fillColor(muted)
      .text(inv.number ? `N° ${inv.number}` : 'Brouillon, sans numéro', left, 86)
      .text(`Émise le ${frDate(inv.issue_date) || '—'}`)
      .text(`À payer avant le ${frDate(inv.due_date) || '—'}`);

    const colW = right - 300;
    doc.fillColor(ink).font('Helvetica-Bold').fontSize(10).text(company.name, 300, 56, { width: colW, align: 'right' });
    doc.font('Helvetica').fillColor(muted);
    for (const v of [company.address, company.phone, company.email, company.legal_ids]) {
      if (v) doc.text(plain(v), { width: colW, align: 'right' });
    }

    let y = Math.max(doc.y, 150) + 24;
    doc.fillColor(muted).fontSize(9).text('Facturé à', left, y);
    doc.fillColor(ink).font('Helvetica-Bold').fontSize(11).text(inv.client_name, left, y + 14, { width: 280 });
    doc.font('Helvetica').fontSize(10);
    for (const v of [inv.client_address, inv.client_phone, inv.client_email]) if (v) doc.text(plain(v), { width: 280 });

    if (inv.title) doc.moveDown(1).font('Helvetica-Bold').text(plain(inv.title), left, doc.y, { width }).font('Helvetica');

    // Tableau des lignes
    const cols = { desc: left, qty: left + 250, price: left + 330, amount: left + 410 };
    const header = (at) => {
      doc.fillColor(muted).fontSize(9);
      doc.text('Description', cols.desc, at);
      doc.text('Quantité', cols.qty, at, { width: 70, align: 'right' });
      doc.text('Prix unitaire', cols.price, at, { width: 70, align: 'right' });
      doc.text('Montant', cols.amount, at, { width: right - cols.amount, align: 'right' });
      doc.moveTo(left, at + 16).lineTo(right, at + 16).strokeColor(rule).stroke();
      return at + 26;
    };
    y = header(doc.y + 24);

    for (const l of inv.lines) {
      const h = Math.max(doc.fontSize(10).heightOfString(plain(l.description), { width: 240 }), 12);
      if (y + h > bottom) { doc.addPage(); y = header(56); }
      doc.fillColor(ink).fontSize(10).text(plain(l.description), cols.desc, y, { width: 240 });
      doc.text(`${plain(m.num(l.quantity))}${l.unit ? ` ${plain(l.unit)}` : ''}`, cols.qty, y, { width: 70, align: 'right' });
      doc.text(money(l.unit_price), cols.price, y, { width: 70, align: 'right' });
      doc.text(money(l.amount), cols.amount, y, { width: right - cols.amount, align: 'right' });
      y += h + 12;
    }
    doc.moveTo(left, y).lineTo(right, y).strokeColor(rule).stroke();
    y += 12;
    if (y > bottom - 120) { doc.addPage(); y = 56; }

    // Totaux
    const labelX = cols.price - 100;
    const row = (label, value, bold = false) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 13 : 10).fillColor(ink)
        .text(label, labelX, y, { width: 170 })
        .text(value, cols.amount - 40, y, { width: right - cols.amount + 40, align: 'right' });
      y += bold ? 22 : 16;
    };
    if (inv.vat_rate > 0) {
      row('Total HT', money(inv.subtotal));
      row(`TVA ${plain(m.num(inv.vat_rate))} %`, money(inv.vat_amount));
      row('Total TTC à payer', money(inv.total), true);
    } else {
      row('Total à payer', money(inv.total), true);
    }
    if (alt(1)) {
      doc.font('Helvetica').fontSize(10).fillColor(muted)
        .text(`soit ${alt(inv.total)}`, labelX, y, { width: right - labelX, align: 'right' })
        .fontSize(8).text(`Parité fixe ${plain(m.rateLabel())}. Paiement accepté en euros ou en francs CFA.`, left, doc.y + 2, { width, align: 'right' });
      y = doc.y;
    }

    // Paiement
    y += 28;
    doc.font('Helvetica').fontSize(10).fillColor(ink).text('Modes de paiement', left, y).fillColor(muted);
    if (company.iban) {
      doc.text(`Virement bancaire${company.bank_name ? ` (${plain(company.bank_name)})` : ''} : ${plain(company.iban)}${company.bic ? `, BIC/SWIFT ${plain(company.bic)}` : ''}`, { width });
    }
    if (company.mobile_money) doc.text(`Mobile Money : ${plain(company.mobile_money)}`, { width });
    if (inv.number) doc.text(`Référence à indiquer : ${inv.number}`);

    if (inv.notes) doc.moveDown(1).fillColor(ink).text(plain(inv.notes), { width });

    if (inv.number) {
      const link = `${appUrl()}/f/${inv.token}`;
      doc.moveDown(1).fillColor(ink)
        .text('Après le paiement, signalez-le ici avec la référence et le justificatif :', { width })
        .fillColor('#24457A').text(link, { link, underline: true, width });
    }

    if (company.footer_note) {
      doc.fontSize(8).fillColor(muted).text(plain(company.footer_note), left, doc.page.height - 80, { width, align: 'center' });
    }
    doc.end();
  });
}
