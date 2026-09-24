// Modèles d'e-mails : chaque fonction renvoie { subject, text, html }.
// HTML en tableaux et styles en ligne, pour s'afficher pareil dans Gmail, Outlook et sur téléphone.
import { money, altMoney, rateLabel } from './money.js';
import { frDate } from './dates.js';
import { appUrl } from './url.js';
import { readFile } from './storage.js';
import { FACTPAY_LOGO_PNG } from './brand-logo.js';
import { lineNote, withholdingLabel, issuedCompany } from './invoice-text.js';
import { paymentLines } from './payment.js';
import { pubId } from './ids.js';

const C = { bg: '#E9EDF1', paper: '#FFFFFF', ink: '#1A2433', muted: '#5E6878', line: '#D3D9E0', brand: '#2B4C7E', paid: '#1D7350', check: '#2B4C7E' };
const FONT = "'Public Sans', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const nl = (s) => esc(s).replace(/\n/g, '<br>');

// Bouton compatible avec tous les clients mail
const button = (href, label, color = C.brand) => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px"><tr>
    <td style="background:${color};border-radius:4px">
      <a href="${esc(href)}" style="display:inline-block;padding:13px 22px;font:600 15px ${FONT};color:#FFFFFF;text-decoration:none">${esc(label)}</a>
    </td>
  </tr></table>`;

// Pastille ronde : ✓ vert pour « payé », point bleu pour « à vérifier »
const badge = (symbol, color) => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px"><tr>
    <td width="48" height="48" align="center" valign="middle" style="width:48px;height:48px;border-radius:24px;background:${color};color:#FFFFFF;font:700 26px ${FONT};line-height:48px">${symbol}</td>
  </tr></table>`;

// Étiquette colorée : « Paiement à vérifier »
const pill = (label, color, bg) => `
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px"><tr>
    <td style="background:${bg};color:${color};border-radius:14px;padding:6px 14px;font:600 13px ${FONT}">${esc(label)}</td>
  </tr></table>`;

