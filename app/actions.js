'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { q, one } from '@/lib/db';
import * as auth from '@/lib/auth';
import * as invoices from '@/lib/invoices';
import { sendMail, mailTestMode } from '@/lib/mail';
import { verifyEmail, resetPasswordEmail, changeEmailEmail, loginCodeEmail, securityNoticeEmail, employeePortalInvitationEmail, withImages } from '@/lib/emails';
import * as twofa from '@/lib/twofa';
import { newSecret, verifyCode } from '@/lib/totp';
import { saveFile, deleteFile } from '@/lib/storage';
import { appUrl } from '@/lib/url';
import { CURRENCIES, fixedRate } from '@/lib/money';
import { passwordProblem } from '@/lib/password';
import { cleanPeriod, periodHours } from '@/lib/period';
import * as documents from '@/lib/documents';
import * as accountant from '@/lib/accountant';
import * as employees from '@/lib/employees';
import * as payroll from '@/lib/payroll';
import * as leaves from '@/lib/leaves';
import * as advances from '@/lib/advances';
import * as expenses from '@/lib/expenses';
import * as portal from '@/lib/portal';
import { listNotifications, markAllRead } from '@/lib/notifications';
import { COUNTRIES, cleanMobiles, localNumber, formatNumber } from '@/lib/payment';
import { AUTH_APPS } from '@/lib/authenticators';
import { pubId } from '@/lib/ids';
import { signFlash } from '@/lib/flash';
import { hitLimit, clientIp } from '@/lib/ratelimit';
import { safeError } from '@/lib/safeerror';
import { matchesType } from '@/lib/filetype';

// Revient sur une page avec un message (?ok=… ou ?erreur=…), signé pour qu'un lien fabriqué à la
// main (par exemple pour une arnaque à l'adresse « ?erreur=Compte suspendu, appelez… ») ne puisse
// pas afficher un message qui n'a pas été produit par ce code.
function back(path, message, error = false) {
  const sep = path.includes('?') ? '&' : '?';
  const kind = error ? 'erreur' : 'ok';
  redirect(`${path}${sep}${kind}=${encodeURIComponent(message)}&s=${signFlash(kind, message)}`);
}

const text = (fd, key, max = 300) => String(fd.get(key) ?? '').replace(/Ð/g, '').trim().slice(0, max);
const number = (fd, key, { min = 0, max = Infinity, fallback = 0 } = {}) => {
  const n = Number(String(fd.get(key) ?? '').replace(',', '.'));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
// Nom de fuseau horaire reconnu (« Europe/Paris »), sinon vide
const validTimeZone = (tz) => { try { return tz && new Intl.DateTimeFormat('fr', { timeZone: tz }) ? tz : ''; } catch { return ''; } };

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
  // Limite les créations de compte en rafale depuis un même appareil (chacune envoie un e-mail)
  if (await hitLimit('signup-ip', await clientIp(), 6, 60)) {
    back('/inscription', 'Trop de comptes créés récemment depuis cette connexion. Réessaie plus tard.', true);
  }
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
    back('/confirmer-email', `L'envoi a échoué : ${safeError(err)}`, true);
  }
  back('/confirmer-email', `Nouveau lien envoyé à ${user.email}.${mailTestMode() ? ' (mode test : lien affiché dans la console du serveur)' : ''}`);
}

export async function login(fd) {
  const email = text(fd, 'email', 200).toLowerCase();
  const password = String(fd.get('password') || '');
  // Limite globale par appareil : freine les essais massifs de mots de passe sur beaucoup de comptes
  if (await hitLimit('login-ip', await clientIp(), 30, 15)) {
    back('/connexion', 'Trop de tentatives depuis cette connexion. Réessaie dans 15 minutes.', true);
  }
  // Le mot de passe est vérifié avant de regarder les essais précédents : quelqu'un qui connaît ton
  // adresse ne peut pas te bloquer en enchaînant volontairement de mauvais essais à ta place. Seuls
  // les MAUVAIS essais comptent pour le blocage, jamais une connexion réussie.
  const locked = await auth.tooManyFailures(email);
  const user = await one('SELECT id, email, name, first_name, password_hash, twofa_method FROM users WHERE email = $1', [email]);
  const passwordOk = user && await auth.checkPassword(password, user.password_hash);
  if (!passwordOk) {
    await auth.recordFailure(email);
    if (locked) back('/connexion', 'Trop d\'essais pour cette adresse. Réessaie dans 15 minutes.', true);
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
      back('/connexion/verification', `Le code n'a pas pu partir : ${safeError(err)}. Clique sur « Renvoyer le code ».`, true);
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
    back('/connexion/verification', `Le code n'a pas pu partir : ${safeError(err)}`, true);
  }
  back('/connexion/verification', `Nouveau code envoyé à ${ch.email}.${mailTestMode() ? ' (mode test : code affiché dans la console)' : ''}`);
}

// Vérifie le mot de passe du compte connecté avant un changement de sécurité (limité en essais :
// une session volée ne permet pas de deviner le mot de passe sans limite)
async function requirePassword(fd, user, tab = '/parametres?onglet=securite') {
  if (await hitLimit('reauth', String(user.id), 8, 15)) back(tab, 'Trop de tentatives. Réessaie dans 15 minutes.', true);
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
  await q(`UPDATE users SET twofa_method = 'email', totp_secret = NULL, totp_pending = NULL, totp_app = '', backup_codes = $1 WHERE id = $2`, [JSON.stringify(hashes), user.id]);
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
  const app = AUTH_APPS.some((a) => a.id === fd.get('app')) ? fd.get('app') : 'autre';
  await q(`UPDATE users SET twofa_method = 'totp', totp_secret = totp_pending, totp_pending = NULL, totp_last_step = $1, backup_codes = $2, totp_app = $4 WHERE id = $3`,
    [step, JSON.stringify(hashes), user.id, app]);
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
  await q(`UPDATE users SET twofa_method = '', totp_secret = NULL, totp_pending = NULL, backup_codes = '[]', totp_app = '' WHERE id = $1`, [user.id]);
  await notifySecurity(user, 'Double authentification désactivée');
  back('/parametres?onglet=securite', 'Double authentification désactivée.');
}

