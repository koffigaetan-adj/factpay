// Nettoyage des champs numériques pendant la frappe : les lettres et symboles sont retirés aussitôt.

// Nombre entier : chiffres seulement (jours, délais…)
export const digitsOnly = (v) => String(v ?? '').replace(/\D/g, '');

// Nombre décimal : chiffres et un seul séparateur (virgule ou point), comme « 7,5 » ou « 1250.50 »
export function decimalOnly(v) {
  let seen = false;
  return String(v ?? '').replace(/[^\d.,]/g, '').replace(/[.,]/g, (sep) => {
    if (seen) return '';
    seen = true;
    return sep;
  });
}

// Liste de nombres entiers séparés par des virgules (« 3, 10, 15 »)
export const digitListOnly = (v) => String(v ?? '').replace(/[^\d,\s]/g, '');

// Numéro de téléphone : chiffres et espaces
export const phoneDigits = (v) => String(v ?? '').replace(/[^\d\s]/g, '');

// Pour les champs non pilotés (defaultValue) : filtre appliqué directement à chaque frappe
export const filterInput = (clean) => (e) => {
  const next = clean(e.target.value);
  if (next !== e.target.value) e.target.value = next;
};