// Lignes « libellé … montant »
const rows = (list) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font:14px ${FONT};color:${C.ink}">
    ${list.filter(Boolean).map(([label, value, strong]) => `
      <tr>
        <td style="padding:7px 12px 7px 0;${strong ? `border-top:2px solid ${C.ink};font-weight:700;font-size:17px;padding-top:12px` : `color:${C.muted}`}">${label}</td>
        <td align="right" style="padding:7px 0;white-space:nowrap;${strong ? `border-top:2px solid ${C.ink};font-weight:700;font-size:17px;padding-top:12px` : ''}">${value}</td>
      </tr>`).join('')}
  </table>`;

// Gabarit commun : en-tête (entreprise ou FactPay), carte blanche, pied de page
function layout({ preheader, heading, sub, body, footer }) {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(heading)}</title></head>
<body style="margin:0;padding:0;background:${C.bg}">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg}"><tr><td align="center" style="padding:32px 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
      <tr><td align="center" style="padding:0 4px 18px;text-align:center;font:700 18px ${FONT};color:${C.ink}">${heading}${sub ? `<div style="font:400 13px ${FONT};color:${C.muted};margin-top:2px">${sub}</div>` : ''}</td></tr>
      <tr><td style="background:${C.paper};border:1px solid ${C.line};border-radius:6px;padding:32px 28px;font:15px/1.55 ${FONT};color:${C.ink}">${body}</td></tr>
      <tr><td align="center" style="padding:18px 4px 0;text-align:center;font:12px/1.5 ${FONT};color:${C.muted}">${footer || ''}${footer ? '<br>' : ''}<a href="${esc(appUrl())}" style="color:${C.muted};text-decoration:none">Envoyé avec&nbsp;<img src="cid:factpay-logo" width="40" height="24" alt="FactPay" style="border:0;vertical-align:middle"></a></td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

// En-tête des e-mails d'une entreprise : toujours un logo au-dessus du nom
// (celui de l'entreprise, ou celui de FactPay tant qu'elle n'en a pas envoyé)
const companyHeading = (company) => `${company.logo_key
  ? `<img src="cid:company-logo" alt="${esc(company.name)}" height="48" style="display:block;border:0;height:48px;width:auto;max-width:200px;margin:0 auto 10px">`
  : `<img src="cid:factpay-logo" width="80" height="48" alt="FactPay" style="display:block;border:0;margin:0 auto 10px">`}${esc(company.name)}`;
const companySub = (company) => [company.address, company.legal_ids].filter(Boolean).map(esc).join(' · ');

// Récapitulatif des montants d'une facture
function amountRows(inv, paid = false) {
  const cur = inv.currency;
  const withheld = inv.withholding_amount > 0;
  const totalLabel = inv.vat_rate > 0 ? 'Total TTC' : 'Total';
  const alt = altMoney(inv.amount_due, inv);
  return rows([
    inv.vat_rate > 0 && ['Total HT', money(inv.subtotal, cur)],
    inv.vat_rate > 0 && [`TVA ${inv.vat_rate} %`, money(inv.vat_amount, cur)],
    withheld && [totalLabel, money(inv.total, cur)],
    withheld && [`${esc(withholdingLabel(inv))}${paid ? '' : ', retenue par vos soins'}`, `− ${money(inv.withholding_amount, cur)}`],
    [withheld ? (paid ? 'Net payé' : 'Net à payer') : `${totalLabel} ${paid ? 'payé' : 'à payer'}`, money(inv.amount_due, cur), true],
    alt && ['', `<span style="color:${C.muted};font-size:13px">soit ${alt} (${esc(rateLabel(cur, inv.alt_currency, inv.alt_rate))})</span>`],
  ]);
}

const periodLine = (inv) => {
  const l = inv.lines?.find((x) => x.kind === 'period');
  const note = l && lineNote(l, inv);
  return note ? `<p style="margin:0 0 16px;color:${C.muted};font-size:14px">Période : ${esc(note)}</p>` : '';
};

const paymentWays = (company) => paymentLines(company).map(([label, value]) => `${esc(label)} : <strong>${esc(value)}</strong>`);

// ---------- Au client de l'entreprise ----------

export function invoiceSentEmail(inv, company, link) {
  company = issuedCompany(inv, company);
  const cur = inv.currency;
  const ways = paymentWays(company);
  const subject = `Facture ${inv.number}${inv.title ? ` – ${inv.title}` : ''} (${company.name})`;
  const html = layout({
    preheader: `${money(inv.amount_due, cur)} à régler avant le ${frDate(inv.due_date)}`,
    heading: companyHeading(company),
    sub: companySub(company),
    body: `
      <p style="margin:0 0 4px;color:${C.muted};font-size:13px">Facture ${esc(inv.number)}</p>
      <h1 style="margin:0 0 6px;font:700 26px/1.2 ${FONT};color:${C.ink}">${money(inv.amount_due, cur)}</h1>
      <p style="margin:0 0 20px;color:${C.muted}">à régler avant le <strong style="color:${C.ink}">${frDate(inv.due_date)}</strong></p>
      <p style="margin:0 0 16px">Bonjour ${esc(inv.client_name)},<br>veuillez trouver ci-joint la facture ${esc(inv.number)}${inv.title ? ` pour « ${esc(inv.title)} »` : ''}.</p>
      ${periodLine(inv)}
      ${amountRows(inv)}
      ${button(link, 'Voir la facture et signaler le paiement')}
      <p style="margin:0;color:${C.muted};font-size:13px">Après votre paiement, ce lien vous permet d'envoyer la référence et le justificatif.</p>
      ${ways.length ? `<div style="margin-top:24px;padding-top:20px;border-top:1px solid ${C.line};font-size:14px">
        <div style="font-weight:600;margin-bottom:6px">Pour payer</div>
        ${ways.map((w) => `<div style="color:${C.muted};margin:2px 0">${w}</div>`).join('')}
        <div style="color:${C.muted};margin:2px 0">Référence à indiquer : <strong>${esc(inv.number)}</strong></div>
      </div>` : ''}`,
    footer: `Facture PDF en pièce jointe.${company.email ? ` Une question ? Répondez à cet e-mail ou écrivez à ${esc(company.email)}.` : ''}`,
  });
  const alt = altMoney(inv.amount_due, inv);
  const text = `Bonjour ${inv.client_name},