export async function logout() {
  await auth.endSession();
  redirect('/connexion');
}

export async function requestPasswordReset(fd) {
  const email = text(fd, 'email', 200).toLowerCase();
  const genericOk = () => back('/mot-de-passe-oublie', `Si un compte existe pour cette adresse, un lien vient d'y être envoyé.${mailTestMode() ? ' (mode test : lien affiché dans la console du serveur)' : ''}`);
  // Limites d'envoi (par appareil, puis par adresse) : sans réponse différente, pour ne pas révéler
  // qu'un compte existe. Au-delà, on répond comme un succès mais aucun e-mail ne repart.
  if (await hitLimit('reset-ip', await clientIp(), 8, 60)) genericOk();
  if (email && await hitLimit('reset-email', email, 3, 60)) genericOk();
  const user = email && await one('SELECT id, name, first_name FROM users WHERE email = $1', [email]);
  if (user) {
    // Un ancien lien encore valable ne doit plus marcher une fois qu'un nouveau est demandé
    await q('DELETE FROM password_resets WHERE user_id = $1 AND NOT used', [user.id]);
    const token = await auth.createPasswordReset(user.id);
    await sendMail({ to: email, ...(await withImages(resetPasswordEmail(user.first_name || user.name, `${appUrl()}/reinitialiser/${token}`))) });
  }
  // Même réponse que le compte existe ou non : on ne révèle pas qui est inscrit.
  genericOk();
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
  // Tout autre lien de réinitialisation encore valable devient inutile
  await q('DELETE FROM password_resets WHERE user_id = $1 AND NOT used', [reset.user_id]);
  await auth.endAllSessions(reset.user_id);
  // Un mot de passe oublié ne dispense pas du second code
  const user = await one('SELECT id, email, name, first_name, twofa_method FROM users WHERE id = $1', [reset.user_id]);
  if (user.twofa_method) await openSessionOrAsk2fa(user);
  await auth.startSession(reset.user_id);
  back('/tableau-de-bord', 'Mot de passe changé.');
}

export async function changePassword(fd) {
  const user = await auth.requireUser();
  const tab = '/parametres?onglet=compte';
  if (await hitLimit('reauth', String(user.id), 8, 15)) back(tab, 'Trop de tentatives. Réessaie dans 15 minutes.', true);
  const row = await one('SELECT password_hash FROM users WHERE id = $1', [user.id]);
  if (!(await auth.checkPassword(String(fd.get('current') || ''), row.password_hash))) {
    back(tab, 'Le mot de passe actuel est incorrect.', true);
  }
  const password = String(fd.get('password') || '');
  const weak = passwordProblem(password, String(fd.get('confirm') || ''));
  if (weak) back(tab, weak, true);
  await q('UPDATE users SET password_hash = $1 WHERE id = $2', [await auth.hashPassword(password), user.id]);
  // Un lien de réinitialisation demandé avant ce changement ne doit plus marcher
  await q('DELETE FROM password_resets WHERE user_id = $1 AND NOT used', [user.id]);
  await auth.endAllSessions(user.id);
  await auth.startSession(user.id);
  back(tab, 'Mot de passe changé. Tes autres appareils ont été déconnectés.');
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
      account_holder: text(fd, 'account_holder', 120),
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
      invoice_prefix: (text(fd, 'invoice_prefix', 10).toUpperCase().replace(/[^A-Z]/g, '') || 'FAC'),
      footer_note: text(fd, 'footer_note', 500),
      reminders_enabled: fd.get('reminders_enabled') === 'on',
      reminder_days: String(fd.get('reminder_days') || '').split(/[^\d]+/).map(Number).filter((n) => n > 0 && n <= 365).slice(0, 5).join(',') || '3,10',
      quote_prefix: (text(fd, 'quote_prefix', 10).toUpperCase().replace(/[^A-Z]/g, '') || 'DEV'),
      quote_validity: Math.round(number(fd, 'quote_validity', { min: 1, max: 365, fallback: 30 })),
    });
  }
  return c;
}

// Enregistre un fichier dans le stockage ; en cas d'échec, le détail part dans les journaux
// et la personne revient sur la page avec un message clair, au lieu d'une page d'erreur
async function storeFile(file, folder, backTo) {
  try {
    return await saveFile(file, folder);
  } catch (err) {
    console.error(`Fichier non enregistré (${folder}) :`, err);
  }
  back(backTo, "Le fichier n'a pas pu être enregistré. Réessaie dans un instant.", true);
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
  if (!(await matchesType(file))) back(from, "Ce fichier n'est pas une véritable image PNG ou JPEG.", true);
  const key = await storeFile(file, 'logos', from);
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
  if (sections.includes('entreprise') && c.phone) {
    // Le champ n'affiche que les chiffres locaux (l'indicatif est à côté) : on les recompose ici,
    // pour garder le même format qu'avant (« +228 XX XX XX XX ») partout où le numéro est affiché.
    const local = localNumber(c.phone, c.country);
    c.phone = local ? formatNumber(local, c.country) : c.phone;
  }
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
  if (await hitLimit('reauth', String(user.id), 8, 15)) back(tab, 'Trop de tentatives. Réessaie dans 15 minutes.', true);
  const row = await one('SELECT password_hash FROM users WHERE id = $1', [user.id]);
  if (!(await auth.checkPassword(String(fd.get('password') || ''), row.password_hash))) back(tab, 'Mot de passe incorrect.', true);
  if (await one('SELECT 1 FROM users WHERE email = $1', [email])) back(tab, 'Cette adresse est déjà utilisée par un autre compte.', true);
  const token = await auth.createEmailVerification(user.id, email);
  try {
    await sendMail({ to: email, ...(await withImages(changeEmailEmail(user.first_name || user.name, `${appUrl()}/confirmer/${token}`))) });
  } catch (err) {
    back(tab, `Le lien n'a pas pu partir : ${safeError(err)}`, true);
  }
  back(tab, `Lien de confirmation envoyé à ${email}. Ton adresse changera quand tu l'auras ouvert.${mailTestMode() ? ' (mode test : lien affiché dans la console)' : ''}`);
}

