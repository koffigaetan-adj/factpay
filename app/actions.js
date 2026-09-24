'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { q, one } from '@/lib/db';
import * as auth from '@/lib/auth';
import * as invoices from '@/lib/invoices';
import { sendMail, mailTestMode } from '@/lib/mail';
import { verifyEmail, resetPasswordEmail, changeEmailEmail, loginCodeEmail, securityNoticeEmail, withImages } from '@/lib/emails';
import * as twofa from '@/lib/twofa';
import { newSecret, verifyCode } from '@/lib/totp';
import { saveFile, deleteFile } from '@/lib/storage';
import { appUrl } from '@/lib/url';
import { CURRENCIES, fixedRate } from '@/lib/money';
import { passwordProblem } from '@/lib/password';
import { cleanPeriod, periodHours } from '@/lib/period';
import * as documents from '@/lib/documents';
import * as accountant from '@/lib/accountant';
import { COUNTRIES, cleanMobiles } from '@/lib/payment';

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

// Envoie le lien de confirmation de l'adresse e-mail
async function sendVerification(user) {
  const token = await auth.createEmailVerification(user.id);
  await sendMail({ to: user.email, ...(await withImages(verifyEmail(user.first_name || user.name, `${appUrl()}/confirmer/${token}`))) });
}

export async function signup(fd) {
  const firstName = text(fd, 'first_name', 60);
  const lastName = text(fd, 'last_name', 60);
  const email = text(fd, 'email', 200).toLowerCase();
  const password = String(fd.get('password') || '');
  if (!firstName || !lastName) back('/inscription', 'Indique ton prénom et ton nom.', true);
  if (fd.get('terms') !== 'on') back('/inscription', "Accepte les conditions d'utilisation et la politique de confidentialité pour créer ton compte.", true);
  if (!emailOk(email)) back('/inscription', 'Indique une adresse e-mail valide.', true);
  const weak = passwordProblem(password, String(fd.get('confirm') || ''));
  if (weak) back('/inscription', weak, true);
  if (await one('SELECT id FROM users WHERE email = $1', [email])) {
    back('/connexion', 'Un compte existe déjà avec cette adresse. Connecte-toi.', true);
  }
  const name = `${firstName} ${lastName}`;
  const user = await one(`INSERT INTO users (email, name, first_name, last_name, password_hash, terms_accepted_at)
    VALUES ($1, $2, $3, $4, $5, now()) RETURNING id`, [email, name, firstName, lastName, await auth.hashPassword(password)]);
  await auth.startSession(user.id);
  try {
    await sendVerification({ id: user.id, email, first_name: firstName });
  } catch (err) {
    console.error('Lien de confirmation non envoyé :', err.message);
    back('/confirmer-email', "L'e-mail de confirmation n'a pas pu partir. Clique sur « Renvoyer le lien ».", true);
  }
  if (mailTestMode()) back('/confirmer-email', 'Mode test : le lien de confirmation est affiché dans la console du serveur.');
  redirect('/confirmer-email');
}

export async function resendVerification() {
  const user = await auth.currentUser();
  if (!user) redirect('/connexion');
  if (user.email_verified_at) redirect('/tableau-de-bord');
  if (await auth.verificationSentRecently(user.id)) back('/confirmer-email', "Un lien vient de partir. Attends une minute avant d'en demander un autre.", true);
  try {
    await sendVerification(user);
  } catch (err) {
    back('/confirmer-email', `L'envoi a échoué : ${err.message}`, true);
  }
  back('/confirmer-email', `Nouveau lien envoyé à ${user.email}.${mailTestMode() ? ' (mode test : lien affiché dans la console du serveur)' : ''}`);
}

export async function login(fd) {
  const email = text(fd, 'email', 200).toLowerCase();
  const password = String(fd.get('password') || '');
  if (await auth.tooManyFailures(email)) back('/connexion', 'Trop d\'essais. Réessaie dans 15 minutes.', true);
  const user = await one('SELECT id, email, name, first_name, password_hash, twofa_method FROM users WHERE email = $1', [email]);
  if (!user || !(await auth.checkPassword(password, user.password_hash))) {
    await auth.recordFailure(email);
    back('/connexion', 'Adresse e-mail ou mot de passe incorrect.', true);
  }
  await auth.clearFailures(email);
  await openSessionOrAsk2fa(user);
}

// ---------- Double authentification ----------

const PENDING = 'login_2fa';