Veuillez trouver ci-joint la facture ${inv.number} de ${company.name}.
${inv.withholding_amount > 0 ? `\nTotal : ${money(inv.total, cur)}\n${withholdingLabel(inv)}, retenue par vos soins : - ${money(inv.withholding_amount, cur)}` : ''}
Montant à payer : ${money(inv.amount_due, cur)}${alt ? `, soit ${alt}` : ''}
À régler avant le : ${frDate(inv.due_date)}
${ways.length ? `\nPour payer :\n${ways.map((w) => `- ${w.replace(/<[^>]+>/g, '')}`).join('\n')}\n` : ''}Référence à indiquer : ${inv.number}

Voir la facture et signaler votre paiement :
${link}

Cordialement,
${company.name}`;
  return { subject, text, html };
}

export function invoicePaidEmail(inv, company, link) {
  company = issuedCompany(inv, company);
  const cur = inv.currency;
  const subject = `Paiement reçu : facture ${inv.number} (${company.name})`;
  const html = layout({
    preheader: `${company.name} confirme avoir reçu ${money(inv.amount_due, cur)}. Merci.`,
    heading: companyHeading(company),
    sub: companySub(company),
    body: `
      ${badge('&#10003;', C.paid)}
      <h1 style="margin:0 0 6px;font:700 24px/1.25 ${FONT};color:${C.paid}">Paiement reçu, merci</h1>
      <p style="margin:0 0 20px;color:${C.muted}">Facture ${esc(inv.number)} réglée le <strong style="color:${C.ink}">${frDate(inv.confirmed_at)}</strong>${inv.payment_method ? ` par ${esc(inv.payment_method)}` : ''}${inv.payment_ref ? `, référence ${esc(inv.payment_ref)}` : ''}.</p>
      <p style="margin:0 0 16px">Bonjour ${esc(inv.client_name)},<br>${esc(company.name)} confirme avoir bien reçu votre paiement. Vous trouverez ci-joint la facture marquée <strong style="color:${C.paid}">payée</strong>, à garder pour votre comptabilité.</p>
      ${periodLine(inv)}
      ${amountRows(inv, true)}
      ${button(link, 'Voir la facture payée', C.paid)}`,
    footer: 'Facture payée en pièce jointe (PDF).',
  });
  const text = `Bonjour ${inv.client_name},

${company.name} confirme avoir bien reçu le paiement de la facture ${inv.number} : ${money(inv.amount_due, cur)}, le ${frDate(inv.confirmed_at)}.

Vous trouverez ci-joint la facture marquée « payée ».
${link}

Merci,
${company.name}`;
  return { subject, text, html };
}

// ---------- À l'entreprise ----------

export function paymentDeclaredEmail(inv, reference) {
  const cur = inv.currency;
  const link = `${appUrl()}/factures/${pubId('facture', inv.id)}`;
  const subject = `Paiement signalé : ${inv.number} (${inv.client_name})`;
  const html = layout({
    preheader: `${inv.client_name} dit avoir payé ${money(inv.amount_due, cur)}. À vérifier.`,
    heading: factpayLogo(),
    body: `
      ${pill('Paiement à vérifier', C.check, '#E3EAF4')}
      <h1 style="margin:0 0 6px;font:700 22px/1.25 ${FONT}">${esc(inv.client_name)} a signalé son paiement</h1>
      <p style="margin:0 0 20px;color:${C.muted}">Facture ${esc(inv.number)}</p>
      ${rows([['Montant attendu', money(inv.amount_due, cur)], ['Référence du paiement', esc(reference)]])}
      <p style="margin:20px 0 0">Vérifie que l'argent est bien arrivé sur ton compte ou ton Mobile Money, puis confirme. Ton client recevra alors automatiquement sa facture marquée payée.</p>
      ${button(link, 'Vérifier et confirmer le paiement')}`,
  });
  const text = `${inv.client_name} a signalé le paiement de la facture ${inv.number}.

