import { q } from './db.js';

// Récupère l'organigramme complet de l'entreprise
export async function getCompanyOrgChart(companyId) {
  const employees = await q(`
    SELECT e.id, e.first_name, e.last_name, e.job_title, e.department, e.manager_id,
      e.email, e.phone, e.contract_type, e.avatar_url, e.status,
      m.first_name AS manager_first_name, m.last_name AS manager_last_name
    FROM employees e
    LEFT JOIN employees m ON m.id = e.manager_id
    WHERE e.company_id = $1 AND e.status IN ('actif', 'conge')
    ORDER BY e.department, e.last_name, e.first_name
  `, [companyId]);

  // Regroupement par département
  const departments = {};
  for (const emp of employees) {
    const dep = emp.department || 'Général / Direction';
    if (!departments[dep]) departments[dep] = [];
    departments[dep].push(emp);
  }

  return {
    totalEmployees: employees.length,
    employees,
    departments,
  };
}
