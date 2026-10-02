// RH & Paie : Gestion des salariés et fiches de paie (Togo / UEMOA)
// Base en mémoire. Lancer avec : npm test
process.env.PGLITE_DIR = 'memory://';
process.env.FACTPAY_QUIET = '1';
delete process.env.DATABASE_URL;
delete process.env.VAPID_PUBLIC_KEY;
delete process.env.VAPID_PRIVATE_KEY;

import { test, before } from 'node:test';
import assert from 'node:assert/strict';

let one, q, empLib, payLib;

before(async () => {
  ({ one, q } = await import('../lib/db.js'));
  empLib = await import('../lib/employees.js');
  payLib = await import('../lib/payroll.js');
});

async function makeCompany(ownerEmail) {
  const u = await one("INSERT INTO users (email, name, password_hash) VALUES ($1, 'Admin', 'x') RETURNING id", [ownerEmail]);
  return one("INSERT INTO companies (owner_id, name, currency, email) VALUES ($1, 'Tech Solutions Lomé', 'XOF', $2) RETURNING *",
    [u.id, ownerEmail]);
}

test("RH : création, modification et liste des salariés avec spécificités Togo", async () => {
  const company = await makeCompany('rh1@company.tg');

  const emp1 = await empLib.saveEmployee(company, {
    first_name: 'Koffi',
    last_name: 'Mensah',
    email: 'koffi.mensah@gmail.com',
    phone: '+22890123456',
    job_title: 'Ingénieur Logiciel',
    department: 'Technique',
    contract_type: 'CDI',
    category: 'Catégorie 6',
    hire_date: '2026-01-15',
    cnss_number: 'CNSS-TG-89214',
    id_card_number: 'CNI-0912-TG',
    base_salary: 250000,
    payment_method: 'tmoney',
    payment_details: '+22890123456',
    status: 'actif',
  });

  assert.ok(emp1.id, "Le salarié a un ID");
  assert.equal(emp1.first_name, 'Koffi');
  assert.equal(emp1.base_salary, 250000);
  assert.equal(emp1.payment_method, 'tmoney');

  const list = await empLib.listEmployees(company.id);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, emp1.id);

  // Modification
  const updated = await empLib.saveEmployee(company, {
    id: emp1.id,
    first_name: 'Koffi',
    last_name: 'Mensah',
    base_salary: 300000,
    job_title: 'Lead Developer',
  });
  assert.equal(updated.base_salary, 300000);
  assert.equal(updated.job_title, 'Lead Developer');
});

test("Paie : calcul exact des cotisations CNSS Togo (4% salariale, 17.5% patronale), Brut et Net", () => {
  const res = payLib.calculatePayslip({
    base_salary: 200000,
    transport_allowance: 25000,
    function_allowance: 15000,
    seniority_bonus: 10000,
    overtime_amount: 0,
    cnss_employee_rate: 4.0,
    tax_salary_amount: 12000,
    salary_advances: 30000,
    other_deductions: 0,
    cnss_employer_rate: 17.5,
  }, 'XOF');

  // Brut = 200000 + 25000 + 15000 + 10000 = 250000
  assert.equal(res.grossSalary, 250000, "Salaire brut exact");

  // CNSS Salariale 4% de 250000 = 10000
  assert.equal(res.cnssEmployeeAmount, 10000, "CNSS salariale 4%");

  // Total déductions = 10000 (CNSS) + 12000 (IRPP) + 30000 (Acompte) = 52000
  assert.equal(res.totalDeductions, 52000, "Total des retenues exact");

  // Net à payer = 250000 - 52000 = 198000
  assert.equal(res.netSalary, 198000, "Net à payer exact");

  // CNSS Patronale 17.5% de 250000 = 43750
  assert.equal(res.cnssEmployerAmount, 43750, "CNSS patronale 17.5%");

  // Coût total employeur = 250000 + 43750 = 293750
  assert.equal(res.totalEmployerCost, 293750, "Coût total employeur exact");
});

test("Paie : création manuelle et génération groupée de bulletins du mois", async () => {
  const company = await makeCompany('rh2@company.tg');

  const emp1 = await empLib.saveEmployee(company, {
    first_name: 'Afi',
    last_name: 'Agbessi',
    base_salary: 150000,
    payment_method: 'flooz',
    status: 'actif',
  });

  const emp2 = await empLib.saveEmployee(company, {
    first_name: 'Komla',
    last_name: 'Lawson',
    base_salary: 180000,
    payment_method: 'bank',
    status: 'actif',
  });

  // Génération automatique pour le mois 9 (Septembre) 2026
  const generated = await payLib.generateMonthlyPayslips(company, { year: 2026, month: 9 });
  assert.equal(generated.length, 2, "2 bulletins générés pour les 2 salariés actifs");
  assert.ok(generated[0].number.startsWith('BS-202609-'), "Numérotation séquentielle du mois");

  // Vérification de la liste
  const payslips = await payLib.listPayslips(company.id, { year: 2026, month: 9 });
  assert.equal(payslips.length, 2);

  // Régression : PostgreSQL replie en minuscules tout alias non cité. « aPayer » revenait donc
  // « apayer », et le compteur de la barre latérale valait 0 sans jamais lever d'erreur.
  let counts = await empLib.getRhNavCounts(company.id);
  assert.equal(counts.bulletinsBrouillons, 2, "Les deux bulletins générés sont des brouillons");
  assert.equal(counts.bulletinsAPayer, 0, "Rien à payer tant qu'un bulletin n'est pas validé");

  await q("UPDATE payslips SET status = 'valide' WHERE id = $1", [generated[1].id]);
  counts = await empLib.getRhNavCounts(company.id);
  assert.equal(counts.bulletinsAPayer, 1, "Un bulletin validé arrive bien dans le compteur « à payer »");

  // Marquer comme payé
  const paid = await payLib.markPayslipPaid(company, generated[0].id, {
    payment_date: '2026-09-30',
    payment_method: 'flooz',
    payment_reference: 'FLZ-9812401',
  });
  assert.equal(paid.status, 'paye');
  assert.equal(paid.payment_reference, 'FLZ-9812401');

  // Tentative de suppression d'un salarié ayant des bulletins -> Archivage automatique
  const delRes = await empLib.deleteEmployee(company.id, emp1.id);
  assert.equal(delRes.archived, true, "Le salarié avec bulletin passé est archivé et non détruit");
});