Montant : ${money(inv.amount_due, cur)}
Référence du paiement : ${reference}

Vérifie que l'argent est bien arrivé, puis confirme le paiement ici :
${link}`;
  return { subject, text, html };
}

export function invoiceCancelledEmail(inv, company) {
  company = issuedCompany(inv, company);
  const cur = inv.currency;
  const subject = `Facture ${inv.number} annulée (${company.name})`;
  const html = layout({
    preheader: `Vous n'avez rien à régler au titre de la facture ${inv.number}.`,
    heading: companyHeading(company),
    sub: companySub(company),
    body: `
      ${pill('Facture annulée', '#A63A2E', '#F6E4E1')}
      <h1 style="margin:0 0 6px;font:700 22px/1.25 ${FONT}">La facture ${esc(inv.number)} est annulée</h1>
      <p style="margin:0 0 20px;color:${C.muted}">Montant initial : ${money(inv.amount_due, cur)}</p>
      <p style="margin:0 0 16px">Bonjour ${esc(inv.client_name)},<br>${esc(company.name)} a annulé cette facture. <strong>Vous n'avez rien à régler</strong> à ce titre, et le lien de paiement n'est plus actif.</p>
      ${inv.credit_number ? `<p style="margin:0 0 16px">Vous trouverez ci-joint l'avoir <strong>${esc(inv.credit_number)}</strong>, qui annule la facture ${esc(inv.number)} dans vos comptes.</p>` : ''}
      ${inv.cancel_reason ? `<p style="margin:0 0 16px;padding:12px 14px;background:${C.bg};border-radius:4px">Motif : ${nl(inv.cancel_reason)}</p>` : ''}
      <p style="margin:0;color:${C.muted};font-size:14px">Une question ? Répondez simplement à cet e-mail.</p>`,
  });
  const text = `Bonjour ${inv.client_name},

${company.name} a annulé la facture ${inv.number} (${money(inv.amount_due, cur)}). Vous n'avez rien à régler à ce titre.
${inv.credit_number ? `Avoir ${inv.credit_number} ci-joint.` : ''}
${inv.cancel_reason ? `
Motif : ${inv.cancel_reason}
` : ''}
Une question ? Répondez simplement à cet e-mail.

${company.name}`;
  return { subject, text, html };
}

export function clientMessageEmail(inv, body) {
  const link = `${appUrl()}/factures/${pubId('facture', inv.id)}`;
  const subject = `Message de ${inv.client_name} : facture ${inv.number}`;
  const html = layout({
    preheader: body.slice(0, 120),
    heading: factpayLogo(),
    body: `
      ${pill('Nouveau message', C.brand, '#E3EAF4')}
      <h1 style="margin:0 0 6px;font:700 22px/1.25 ${FONT}">${esc(inv.client_name)} t'a écrit</h1>
      <p style="margin:0 0 20px;color:${C.muted}">À propos de la facture ${esc(inv.number)}</p>
      <div style="padding:16px 18px;background:${C.bg};border-radius:4px;white-space:normal">${nl(body)}</div>
      <p style="margin:20px 0 0">Réponds directement à cet e-mail : ta réponse partira à ${esc(inv.client_email)}.</p>
      ${button(link, 'Voir la facture')}`,
  });
  const text = `${inv.client_name} t'a écrit à propos de la facture ${inv.number} :

${body}

