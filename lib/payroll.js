import { q, one } from './db.js';
import { roundFor } from './money.js';
import { today } from './dates.js';
import { MONTHS, calculatePayslip } from './rh-constants.js';

export { MONTHS, calculatePayslip };


// Prochain numéro séquentiel de bulletin pour l'entreprise
async function nextPayslipNumber(companyId, year, month) {
  const mStr = String(month).padStart(2, '0');
  const count = await one(
    'SELECT count(*)::int AS n FROM payslips WHERE company_id = $1 AND period_year = $2 AND period_month = $3',
    [companyId, year, month]
  );
  const seq = String((count?.n || 0) + 1).padStart(3, '0');
  return `BS-${year}${mStr}-${seq}`;
}

// Liste les bulletins de paie d'une entreprise
export async function listPayslips(companyId, { year, month, employeeId, status } = {}) {
  let query = `
    SELECT p.*, e.first_name, e.last_name, e.job_title, e.department, e.cnss_number, e.phone AS employee_phone
    FROM payslips p
    JOIN employees e ON e.id = p.employee_id
    WHERE p.company_id = $1
  `;
  const params = [companyId];
  let idx = 2;

  if (year) {
    query += ` AND p.period_year = $${idx++}`;
    params.push(Number(year));
  }
  if (month) {
    query += ` AND p.period_month = $${idx++}`;
    params.push(Number(month));
  }
  if (employeeId) {
    query += ` AND p.employee_id = $${idx++}`;
    params.push(Number(employeeId));
  }
  if (status && status !== 'all') {
    query += ` AND p.status = $${idx++}`;
    params.push(status);
  }

  query += ' ORDER BY p.period_year DESC, p.period_month DESC, p.id DESC';
  return q(query, params);
}

// Récupère un bulletin par son id
export async function getPayslip(companyId, id) {
  return one(`
    SELECT p.*, e.first_name, e.last_name, e.job_title, e.department, e.cnss_number,
      e.id_card_number, e.contract_type, e.category, e.hire_date, e.email AS employee_email,
      e.phone AS employee_phone, e.payment_details AS employee_payment_details
    FROM payslips p
    JOIN employees e ON e.id = p.employee_id
    WHERE p.company_id = $1 AND p.id = $2
  `, [companyId, Number(id) || 0]);
}

