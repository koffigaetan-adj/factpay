import { q, one } from './db.js';
import { CONTRACT_TYPES, PAYMENT_METHODS } from './rh-constants.js';

export { CONTRACT_TYPES, PAYMENT_METHODS };

// Liste les salariés d'une entreprise
export async function listEmployees(companyId, status = 'all') {
  if (status && status !== 'all') {
    return q('SELECT * FROM employees WHERE company_id = $1 AND status = $2 ORDER BY last_name, first_name', [companyId, status]);
  }
  return q('SELECT * FROM employees WHERE company_id = $1 ORDER BY last_name, first_name', [companyId]);
}

// Récupère un salarié par son id
export async function getEmployee(companyId, id) {
  return one('SELECT * FROM employees WHERE company_id = $1 AND id = $2', [companyId, Number(id) || 0]);
}

// Enregistre ou met à jour un salarié
export async function saveEmployee(company, data) {
  const firstName = String(data.first_name || '').trim();
  const lastName = String(data.last_name || '').trim();
  if (!firstName || !lastName) {
    throw new Error('Le prénom et le nom de famille sont requis.');
  }

  const baseSalary = Math.max(0, Number(String(data.base_salary || 0).replace(',', '.')) || 0);
  const contractType = CONTRACT_TYPES[data.contract_type] ? data.contract_type : 'CDI';
  const paymentMethod = PAYMENT_METHODS[data.payment_method] ? data.payment_method : 'bank';
  const status = ['actif', 'conge', 'inactif', 'archive'].includes(data.status) ? data.status : 'actif';

  const payload = [
    firstName,
    lastName,
    String(data.email || '').trim().toLowerCase(),
    String(data.phone || '').trim(),
    String(data.job_title || '').trim(),
    String(data.department || '').trim(),
    contractType,
    String(data.category || '').trim(),
    String(data.hire_date || '').trim(),
    String(data.end_date || '').trim(),
    String(data.cnss_number || '').trim(),
    String(data.id_card_number || '').trim(),
    baseSalary,
    paymentMethod,
    String(data.payment_details || '').trim(),
    status,
  ];

  if (data.id) {
    const existing = await getEmployee(company.id, data.id);
    if (!existing) throw new Error('Salarié introuvable.');

    return one(`
      UPDATE employees SET
        first_name = $1, last_name = $2, email = $3, phone = $4, job_title = $5,
        department = $6, contract_type = $7, category = $8, hire_date = $9, end_date = $10,
        cnss_number = $11, id_card_number = $12, base_salary = $13, payment_method = $14,
        payment_details = $15, status = $16
      WHERE company_id = $17 AND id = $18
      RETURNING *`, [...payload, company.id, existing.id]);
  }

  return one(`
    INSERT INTO employees (
      first_name, last_name, email, phone, job_title, department, contract_type,
      category, hire_date, end_date, cnss_number, id_card_number, base_salary,
      payment_method, payment_details, status, company_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    RETURNING *`, [...payload, company.id]);
}

// Supprime un salarié (s'il n'a pas de bulletins attachés ou le désactive)
export async function deleteEmployee(companyId, id) {
  const payslips = await q('SELECT id FROM payslips WHERE company_id = $1 AND employee_id = $2 LIMIT 1', [companyId, Number(id) || 0]);
  if (payslips.length > 0) {
    // Si des bulletins existent, on archive pour préserver l'historique légal
    await q("UPDATE employees SET status = 'archive' WHERE company_id = $1 AND id = $2", [companyId, Number(id) || 0]);
    return { archived: true };
  }
  await q('DELETE FROM employees WHERE company_id = $1 AND id = $2', [companyId, Number(id) || 0]);
  return { deleted: true };
}

// Compteurs de la barre latérale RH : ce qui attend une décision de l'employeur. Une seule requête,
// les sous-selects ne renvoyant qu'une ligne chacun.
// Les alias sont en minuscules : PostgreSQL replie en minuscules tout identifiant non cité,
// donc un alias « aPayer » revenait « apayer » et le compteur valait 0 en silence.
export async function getRhNavCounts(companyId) {
  try {
    const row = await one(`
      SELECT
        (SELECT count(*)::int FROM employees WHERE company_id = $1 AND status = 'actif') AS effectif,
        (SELECT count(*)::int FROM leave_requests WHERE company_id = $1 AND status = 'en_attente') AS conges,
        (SELECT count(*)::int FROM expense_reports WHERE company_id = $1 AND status = 'en_attente') AS notes,
        (SELECT count(*)::int FROM salary_advances WHERE company_id = $1 AND status = 'en_attente') AS acomptes,
        (SELECT count(*)::int FROM payslips WHERE company_id = $1 AND status = 'brouillon') AS brouillons,
        (SELECT count(*)::int FROM payslips WHERE company_id = $1 AND status = 'valide') AS a_payer,
        (SELECT count(*)::int FROM employees
          WHERE company_id = $1 AND status IN ('actif', 'conge')
            AND (portal_token IS NULL OR portal_token_expires_at IS NULL OR portal_token_expires_at <= now())) AS sans_portail
    `, [companyId]) || {};
    return {
      effectif: Number(row.effectif) || 0,
      conges: Number(row.conges) || 0,
      notes: Number(row.notes) || 0,
      acomptes: Number(row.acomptes) || 0,
      bulletinsBrouillons: Number(row.brouillons) || 0,
      bulletinsAPayer: Number(row.a_payer) || 0,
      sansPortail: Number(row.sans_portail) || 0,
    };
  } catch {
    return {
      effectif: 0,
      conges: 0,
      notes: 0,
      acomptes: 0,
      bulletinsBrouillons: 0,
      bulletinsAPayer: 0,
      sansPortail: 0,
    };
  }
}