Réponds directement à cet e-mail : ta réponse partira à ${inv.client_email}.
${link}`;
  return { subject, text, html };
}

// Relance d'une facture en retard : cordiale, avec le montant, le retard et le lien
export function reminderEmail(inv, company, link) {
  company = issuedCompany(inv, company);
  const cur = inv.currency;
  const ways = paymentWays(company);
  const days = Math.max(1, Math.round((Date.now() - new Date(`${inv.due_date}T12:00:00Z`).getTime()) / 86400000));
  const subject = `Rappel : facture ${inv.number} (${company.name})`;
  const html = layout({
    preheader: `${money(inv.amount_due, cur)} attendus depuis le ${frDate(inv.due_date)}.`,
    heading: companyHeading(company),
    sub: companySub(company),
    body: `
      ${pill('Rappel de paiement', '#8F5608', '#F6EBD9')}
      <h1 style="margin:0 0 6px;font:700 26px/1.2 ${FONT};color:${C.ink}">${money(inv.amount_due, cur)}</h1>
      <p style="margin:0 0 20px;color:${C.muted}">Facture ${esc(inv.number)}, échue le <strong style="color:${C.ink}">${frDate(inv.due_date)}</strong> (il y a ${days} jour${days > 1 ? 's' : ''})</p>
      <p style="margin:0 0 16px">Bonjour ${esc(inv.client_name)},<br>sauf erreur de notre part, nous n'avons pas encore reçu le règlement de cette facture. Si le paiement est déjà parti, merci de le signaler avec sa référence grâce au bouton ci-dessous : nous le vérifierons.</p>
      ${button(link, 'Payer ou signaler le paiement')}
      ${ways.length ? `<div style="margin-top:24px;padding-top:20px;border-top:1px solid ${C.line};font-size:14px">
        <div style="font-weight:600;margin-bottom:6px">Pour payer</div>
        ${ways.map((w) => `<div style="color:${C.muted};margin:2px 0">${w}</div>`).join('')}
        <div style="color:${C.muted};margin:2px 0">Référence à indiquer : <strong>${esc(inv.number)}</strong></div>
      </div>` : ''}`,
    footer: 'Facture PDF en pièce jointe. Une question ? Répondez simplement à cet e-mail.',
  });
  const text = `Bonjour ${inv.client_name},

Sauf erreur de notre part, la facture ${inv.number} de ${money(inv.amount_due, cur)}, échue le ${frDate(inv.due_date)}, n'est pas encore réglée.
Si le paiement est déjà parti, merci de le signaler avec sa référence :
${link}

Cordialement,
${company.name}`;
  return { subject, text, html };
}

// Devis envoyé au client, avec les boutons pour l'accepter ou le refuser
export function quoteSentEmail(inv, company, link) {
  company = issuedCompany(inv, company);
  const cur = inv.currency;
  const subject = `Devis ${inv.number}${inv.title ? ` – ${inv.title}` : ''} (${company.name})`;
  const html = layout({
    preheader: `${money(inv.amount_due, cur)}, valable jusqu'au ${frDate(inv.due_date)}`,
    heading: companyHeading(company),
    sub: companySub(company),
    body: `
      <p style="margin:0 0 4px;color:${C.muted};font-size:13px">Devis ${esc(inv.number)}</p>
      <h1 style="margin:0 0 6px;font:700 26px/1.2 ${FONT};color:${C.ink}">${money(inv.amount_due, cur)}</h1>
      <p style="margin:0 0 20px;color:${C.muted}">valable jusqu'au <strong style="color:${C.ink}">${frDate(inv.due_date)}</strong></p>
      <p style="margin:0 0 16px">Bonjour ${esc(inv.client_name)},<br>voici notre devis${inv.title ? ` pour « ${esc(inv.title)} »` : ''}. Vous pouvez le consulter, puis l'accepter ou le refuser en ligne.</p>
      ${periodLine(inv)}
      ${amountRows(inv)}
      ${button(link, 'Voir et répondre au devis')}`,
    footer: `Devis PDF en pièce jointe.${company.email ? ` Une question ? Répondez à cet e-mail ou écrivez à ${esc(company.email)}.` : ''}`,
  });
  const text = `Bonjour ${inv.client_name},

Voici le devis ${inv.number} de ${company.name} : ${money(inv.amount_due, cur)}, valable jusqu'au ${frDate(inv.due_date)}.
Le consulter et l'accepter ou le refuser :
${link}

Cordialement,
${company.name}`;
  return { subject, text, html };
}