// Sans double authentification : session ouverte. Avec : on demande le second code.
async function openSessionOrAsk2fa(user, then = '/tableau-de-bord') {
  if (!user.twofa_method) {
    await auth.startSession(user.id);
    redirect(then);
  }
  const { token, emailCode } = await twofa.createChallenge(user);
  (await cookies()).set(PENDING, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 600 });
  if (emailCode) {
    try {
      await sendMail({ to: user.email, ...(await withImages(loginCodeEmail(user.first_name || user.name, emailCode))) });
    } catch (err) {
      back('/connexion/verification', `Le code n'a pas pu partir : ${err.message}. Clique sur « Renvoyer le code ».`, true);
    }
  }
  redirect('/connexion/verification');
}

export async function verifyLogin(fd) {
  const jar = await cookies();
  const token = jar.get(PENDING)?.value;
  const r = await twofa.verifyChallenge(token, text(fd, 'code', 20));
  if (r.expired) {
    jar.delete(PENDING);
    back('/connexion', 'La vérification a expiré ou a échoué trop de fois. Reconnecte-toi.', true);
  }
  if (!r.ok) back('/connexion/verification', `Code incorrect. Encore ${r.left} essai${r.left > 1 ? 's' : ''}.`, true);
  jar.delete(PENDING);
  await auth.startSession(r.userId);
  if (r.usedBackup) back('/parametres?onglet=securite', 'Connecté avec un code de secours : il ne servira plus. Pense à en générer de nouveaux s\'il t\'en reste peu.');
  redirect('/tableau-de-bord');
}

export async function resendLoginCode() {
  const token = (await cookies()).get(PENDING)?.value;
  const ch = token && await twofa.findChallenge(token);
  if (!ch) back('/connexion', 'La vérification a expiré. Reconnecte-toi.', true);
  const code = await twofa.renewEmailCode(token);
  if (!code) back('/connexion/verification', 'Un code vient de partir. Attends 30 secondes avant d\'en demander un autre.', true);
  try {
    await sendMail({ to: ch.email, ...(await withImages(loginCodeEmail(ch.first_name || ch.name, code))) });
  } catch (err) {
    back('/connexion/verification', `Le code n'a pas pu partir : ${err.message}`, true);
  }
  back('/connexion/verification', `Nouveau code envoyé à ${ch.email}.${mailTestMode() ? ' (mode test : code affiché dans la console)' : ''}`);
}

// Vérifie le mot de passe du compte connecté avant un changement de sécurité
async function requirePassword(fd, user, tab = '/parametres?onglet=securite') {
  const row = await one('SELECT password_hash FROM users WHERE id = $1', [user.id]);
  if (!(await auth.checkPassword(String(fd.get('password') || ''), row.password_hash))) back(tab, 'Mot de passe incorrect.', true);
}

