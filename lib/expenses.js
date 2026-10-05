import { q, one } from './db.js';
import { today } from './dates.js';
import { EXPENSE_CATEGORIES } from './rh-constants.js';
import { storeUploadedFile } from './documents.js';

export { EXPENSE_CATEGORIES };

// Liste les notes de frais
export async function listExpenses(companyId, { employeeId, status } = {}) {
  let query = `
    SELECT er.*, e.first_name, e.last_name, e.job_title, e.department, e.phone AS employee_phone
    FROM expense_reports er
    JOIN employees e ON e.id = er.employee_id
    WHERE er.company_id = $1
  `;
  const params = [companyId];
  let idx = 2;

  if (employeeId) {
    query += ` AND er.employee_id = $${idx++}`;
    params.push(Number(employeeId));
  }
  if (status && status !== 'all') {
    query += ` AND er.status = $${idx++}`;
    params.push(status);
  }

  query += ' ORDER BY er.created_at DESC, er.id DESC';
  return q(query, params);
}

// Crée une note de frais. Le reçu (photo du ticket, facture carburant) est facultatif mais
// contrôlé ; en cas de problème il est refusé plutôt que d'enregistrer une note sans justificatif.
export async function createExpenseReport(companyId, { employee_id, title, amount, category, expense_date, receipt_url, receipt_name, receipt_mime }, file) {
  const emp = await one('SELECT id FROM employees WHERE company_id = $1 AND id = $2', [companyId, Number(employee_id) || 0]);
  if (!emp) throw new Error('Salarié introuvable.');

  const amt = Math.max(100, Number(amount) || 0);
  const cat = EXPENSE_CATEGORIES[category] ? category : 'transport';
  const expDate = expense_date || today();

  let stored = {};
  if (file) {
    stored = await storeUploadedFile(file, 'rh/frais');
    if (stored.error) return { error: stored.error };
  }

  return one(`
    INSERT INTO expense_reports (company_id, employee_id, title, amount, category, expense_date, receipt_url, receipt_name, receipt_mime, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'en_attente')
    RETURNING *`, [companyId, emp.id, String(title || 'Note de frais').trim(), amt, cat, expDate,
    stored.key || receipt_url || '', stored.name || '', stored.mime || '']);
}

// Valide ou rembourse une note de frais
export async function reviewExpenseReport(companyId, id, { status, payment_reference = '' }) {
  const exp = await one('SELECT * FROM expense_reports WHERE company_id = $1 AND id = $2', [companyId, Number(id) || 0]);
  if (!exp) throw new Error('Note de frais introuvable.');

  const nextStatus = ['approuve', 'rembourse', 'refuse'].includes(status) ? status : 'en_attente';

  return one(`
    UPDATE expense_reports SET
      status = $1,
      payment_reference = $2
    WHERE company_id = $3 AND id = $4
    RETURNING *`, [nextStatus, String(payment_reference || '').trim(), companyId, exp.id]);
}