// À l'entreprise : le client a accepté ou refusé son devis
export function quoteAnsweredEmail(inv, accepted) {
  const link = `${appUrl()}/factures/${pubId('facture', inv.id)}`;
  const subject = `Devis ${inv.number} ${accepted ? 'accepté' : 'refusé'} par ${inv.client_name}`;
  const html = layout({
    preheader: `${inv.client_name} a ${accepted ? 'accepté' : 'refusé'} le devis ${inv.number}.`,
    heading: factpayLogo(),
    body: `
      ${accepted ? badge('&#10003;', C.paid) : pill('Devis refusé', '#A63A2E', '#F6E4E1')}
      <h1 style="margin:0 0 6px;font:700 22px/1.25 ${FONT};color:${accepted ? C.paid : C.ink}">${esc(inv.client_name)} a ${accepted ? 'accepté' : 'refusé'} ton devis</h1>
      <p style="margin:0 0 20px;color:${C.muted}">Devis ${esc(inv.number)} · ${money(inv.amount_due, inv.currency)}</p>
      <p style="margin:0">${accepted ? 'Tu peux maintenant le transformer en facture en un clic.' : 'Tu peux lui écrire pour en savoir plus ou lui proposer un nouveau devis.'}</p>
      ${button(link, accepted ? 'Transformer en facture' : 'Voir le devis')}`,
  });
  const text = `${inv.client_name} a ${accepted ? 'accepté' : 'refusé'} le devis ${inv.number} (${money(inv.amount_due, inv.currency)}).\n${link}`;
  return { subject, text, html };
}

// ---------- Compte ----------

const factpayLogo = () => `<img src="cid:factpay-logo" width="80" height="48" alt="FactPay" style="display:block;border:0;margin:0 auto">`;

function accountEmail({ subject, preheader, title, intro, link, action, outro, text }) {
  const html = layout({
    preheader,
    heading: factpayLogo(),
    body: `
      <h1 style="margin:0 0 12px;font:700 22px/1.25 ${FONT}">${title}</h1>
      <p style="margin:0">${intro}</p>
      ${button(link, action)}
      <p style="margin:12px 0 0;color:${C.muted};font-size:13px">${outro}<br>Si le bouton ne marche pas, copie ce lien : <a href="${esc(link)}" style="color:${C.brand};word-break:break-all">${esc(link)}</a></p>`,
  });
  return { subject, text, html };
}

export function verifyEmail(name, link) {
  return accountEmail({
    subject: 'Confirme ton adresse e-mail',
    preheader: 'Un clic pour activer ton compte FactPay.',
    title: `Bienvenue sur FactPay, ${esc(name)}`,
    intro: 'Confirme ton adresse e-mail pour activer ton compte. Tu pourras ensuite renseigner ton entreprise et envoyer ta première facture.',
    link,
    action: 'Confirmer mon adresse',
    outro: "Ce lien est valable 24 heures. Si tu n'as pas créé de compte, ignore cet e-mail.",
    text: `Bonjour ${name},\n\nPour activer ton compte FactPay, confirme ton adresse e-mail en ouvrant ce lien (valable 24 heures) :\n${link}\n\nSi tu n'as pas créé de compte, ignore cet e-mail.`,
  });
}

export function changeEmailEmail(name, link) {
  return accountEmail({
    subject: 'Confirme ta nouvelle adresse e-mail',
    preheader: 'Un clic pour utiliser cette adresse sur FactPay.',
    title: 'Nouvelle adresse e-mail',
    intro: `Bonjour ${esc(name)}, tu as demandé à utiliser cette adresse pour ton compte FactPay. Confirme-la pour terminer le changement.`,
    link,
    action: 'Confirmer cette adresse',
    outro: "Ce lien est valable 24 heures. Tant qu'il n'est pas ouvert, ton ancienne adresse reste active. Si tu n'as rien demandé, ignore cet e-mail.",
    text: `Bonjour ${name},\n\nPour utiliser cette adresse sur FactPay, ouvre ce lien (valable 24 heures) :\n${link}\n\nSi tu n'as rien demandé, ignore cet e-mail.`,
  });
}