// Suppression du compte et de toutes ses données (entreprise, clients, factures, fichiers stockés)
// Le mot de passe et le mot « SUPPRIMER » tapé à la main protègent contre un clic accidentel ou un
// appareil resté connecté ; l'action est définitive et irréversible.
export async function deleteAccount(fd) {
  const user = await auth.requireUser();
  const tab = '/parametres?onglet=compte';
  if (await hitLimit('reauth', String(user.id), 8, 15)) back(tab, 'Trop de tentatives. Réessaie dans 15 minutes.', true);
  const row = await one('SELECT password_hash FROM users WHERE id = $1', [user.id]);
  if (!(await auth.checkPassword(String(fd.get('password') || ''), row.password_hash))) back(tab, 'Mot de passe incorrect.', true);
  if (text(fd, 'confirm', 20).toUpperCase() !== 'SUPPRIMER') back(tab, 'Tape SUPPRIMER en majuscules pour confirmer.', true);

  // Les fichiers (photo, logo, documents, justificatifs) sont gardés en dehors de la base : il faut
  // les lister avant de supprimer le compte, puis les effacer un par un après.
  const company = await one('SELECT id, logo_key FROM companies WHERE owner_id = $1', [user.id]);
  const [docs, invs] = company ? await Promise.all([
    q('SELECT file_key FROM documents WHERE company_id = $1', [company.id]),
    q('SELECT proof_key FROM invoices WHERE company_id = $1 AND proof_key IS NOT NULL', [company.id]),
  ]) : [[], []];
  const keys = [user.avatar_key, company?.logo_key, ...docs.map((d) => d.file_key), ...invs.map((i) => i.proof_key)].filter(Boolean);

  await auth.endSession();
  await q('DELETE FROM users WHERE id = $1', [user.id]);
  await Promise.all(keys.map((k) => deleteFile(k)));
  redirect('/?compte=supprime');
}

// Apparence : claire (par défaut), sombre, ou automatique (appareil). Gardée un an dans ce navigateur.
export async function setTheme(fd) {
  const theme = ['auto', 'dark'].includes(fd.get('theme')) ? String(fd.get('theme')) : 'light';
  const jar = await cookies();
  if (theme === 'light') jar.delete('theme');
  else jar.set('theme', theme, { path: '/', maxAge: 365 * 86400, sameSite: 'lax' });
  revalidatePath('/', 'layout');
  back('/parametres?onglet=compte', 'Apparence enregistrée.');
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
  if (!(await matchesType(file))) back(tab, "Ce fichier n'est pas une véritable image PNG, JPEG ou WebP.", true);
  const key = await storeFile(file, 'avatars', tab);
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
  if (!c.name || !emailOk(c.email)) back(`/clients/${pubId('client', id)}`, 'Indique le nom du client et une adresse e-mail valide.', true);
  await q('UPDATE clients SET name = $1, email = $2, phone = $3, address = $4 WHERE id = $5 AND company_id = $6',
    [c.name, c.email, c.phone, c.address, id, company.id]);
  back(`/clients/${pubId('client', id)}`, 'Client mis à jour.');
}

export async function deleteClient(fd) {
  const { company } = await auth.requireCompany();
  const id = Number(fd.get('id'));
  const used = await one('SELECT 1 FROM invoices WHERE client_id = $1 AND company_id = $2 LIMIT 1', [id, company.id]);
  if (used) back(`/clients/${pubId('client', id)}`, 'Ce client a des factures : il ne peut pas être supprimé.', true);
  await q('DELETE FROM clients WHERE id = $1 AND company_id = $2', [id, company.id]);
  back('/clients', 'Client supprimé.');
}

// ---------- Factures ----------