// Crée ou met à jour un bulletin de paie
export async function savePayslip(company, data) {
  const employeeId = Number(data.employee_id);
  const employee = await one('SELECT * FROM employees WHERE company_id = $1 AND id = $2', [company.id, employeeId]);
  if (!employee) throw new Error('Salarié introuvable.');

  const periodMonth = Math.min(Math.max(Number(data.period_month) || new Date().getUTCMonth() + 1, 1), 12);
  const periodYear = Number(data.period_year) || new Date().getUTCFullYear();
  const currency = company.currency || 'XOF';

  const calc = calculatePayslip({
    base_salary: data.base_salary ?? employee.base_salary,
    seniority_bonus: data.seniority_bonus,
    transport_allowance: data.transport_allowance,
    function_allowance: data.function_allowance,
    other_allowances: data.other_allowances,
    overtime_amount: data.overtime_amount,
    cnss_employee_rate: data.cnss_employee_rate,
    tax_salary_amount: data.tax_salary_amount,
    salary_advances: data.salary_advances,
    other_deductions: data.other_deductions,
    cnss_employer_rate: data.cnss_employer_rate,
  }, currency);

  const status = ['brouillon', 'valide', 'paye'].includes(data.status) ? data.status : 'brouillon';
  const paymentMethod = data.payment_method || employee.payment_method || 'tmoney';
  const issueDate = data.issue_date || today();
  const paymentDate = data.payment_date || (status === 'paye' ? today() : '');

  if (data.id) {
    const existing = await getPayslip(company.id, data.id);
    if (!existing) throw new Error('Bulletin introuvable.');

    return one(`
      UPDATE payslips SET
        period_month = $1, period_year = $2, issue_date = $3, payment_date = $4,
        base_salary = $5, seniority_bonus = $6, transport_allowance = $7, function_allowance = $8,
        other_allowances = $9, overtime_amount = $10, gross_salary = $11,
        cnss_employee_rate = $12, cnss_employee_amount = $13, tax_salary_amount = $14,
        salary_advances = $15, other_deductions = $16, total_deductions = $17,
        net_salary = $18, cnss_employer_rate = $19, cnss_employer_amount = $20,
        total_employer_cost = $21, status = $22, payment_method = $23, payment_reference = $24,
        notes = $25
      WHERE company_id = $26 AND id = $27
      RETURNING *`, [
      periodMonth, periodYear, issueDate, paymentDate,
      calc.baseSalary, calc.seniorityBonus, calc.transportAllowance, calc.functionAllowance,
      calc.otherAllowances, calc.overtimeAmount, calc.grossSalary,
      calc.cnssEmployeeRate, calc.cnssEmployeeAmount, calc.taxSalaryAmount,
      calc.salaryAdvances, calc.otherDeductions, calc.totalDeductions,
      calc.netSalary, calc.cnssEmployerRate, calc.cnssEmployerAmount,
      calc.totalEmployerCost, status, paymentMethod, String(data.payment_reference || '').trim(),
      String(data.notes || '').trim(), company.id, existing.id
    ]);
  }

  const number = await nextPayslipNumber(company.id, periodYear, periodMonth);

  return one(`
    INSERT INTO payslips (
      company_id, employee_id, number, period_month, period_year, issue_date, payment_date,
      currency, base_salary, seniority_bonus, transport_allowance, function_allowance,
      other_allowances, overtime_amount, gross_salary, cnss_employee_rate, cnss_employee_amount,
      tax_salary_amount, salary_advances, other_deductions, total_deductions, net_salary,
      cnss_employer_rate, cnss_employer_amount, total_employer_cost, status, payment_method,
      payment_reference, notes
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
      $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29
    ) RETURNING *`, [
    company.id, employee.id, number, periodMonth, periodYear, issueDate, paymentDate,
    currency, calc.baseSalary, calc.seniorityBonus, calc.transportAllowance, calc.functionAllowance,
    calc.otherAllowances, calc.overtimeAmount, calc.grossSalary, calc.cnssEmployeeRate, calc.cnssEmployeeAmount,
    calc.taxSalaryAmount, calc.salaryAdvances, calc.otherDeductions, calc.totalDeductions, calc.netSalary,
    calc.cnssEmployerRate, calc.cnssEmployerAmount, calc.totalEmployerCost, status, paymentMethod,
    String(data.payment_reference || '').trim(), String(data.notes || '').trim()
  ]);
}

// Génère en 1 clic les bulletins du mois pour tous les salariés actifs
export async function generateMonthlyPayslips(company, { year, month }) {
  const activeEmployees = await q(
    "SELECT * FROM employees WHERE company_id = $1 AND status IN ('actif', 'conge')",
    [company.id]
  );
  if (!activeEmployees.length) {
    throw new Error('Aucun salarié actif trouvé.');
  }

  const created = [];
  for (const emp of activeEmployees) {
    // Vérifier si un bulletin existe déjà pour ce salarié sur ce mois
    const existing = await one(
      'SELECT id FROM payslips WHERE company_id = $1 AND employee_id = $2 AND period_year = $3 AND period_month = $4',
      [company.id, emp.id, year, month]
    );
    if (!existing) {
      const p = await savePayslip(company, {
        employee_id: emp.id,
        period_year: year,
        period_month: month,
        base_salary: emp.base_salary,
        payment_method: emp.payment_method,
        status: 'brouillon',
      });
      created.push(p);
    }
  }

  return created;
}

// Marque un bulletin comme payé
export async function markPayslipPaid(company, id, { payment_date, payment_method, payment_reference } = {}) {
  return one(`
    UPDATE payslips SET
      status = 'paye',
      payment_date = COALESCE($1, CURRENT_DATE::text),
      payment_method = COALESCE($2, payment_method),
      payment_reference = COALESCE($3, payment_reference)
    WHERE company_id = $4 AND id = $5
    RETURNING *`, [payment_date || today(), payment_method, payment_reference || '', company.id, Number(id) || 0]);
}

// Supprime un bulletin de paie
export async function deletePayslip(companyId, id) {
  return q('DELETE FROM payslips WHERE company_id = $1 AND id = $2', [companyId, Number(id) || 0]);
}
