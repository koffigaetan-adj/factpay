import crypto from 'crypto';
import { q, one } from './db.js';
import { listPayslips } from './payroll.js';
import { listLeaveRequests } from './leaves.js';
import { listAdvances } from './advances.js';
import { listExpenses } from './expenses.js';
import { getCompanyOrgChart } from './orgchart.js';
import { hashPassword, checkPassword, passwordProblem } from './password.js';

// Durée de validité d'un lien d'accès au portail salarié, **reprise à chaque visite**. Le lien
// reste donc utilisable tant que le salarié l'ouvre, et c'est seulement un lien abandonné qui
// cesse de fonctionner au bout de trois mois. C'est indispensable ici : ces liens circulent par
// WhatsApp, on les renvoie à l'appui d'un bulletin, et un lien mort à six mois serait perçu comme
// une panne alors que le salarié vient de le recevoir.
export const TOKEN_DAYS = 90;

const expiryOf = (from = new Date()) =>
  new Date(from.getTime() + TOKEN_DAYS * 24 * 3600 * 1000).toISOString();

const newToken = () => 'emp_' + crypto.randomBytes(24).toString('base64url');

// Crée un lien d'accès, ou en renouvelle un existant. `force` ignore le lien en cours : c'est ce
// que fait le bouton « Régénérer le lien », qui doit invalider l'ancien pour qu'une fuite soit
// réellement coupée (sans `force`, on renvoyait le même jeton et le bouton ne servait à rien).
export async function getOrCreatePortalToken(employeeId, { force = false } = {}) {
  const emp = await one(
    'SELECT id, portal_token, portal_token_expires_at FROM employees WHERE id = $1',
    [Number(employeeId) || 0],
  );
  if (!emp) return null;
  const stillValid = emp.portal_token
    && emp.portal_token_expires_at && new Date(emp.portal_token_expires_at) > new Date();
  if (stillValid && !force) return emp.portal_token;

  const token = newToken();
  await q(`UPDATE employees SET portal_token = $1, portal_token_created_at = now(), portal_token_expires_at = $2
    WHERE id = $3`, [token, expiryOf(), emp.id]);
  return token;
}

// Coupe l'accès : le lien affiché sur la fiche salarié devient immédiatement inopérant.
export async function revokePortalToken(employeeId) {
  const emp = await one('SELECT id FROM employees WHERE id = $1', [Number(employeeId) || 0]);
  if (!emp) return false;
  await q(`UPDATE employees SET portal_token = NULL, portal_token_expires_at = NULL WHERE id = $1`, [emp.id]);
  return true;
}

export const portalExpiryOf = expiryOf;

// Retrouve le salarié par son jeton de portail. Un lien expiré est traité comme inexistant.
export async function getEmployeeByPortalToken(token) {
  if (!token || typeof token !== 'string') return null;
  return one(`
    SELECT e.*, c.name AS company_name, c.currency, c.legal_ids AS company_legal_ids,
           c.email AS company_email, c.phone AS company_phone, c.address AS company_address
    FROM employees e
    JOIN companies c ON c.id = e.company_id
    WHERE e.portal_token = $1 AND e.portal_token_expires_at > now()
  `, [token]);
}

// Vérifie un jeton renvoyé par un formulaire du portail. Renvoie le salarié, ou null : l'appelant
// ne fait jamais confiance au `employee_id` envoyé avec le formulaire, il utilise celui-ci.
export async function portalEmployee(token) {
  const emp = await getEmployeeByPortalToken(token);
  if (emp) return emp;
  // Un lien expiré existe peut-être encore : on le distingue pour indiquer la bonne raison.
  if (token && typeof token === 'string') {
    const stale = await one('SELECT id FROM employees WHERE portal_token = $1', [token]);
    if (stale) return null;
  }
  return null;
}

// Distingue « lien inconnu » de « lien arrivé à échéance », pour afficher le bon message au
// salarié. Un lien sans échéance est considéré comme expiré : il ne doit plus ouvrir le portail.
export async function portalIsExpired(token) {
  if (!token || typeof token !== 'string') return false;
  const row = await one('SELECT portal_token_expires_at FROM employees WHERE portal_token = $1', [token]);
  if (!row) return false;
  if (!row.portal_token_expires_at) return true;
  return new Date(row.portal_token_expires_at) <= new Date();
}

// Note la visite : alimente la dernière connexion affichée sur la fiche du salarié et le journal
// des consultations, consultable par le propriétaire de l'entreprise. L'échéance est repoussée au
// même moment : c'est ce qui rend le lien tenable quand il passe par la messagerie.
export async function touchPortalAccess(employee) {
  await q('UPDATE employees SET portal_last_seen_at = now(), portal_token_expires_at = $2 WHERE id = $1',
    [employee.id, expiryOf()]);
  let ip = '';
  try {
    const { headers } = await import('next/headers');
    const h = await headers();
    ip = (h.get('x-forwarded-for') || h.get('x-real-ip') || '').split(',')[0].trim();
  } catch {
    // Hors serveur Next (tests) : pas d'adresse à lire, la visite reste journalisée sans IP.
  }
  await q('INSERT INTO portal_access_log (employee_id, company_id, ip) VALUES ($1, $2, $3)',
    [employee.id, employee.company_id, ip.slice(0, 60)]);
}