export async function saveInvoice(fd) {
  const { company } = await auth.requireCompany();
  const id = Number(fd.get('id')) || null;
  const docType = fd.get('doc_type') === 'devis' ? 'devis' : 'facture';
  const word = docType === 'devis' ? 'Devis' : 'Facture';
  const formPath = id ? `/factures/${pubId('facture', id)}/modifier` : docType === 'devis' ? '/devis/nouveau' : '/factures/nouvelle';
  const intent = docType === 'devis' && fd.get('intent') === 'programmer' ? 'brouillon' : String(fd.get('intent'));
  let lines = [];
  try { lines = invoices.cleanLines(JSON.parse(String(fd.get('lines') || '[]'))); } catch { /* lignes invalides */ }
  // Période travaillée : les heures de la ligne « période » sont recalculées ici, pas reprises du navigateur
  let period = null;
  try { period = cleanPeriod(JSON.parse(String(fd.get('period') || 'null'))); } catch { /* période invalide */ }
  lines = lines
    .map((l) => (l.kind !== 'period' ? l : period ? { ...l, quantity: periodHours(period), unit: 'heure(s)' } : { ...l, kind: 'service' }))
    .filter((l) => l.quantity);
  // Envoi programmé : l'instant exact en temps universel (calculé dans le navigateur à partir de
  // l'heure locale de l'appareil) et le nom du fuseau, pour réafficher l'heure telle qu'elle a été choisie
  let sendOn = '';
  let sendTz = '';
  if (intent === 'programmer') {
    const at = new Date(text(fd, 'send_on', 40));
    if (Number.isNaN(at.getTime())) back(formPath, "Choisis la date et l'heure d'envoi.", true);
    if (at.getTime() < Date.now() - 5 * 60 * 1000) back(formPath, "Choisis une date et une heure à venir.", true);
    if (at.getTime() > Date.now() + 366 * 86400 * 1000) back(formPath, "L'envoi peut être programmé un an à l'avance au plus.", true);
    sendOn = at.toISOString();
    sendTz = validTimeZone(text(fd, 'send_tz', 60));
  }

  // Devise de la facture, et seconde devise facultative avec son taux (fixe pour € / F CFA, saisi sinon)
  const currency = CURRENCIES[fd.get('currency')] ? String(fd.get('currency')) : company.currency;
  const alt = CURRENCIES[fd.get('alt_currency')] && fd.get('alt_currency') !== currency ? String(fd.get('alt_currency')) : null;
  const altRate = alt ? (fixedRate(currency, alt) ?? number(fd, 'alt_rate')) : null;
  if (alt && !(altRate > 0)) {
    back(formPath, `Indique le taux de change : 1 ${currency} = combien de ${alt} ?`, true);
  }

  let paymentMethods = null;
  const pmRaw = fd.get('payment_methods');
  if (pmRaw !== null && pmRaw !== undefined && typeof pmRaw === 'string') {
    try {
      const parsed = JSON.parse(pmRaw);
      if (Array.isArray(parsed)) {
        paymentMethods = JSON.stringify(parsed.filter((x) => typeof x === 'string').map((s) => s.slice(0, 100)).slice(0, 20));
      }
    } catch { /* invalide */ }
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
      payment_methods: paymentMethods,
      notes: text(fd, 'notes', 1000), send_on: sendOn, send_tz: sendTz, doc_type: docType,
    });
  } catch (err) {
    back(formPath, err.message, true);
  }

  if (intent === 'envoyer') {
    const r = await invoices.sendInvoice(company, invoiceId);
    revalidatePath('/', 'layout');
    if (!r.ok) back(`/factures/${pubId('facture', invoiceId)}`, `${word} ${r.invoice.number} émis${docType === 'facture' ? 'e' : ''}, mais l'envoi a échoué : ${r.error}`, true);
    back(`/factures/${pubId('facture', invoiceId)}`, `${word} ${r.invoice.number} envoyé${docType === 'facture' ? 'e' : ''} à ${r.invoice.client_email}.${mailTestMode() ? ' (mode test : e-mail affiché dans la console)' : ''}`);
  }
  revalidatePath('/', 'layout');
  const savedMessage = intent === 'programmer' ? 'Envoi programmé.' : id ? 'Modifications enregistrées.' : 'Brouillon enregistré.';
  back(`/factures/${pubId('facture', invoiceId)}`, savedMessage);
}

export async function sendInvoiceNow(fd) {
  const { company } = await auth.requireCompany();
  const id = Number(fd.get('id'));
  const exists = await one('SELECT id, status FROM invoices WHERE id = $1 AND company_id = $2', [id, company.id]);
  if (!exists) back('/factures', 'Document introuvable.', true);
  if (['payee', 'annulee', 'acceptee', 'refusee', 'convertie'].includes(exists.status)) back(`/factures/${pubId('facture', id)}`, 'Ce document ne peut plus être envoyé.', true);
  const r = await invoices.sendInvoice(company, id);
  revalidatePath('/', 'layout');
  if (!r.ok) back(`/factures/${pubId('facture', id)}`, `L'envoi a échoué : ${r.error}`, true);
  back(`/factures/${pubId('facture', id)}`, `${r.invoice.number} envoyé à ${r.invoice.client_email}.${mailTestMode() ? ' (mode test : e-mail affiché dans la console)' : ''}`);
}

// Relance à la main d'une facture en attente
export async function remindNow(fd) {
  const { company } = await auth.requireCompany();
  const id = Number(fd.get('id'));
  const r = await invoices.sendReminder(company, id);
  revalidatePath(`/factures/${pubId('facture', id)}`);
  if (!r.ok) back(`/factures/${pubId('facture', id)}`, `La relance n'est pas partie : ${r.error}`, true);
  back(`/factures/${pubId('facture', id)}`, `Relance envoyée à ${r.invoice.client_email}.${mailTestMode() ? ' (mode test : e-mail affiché dans la console)' : ''}`);
}

// Copie une facture ou un devis en nouveau brouillon (la période passe au mois suivant)
export async function duplicateDocument(fd) {
  const { company } = await auth.requireCompany();
  const newId = await invoices.duplicate(company, Number(fd.get('id')));
  if (!newId) back('/factures', 'Document introuvable.', true);
  revalidatePath('/', 'layout');
  back(`/factures/${pubId('facture', newId)}/modifier`, 'Copie créée en brouillon. Vérifie-la, puis envoie-la.');
}

// Devis accepté (ou non) → brouillon de facture
export async function convertQuote(fd) {
  const { company } = await auth.requireCompany();
  const id = Number(fd.get('id'));
  const newId = await invoices.convertQuote(company, id);
  if (!newId) back(`/factures/${pubId('facture', id)}`, 'Ce devis ne peut pas être transformé en facture.', true);
  revalidatePath('/', 'layout');
  back(`/factures/${pubId('facture', newId)}/modifier`, 'Facture créée à partir du devis. Vérifie-la, puis envoie-la.');
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
  if (!r.confirmed) back(`/factures/${pubId('facture', id)}`, 'Cette facture ne peut pas être marquée payée.', true);
  if (r.skipped) back(`/factures/${pubId('facture', id)}`, "Facture marquée payée. Le client n'a pas été prévenu.");
  if (!r.sent) back(`/factures/${pubId('facture', id)}`, `Facture marquée payée, mais la facture payée n'est pas partie : ${r.error}. Clique sur « Renvoyer la facture payée ».`, true);
  back(`/factures/${pubId('facture', id)}`, `Facture marquée payée. La facture payée a été envoyée à ${r.invoice.client_email}.${mailTestMode() ? ' (mode test : e-mail affiché dans la console)' : ''}`);
}

