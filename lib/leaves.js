import { q, one } from './db.js';
import { LEAVE_TYPES } from './rh-constants.js';
import { storeUploadedFile } from './documents.js';

export { LEAVE_TYPES };

// Liste les demandes de congés
export async function listLeaveRequests(companyId, { employeeId, status } = {}) {
  let query = `
    SELECT lr.*, e.first_name, e.last_name, e.job_title, e.department, e.leave_balance
    FROM leave_requests lr
    JOIN employees e ON e.id = lr.employee_id
    WHERE lr.company_id = $1
  `;
  const params = [companyId];
  let idx = 2;

  if (employeeId) {
    query += ` AND lr.employee_id = $${idx++}`;
    params.push(Number(employeeId));
  }
  if (status && status !== 'all') {
    query += ` AND lr.status = $${idx++}`;
    params.push(status);
  }

  query += ' ORDER BY lr.created_at DESC, lr.id DESC';
  return q(query, params);
}

// Récupère une demande par son id
export async function getLeaveRequest(companyId, id) {
  return one(`
    SELECT lr.*, e.first_name, e.last_name, e.job_title, e.department, e.leave_balance
    FROM leave_requests lr
    JOIN employees e ON e.id = lr.employee_id
    WHERE lr.company_id = $1 AND lr.id = $2
  `, [companyId, Number(id) || 0]);
}

// Crée une demande de congé. `file` est le justificatif (certificat médical, convocation…) :
// facultatif, mais contrôlé comme les documents. Renvoie la demande, ou { error } si la pièce pose
// problème (on ne crée alors pas de demande à moitié enregistrée, sans justificatif).
export async function createLeaveRequest(companyId, { employee_id, type, start_date, end_date, days_count, reason, document_url, document_name, document_mime }, file) {
  const emp = await one('SELECT id, leave_balance FROM employees WHERE company_id = $1 AND id = $2', [companyId, Number(employee_id) || 0]);
  if (!emp) throw new Error('Salarié introuvable.');

  const leaveType = LEAVE_TYPES[type] ? type : 'conge_paye';
  const days = Math.max(0.5, Number(days_count) || 1);

  let stored = {};
  if (file) {
    stored = await storeUploadedFile(file, 'rh/conges');
    if (stored.error) return { error: stored.error };
  }

  return one(`
    INSERT INTO leave_requests (company_id, employee_id, type, start_date, end_date, days_count, reason, document_url, document_name, document_mime, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'en_attente')
    RETURNING *`, [companyId, emp.id, leaveType, start_date, end_date, days,
    String(reason || '').trim(), stored.key || document_url || '', stored.name || '', stored.mime || '']);
}

// Approuve ou refuse une demande
export async function reviewLeaveRequest(companyId, id, { status, review_note = '' }) {
  const req = await getLeaveRequest(companyId, id);
  if (!req) throw new Error('Demande introuvable.');

  const nextStatus = ['approuve', 'refuse'].includes(status) ? status : 'en_attente';

  // Si approuvé et de type congé payé, on déduit du solde
  if (nextStatus === 'approuve' && req.type === 'conge_paye' && req.status !== 'approuve') {
    await q('UPDATE employees SET leave_balance = GREATEST(0, leave_balance - $1) WHERE id = $2', [req.days_count, req.employee_id]);
  }

  return one(`
    UPDATE leave_requests SET
      status = $1,
      reviewed_at = now(),
      review_note = $2
    WHERE company_id = $3 AND id = $4
    RETURNING *`, [nextStatus, String(review_note || '').trim(), companyId, req.id]);
}