// Codes de secours affichés une seule fois, juste après leur création
async function showBackupCodesOnce(codes) {
  (await cookies()).set('backup_codes_once', codes.join(' '), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/parametres', maxAge: 600 });
}

async function notifySecurity(user, what) {
  await sendMail({ to: user.email, ...(await withImages(securityNoticeEmail(user.first_name || user.name, what))) })
    .catch((e) => console.error('Alerte de sécurité non envoyée :', e.message));
}

export async function enableEmail2fa(fd) {
  const user = await auth.requireUser();
  await requirePassword(fd, user);
  const { codes, hashes } = twofa.newBackupCodes();
  await q(`UPDATE users SET twofa_method = 'email', totp_secret = NULL, totp_pending = NULL, backup_codes = $1 WHERE id = $2`, [JSON.stringify(hashes), user.id]);
  await showBackupCodesOnce(codes);
  await notifySecurity(user, 'Double authentification activée (code par e-mail)');
  back('/parametres?onglet=securite', 'Double authentification activée : un code te sera envoyé par e-mail à chaque connexion.');
}

// Étape 1 de l'application : un nouveau secret, montré en QR code, en attente de confirmation
export async function startTotpSetup(fd) {
  const user = await auth.requireUser();
  await requirePassword(fd, user);
  await q('UPDATE users SET totp_pending = $1 WHERE id = $2', [twofa.encrypt(newSecret()), user.id]);
  redirect('/parametres?onglet=securite&etape=application');
}

// Étape 2 : le premier code de l'application prouve que le QR code a bien été scanné
export async function confirmTotpSetup(fd) {
  const user = await auth.requireUser();
  const row = await one('SELECT totp_pending FROM users WHERE id = $1', [user.id]);
  if (!row.totp_pending) back('/parametres?onglet=securite', 'Recommence la configuration de l\'application.', true);
  const step = verifyCode(twofa.decrypt(row.totp_pending), text(fd, 'code', 10));
  if (step === null) back('/parametres?onglet=securite&etape=application', 'Code incorrect. Vérifie l\'heure de ton téléphone et réessaie avec le code affiché.', true);
  const { codes, hashes } = twofa.newBackupCodes();
  await q(`UPDATE users SET twofa_method = 'totp', totp_secret = totp_pending, totp_pending = NULL, totp_last_step = $1, backup_codes = $2 WHERE id = $3`,
    [step, JSON.stringify(hashes), user.id]);
  await showBackupCodesOnce(codes);
  await notifySecurity(user, 'Double authentification activée (application)');
  back('/parametres?onglet=securite', 'Double authentification activée : ton application te donnera un code à chaque connexion.');
}

export async function newBackupCodes(fd) {
  const user = await auth.requireUser();
  await requirePassword(fd, user);
  const { codes, hashes } = twofa.newBackupCodes();
  await q('UPDATE users SET backup_codes = $1 WHERE id = $2', [JSON.stringify(hashes), user.id]);
  await showBackupCodesOnce(codes);
  back('/parametres?onglet=securite', 'Nouveaux codes de secours créés. Les anciens ne marchent plus.');
}

export async function hideBackupCodes() {
  (await cookies()).delete({ name: 'backup_codes_once', path: '/parametres' });
  redirect('/parametres?onglet=securite');
}

export async function disable2fa(fd) {
  const user = await auth.requireUser();
  await requirePassword(fd, user);
  await q(`UPDATE users SET twofa_method = '', totp_secret = NULL, totp_pending = NULL, backup_codes = '[]' WHERE id = $1`, [user.id]);
  await notifySecurity(user, 'Double authentification désactivée');
  back('/parametres?onglet=securite', 'Double authentification désactivée.');
}

export async function logout() {
  await auth.endSession();
  redirect('/connexion');
}

export async function requestPasswordReset(fd) {
  const email = text(fd, 'email', 200).toLowerCase();
  const user = email && await one('SELECT id, name, first_name FROM users WHERE email = $1', [email]);
  if (user) {
    const token = await auth.createPasswordReset(user.id);
    await sendMail({ to: email, ...(await withImages(resetPasswordEmail(user.first_name || user.name, `${appUrl()}/reinitialiser/${token}`))) });
  }
  // Même réponse que le compte existe ou non : on ne révèle pas qui est inscrit.
  back('/mot-de-passe-oublie', `Si un compte existe pour cette adresse, un lien vient d'y être envoyé.${mailTestMode() ? ' (mode test : lien affiché dans la console du serveur)' : ''}`);
}

export async function resetPassword(fd) {
  const token = text(fd, 'token', 200);
  const password = String(fd.get('password') || '');
  const reset = await auth.findPasswordReset(token);
  if (!reset) back('/mot-de-passe-oublie', 'Ce lien a expiré ou a déjà servi. Demande-en un nouveau.', true);
  const weak = passwordProblem(password, String(fd.get('confirm') || ''));
  if (weak) back(`/reinitialiser/${token}`, weak, true);
  // Le lien reçu par e-mail prouve aussi que l'adresse est la bonne
  await q('UPDATE users SET password_hash = $1, email_verified_at = coalesce(email_verified_at, now()) WHERE id = $2',
    [await auth.hashPassword(password), reset.user_id]);
  await auth.markResetUsed(token);
  await auth.endAllSessions(reset.user_id);
  // Un mot de passe oublié ne dispense pas du second code
  const user = await one('SELECT id, email, name, first_name, twofa_method FROM users WHERE id = $1', [reset.user_id]);
  if (user.twofa_method) await openSessionOrAsk2fa(user);
  await auth.startSession(reset.user_id);
  back('/tableau-de-bord', 'Mot de passe changé.');
}

export async function changePassword(fd) {
  const user = await auth.requireUser();
  const row = await one('SELECT password_hash FROM users WHERE id = $1', [user.id]);
  if (!(await auth.checkPassword(String(fd.get('current') || ''), row.password_hash))) {
    back('/parametres?onglet=compte', 'Le mot de passe actuel est incorrect.', true);
  }
  const password = String(fd.get('password') || '');
  const weak = passwordProblem(password, String(fd.get('confirm') || ''));
  if (weak) back('/parametres?onglet=compte', weak, true);
  await q('UPDATE users SET password_hash = $1 WHERE id = $2', [await auth.hashPassword(password), user.id]);
  await auth.endAllSessions(user.id);
  await auth.startSession(user.id);
  back('/parametres?onglet=compte', 'Mot de passe changé. Tes autres appareils ont été déconnectés.');
}

// ---------- Entreprise ----------

// Champs de l'entreprise, par rubrique : un formulaire n'enregistre que les rubriques qu'il contient
const SECTIONS = ['entreprise', 'paiement', 'factures'];
function companyFields(fd, sections) {
  const c = {};
  if (sections.includes('entreprise')) {
    Object.assign(c, {
      name: text(fd, 'name', 160),
      address: text(fd, 'address', 400),
      phone: text(fd, 'phone', 60),
      email: text(fd, 'email', 200),
      legal_ids: text(fd, 'legal_ids', 200),
      country: COUNTRIES[fd.get('country')] ? String(fd.get('country')) : 'TG',
    });
  }
  if (sections.includes('paiement')) {
    Object.assign(c, {
      bank_name: text(fd, 'bank_name', 120),
      iban: text(fd, 'iban', 60),
      bic: text(fd, 'bic', 20),
      mobile_money: text(fd, 'mobile_money', 200),
      spi_alias: text(fd, 'spi_alias', 100),
    });
  }
  if (sections.includes('factures')) {
    const currency = String(fd.get('currency'));
    Object.assign(c, {
      currency: CURRENCIES[currency] ? currency : 'XOF',
      show_alt_currency: fd.get('show_alt_currency') === 'on',
      payment_terms: Math.round(number(fd, 'payment_terms', { max: 365, fallback: 14 })),
      default_vat_rate: number(fd, 'default_vat_rate', { max: 100 }),
      tax_reserve_rate: number(fd, 'tax_reserve_rate', { max: 100 }),
      invoice_prefix: (text(fd, 'invoice_prefix', 10).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'FAC'),
      footer_note: text(fd, 'footer_note', 500),
      reminders_enabled: fd.get('reminders_enabled') === 'on',
      reminder_days: String(fd.get('reminder_days') || '').split(/[^\d]+/).map(Number).filter((n) => n > 0 && n <= 365).slice(0, 5).join(',') || '3,10',
      quote_prefix: (text(fd, 'quote_prefix', 10).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'DEV'),
      quote_validity: Math.round(number(fd, 'quote_validity', { min: 1, max: 365, fallback: 30 })),
    });
  }
  return c;
}

// Logo : PNG ou JPEG (les formats que le PDF sait afficher), 1 Mo au plus
const LOGO_TYPES = ['image/png', 'image/jpeg'];
async function saveLogo(fd, userId, from) {
  if (fd.get('remove_logo') === 'on') {
    await q('UPDATE companies SET logo_key = NULL, logo_mime = NULL, logo_updated_at = now() WHERE owner_id = $1', [userId]);
    return;
  }
  const file = fd.get('logo');
  if (!file || typeof file === 'string' || !file.size) return;
  if (!LOGO_TYPES.includes(file.type)) back(from, 'Le logo doit être une image PNG ou JPEG.', true);
  if (file.size > 1024 * 1024) back(from, 'Le logo dépasse 1 Mo. Réduis sa taille et réessaie.', true);
  const key = await saveFile(file, 'logos');
  await q('UPDATE companies SET logo_key = $1, logo_mime = $2, logo_updated_at = now() WHERE owner_id = $3', [key, file.type, userId]);
}

export async function saveCompany(fd) {
  const user = await auth.requireUser();
  const sections = fd.getAll('sections').map(String).filter((x) => SECTIONS.includes(x));
  const c = companyFields(fd, sections);
  const inSettings = fd.get('from') === 'parametres';
  const from = inSettings ? `/parametres?onglet=${sections[0] || 'entreprise'}` : '/bienvenue';
  const existing = await one('SELECT id, country FROM companies WHERE owner_id = $1', [user.id]);
  if ((sections.includes('entreprise') || !existing) && !c.name) back(from, "Le nom de l'entreprise est obligatoire.", true);
  if (sections.includes('paiement')) {
    let rawMobiles = [];
    try { rawMobiles = JSON.parse(String(fd.get('mobile_accounts') || '[]')); } catch { /* liste invalide */ }
    // Les numéros suivent le pays de l'entreprise (rubrique Entreprise, ou déjà enregistré)
    const mobiles = cleanMobiles(rawMobiles, c.country || existing?.country || 'TG');
    if (mobiles.error) back(from, mobiles.error, true);
    c.mobile_accounts = JSON.stringify(mobiles.list);
  }
  const keys = Object.keys(c);
  if (existing && keys.length) {
    await q(`UPDATE companies SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')} WHERE owner_id = $${keys.length + 1}`,
      [...Object.values(c), user.id]);
  } else if (!existing) {
    await q(`INSERT INTO companies (owner_id, ${keys.join(', ')}) VALUES ($1, ${keys.map((_, i) => `$${i + 2}`).join(', ')})`,
      [user.id, ...Object.values(c)]);
  }
  if (sections.includes('entreprise')) await saveLogo(fd, user.id, from);
  revalidatePath('/', 'layout');
  if (inSettings) back(from, 'Modifications enregistrées.');
  back('/tableau-de-bord', 'Ton compte est prêt. Ajoute ton premier client, puis crée ta première facture.');
}

// Changement d'adresse : un lien part à la nouvelle adresse, qui ne remplace l'ancienne qu'une fois confirmée
export async function requestEmailChange(fd) {
  const user = await auth.requireUser();
  const email = text(fd, 'email', 200).toLowerCase();
  const tab = '/parametres?onglet=compte';
  if (!emailOk(email)) back(tab, 'Indique une adresse e-mail valide.', true);
  if (email === user.email) back(tab, "C'est déjà ton adresse.", true);
  const row = await one('SELECT password_hash FROM users WHERE id = $1', [user.id]);
  if (!(await auth.checkPassword(String(fd.get('password') || ''), row.password_hash))) back(tab, 'Mot de passe incorrect.', true);
  if (await one('SELECT 1 FROM users WHERE email = $1', [email])) back(tab, 'Cette adresse est déjà utilisée par un autre compte.', true);
  const token = await auth.createEmailVerification(user.id, email);
  try {
    await sendMail({ to: email, ...(await withImages(changeEmailEmail(user.first_name || user.name, `${appUrl()}/confirmer/${token}`))) });
  } catch (err) {
    back(tab, `Le lien n'a pas pu partir : ${err.message}`, true);
  }
  back(tab, `Lien de confirmation envoyé à ${email}. Ton adresse changera quand tu l'auras ouvert.${mailTestMode() ? ' (mode test : lien affiché dans la console)' : ''}`);
}

// Suppression du compte et de toutes ses données (entreprise, clients, factures)
export async function deleteAccount(fd) {
  const user = await auth.requireUser();
  const tab = '/parametres?onglet=compte';
  if (text(fd, 'confirm_word', 20).toUpperCase() !== 'SUPPRIMER') back(tab, 'Tape SUPPRIMER pour confirmer.', true);
  const row = await one('SELECT password_hash FROM users WHERE id = $1', [user.id]);
  if (!(await auth.checkPassword(String(fd.get('password') || ''), row.password_hash))) back(tab, 'Mot de passe incorrect.', true);
  await auth.endSession();
  await q('DELETE FROM users WHERE id = $1', [user.id]);
  redirect('/?compte=supprime');
}

// Apparence : automatique (appareil), claire ou sombre. Gardée un an dans ce navigateur.
export async function setTheme(fd) {
  const theme = ['light', 'dark'].includes(fd.get('theme')) ? String(fd.get('theme')) : 'auto';
  const jar = await cookies();
  if (theme === 'auto') jar.delete('theme');
  else jar.set('theme', theme, { path: '/', maxAge: 365 * 86400, sameSite: 'lax' });
  revalidatePath('/', 'layout');
  back('/parametres?onglet=apparence', 'Apparence enregistrée.');
}

// Photo de profil : PNG, JPEG ou WebP, 1 Mo au plus ; ou retour à l'icône par défaut
export async function saveAvatar(fd) {
  const user = await auth.requireUser();
  const tab = '/parametres?onglet=compte';
  const old = await one('SELECT avatar_key FROM users WHERE id = $1', [user.id]);
  if (fd.get('remove') === '1') {
    await q('UPDATE users SET avatar_key = NULL, avatar_mime = NULL, avatar_updated_at = now() WHERE id = $1', [user.id]);
    if (old?.avatar_key) await deleteFile(old.avatar_key);
    revalidatePath('/', 'layout');
    back(tab, "Photo supprimée. L'icône par défaut est revenue.");
  }
  const file = fd.get('avatar');
  if (!file || typeof file === 'string' || !file.size) back(tab, 'Choisis une photo.', true);
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) back(tab, 'La photo doit être une image PNG, JPEG ou WebP.', true);
  if (file.size > 1024 * 1024) back(tab, 'La photo dépasse 1 Mo. Réduis sa taille et réessaie.', true);
  const key = await saveFile(file, 'avatars');
  await q('UPDATE users SET avatar_key = $1, avatar_mime = $2, avatar_updated_at = now() WHERE id = $3', [key, file.type, user.id]);
  if (old?.avatar_key) await deleteFile(old.avatar_key);
  revalidatePath('/', 'layout');
  back(tab, 'Photo de profil mise à jour.');
}

