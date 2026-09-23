'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { q, one } from '@/lib/db';
import * as auth from '@/lib/auth';
import * as invoices from '@/lib/invoices';
import { sendMail, mailTestMode } from '@/lib/mail';
import { saveFile } from '@/lib/storage';
import { appUrl } from '@/lib/url';
import { CURRENCIES } from '@/lib/money';

// Revient sur une page avec un message (?ok=… ou ?erreur=…)
function back(path, message, error = false) {
  const sep = path.includes('?') ? '&' : '?';
  redirect(`${path}${sep}${error ? 'erreur' : 'ok'}=${encodeURIComponent(message)}`);
}

const text = (fd, key, max = 300) => String(fd.get(key) ?? '').trim().slice(0, max);
const number = (fd, key, { min = 0, max = Infinity, fallback = 0 } = {}) => {
  const n = Number(String(fd.get(key) ?? '').replace(',', '.'));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// ---------- Comptes ----------

export async function signup(fd) {
  const name = text(fd, 'name', 120);
  const email = text(fd, 'email', 200).toLowerCase();
  const password = String(fd.get('password') || '');
  if (!name || !emailOk(email)) back('/inscription', 'Indique ton nom et une adresse e-mail valide.', true);
  if (password.length < 8) back('/inscription', 'Le mot de passe doit faire au moins 8 caractères.', true);
  if (await one('SELECT id FROM users WHERE email = $1', [email])) {
    back('/connexion', 'Un compte existe déjà avec cette adresse. Connecte-toi.', true);
  }
  const user = await one('INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id',
    [email, name, await auth.hashPassword(password)]);
  await auth.startSession(user.id);
  redirect('/bienvenue');
}

export async function login(fd) {
  const email = text(fd, 'email', 200).toLowerCase();
  const password = String(fd.get('password') || '');
  if (await auth.tooManyFailures(email)) back('/connexion', 'Trop d\'essais. Réessaie dans 15 minutes.', true);
  const user = await one('SELECT id, password_hash FROM users WHERE email = $1', [email]);
  if (!user || !(await auth.checkPassword(password, user.password_hash))) {
    await auth.recordFailure(email);
    back('/connexion', 'Adresse e-mail ou mot de passe incorrect.', true);
  }
  await auth.clearFailures(email);
  await auth.startSession(user.id);
  redirect('/tableau-de-bord');
}

export async function logout() {
  await auth.endSession();
  redirect('/connexion');
}

export async function requestPasswordReset(fd) {
  const email = text(fd, 'email', 200).toLowerCase();
  const user = email && await one('SELECT id, name FROM users WHERE email = $1', [email]);
  if (user) {
    const token = await auth.createPasswordReset(user.id);
    await sendMail({
      to: email,
      subject: 'Réinitialiser ton mot de passe',
      text: `Bonjour ${user.name},\n\nPour choisir un nouveau mot de passe, ouvre ce lien (valable 1 heure) :\n${appUrl()}/reinitialiser/${token}\n\nSi tu n'as rien demandé, ignore cet e-mail.`,
    });
  }
  // Même réponse que le compte existe ou non : on ne révèle pas qui est inscrit.
  back('/mot-de-passe-oublie', `Si un compte existe pour cette adresse, un lien vient d'y être envoyé.${mailTestMode() ? ' (mode test : lien affiché dans la console du serveur)' : ''}`);
}

export async function resetPassword(fd) {
  const token = text(fd, 'token', 200);
  const password = String(fd.get('password') || '');
  const reset = await auth.findPasswordReset(token);
  if (!reset) back('/mot-de-passe-oublie', 'Ce lien a expiré ou a déjà servi. Demande-en un nouveau.', true);
  if (password.length < 8) back(`/reinitialiser/${token}`, 'Le mot de passe doit faire au moins 8 caractères.', true);
  await q('UPDATE users SET password_hash = $1 WHERE id = $2', [await auth.hashPassword(password), reset.user_id]);
  await auth.markResetUsed(token);
  await auth.endAllSessions(reset.user_id);
  await auth.startSession(reset.user_id);
  back('/tableau-de-bord', 'Mot de passe changé.');
}

export async function changePassword(fd) {
  const user = await auth.requireUser();
  const row = await one('SELECT password_hash FROM users WHERE id = $1', [user.id]);
  if (!(await auth.checkPassword(String(fd.get('current') || ''), row.password_hash))) {
    back('/parametres', 'Le mot de passe actuel est incorrect.', true);
  }
  const password = String(fd.get('password') || '');
  if (password.length < 8) back('/parametres', 'Le nouveau mot de passe doit faire au moins 8 caractères.', true);
  await q('UPDATE users SET password_hash = $1 WHERE id = $2', [await auth.hashPassword(password), user.id]);
  await auth.endAllSessions(user.id);
  await auth.startSession(user.id);
  back('/parametres', 'Mot de passe changé. Tes autres appareils ont été déconnectés.');
}

// ---------- Entreprise ----------

function companyFields(fd) {
  const currency = String(fd.get('currency'));
  return {
    name: text(fd, 'name', 160),
    address: text(fd, 'address', 400),
    phone: text(fd, 'phone', 60),
    email: text(fd, 'email', 200),
    legal_ids: text(fd, 'legal_ids', 200),
    bank_name: text(fd, 'bank_name', 120),
    iban: text(fd, 'iban', 60),
    bic: text(fd, 'bic', 20),
    mobile_money: text(fd, 'mobile_money', 200),
    currency: CURRENCIES[currency] ? currency : 'XOF',
    show_alt_currency: fd.get('show_alt_currency') === 'on',
    payment_terms: Math.round(number(fd, 'payment_terms', { max: 365, fallback: 14 })),
    default_vat_rate: number(fd, 'default_vat_rate', { max: 100 }),
    tax_reserve_rate: number(fd, 'tax_reserve_rate', { max: 100 }),
    invoice_prefix: (text(fd, 'invoice_prefix', 10).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'FAC'),
    footer_note: text(fd, 'footer_note', 500),
  };
}

export async function saveCompany(fd) {
  const user = await auth.requireUser();
  const c = companyFields(fd);
  const from = fd.get('from') === 'parametres' ? '/parametres' : '/bienvenue';
  if (!c.name) back(from, 'Le nom de l\'entreprise est obligatoire.', true);
  const keys = Object.keys(c);
  const existing = await one('SELECT id FROM companies WHERE owner_id = $1', [user.id]);
  if (existing) {
    await q(`UPDATE companies SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE owner_id = $${keys.length + 1}`,
      [...Object.values(c), user.id]);
  } else {
    await q(`INSERT INTO companies (owner_id, ${keys.join(', ')}) VALUES ($1, ${keys.map((_, i) => `$${i + 2}`).join(', ')})`,
      [user.id, ...Object.values(c)]);
  }
  revalidatePath('/', 'layout');
  if (from === '/parametres') back('/parametres', 'Informations enregistrées.');
  back('/tableau-de-bord', 'Ton compte est prêt. Ajoute ton premier client, puis crée ta première facture.');
}

// ---------- Clients ----------

function clientFields(fd) {
  return { name: text(fd, 'name', 160), email: text(fd, 'email', 200), phone: text(fd, 'phone', 60), address: text(fd, 'address', 400) };
}

export async function createClient(fd) {
  const { company } = await auth.requireCompany();
  const c = clientFields(fd);
  const next = fd.get('next') === 'facture' ? '/factures/nouvelle' : '/clients';
  if (!c.name || !emailOk(c.email)) back(next, 'Indique le nom du client et une adresse e-mail valide.', true);
  await q('INSERT INTO clients (company_id, name, email, phone, address) VALUES ($1, $2, $3, $4, $5)',
    [company.id, c.name, c.email, c.phone, c.address]);
  back(next, `Client « ${c.name} » ajouté.`);
}

export async function updateClient(fd) {
  const { company } = await auth.requireCompany();
  const id = Number(fd.get('id'));
  const c = clientFields(fd);
  if (!c.name || !emailOk(c.email)) back(`/clients/${id}`, 'Indique le nom du client et une adresse e-mail valide.', true);
  await q('UPDATE clients SET name = $1, email = $2, phone = $3, address = $4 WHERE id = $5 AND company_id = $6',
    [c.name, c.email, c.phone, c.address, id, company.id]);
  back('/clients', 'Client mis à jour.');
}

export async function deleteClient(fd) {
  const { company } = await auth.requireCompany();
  const id = Number(fd.get('id'));
  const used = await one('SELECT 1 FROM invoices WHERE client_id = $1 LIMIT 1', [id]);
  if (used) back(`/clients/${id}`, 'Ce client a des factures : il ne peut pas être supprimé.', true);
  await q('DELETE FROM clients WHERE id = $1 AND company_id = $2', [id, company.id]);
  back('/clients', 'Client supprimé.');
}

// ---------- Factures ----------

export async function saveInvoice(fd) {
  const { company } = await auth.requireCompany();
  const id = Number(fd.get('id')) || null;
  const intent = String(fd.get('intent'));
  let lines = [];
  try { lines = invoices.cleanLines(JSON.parse(String(fd.get('lines') || '[]'))); } catch { /* lignes invalides */ }
  const sendOn = intent === 'programmer' ? text(fd, 'send_on', 10) : '';
  if (intent === 'programmer' && !/^\d{4}-\d{2}-\d{2}$/.test(sendOn)) {
    back(id ? `/factures/${id}/modifier` : '/factures/nouvelle', 'Choisis la date d\'envoi.', true);
  }

  let invoiceId;
  try {
    invoiceId = await invoices.saveDraft(company, {
      id, client_id: fd.get('client_id'), title: text(fd, 'title', 200), lines,
      vat_rate: number(fd, 'vat_rate', { max: 100 }), notes: text(fd, 'notes', 1000), send_on: sendOn,
    });
  } catch (err) {
    back(id ? `/factures/${id}/modifier` : '/factures/nouvelle', err.message, true);
  }

  if (intent === 'envoyer') {
    const r = await invoices.sendInvoice(company, invoiceId);
    revalidatePath('/', 'layout');
    if (!r.ok) back(`/factures/${invoiceId}`, `Facture ${r.invoice.number} émise, mais l'envoi a échoué : ${r.error}`, true);
    back(`/factures/${invoiceId}`, `Facture ${r.invoice.number} envoyée à ${r.invoice.client_email}.${mailTestMode() ? ' (mode test : e-mail affiché dans la console)' : ''}`);
  }
  revalidatePath('/', 'layout');
  back(`/factures/${invoiceId}`, intent === 'programmer' ? 'Envoi programmé.' : 'Brouillon enregistré.');
}

export async function sendInvoiceNow(fd) {
  const { company } = await auth.requireCompany();
  const id = Number(fd.get('id'));
  const exists = await one('SELECT id FROM invoices WHERE id = $1 AND company_id = $2', [id, company.id]);
  if (!exists) back('/factures', 'Facture introuvable.', true);
  const r = await invoices.sendInvoice(company, id);
  revalidatePath('/', 'layout');
  if (!r.ok) back(`/factures/${id}`, `L'envoi a échoué : ${r.error}`, true);
  back(`/factures/${id}`, `Facture ${r.invoice.number} envoyée à ${r.invoice.client_email}.${mailTestMode() ? ' (mode test : e-mail affiché dans la console)' : ''}`);
}

export async function confirmInvoicePayment(fd) {
  const { company } = await auth.requireCompany();
  const id = Number(fd.get('id'));
  await invoices.confirmPayment(company.id, id);
  revalidatePath('/', 'layout');
  back(`/factures/${id}`, 'Paiement confirmé.');
}

export async function deleteInvoice(fd) {
  const { company } = await auth.requireCompany();
  await invoices.deleteDraft(company.id, Number(fd.get('id')));
  revalidatePath('/', 'layout');
  back('/factures', 'Brouillon supprimé.');
}

// ---------- Côté client de la facture (page publique, lien secret) ----------

const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/gif', 'application/pdf'];
const MAX_BYTES = 4 * 1024 * 1024;

export async function declarePayment(fd) {
  const token = text(fd, 'token', 100);
  const page = `/f/${token}`;
  const found = await invoices.getInvoiceByToken(token);
  if (!found) redirect('/');
  if (!['emise', 'envoyee'].includes(found.invoice.status)) redirect(page);

  const reference = text(fd, 'reference', 120);
  const file = fd.get('justificatif');
  if (!reference) back(page, 'Indiquez la référence du paiement.', true);
  if (!file || typeof file === 'string' || !file.size) back(page, 'Joignez une image ou un PDF du paiement.', true);
  if (!ALLOWED.includes(file.type)) back(page, 'Le justificatif doit être une image ou un PDF.', true);
  if (file.size > MAX_BYTES) back(page, 'Le fichier dépasse 4 Mo.', true);

  const proofKey = await saveFile(file);
  await invoices.declarePayment(token, { reference, proofKey, proofName: file.name.slice(0, 200), proofMime: file.type });
  revalidatePath(page);
  redirect(page);
}
