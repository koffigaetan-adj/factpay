// Pays de l'entreprise, indicatif, longueur des numéros et opérateurs Mobile Money proposés.
// « Autre » permet de saisir un opérateur absent de la liste.
export const COUNTRIES = {
  TG: { name: 'Togo', dial: '228', digits: 8, operators: ['Flooz', 'Mixx by Yas'] },
  BJ: { name: 'Bénin', dial: '229', digits: 10, operators: ['MTN MoMo', 'Moov Money', 'Celtiis Cash'] },
  CI: { name: "Côte d'Ivoire", dial: '225', digits: 10, operators: ['Orange Money', 'MTN MoMo', 'Moov Money', 'Wave'] },
  SN: { name: 'Sénégal', dial: '221', digits: 9, operators: ['Orange Money', 'Wave', 'Free Money'] },
  BF: { name: 'Burkina Faso', dial: '226', digits: 8, operators: ['Orange Money', 'Moov Money'] },
  ML: { name: 'Mali', dial: '223', digits: 8, operators: ['Orange Money', 'Moov Money'] },
  NE: { name: 'Niger', dial: '227', digits: 8, operators: ['Airtel Money', 'Moov Money'] },
};
export const OTHER = 'Autre';
export const countryOf = (code) => COUNTRIES[code] || COUNTRIES.TG;

const digitsOnly = (s) => String(s || '').replace(/\D/g, '');

// Numéro local saisi (espaces acceptés, indicatif facultatif) → chiffres locaux, ou null s'il ne respecte pas le pays
export function localNumber(input, countryCode) {
  const c = countryOf(countryCode);
  let d = digitsOnly(input);
  if (d.startsWith('00' + c.dial)) d = d.slice(2 + c.dial.length);
  else if (d.startsWith(c.dial) && d.length === c.dial.length + c.digits) d = d.slice(c.dial.length);
  return d.length === c.digits ? d : null;
}

// « +228 90 00 00 00 »
export function formatNumber(local, countryCode) {
  const c = countryOf(countryCode);
  return `+${c.dial} ${digitsOnly(local).replace(/(\d{2})(?=\d)/g, '$1 ')}`;
}

// Nettoie les moyens Mobile Money reçus du formulaire. Renvoie { list, error }.
export function cleanMobiles(raw, countryCode) {
  const list = [];
  for (const m of Array.isArray(raw) ? raw.slice(0, 6) : []) {
    const operator = String(m.operator === OTHER ? m.other || '' : m.operator || '').trim().slice(0, 40);
    const number = String(m.number || '').trim();
    if (!operator && !number) continue;
    if (!operator) return { error: 'Choisis l\'opérateur de chaque numéro Mobile Money.' };
    const local = localNumber(number, countryCode);
    if (!local) {
      const c = countryOf(countryCode);
      return { error: `Le numéro ${operator} doit avoir ${c.digits} chiffres (${c.name}, +${c.dial}).` };
    }
    list.push({ operator, number: local });
  }
  return { list };
}

export function parseMobiles(company) {
  try { return JSON.parse(company.mobile_accounts || '[]'); } catch { return []; }
}

// Moyens de paiement à afficher sur la facture, la page client et les e-mails : [[libellé, valeur], …]
export function paymentLines(company) {
  const out = [];
  if (company.iban) {
    out.push([`Virement${company.bank_name ? ` (${company.bank_name})` : ''}`, `${company.iban}${company.bic ? `, BIC ${company.bic}` : ''}`]);
  }
  const mobiles = parseMobiles(company);
  for (const m of mobiles) out.push([m.operator, formatNumber(m.number, company.country)]);
  // Ancien champ texte libre, tant qu'aucun numéro n'a été saisi dans le nouveau format
  if (!mobiles.length && company.mobile_money) out.push(['Mobile Money', company.mobile_money]);
  if (company.spi_alias) out.push(['Alias SPI (BCEAO)', company.spi_alias]);
  return out;
}

// Moyens proposés quand l'entreprise marque elle-même une facture payée
export function paymentMethodOptions(company) {
  const list = ['Virement bancaire', ...parseMobiles(company).map((m) => m.operator), ...countryOf(company.country).operators];
  if (company.spi_alias) list.push('Virement SPI (BCEAO)');
  list.push('Espèces', 'Chèque', 'Autre');
  return [...new Set(list)];
}

// Lien WhatsApp avec le message déjà écrit. Avec le numéro du client, la conversation s'ouvre directement ;
// un numéro local reçoit l'indicatif du pays de l'entreprise.
export function whatsappLink(phone, message, countryCode) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  const c = countryOf(countryCode);
  if (d && d.length <= c.digits) d = c.dial + d;
  return `https://wa.me/${d.length >= 8 ? d : ''}?text=${encodeURIComponent(message)}`;
}
