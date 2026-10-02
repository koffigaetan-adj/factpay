import { q, one } from './db.js';
import { today } from './dates.js';

// Liste les demandes d'acomptes
export async function listAdvances(companyId, { employeeId, status, year, month } = {}) {
  let query = `
    SELECT sa.*, e.first_name, e.last_name, e.job_title, e.department, e.base_salary, e.phone AS employee_phone
    FROM salary_advances sa
    JOIN employees e ON e.id = sa.employee_id
    WHERE sa.company_id = $1
  `;
  const params = [companyId];
  let idx = 2;

  if (employeeId) {
    query += ` AND sa.employee_id = $${idx++}`;
    params.push(Number(employeeId));
  }
  if (status && status !== 'all') {
    query += ` AND sa.status = $${idx++}`;
    params.push(status);
  }
  if (year) {
    query += ` AND sa.period_year = $${idx++}`;
    params.push(Number(year));
  }
  if (month) {
    query += ` AND sa.period_month = $${idx++}`;
    params.push(Number(month));
  }

  query += ' ORDER BY sa.created_at DESC, sa.id DESC';
  return q(query, params);
}

// Crée une demande d'acompte
export async function requestSalaryAdvance(companyId, { employee_id, amount, reason, period_month, period_year, payment_method }) {
  const emp = await one('SELECT id, base_salary, payment_method FROM employees WHERE company_id = $1 AND id = $2', [companyId, Number(employee_id) || 0]);
  if (!emp) throw new Error('Salarié introuvable.');

  const amt = Math.max(1000, Number(amount) || 0);
  const m = Number(period_month) || (new Date().getUTCMonth() + 1);
  const y = Number(period_year) || new Date().getUTCFullYear();
  const method = payment_method || emp.payment_method || 'tmoney';

  return one(`
    INSERT INTO salary_advances (company_id, employee_id, amount, reason, period_month, period_year, payment_method, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'en_attente')
    RETURNING *`, [companyId, emp.id, amt, String(reason || '').trim(), m, y, method]);
}

// Valide, paye ou refuse une demande d'acompte
export async function reviewSalaryAdvance(companyId, id, { status, payment_method, payment_reference }) {
  const adv = await one('SELECT * FROM salary_advances WHERE company_id = $1 AND id = $2', [companyId, Number(id) || 0]);
  if (!adv) throw new Error('Acompte introuvable.');

  const nextStatus = ['approuve', 'paye', 'refuse'].includes(status) ? status : 'en_attente';
  const paidAt = nextStatus === 'paye' ? new Date().toISOString() : null;

  return one(`
    UPDATE salary_advances SET
      status = $1,
      payment_method = COALESCE($2, payment_method),
      payment_reference = COALESCE($3, payment_reference),
      paid_at = $4
    WHERE company_id = $5 AND id = $6
    RETURNING *`, [nextStatus, payment_method, payment_reference || '', paidAt, companyId, adv.id]);
}