// Les 20 dernières ouvertures, pour le propriétaire
export async function recentPortalAccess(employeeId, limit = 20) {
  return q('SELECT ip, seen_at FROM portal_access_log WHERE employee_id = $1 ORDER BY seen_at DESC LIMIT $2',
    [Number(employeeId) || 0, Math.min(100, Math.max(1, Number(limit) || 20))]);
}

// Le composant portail est un composant client : tout ce qu'il reçoit est envoyé au navigateur du
// salarié. On ne lui passe donc que les champs réellement affichés, jamais la ligne complète —
// le jeton d'accès, le salaire de base et les coordonnées de paiement n'ont rien à y faire.
export function portalViewOf(emp) {
  if (!emp) return emp;
  const {
    id, company_id, first_name, last_name, job_title, department, contract_type,
    hire_date, end_date, status, cnss_number, id_card_number, leave_balance,
    payment_method, currency, company_name, company_address, company_legal_ids,
    company_email, company_phone, email, phone, portal_confirmed_at,
  } = emp;
  return {
    id, company_id, first_name, last_name, job_title, department, contract_type,
    hire_date, end_date, status, cnss_number, id_card_number, leave_balance,
    payment_method, currency, company_name, company_address, company_legal_ids,
    company_email, company_phone, email, phone, portal_confirmed_at,
    has_password: Boolean(emp.portal_password_hash),
  };
}

// Active l'espace du collaborateur en enregistrant son mot de passe
export async function confirmPortalAccount(token, password, confirm) {
  const problem = passwordProblem(password, confirm);
  if (problem) return { ok: false, error: problem };

  const emp = await getEmployeeByPortalToken(token);
  if (!emp) return { ok: false, error: "Lien d'accès invalide ou expiré." };

  const hash = await hashPassword(password);
  await q(`
    UPDATE employees
    SET portal_password_hash = $1, portal_confirmed_at = now(), portal_last_seen_at = now()
    WHERE id = $2
  `, [hash, emp.id]);

  await q('INSERT INTO portal_access_log (employee_id, company_id, ip) VALUES ($1, $2, $3)',
    [emp.id, emp.company_id, 'activation']);

  return { ok: true, employee: emp };
}

// Permet au salarié connecté de changer son mot de passe
export async function changePortalPassword(token, currentPassword, newPassword, confirm) {
  const emp = await getEmployeeByPortalToken(token);
  if (!emp) return { ok: false, error: "Session ou lien d'accès introuvable." };

  if (emp.portal_password_hash) {
    const valid = await checkPassword(currentPassword, emp.portal_password_hash);
    if (!valid) return { ok: false, error: "Le mot de passe actuel est incorrect." };
  }

  const problem = passwordProblem(newPassword, confirm);
  if (problem) return { ok: false, error: problem };

  const hash = await hashPassword(newPassword);
  await q('UPDATE employees SET portal_password_hash = $1 WHERE id = $2', [hash, emp.id]);
  return { ok: true };
}

// Authentifie un salarié avec son e-mail ou téléphone et mot de passe
export async function authenticatePortalEmployee(identifier, password) {
  const clean = String(identifier || '').trim();
  if (!clean || !password) return { ok: false, error: "Identifiant ou mot de passe manquant." };

  const emp = await one(`
    SELECT e.*, c.name AS company_name
    FROM employees e
    JOIN companies c ON c.id = e.company_id
    WHERE (LOWER(e.email) = LOWER($1) OR e.phone = $1)
      AND e.portal_password_hash IS NOT NULL
    LIMIT 1
  `, [clean]);

  if (!emp) return { ok: false, error: "Aucun compte collaborateur actif correspondant avec mot de passe." };

  const valid = await checkPassword(password, emp.portal_password_hash);
  if (!valid) return { ok: false, error: "Identifiant ou mot de passe incorrect." };

  const token = await getOrCreatePortalToken(emp.id);
  await touchPortalAccess(emp);
  return { ok: true, employee: emp, token };
}

// Charge l'ensemble des données du portail salarié
export async function getEmployeePortalData(employee) {
  const [payslips, leaves, advances, expenses, orgChart, announcements] = await Promise.all([
    listPayslips(employee.company_id, { employeeId: employee.id }),
    listLeaveRequests(employee.company_id, { employeeId: employee.id }),
    listAdvances(employee.company_id, { employeeId: employee.id }),
    listExpenses(employee.company_id, { employeeId: employee.id }),
    getCompanyOrgChart(employee.company_id),
    q('SELECT * FROM company_announcements WHERE company_id = $1 ORDER BY pinned DESC, created_at DESC LIMIT 5', [employee.company_id]),
  ]);

  return {
    employee: portalViewOf(employee),
    payslips,
    leaves,
    advances,
    expenses,
    orgChart,
    announcements,
  };
}