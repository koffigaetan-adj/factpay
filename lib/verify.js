import crypto from 'node:crypto';
import { appUrl } from './url.js';

// Vérification d'authenticité des documents émis (facture, devis, avoir).
// Code : 12 caractères sans ambiguïté (ni O/0 ni I/1), affiché XXXX-XXXX-XXXX.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function newVerifyCode() {
  const bytes = crypto.randomBytes(12);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

// Ce que la personne tape ou scanne → forme enregistrée (majuscules, sans tirets ni espaces)
export const normalizeCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);

export const formatCode = (code) => (code || '').match(/.{1,4}/g)?.join('-') || '';

export const verifyUrl = (code) => `${appUrl()}/v/${code}`;

// Empreinte du contenu : numéro, dates, parties, montants et lignes. Le statut n'en fait pas partie
// (une facture payée garde la même empreinte). Un PDF retouché ne correspond plus aux montants affichés en ligne.
export function fingerprint(inv, companyName) {
  const data = JSON.stringify({
    n: inv.number, d: inv.issue_date, e: inv.due_date, t: inv.doc_type || 'facture',
    from: companyName, to: inv.client_name, c: inv.currency,
    ht: inv.subtotal, tva: inv.vat_amount, ttc: inv.total, ret: inv.withholding_amount, net: inv.amount_due,
    l: (inv.lines || []).map((l) => [l.description, l.quantity, l.unit_price, l.amount]),
  });
  return crypto.createHash('sha256').update(data).digest('hex').slice(0, 16).toUpperCase().match(/.{4}/g).join('-');
}
