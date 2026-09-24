// Banques et opérateurs Mobile Money proposés, avec leur logo (dossier public/brands) ou, à défaut,
// une pastille de couleur avec leurs initiales.
// Pour ajouter un logo : déposer l'image dans public/brands/<nom>.png et renseigner « logo » ci-dessous.

export const OPERATORS = {
  'Flooz': { logo: '/brands/flooz.png', color: '#F37021', short: 'FL' },
  'Moov Money': { logo: '/brands/flooz.png', color: '#F37021', short: 'MM' },
  'Mixx by Yas': { logo: '/brands/mixx.png', color: '#1B3F8F', short: 'MX' },
  'MTN MoMo': { color: '#FFCB05', ink: '#1A2433', short: 'MTN' },
  'Orange Money': { color: '#FF7900', short: 'OM' },
  'Wave': { color: '#1DC8F2', short: 'W' },
  'Celtiis Cash': { color: '#6A2C91', short: 'CC' },
  'Free Money': { color: '#CD1719', short: 'FM' },
  'Airtel Money': { color: '#E40000', short: 'AM' },
};

// Banques proposées dans la liste (les autres se saisissent avec « Autre banque… »)
export const BANKS = {
  'Ecobank': { logo: '/brands/ecobank.png', color: '#005B96', short: 'EB' },
  'Orabank': { logo: '/brands/orabank.png', color: '#00843D', short: 'OB' },
  'Coris Bank International': { logo: '/brands/coris.png', color: '#00539F', short: 'CB' },
  'Banque Atlantique': { logo: '/brands/banque-atlantique.png', color: '#E87722', short: 'BA' },
  'Sunu Bank': { logo: '/brands/sunu.png', color: '#C80025', short: 'SB' },
  'Bank of Africa': { logo: '/brands/boa.png', color: '#00843D', short: 'BOA', aliases: ['boa'] },
};

// Autres moyens de paiement
const OTHERS = {
  'SPI': { logo: '/brands/spi.png', color: '#F9B900', ink: '#552D03', short: 'SPI' },
  'Mobile Money': { color: '#5E6878', short: 'MM' },
};

const initials = (name) => String(name || '?').split(/[\s()/-]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

// Apparence d'une banque ou d'un opérateur, connu ou saisi à la main
export function brandOf(name) {
  // Nom tapé à la main (« Ecobank Togo ») : reconnu s'il contient le nom complet ou un mot distinctif (pas « banque »)
  const typed = String(name || '').toLowerCase();
  const generic = ['banque', 'bank', 'money', 'moov'];
  const known = OPERATORS[name] || BANKS[name] || OTHERS[name]
    || Object.entries({ ...OPERATORS, ...BANKS }).find(([k, v]) => {
      const key = k.toLowerCase();
      const first = key.split(' ')[0];
      const words = typed.split(/\s+/);
      return typed.includes(key) || (!generic.includes(first) && words.includes(first)) || (v.aliases || []).some((a) => words.includes(a));
    })?.[1];
  return { logo: known?.logo || null, color: known?.color || '#5E6878', ink: known?.ink || '#FFFFFF', short: known?.short || initials(name) };
}