export async function reopenPayment(fd) {
  const { company } = await auth.requireCompany();
  const id = Number(fd.get('id'));
  const row = await invoices.reopenInvoice(company, id);
  revalidatePath('/', 'layout');
  if (!row) back(`/factures/${pubId('facture', id)}`, "Cette facture n'est pas marquée payée.", true);
  back(`/factures/${pubId('facture', id)}`, row.status === 'signalee' ? 'Facture remise en « paiement signalé, à vérifier ».' : 'Facture remise en attente de paiement.');
}

export async function resendReceipt(fd) {
  const { company } = await auth.requireCompany();
  const id = Number(fd.get('id'));
  const paid = await one(`SELECT id FROM invoices WHERE id = $1 AND company_id = $2 AND status = 'payee'`, [id, company.id]);
  if (!paid) back(`/factures/${pubId('facture', id)}`, "Cette facture n'est pas encore payée.", true);
  const r = await invoices.sendReceipt(company, id);
  revalidatePath(`/factures/${pubId('facture', id)}`);
  if (!r.sent) back(`/factures/${pubId('facture', id)}`, `Le reçu n'est pas parti : ${r.error}`, true);
  back(`/factures/${pubId('facture', id)}`, `Facture payée renvoyée à ${r.invoice.client_email}.`);
}

export async function cancelInvoice(fd) {
  const { company } = await auth.requireCompany();
  const id = Number(fd.get('id'));
  const notify = fd.get('notify') === 'on';
  const r = await invoices.cancelInvoice(company, id, text(fd, 'reason', 500), { notify });
  revalidatePath('/', 'layout');
  if (!r.cancelled) back(`/factures/${pubId('facture', id)}`, "Cette facture ne peut plus être annulée : le client a déjà signalé ou réglé son paiement.", true);
  if (r.skipped) back(`/factures/${pubId('facture', id)}`, "Facture annulée et avoir émis. Le client n'a pas été prévenu.");
  if (!r.sent) back(`/factures/${pubId('facture', id)}`, `Facture annulée, mais le client n'a pas pu être prévenu : ${r.error}`, true);
  back(`/factures/${pubId('facture', id)}`, `Facture annulée. ${r.invoice.client_email} a été prévenu.${mailTestMode() ? ' (mode test : e-mail affiché dans la console)' : ''}`);
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
  if (!(await matchesType(file))) back(page, "Ce fichier n'est pas une véritable image ou un PDF valide.", true);

  const proofKey = await storeFile(file, 'justificatifs', page);
  await invoices.declarePayment(token, { reference, proofKey, proofName: file.name.slice(0, 200), proofMime: file.type });
  revalidatePath(page);
  redirect(page);
}

// Le client écrit à l'entreprise depuis la page de sa facture (message propre au bloc contact : ?contact=…)
export async function contactCompany(fd) {
  const token = text(fd, 'token', 100);
  const page = `/f/${token}`;
  const reply = (message, error = false) => {
    const kind = error ? 'contact_erreur' : 'contact';
    redirect(`${page}?${kind}=${encodeURIComponent(message)}&s=${signFlash(kind, message)}#contact`);
  };
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
    back(`/f/${token}`, 'Pour accepter, tapez votre nom complet et cochez « Bon pour accord ».', true);
  }
  await invoices.answerQuote(token, accepted, signedBy);
  redirect(`/f/${token}`);
}

// ---------- Documents ----------

const isoDate = (fd, key) => { const v = text(fd, key, 10); return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : ''; };

export async function uploadDocument(fd) {
  const { company } = await auth.requireCompany();
  const from = fd.get('from') === 'client' ? `/clients/${pubId('client', Number(fd.get('client_id')))}#documents` : '/documents';
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
  back(fd.get('from') === 'client' ? `/clients/${pubId('client', Number(fd.get('client_id')))}#documents` : '/documents', 'Document supprimé.');
}

// ---------- Factures récurrentes ----------

