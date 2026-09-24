import PDFDocument from 'pdfkit';
import * as m from './money.js';
import { frDate } from './dates.js';
import { appUrl } from './url.js';
import { lineNote, withholdingLabel, issuedCompany } from './invoice-text.js';
import { readFile } from './storage.js';
import { paymentLines } from './payment.js';
import { FACTPAY_LOGO_PNG, FACTPAY_LOGO_RATIO } from './brand-logo.js';

// Les polices PDF standard n'ont pas l'espace fine insécable utilisée en français
const plain = (s) => String(s ?? '').replace(/[  ]/g, ' ');

// Avoir : le même document, en négatif, qui annule une facture en comptabilité
export const creditNotePdf = (inv, company) => invoicePdf(inv, company, { credit: true });

// Facture, devis ou avoir, selon le document et l'option credit
export async function invoicePdf(inv, company, { credit = false } = {}) {
  // Identité de l'entreprise figée à l'émission
  company = issuedCompany(inv, company);
  // Logo de l'entreprise : s'il est illisible, le document part sans
  const logo = company.logo_key ? await readFile(company.logo_key).catch(() => null) : null;
  const mode = credit ? 'avoir' : inv.doc_type === 'devis' ? 'devis' : 'facture';
  const title = { facture: 'Facture', devis: 'Devis', avoir: 'Avoir' }[mode];
  const number = credit ? inv.credit_number : inv.number;
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56, info: { Title: `${title} ${number || ''}`, Author: company.name } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const cur = inv.currency;
    // Sur un avoir, tous les montants sont négatifs
    const sign = credit ? -1 : 1;
    const money = (n) => plain(m.money(sign * n, cur));
    const alt = (n) => plain(m.altMoney(sign * n, inv));
    const ink = '#1C2536';
    const muted = '#5B6576';
    const rule = '#D5DAE1';
    const left = 56;
    const right = doc.page.width - 56;
    const width = right - left;
    const bottom = doc.page.height - 110;

    // En-tête : le logo (48 pt de haut au plus) pousse le titre vers le bas
    let top = 56;
    if (logo) {
      try {
        doc.image(logo, left, 56, { fit: [160, 48], align: 'left', valign: 'top' });
        top = 56 + 64;
      } catch { /* image illisible : pas de logo */ }
    }
    doc.fillColor(ink).font('Helvetica-Bold').fontSize(22).text(title, left, top);
    const meta = {
      facture: [`Émise le ${frDate(inv.issue_date) || '—'}`, `À payer avant le ${frDate(inv.due_date) || '—'}`],
      devis: [`Émis le ${frDate(inv.issue_date) || '—'}`, `Valable jusqu'au ${frDate(inv.due_date) || '—'}`],
      avoir: [`Émis le ${frDate(inv.credit_date) || '—'}`, `Annule la facture ${inv.number} du ${frDate(inv.issue_date)}`],
    }[mode];
    doc.font('Helvetica').fontSize(10).fillColor(muted)
      .text(number ? `N° ${number}` : 'Brouillon, sans numéro', left, top + 30);
    for (const line of meta) doc.text(plain(line));

    // Tampon : facture PAYÉE / ANNULÉE, devis ACCEPTÉ / REFUSÉ, avec la date
    const stamps = {
      facture: { payee: ['PAYÉE', inv.confirmed_at, true], annulee: ['ANNULÉE', inv.cancelled_at, false] },
      devis: { acceptee: ['ACCEPTÉ', inv.accepted_at, true], convertie: ['ACCEPTÉ', inv.accepted_at, true], refusee: ['REFUSÉ', inv.refused_at, false] },
      avoir: {},
    }[mode][inv.status];
    const stamp = stamps && { word: stamps[0], at: stamps[1], ok: stamps[2], color: stamps[2] ? '#1D7350' : '#A63A2E' };
    if (stamp) {
      const label = `${stamp.word}${stamp.at ? ` LE ${plain(frDate(stamp.at)).toUpperCase()}` : ''}`;
      doc.font('Helvetica-Bold').fontSize(10);
      const w = doc.widthOfString(label) + 36;
      const sy = top + 76;
      doc.save().roundedRect(left, sy, w, 24, 12).fill(stamp.color).restore();
      doc.circle(left + 13, sy + 12, 5).fill('#FFFFFF');
      if (stamp.ok) {
        doc.moveTo(left + 10.5, sy + 12).lineTo(left + 12.5, sy + 14).lineTo(left + 15.8, sy + 9.8).lineWidth(1.4).strokeColor(stamp.color).stroke();
      } else {
        doc.moveTo(left + 10.8, sy + 9.8).lineTo(left + 15.2, sy + 14.2).moveTo(left + 15.2, sy + 9.8).lineTo(left + 10.8, sy + 14.2).lineWidth(1.4).strokeColor(stamp.color).stroke();
      }
      doc.fillColor('#FFFFFF').text(label, left + 24, sy + 7, { lineBreak: false });
      doc.font('Helvetica').lineWidth(1);
    }

    const colW = right - 300;
    doc.fillColor(ink).font('Helvetica-Bold').fontSize(10).text(company.name, 300, 56, { width: colW, align: 'right' });
    doc.font('Helvetica').fillColor(muted);
    for (const v of [company.address, company.phone, company.email, company.legal_ids]) {
      if (v) doc.text(plain(v), { width: colW, align: 'right' });
    }

    let y = Math.max(doc.y, top + (stamp ? 104 : 94)) + 24;
    doc.fillColor(muted).fontSize(9).text(mode === 'devis' ? 'Destinataire' : 'Facturé à', left, y);
    doc.fillColor(ink).font('Helvetica-Bold').fontSize(11).text(inv.client_name, left, y + 14, { width: 280 });
    doc.font('Helvetica').fontSize(10);
    for (const v of [inv.client_address, inv.client_phone, inv.client_email]) if (v) doc.text(plain(v), { width: 280 });

    if (inv.title) doc.moveDown(1).font('Helvetica-Bold').text(plain(inv.title), left, doc.y, { width }).font('Helvetica');

    // Tableau des lignes
    // Colonnes assez larges pour « -1 000 000 F CFA » sur une ligne
    const cols = { desc: left, qty: left + 196, price: left + 266, amount: left + 372 };
    const descW = 186;
    const header = (at) => {
      doc.fillColor(muted).fontSize(9);
      doc.text('Description', cols.desc, at);
      doc.text('Quantité', cols.qty, at, { width: 64, align: 'right' });
      doc.text('Prix unitaire', cols.price, at, { width: 100, align: 'right' });
      doc.text('Montant', cols.amount, at, { width: right - cols.amount, align: 'right' });
      doc.moveTo(left, at + 16).lineTo(right, at + 16).strokeColor(rule).stroke();
      return at + 26;
    };
    y = header(doc.y + 24);

    for (const l of inv.lines) {
      const note = plain(lineNote(l, inv));
      const h = Math.max(doc.fontSize(10).heightOfString(plain(l.description), { width: descW }), 12)
        + (note ? doc.fontSize(8).heightOfString(note, { width: descW }) + 2 : 0);
      if (y + h > bottom) { doc.addPage(); y = header(56); }
      if (note) doc.fillColor(muted).fontSize(8).text(note, cols.desc, y + doc.fontSize(10).heightOfString(plain(l.description), { width: descW }) + 2, { width: descW });
      doc.fillColor(ink).fontSize(10).text(plain(l.description), cols.desc, y, { width: descW });
      // Une prime simple n'affiche que son montant ; multipliée, elle affiche « × 2 » et le montant unitaire
      if (l.kind !== 'prime' || l.quantity !== 1) {
        const qty = l.kind === 'prime' ? `× ${plain(m.num(l.quantity))}` : `${plain(m.num(l.quantity))}${l.unit ? ` ${plain(l.unit)}` : ''}`;
        doc.text(qty, cols.qty, y, { width: 64, align: 'right' });
        doc.text(money(l.unit_price), cols.price, y, { width: 100, align: 'right' });
      }
      doc.text(money(l.amount), cols.amount, y, { width: right - cols.amount, align: 'right' });
      y += h + 12;
    }
    doc.moveTo(left, y).lineTo(right, y).strokeColor(rule).stroke();
    y += 12;
    if (y > bottom - 120) { doc.addPage(); y = 56; }

    // Totaux
    const labelX = cols.price - 100;
    const row = (label, value, bold = false) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 13 : 10).fillColor(ink);
      // Un libellé long (retenue avec sa base) passe sur deux lignes : la ligne suivante descend d'autant
      const h = doc.heightOfString(label, { width: 170 });
      doc.text(label, labelX, y, { width: 170 })
        .text(value, cols.amount - 40, y, { width: right - cols.amount + 40, align: 'right' });
      y += Math.max(h + 4, bold ? 22 : 16);
    };
    const withheld = inv.withholding_amount > 0;
    if (inv.vat_rate > 0) {
      row('Total HT', money(inv.subtotal));
      row(`TVA ${plain(m.num(inv.vat_rate))} %`, money(inv.vat_amount));
    }
    const totalLabel = inv.vat_rate > 0 ? 'Total TTC' : 'Total';
    const paid = mode === 'facture' && inv.status === 'payee';
    const finalLabel = { facture: withheld ? (paid ? 'Net payé' : 'Net à payer') : `${totalLabel} ${paid ? 'payé' : 'à payer'}`,
      devis: withheld ? 'Net à payer' : totalLabel, avoir: withheld ? 'Net de l\'avoir' : 'Total de l\'avoir' }[mode];
    if (withheld) {
      row(totalLabel, money(inv.total));
      row(plain(withholdingLabel(inv)).replace(' (', '\n('), `${credit ? '+' : '-'} ${plain(m.money(inv.withholding_amount, cur))}`);
    }
    row(finalLabel, money(inv.amount_due), true);
    if (inv.alt_currency && inv.alt_rate) {
      const kind = m.fixedRate(cur, inv.alt_currency) ? 'Parité fixe' : 'Taux appliqué';
      doc.font('Helvetica').fontSize(10).fillColor(muted)
        .text(`soit ${alt(inv.amount_due)}`, labelX, y, { width: right - labelX, align: 'right' })
        .fontSize(8).text(`${kind} : ${plain(m.rateLabel(cur, inv.alt_currency, inv.alt_rate))}.`, left, doc.y + 2, { width, align: 'right' });
      y = doc.y;
    }

    // Paiement : les moyens de payer, ou la confirmation du règlement
    y += 28;
    if (mode === 'avoir') {
      doc.font('Helvetica').fontSize(10).fillColor(ink)
        .text(`Cet avoir annule la facture ${inv.number}. Aucun paiement n'est dû au titre de cette facture.${inv.cancel_reason ? ` Motif : ${plain(inv.cancel_reason)}` : ''}`, left, y, { width });
    } else if (mode === 'devis') {
      doc.font('Helvetica').fontSize(10).fillColor(ink)
        .text(inv.status === 'refusee' ? 'Devis refusé.'
          : inv.accepted_at ? `Bon pour accord : devis accepté le ${plain(frDate(inv.accepted_at))}${inv.accepted_by ? `, signé en ligne par ${plain(inv.accepted_by)}` : ''}.`
            : `Devis valable jusqu'au ${plain(frDate(inv.due_date))}. Il deviendra une facture une fois accepté.`, left, y, { width });
    } else if (inv.status === 'annulee') {
      doc.font('Helvetica').fontSize(10).fillColor('#A63A2E')
        .text(`Facture annulée${inv.cancelled_at ? ` le ${plain(frDate(inv.cancelled_at))}` : ''}${inv.credit_number ? ` par l'avoir ${inv.credit_number}` : ''} : rien à régler.${inv.cancel_reason ? ` Motif : ${plain(inv.cancel_reason)}` : ''}`, left, y, { width });
    } else if (inv.status === 'payee') {
      doc.font('Helvetica').fontSize(10).fillColor('#1D7350')
        .text(`Paiement reçu${inv.confirmed_at ? ` le ${plain(frDate(inv.confirmed_at))}` : ''}${inv.payment_method ? ` par ${plain(inv.payment_method)}` : ''}${inv.payment_ref ? `, référence ${plain(inv.payment_ref)}` : ''}. Merci.`, left, y, { width });
    } else {
      doc.font('Helvetica').fontSize(10).fillColor(ink).text('Modes de paiement', left, y).fillColor(muted);
      for (const [label, value] of paymentLines(company)) doc.text(`${plain(label)} : ${plain(value)}`, { width });
      if (inv.number) doc.text(`Référence à indiquer : ${inv.number}`);
    }

    if (inv.notes) doc.moveDown(1).fillColor(ink).text(plain(inv.notes), { width });

    const link = `${appUrl()}/f/${inv.token}`;
    if (mode === 'facture' && inv.number && !['payee', 'annulee'].includes(inv.status)) {
      doc.moveDown(1).fillColor(ink)
        .text('Après le paiement, signalez-le ici avec la référence et le justificatif :', { width })
        .fillColor('#24457A').text(link, { link, underline: true, width });
    }
    if (mode === 'devis' && inv.number && ['emise', 'envoyee'].includes(inv.status)) {
      doc.moveDown(1).fillColor(ink)
        .text('Pour accepter ou refuser ce devis en ligne :', { width })
        .fillColor('#24457A').text(link, { link, underline: true, width });
    }

    // Pied de page : « Émise avec » et le logo FactPay (marge du bas levée pour ne pas créer de page)
    doc.page.margins.bottom = 0;
    const markH = 16;
    const markW = markH * FACTPAY_LOGO_RATIO;
    const markY = doc.page.height - 40;
    doc.font('Helvetica').fontSize(7).fillColor(muted);
    const caption = mode === 'facture' ? 'Émise avec' : 'Émis avec';
    const capW = doc.widthOfString(caption);
    doc.text(caption, right - markW - capW - 6, markY + 5, { lineBreak: false });
    doc.image(FACTPAY_LOGO_PNG, right - markW, markY, { width: markW, height: markH });

    if (company.footer_note) {
      doc.fontSize(8).fillColor(muted).text(plain(company.footer_note), left, doc.page.height - 80, { width, align: 'center' });
    }
    doc.end();
  });
}