// Prénom et nom du compte (onglet Mon compte)
export async function updateProfile(fd) {
  const user = await auth.requireUser();
  const firstName = text(fd, 'first_name', 60);
  const lastName = text(fd, 'last_name', 60);
  if (!firstName || !lastName) back('/parametres?onglet=compte', 'Indique ton prénom et ton nom.', true);
  await q('UPDATE users SET first_name = $1, last_name = $2, name = $3 WHERE id = $4', [firstName, lastName, `${firstName} ${lastName}`, user.id]);
  revalidatePath('/', 'layout');
  back('/parametres?onglet=compte', 'Profil mis à jour.');
}

// ---------- Clients ----------

function clientFields(fd) {
  return { name: text(fd, 'name', 160), email: text(fd, 'email', 200), phone: text(fd, 'phone', 60), address: text(fd, 'address', 400) };
}

export async function createClient(fd) {
  const { company } = await auth.requireCompany();
  const c = clientFields(fd);
  const next = { facture: '/factures/nouvelle', devis: '/devis/nouveau' }[fd.get('next')] || '/clients';
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
  back(`/clients/${id}`, 'Client mis à jour.');
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
  const docType = fd.get('doc_type') === 'devis' ? 'devis' : 'facture';
  const word = docType === 'devis' ? 'Devis' : 'Facture';
  const formPath = id ? `/factures/${id}/modifier` : docType === 'devis' ? '/devis/nouveau' : '/factures/nouvelle';
  const intent = docType === 'devis' && fd.get('intent') === 'programmer' ? 'brouillon' : String(fd.get('intent'));
  let lines = [];
  try { lines = invoices.cleanLines(JSON.parse(String(fd.get('lines') || '[]'))); } catch { /* lignes invalides */ }
  // Période travaillée : les heures de la ligne « période » sont recalculées ici, pas reprises du navigateur
  let period = null;
  try { period = cleanPeriod(JSON.parse(String(fd.get('period') || 'null'))); } catch { /* période invalide */ }
  lines = lines
    .map((l) => (l.kind !== 'period' ? l : period ? { ...l, quantity: periodHours(period), unit: 'heure(s)' } : { ...l, kind: 'service' }))
    .filter((l) => l.quantity);
  const sendOn = intent === 'programmer' ? text(fd, 'send_on', 10) : '';
  if (intent === 'programmer' && !/^\d{4}-\d{2}-\d{2}$/.test(sendOn)) {
    back(formPath, 'Choisis la date d\'envoi.', true);
  }

  // Devise de la facture, et seconde devise facultative avec son taux (fixe pour € / F CFA, saisi sinon)
  const currency = CURRENCIES[fd.get('currency')] ? String(fd.get('currency')) : company.currency;
  const alt = CURRENCIES[fd.get('alt_currency')] && fd.get('alt_currency') !== currency ? String(fd.get('alt_currency')) : null;
  const altRate = alt ? (fixedRate(currency, alt) ?? number(fd, 'alt_rate')) : null;
  if (alt && !(altRate > 0)) {
    back(formPath, `Indique le taux de change : 1 ${currency} = combien de ${alt} ?`, true);
  }

  let invoiceId;
  try {
    invoiceId = await invoices.saveDraft(company, {
      id, client_id: fd.get('client_id'), title: text(fd, 'title', 200), lines,
      currency, alt_currency: alt, alt_rate: altRate,
      vat_rate: number(fd, 'vat_rate', { max: 100 }),
      withholding_rate: number(fd, 'withholding_rate', { max: 100 }),
      withholding_label: text(fd, 'withholding_label', 80) || 'Retenue à la source',
      period,
      notes: text(fd, 'notes', 1000), send_on: sendOn, doc_type: docType,
    });
  } catch (err) {
    back(formPath, err.message, true);
  }

  if (intent === 'envoyer') {
    const r = await invoices.sendInvoice(company, invoiceId);
    revalidatePath('/', 'layout');
    if (!r.ok) back(`/factures/${invoiceId}`, `${word} ${r.invoice.number} émis${docType === 'facture' ? 'e' : ''}, mais l'envoi a échoué : ${r.error}`, true);
    back(`/factures/${invoiceId}`, `${word} ${r.invoice.number} envoyé${docType === 'facture' ? 'e' : ''} à ${r.invoice.client_email}.${mailTestMode() ? ' (mode test : e-mail affiché dans la console)' : ''}`);
  }
  revalidatePath('/', 'layout');
  back(`/factures/${invoiceId}`, intent === 'programmer' ? 'Envoi programmé.' : 'Brouillon enregistré.');
}