export async function setRepeat(fd) {
  const { company } = await auth.requireCompany();
  const id = Number(fd.get('id'));
  const active = fd.get('active') === '1';
  const r = await invoices.setRepeat(company, id, { active, day: number(fd, 'day', { min: 1, max: 28, fallback: 28 }) });
  revalidatePath(`/factures/${pubId('facture', id)}`);
  if (!r) back(`/factures/${pubId('facture', id)}`, 'Seule une facture déjà émise peut servir de modèle.', true);
  back(`/factures/${pubId('facture', id)}`, r.active
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

// ---------- Notifications push ----------
// Appelées directement en JavaScript (pas par un <form>) depuis PushToggle : pas de redirection,
// juste un enregistrement ou une suppression en base.

export async function subscribePush(fd) {
  const user = await auth.requireUser();
  let sub;
  try { sub = JSON.parse(String(fd.get('subscription') || '')); } catch { return { ok: false }; }
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return { ok: false };
  await q(`INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES ($1, $2, $3, $4)
    ON CONFLICT (endpoint) DO UPDATE SET user_id = $1, p256dh = $3, auth = $4`,
    [user.id, sub.endpoint, sub.keys.p256dh, sub.keys.auth]);
  return { ok: true };
}

export async function unsubscribePush(fd) {
  const user = await auth.requireUser();
  const endpoint = text(fd, 'endpoint', 500);
  if (endpoint) await q('DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2', [user.id, endpoint]);
  return { ok: true };
}

// ---------- La cloche de notifications ----------
// Appelées en JavaScript direct depuis NotificationBell (pas de <form>, pas de redirection).

export async function listMyNotifications() {
  const user = await auth.requireUser();
  return listNotifications(user.id);
}

export async function markNotificationsRead() {
  const user = await auth.requireUser();
  await markAllRead(user.id);
}

// ---------- Ressources Humaines : Salariés ----------

export async function saveEmployeeAction(fd) {
  const { company } = await auth.requireCompany();
  const returnTo = String(fd.get('return_to') || '').trim() || (fd.get('id') ? `/employes/${fd.get('id')}` : '/employes');
  try {
    const email = text(fd, 'email', 150);
    const activatePortal = fd.get('activate_portal') === '1' || fd.get('activate_portal') === 'on' || fd.get('activate_portal') === 'true';

    if (activatePortal && !email) {
      throw new Error("L'adresse e-mail est obligatoire pour activer l'espace en ligne du salarié.");
    }

    const emp = await employees.saveEmployee(company, {
      id: fd.get('id') ? Number(fd.get('id')) : null,
      first_name: text(fd, 'first_name', 80),
      last_name: text(fd, 'last_name', 80),
      email: email,
      phone: text(fd, 'phone', 40),
      job_title: text(fd, 'job_title', 100),
      department: text(fd, 'department', 80),
      contract_type: text(fd, 'contract_type', 30),
      category: text(fd, 'category', 50),
      hire_date: text(fd, 'hire_date', 20),
      end_date: text(fd, 'end_date', 20),
      cnss_number: text(fd, 'cnss_number', 50),
      id_card_number: text(fd, 'id_card_number', 50),
      base_salary: number(fd, 'base_salary'),
      payment_method: text(fd, 'payment_method', 30) || 'bank',
      payment_details: text(fd, 'payment_details', 100),
      status: text(fd, 'status', 20),
      leave_balance: fd.has('leave_balance') && fd.get('leave_balance') !== '' ? number(fd, 'leave_balance', { fallback: 0 }) : undefined,
    });

    let portalActivated = false;
    if (activatePortal && email) {
      const token = await portal.getOrCreatePortalToken(emp.id, { force: false });
      portalActivated = true;
      const portalUrl = `${appUrl()}/portail/${token}`;
      try {
        await sendMail({
          to: emp.email,
          replyTo: company.email || undefined,
          ...(await withImages(employeePortalInvitationEmail({ employee: emp, company, portalUrl }), company)),
        });
      } catch (mailErr) {
        console.error('Erreur envoi email portail salarié:', mailErr);
      }
    }

    revalidatePath('/employes');
    revalidatePath(`/employes/${emp.id}`);
    revalidatePath('/', 'layout');

    const successMsg = portalActivated
      ? `Salarié ${emp.first_name} ${emp.last_name} enregistré avec succès et invitation envoyée à ${emp.email}.`
      : `Salarié ${emp.first_name} ${emp.last_name} enregistré avec succès.`;

    back(returnTo, successMsg);
  } catch (err) {
    back(returnTo, safeError(err), true);
  }
}

export async function deleteEmployeeAction(fd) {
  const { company } = await auth.requireCompany();
  const id = Number(fd.get('id'));
  try {
    const res = await employees.deleteEmployee(company.id, id);
    revalidatePath('/employes');
    if (res.archived) {
      back('/employes', 'Salarié archivé (ses bulletins de paie passés ont été conservés).');
    } else {
      back('/employes', 'Salarié supprimé.');
    }
  } catch (err) {
    back('/employes', safeError(err), true);
  }
}

// ---------- Ressources Humaines : Fiches de Paie ----------

export async function savePayslipAction(fd) {
  const { company } = await auth.requireCompany();
  try {
    const p = await payroll.savePayslip(company, {
      id: fd.get('id') ? Number(fd.get('id')) : null,
      employee_id: Number(fd.get('employee_id')),
      period_month: number(fd, 'period_month', { min: 1, max: 12 }),
      period_year: number(fd, 'period_year', { min: 2000, max: 2100 }),
      issue_date: text(fd, 'issue_date', 20),
      payment_date: text(fd, 'payment_date', 20),
      base_salary: number(fd, 'base_salary'),
      seniority_bonus: number(fd, 'seniority_bonus'),
      transport_allowance: number(fd, 'transport_allowance'),
      function_allowance: number(fd, 'function_allowance'),
      other_allowances: number(fd, 'other_allowances'),
      overtime_amount: number(fd, 'overtime_amount'),
      cnss_employee_rate: number(fd, 'cnss_employee_rate', { fallback: 4.0 }),
      tax_salary_amount: number(fd, 'tax_salary_amount'),
      salary_advances: number(fd, 'salary_advances'),
      other_deductions: number(fd, 'other_deductions'),
      cnss_employer_rate: number(fd, 'cnss_employer_rate', { fallback: 17.5 }),
      status: text(fd, 'status', 20),
      payment_method: text(fd, 'payment_method', 30),
      payment_reference: text(fd, 'payment_reference', 100),
      notes: text(fd, 'notes', 500),
    });
    revalidatePath('/fiches-de-paie');
    back(`/fiches-de-paie/${p.id}`, `Bulletin ${p.number} enregistré.`);
  } catch (err) {
    back('/fiches-de-paie', safeError(err), true);
  }
}

export async function generateMonthlyPayslipsAction(fd) {
  const { company } = await auth.requireCompany();
  const year = number(fd, 'period_year', { min: 2000, max: 2100, fallback: new Date().getUTCFullYear() });
  const month = number(fd, 'period_month', { min: 1, max: 12, fallback: new Date().getUTCMonth() + 1 });
  try {
    const list = await payroll.generateMonthlyPayslips(company, { year, month });
    revalidatePath('/fiches-de-paie');
    if (!list.length) {
      back(`/fiches-de-paie?annee=${year}&mois=${month}`, 'Tous les bulletins de ce mois ont déjà été créés.');
    } else {
      back(`/fiches-de-paie?annee=${year}&mois=${month}`, `${list.length} bulletin(s) de paie généré(s) pour ${payroll.MONTHS[month - 1]} ${year}.`);
    }
  } catch (err) {
    back('/fiches-de-paie', safeError(err), true);
  }
}

export async function markPayslipPaidAction(fd) {
  const { company } = await auth.requireCompany();
  const id = Number(fd.get('id'));
  const payment_method = text(fd, 'payment_method', 30);
  const payment_reference = text(fd, 'payment_reference', 100);
  const payment_date = text(fd, 'payment_date', 20);
  try {
    await payroll.markPayslipPaid(company, id, { payment_date, payment_method, payment_reference });
    revalidatePath('/fiches-de-paie');
    back(`/fiches-de-paie/${id}`, 'Bulletin marqué comme payé.');
  } catch (err) {
    back(`/fiches-de-paie/${id}`, safeError(err), true);
  }
}

export async function deletePayslipAction(fd) {
  const { company } = await auth.requireCompany();
  const id = Number(fd.get('id'));
  try {
    await payroll.deletePayslip(company.id, id);
    revalidatePath('/fiches-de-paie');
    back('/fiches-de-paie', 'Bulletin de paie supprimé.');
  } catch (err) {
    back('/fiches-de-paie', safeError(err), true);
  }
}

// ---------- Ressources Humaines : Congés & Absences ----------

export async function createLeaveRequestAction(fd) {
  const { company } = await auth.requireCompany();
  const returnUrl = text(fd, 'return_url', 200) || '/conges';
  try {
    const r = await leaves.createLeaveRequest(company.id, {
      employee_id: Number(fd.get('employee_id')),
      type: text(fd, 'type', 40),
      start_date: text(fd, 'start_date', 20),
      end_date: text(fd, 'end_date', 20),
      days_count: number(fd, 'days_count', { min: 0.5, fallback: 1 }),
      reason: text(fd, 'reason', 300),
    }, fd.get('justificatif'));
    if (r && r.error) back(returnUrl, r.error, true);
    revalidatePath(returnUrl);
    revalidatePath('/', 'layout');
    back(returnUrl, 'Demande de congé enregistrée avec succès.');
  } catch (err) {
    back(returnUrl, safeError(err), true);
  }
}

export async function reviewLeaveRequestAction(fd) {
  const { company } = await auth.requireCompany();
  const id = Number(fd.get('id'));
  const status = text(fd, 'status', 30);
  const review_note = text(fd, 'review_note', 300);
  try {
    await leaves.reviewLeaveRequest(company.id, id, { status, review_note });
    revalidatePath('/conges');
    back('/conges', `Demande de congé ${status === 'approuve' ? 'approuvée' : 'refusée'}.`);
  } catch (err) {
    back('/conges', safeError(err), true);
  }
}

// ---------- Ressources Humaines : Acomptes sur Salaire ----------

export async function requestSalaryAdvanceAction(fd) {
  const { company } = await auth.requireCompany();
  const returnUrl = text(fd, 'return_url', 200) || '/acomptes';
  try {
    await advances.requestSalaryAdvance(company.id, {
      employee_id: Number(fd.get('employee_id')),
      amount: number(fd, 'amount'),
      reason: text(fd, 'reason', 300),
      period_month: number(fd, 'period_month'),
      period_year: number(fd, 'period_year'),
      payment_method: text(fd, 'payment_method', 30),
    });
    revalidatePath(returnUrl);
    revalidatePath('/', 'layout');
    back(returnUrl, 'Demande d’acompte soumise avec succès.');
  } catch (err) {
    back(returnUrl, safeError(err), true);
  }
}

export async function reviewSalaryAdvanceAction(fd) {
  const { company } = await auth.requireCompany();
  const id = Number(fd.get('id'));
  const status = text(fd, 'status', 30);
  const payment_method = text(fd, 'payment_method', 30);
  const payment_reference = text(fd, 'payment_reference', 100);
  try {
    await advances.reviewSalaryAdvance(company.id, id, { status, payment_method, payment_reference });
    revalidatePath('/acomptes');
    back('/acomptes', `Demande d’acompte mise à jour (${status}).`);
  } catch (err) {
    back('/acomptes', safeError(err), true);
  }
}

// ---------- Ressources Humaines : Notes de Frais ----------

export async function createExpenseReportAction(fd) {
  const { company } = await auth.requireCompany();
  const returnUrl = text(fd, 'return_url', 200) || '/notes-de-frais';
  try {
    const r = await expenses.createExpenseReport(company.id, {
      employee_id: Number(fd.get('employee_id')),
      title: text(fd, 'title', 100),
      amount: number(fd, 'amount'),
      category: text(fd, 'category', 40),
      expense_date: text(fd, 'expense_date', 20),
    }, fd.get('recu'));
    if (r && r.error) back(returnUrl, r.error, true);
    revalidatePath(returnUrl);
    revalidatePath('/', 'layout');
    back(returnUrl, 'Note de frais enregistrée avec succès.');
  } catch (err) {
    back(returnUrl, safeError(err), true);
  }
}

export async function reviewExpenseReportAction(fd) {
  const { company } = await auth.requireCompany();
  const id = Number(fd.get('id'));
  const status = text(fd, 'status', 30);
  const payment_reference = text(fd, 'payment_reference', 100);
  try {
    await expenses.reviewExpenseReport(company.id, id, { status, payment_reference });
    revalidatePath('/notes-de-frais');
    back('/notes-de-frais', `Note de frais mise à jour (${status}).`);
  } catch (err) {
    back('/notes-de-frais', safeError(err), true);
  }
}

// ---------- Portail Salarié : lien d'accès, révocation, et demandes du salarié ----------

// Page de retour. L'activation se fait aussi bien depuis la fiche que depuis la liste des
// salariés : sans cela, le bouton de la liste renvoyait le propriétaire sur la fiche, ce qui
// annulait l'intérêt d'agir sans quitter la liste. On n'accepte qu'un chemin interne.
function portalReturnPath(fd, employeeId) {
  const wanted = String(fd.get('return_to') || '').trim();
  return wanted.startsWith('/') && !wanted.startsWith('//') ? wanted : `/employes/${employeeId}`;
}

// Crée le lien d'accès, ou le renouvelle. Le bouton « Régénérer le lien » passe `force` : sans
// cela la fonction renvoyait le jeton déjà en base et le bouton ne coupait rien, un lien fuite
// restant valable pour toujours.
export async function generateEmployeePortalTokenAction(fd) {
  const { company } = await auth.requireCompany();
  const employeeId = Number(fd.get('employee_id'));
  const to = portalReturnPath(fd, employeeId);
  if (!(await employees.getEmployee(company.id, employeeId))) back(to, 'Salarié introuvable.', true);
  const wasActive = Boolean((await employees.getEmployee(company.id, employeeId)).portal_token);
  try {
    const token = await portal.getOrCreatePortalToken(employeeId, { force: fd.get('regen') === '1' });
    const emp = await employees.getEmployee(company.id, employeeId);
    if (emp?.email) {
      const portalUrl = `${appUrl()}/portail/${token}`;
      try {
        await sendMail({
          to: emp.email,
          replyTo: company.email || undefined,
          ...(await withImages(employeePortalInvitationEmail({ employee: emp, company, portalUrl }), company)),
        });
      } catch (mailErr) {
        console.error('Erreur envoi email portail salarié:', mailErr);
      }
    }
    revalidatePath(`/employes/${employeeId}`);
    revalidatePath('/employes');
    revalidatePath('/', 'layout');
    back(to, wasActive
      ? 'Ancien lien coupé et nouveau lien créé. L\'ancien ne fonctionne plus.'
      : `Lien d'accès créé : il donne accès aux bulletins de paie et reste valable ${portal.TOKEN_DAYS} jours après chaque visite.`);
  } catch (err) {
    back(to, safeError(err), true);
  }
}

// Coupe définitivement l'accès du salarié à son portail.
export async function revokeEmployeePortalAccessAction(fd) {
  const { company } = await auth.requireCompany();
  const employeeId = Number(fd.get('employee_id'));
  const to = portalReturnPath(fd, employeeId);
  if (!(await employees.getEmployee(company.id, employeeId))) back(to, 'Salarié introuvable.', true);
  await portal.revokePortalToken(employeeId);
  revalidatePath(`/employes/${employeeId}`);
  revalidatePath('/employes');
  revalidatePath('/', 'layout');
  back(to, 'Accès au portail coupé. Le salarié ne peut plus ouvrir ses bulletins avec l\'ancien lien.');
}

// Résout le salarié depuis le jeton du portail et refuse tout le reste. Le `employee_id` des
// formulaires du portail est volontairement ignoré : seul le jeton décide de quel salarié il
// s'agit, ce qui empêche d'écrire une demande au nom de quelqu'un d'autre. Renvoie { employee,
// backUrl }, ou redirige vers la page d'accueil du portail en cas de jeton invalide ou expiré.
async function portalGuard(fd) {
  const token = text(fd, 'portal_token', 120);
  const backUrl = `/portail/${token}`;

  if (!token) redirect('/');

  // Limite les envois depuis un même appareil et un même jeton : le portail est une page publique,
  // son adresse circule et ses formulaires ne doivent pas pouvoir être remplis en boucle.
  if (await hitLimit('portal', token, 20, 60)) {
    back(backUrl, 'Trop d\'envois depuis cet appareil. Réessaie dans une heure.', true);
  }

  const employee = await portal.portalEmployee(token);
  if (!employee) {
    const expired = await portal.portalIsExpired(token);
    redirect(expired
      ? `/portail/${token}?expire=1`
      : '/');
  }
  if (employee.status === 'inactif' || employee.status === 'archive') {
    back(backUrl, 'Votre accès a été fermé par votre employeur. Contactez le service RH.', true);
  }
  return { employee, backUrl };
}

export async function portalLeaveRequestAction(fd) {
  const { employee, backUrl } = await portalGuard(fd);
  const r = await leaves.createLeaveRequest(employee.company_id, {
    employee_id: employee.id,
    type: text(fd, 'type', 40),
    start_date: text(fd, 'start_date', 20),
    end_date: text(fd, 'end_date', 20),
    days_count: number(fd, 'days_count', { min: 0.5, fallback: 1 }),
    reason: text(fd, 'reason', 300),
  }, fd.get('justificatif'));
  if (r && r.error) back(backUrl, r.error, true);
  await portal.touchPortalAccess(employee);
  revalidatePath(backUrl);
  revalidatePath('/conges');
  back(backUrl, 'Votre demande a été transmise. Vous serez notifié dès qu\'elle est traitée.');
}

export async function portalAdvanceRequestAction(fd) {
  const { employee, backUrl } = await portalGuard(fd);
  const now = new Date();
  await advances.requestSalaryAdvance(employee.company_id, {
    employee_id: employee.id,
    amount: number(fd, 'amount'),
    reason: text(fd, 'reason', 300),
    period_month: number(fd, 'period_month', { min: 1, max: 12, fallback: now.getUTCMonth() + 1 }),
    period_year: number(fd, 'period_year', { min: 2000, max: 2100, fallback: now.getUTCFullYear() }),
    payment_method: text(fd, 'payment_method', 30),
  });
  await portal.touchPortalAccess(employee);
  revalidatePath(backUrl);
  revalidatePath('/acomptes');
  back(backUrl, 'Votre demande d\'acompte a été transmise.');
}

export async function portalExpenseReportAction(fd) {
  const { employee, backUrl } = await portalGuard(fd);
  const r = await expenses.createExpenseReport(employee.company_id, {
    employee_id: employee.id,
    title: text(fd, 'title', 100),
    amount: number(fd, 'amount'),
    category: text(fd, 'category', 40),
    expense_date: text(fd, 'expense_date', 20),
  }, fd.get('recu'));
  if (r && r.error) back(backUrl, r.error, true);
  await portal.touchPortalAccess(employee);
  revalidatePath(backUrl);
  revalidatePath('/notes-de-frais');
  back(backUrl, 'Votre note de frais a été transmise.');
}