// Code de connexion (double authentification par e-mail)
export function loginCodeEmail(name, code) {
  const html = layout({
    preheader: `Ton code de connexion FactPay : ${code}`,
    heading: factpayLogo(),
    body: `
      <h1 style="margin:0 0 12px;font:700 22px/1.25 ${FONT}">Ton code de connexion</h1>
      <p style="margin:0 0 20px">Bonjour ${esc(name)}, voici le code pour terminer ta connexion à FactPay :</p>
      <div style="font:700 34px/1 ${FONT};letter-spacing:8px;color:${C.ink};background:${C.bg};border-radius:6px;padding:18px 0;text-align:center">${esc(code)}</div>
      <p style="margin:20px 0 0;color:${C.muted};font-size:13px">Il est valable 10 minutes. Si tu n'essaies pas de te connecter, quelqu'un connaît peut-être ton mot de passe : change-le dans Paramètres → Mon compte.</p>`,
  });
  return {
    subject: `${code} est ton code de connexion FactPay`,
    text: `Bonjour ${name},

Ton code de connexion FactPay : ${code}
Il est valable 10 minutes.

Si tu n'essaies pas de te connecter, change ton mot de passe.`,
    html,
  };
}

// Alerte de sécurité : double authentification activée, désactivée…
export function securityNoticeEmail(name, what) {
  const html = layout({
    preheader: what,
    heading: factpayLogo(),
    body: `
      ${pill('Sécurité du compte', C.brand, '#E3EAF4')}
      <h1 style="margin:0 0 12px;font:700 22px/1.25 ${FONT}">${esc(what)}</h1>
      <p style="margin:0">Bonjour ${esc(name)}, ce changement vient d'être fait sur ton compte FactPay. Si ce n'est pas toi, change ton mot de passe tout de suite et écris-nous en répondant à cet e-mail.</p>`,
  });
  return { subject: `FactPay : ${what}`, text: `Bonjour ${name},

${what}.
Si ce n'est pas toi, change ton mot de passe tout de suite.`, html };
}

export function resetPasswordEmail(name, link) {
  return accountEmail({
    subject: 'Réinitialiser ton mot de passe',
    preheader: 'Choisis un nouveau mot de passe pour ton compte FactPay.',
    title: 'Nouveau mot de passe',
    intro: `Bonjour ${esc(name)}, tu as demandé à changer ton mot de passe. Clique sur le bouton pour en choisir un nouveau.`,
    link,
    action: 'Choisir un nouveau mot de passe',
    outro: "Ce lien est valable 1 heure. Si tu n'as rien demandé, ignore cet e-mail : ton mot de passe ne change pas.",
    text: `Bonjour ${name},\n\nPour choisir un nouveau mot de passe, ouvre ce lien (valable 1 heure) :\n${link}\n\nSi tu n'as rien demandé, ignore cet e-mail.`,
  });
}

// Joint au message les images utilisées dans le HTML (cid:…) : elles s'affichent sans rien télécharger
export async function withImages(email, company = null) {
  const inline = [];
  if (email.html.includes('cid:factpay-logo')) inline.push({ cid: 'factpay-logo', filename: 'factpay.png', content: FACTPAY_LOGO_PNG, contentType: 'image/png' });
  if (email.html.includes('cid:company-logo') && company?.logo_key) {
    const content = await readFile(company.logo_key).catch(() => null);
    if (content) inline.push({ cid: 'company-logo', filename: `logo.${company.logo_mime === 'image/jpeg' ? 'jpg' : 'png'}`, content, contentType: company.logo_mime || 'image/png' });
    // Logo illisible : on retire l'image plutôt que d'afficher une image cassée
    else email = { ...email, html: email.html.replace('cid:company-logo', 'cid:factpay-logo') };
  }
  if (email.html.includes('cid:factpay-logo') && !inline.some((i) => i.cid === 'factpay-logo')) {
    inline.push({ cid: 'factpay-logo', filename: 'factpay.png', content: FACTPAY_LOGO_PNG, contentType: 'image/png' });
  }
  return { ...email, inline };
}