export async function sendInvoiceNow(fd) {
  const { company } = await auth.requireCompany();
  const id = Number(fd.get('id'));
  const exists = await one('SELECT id, status FROM invoices WHERE id = $1 AND company_id = $2', [id, company.id]);
  if (!exists) back('/factures', 'Document introuvable.', true);
  if (['payee', 'annulee', 'acceptee', 'refusee', 'convertie'].includes(exists.status)) back(`/factures/${id}`, 'Ce document ne peut plus être envoyé.', true);
  const r = await invoices.sendInvoice(company, id);
  revalidatePath('/', 'layout');
  if (!r.ok) back(`/factures/${id}`, `L'envoi a échoué : ${r.error}`, true);
  back(`/factures/${id}`, `${r.invoice.number} envoyé à ${r.invoice.client_email}.${mailTestMode() ? ' (mode test : e-mail affiché dans la console)' : ''}`);
}

// Relance à la main d'une facture en attente
export async function remindNow(fd) {
  const { company } = await auth.requireCompany();
  const id = Number(fd.get('id'));
  const r = await invoices.sendReminder(company, id);
  revalidatePath(`/factures/${id}`);
  if (!r.ok) back(`/factures/${id}`, `La relance n'est pas partie : ${r.error}`, true);
  back(`/factures/${id}`, `Relance envoyée à ${r.invoice.client_email}.${mailTestMode() ? ' (mode test : e-mail affiché dans la console)' : ''}`);
}

// Copie une facture ou un devis en nouveau brouillon (la période passe au mois suivant)
export async function duplicateDocument(fd) {
  const { company } = await auth.requireCompany();
  const newId = await invoices.duplicate(company, Number(fd.get('id')));
  if (!newId) back('/factures', 'Document introuvable.', true);
  revalidatePath('/', 'layout');
  back(`/factures/${newId}/modifier`, 'Copie créée en brouillon. Vérifie-la, puis envoie-la.');
}

// Devis accepté (ou non) → brouillon de facture
export async function convertQuote(fd) {
  const { company } = await auth.requireCompany();
  const id = Number(fd.get('id'));
  const newId = await invoices.convertQuote(company, id);
  if (!newId) back(`/factures/${id}`, 'Ce devis ne peut pas être transformé en facture.', true);
  revalidatePath('/', 'layout');
  back(`/factures/${newId}/modifier`, 'Facture créée à partir du devis. Vérifie-la, puis envoie-la.');
}

export async function confirmInvoicePayment(fd) {
  const { company } = await auth.requireCompany();
  const id = Number(fd.get('id'));
  const notify = fd.get('notify') === 'on';
  const r = await invoices.confirmPayment(company, id, {
    paidOn: text(fd, 'paid_on', 10),
    method: text(fd, 'method', 60),
    reference: text(fd, 'reference', 120),
    notify,
  });
  revalidatePath('/', 'layout');
  if (!r.confirmed) back(`/factures/${id}`, 'Cette facture ne peut pas être marquée payée.', true);
  if (r.skipped) back(`/factures/${id}`, "Facture marquée payée. Le client n'a pas été prévenu.");
  if (!r.sent) back(`/factures/${id}`, `Facture marquée payée, mais la facture payée n'est pas partie : ${r.error}. Clique sur « Renvoyer la facture payée ».`, true);
  back(`/factures/${id}`, `Facture marquée payée. La facture payée a été envoyée à ${r.invoice.client_email}.${mailTestMode() ? ' (mode test : e-mail affiché dans la console)' : ''}`);
}

export async function reopenPayment(fd) {
  const { company } = await auth.requireCompany();
  const id = Number(fd.get('id'));
  const row = await invoices.reopenInvoice(company, id);
  revalidatePath('/', 'layout');
  if (!row) back(`/factures/${id}`, "Cette facture n'est pas marquée payée.", true);
  back(`/factures/${id}`, row.status === 'signalee' ? 'Facture remise en « paiement signalé, à vérifier ».' : 'Facture remise en attente de paiement.');
}

export async function resendReceipt(fd) {
  const { company } = await auth.requireCompany();
  const id = Number(fd.get('id'));
  const paid = await one(`SELECT id FROM invoices WHERE id = $1 AND company_id = $2 AND status = 'payee'`, [id, company.id]);
  if (!paid) back(`/factures/${id}`, "Cette facture n'est pas encore payée.", true);
  const r = await invoices.sendReceipt(company, id);
  revalidatePath(`/factures/${id}`);
  if (!r.sent) back(`/factures/${id}`, `Le reçu n'est pas parti : ${r.error}`, true);
  back(`/factures/${id}`, `Facture payée renvoyée à ${r.invoice.client_email}.`);
}

export async function cancelInvoice(fd) {
  const { company } = await auth.requireCompany();
  const id = Number(fd.get('id'));
  const r = await invoices.cancelInvoice(company, id, text(fd, 'reason', 500));
  revalidatePath('/', 'layout');
  if (!r.cancelled) back(`/factures/${id}`, "Cette facture ne peut plus être annulée : le client a déjà signalé ou réglé son paiement.", true);
  if (!r.sent) back(`/factures/${id}`, `Facture annulée, mais le client n'a pas pu être prévenu : ${r.error}`, true);
  back(`/factures/${id}`, `Facture annulée. ${r.invoice.client_email} a été prévenu.${mailTestMode() ? ' (mode test : e-mail affiché dans la console)' : ''}`);
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

// Le client écrit à l'entreprise depuis la page de sa facture (message propre au bloc contact : ?contact=…)
export async function contactCompany(fd) {
  const token = text(fd, 'token', 100);
  const page = `/f/${token}`;
  const reply = (message, error = false) => redirect(`${page}?${error ? 'contact_erreur' : 'contact'}=${encodeURIComponent(message)}#contact`);
  const body = text(fd, 'message', 2000);
  if (body.length < 3) reply('Écrivez votre message.', true);
  const r = await invoices.sendClientMessage(token, body);
  if (!r.ok) reply(r.error, true);
  reply(`Message envoyé à ${r.company.name}. La réponse arrivera à ${r.invoice.client_email}.`);
}

// Le client accepte ou refuse un devis depuis sa page
export async function answerQuote(fd) {
  const token = text(fd, 'token', 100);
  const accepted = fd.get('answer') === 'accepter';
  const signedBy = text(fd, 'signed_by', 120);
  // Accepter, c'est signer : nom complet et « bon pour accord » obligatoires
  if (accepted && (signedBy.length < 3 || fd.get('agree') !== 'on')) {
    redirect(`/f/${token}?erreur=${encodeURIComponent('Pour accepter, tapez votre nom complet et cochez « Bon pour accord ».')}`);
  }
  await invoices.answerQuote(token, accepted, signedBy);
  redirect(`/f/${token}`);
}

// ---------- Documents ----------

const isoDate = (fd, key) => { const v = text(fd, key, 10); return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ''; };

export async function uploadDocument(fd) {
  const { company } = await auth.requireCompany();
  const from = fd.get('from') === 'client' ? `/clients/${Number(fd.get('client_id'))}#documents` : '/documents';
  const r = await documents.addDocument(company.id, {
    file: fd.get('file'),
    title: text(fd, 'title', 160),
    category: text(fd, 'category', 30),
    clientId: Number(fd.get('client_id')) || null,
    docDate: isoDate(fd, 'doc_date'),
    expiresOn: isoDate(fd, 'expires_on'),
    notes: text(fd, 'notes', 500),
  });
  if (r.error) back(from, r.error, true);
  revalidatePath('/', 'layout');
  back(from, 'Document ajouté.');
}

export async function deleteDocument(fd) {
  const { company } = await auth.requireCompany();
  await documents.removeDocument(company.id, Number(fd.get('id')));
  revalidatePath('/', 'layout');
  back(fd.get('from') === 'client' ? `/clients/${Number(fd.get('client_id'))}#documents` : '/documents', 'Document supprimé.');
}

// ---------- Factures récurrentes ----------

export async function setRepeat(fd) {
  const { company } = await auth.requireCompany();
  const id = Number(fd.get('id'));
  const active = fd.get('active') === '1';
  const r = await invoices.setRepeat(company, id, { active, day: number(fd, 'day', { min: 1, max: 28, fallback: 28 }) });
  revalidatePath(`/factures/${id}`);
  if (!r) back(`/factures/${id}`, 'Seule une facture déjà émise peut servir de modèle.', true);
  back(`/factures/${id}`, r.active
    ? `Facture récurrente : une copie partira automatiquement chaque mois, la prochaine le ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${r.next}T12:00:00Z`))}.`
    : 'Récurrence arrêtée : plus aucune copie ne partira.');
}

// ---------- Accès comptable ----------

export async function createAccountantAccess() {
  const { company } = await auth.requireCompany();
  await accountant.createAccountantLink(company.id);
  back('/parametres?onglet=comptable', 'Lien créé. Copie-le et envoie-le à ton comptable.');
}

export async function revokeAccountantAccess() {
  const { company } = await auth.requireCompany();
  await accountant.revokeAccountantLink(company.id);
  back('/parametres?onglet=comptable', "Lien désactivé : ton comptable n'a plus accès.");
}
