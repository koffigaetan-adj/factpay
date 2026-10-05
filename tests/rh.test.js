// RH & Paie : Gestion des salariés et fiches de paie (Togo / UEMOA)
// Base en mémoire. Lancer avec : npm test
process.env.PGLITE_DIR = 'memory://';
process.env.FACTPAY_QUIET = '1';
delete process.env.DATABASE_URL;
delete process.env.VAPID_PUBLIC_KEY;
delete process.env.VAPID_PRIVATE_KEY;

import { test, before } from 'node:test';
import assert from 'node:assert/strict';

let one, q, empLib, payLib, rhConst;

before(async () => {
  ({ one, q } = await import('../lib/db.js'));
  empLib = await import('../lib/employees.js');
  payLib = await import('../lib/payroll.js');
  rhConst = await import('../lib/rh-constants.js');
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

test("Paie : les lignes libres montent le brut, les retenues rognent le net", () => {
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
    lines: [
      { kind: 'ajout', label: 'Prime de fin d’année', amount: 60000 },
      { kind: 'retenue', label: 'Avance sur salaire', amount: 20000 },
    ],
  }, 'XOF');

  // Brut = 250000 des rubriques fixes + 60000 de prime = 310000
  assert.equal(res.extraGains, 60000, "Le total des ajouts est reporté");
  assert.equal(res.grossSalary, 310000, "Un ajout majore le salaire brut");

  // La CNSS porte sur le brut majoré : 4% de 310000 = 12400
  assert.equal(res.cnssEmployeeAmount, 12400, "La CNSS salariale suit le brut majoré");

  // Retenues = 12400 CNSS + 12000 IRPP + 30000 acompte + 20000 retenue libre = 74400
  assert.equal(res.extraDeductions, 20000, "Le total des retenues libres est reporté");
  assert.equal(res.totalDeductions, 74400, "Une retenue s’ajoute aux autres retenues");
  assert.equal(res.netSalary, 310000 - 74400, "Le net intègre la retenue libre");

  // La CNSS patronale suit aussi le brut majoré : 17.5% de 310000 = 54250
  assert.equal(res.cnssEmployerAmount, 54250, "La CNSS patronale suit le brut majoré");

  // Une ligne sans libellé est une ligne inachevée : la garder gonflerait le bulletin d’un
  // montant que personne ne peut expliquer. Une retenue vide ou négative est écartée aussi.
  const nettoye = payLib.calculatePayslip({
    base_salary: 100000,
    cnss_employee_rate: 4.0,
    cnss_employer_rate: 17.5,
    lines: [
      { kind: 'ajout', label: '   ', amount: 50000 },
      { kind: 'ajout', label: 'Remboursement', amount: 0 },
      { kind: 'retenue', label: 'Pénalité', amount: -3000 },
      { kind: 'ajout', label: 'Prime', amount: 10000 },
    ],
  }, 'XOF');
  assert.equal(nettoye.lines.length, 1, "Seule la ligne complète est conservée");
  assert.equal(nettoye.grossSalary, 110000, "Une ligne vide ou négative n’entre pas dans le brut");

  // Un sens inconnu ne doit pas être compté deux fois : tout ce qui n’est pas « retenue » est
  // un ajout, sinon une valeur corrompue disparaîtrait du bulletin sans laisser de trace.
  const sensInconnu = payLib.calculatePayslip({
    base_salary: 100000,
    cnss_employee_rate: 4.0,
    cnss_employer_rate: 17.5,
    lines: [{ kind: 'n_importe_quoi', label: 'Ligne strange', amount: 5000 }],
  }, 'XOF');
  assert.equal(sensInconnu.grossSalary, 105000, "Un sens inconnu est compté en ajout");
});

test("Paie : le formulaire envoyant des lignes en parallèle les réassocie correctement", () => {
  // Un navigateur n'envoie pas un tableau de lignes mais trois tableaux parallèles, dont les
  // indices ne se correspondent que si chaque ligne rend ses trois champs dans le même ordre.
  // Un champ déplacé d'une ligne à l'autre attribue alors le mauvais montant au mauvais
  // libellé, sans lever la moindre erreur. Ce test existe pour attraper ce décalage.
  const fd = new FormData();
  const lignes = [
    { kind: 'ajout', label: 'Prime de fin d’année', amount: '60000' },
    { kind: 'retenue', label: 'Avance sur salaire', amount: '20000' },
    { kind: 'ajout', label: 'Remboursement de frais', amount: '7500' },
  ];
  for (const ligne of lignes) {
    fd.append('line_kind', ligne.kind);
    fd.append('line_label', ligne.label);
    fd.append('line_amount', ligne.amount);
  }
  // Les champs du reste du bulletin doivent être ignorés, pas confondus avec des lignes.
  fd.append('base_salary', '200000');
  fd.append('status', 'brouillon');

  const parsed = rhConst.payslipLinesFromForm(fd);
  assert.equal(parsed.length, 3, "Les trois lignes sont retrouvées");
  assert.deepEqual(parsed, lignes.map((l) => ({ kind: l.kind, label: l.label, amount: Number(l.amount) })),
    "Chaque montant reste associé à son propre libellé");

  // Une ligne laissée vide par l'utilisateur ne doit pas créer un montant sans explication.
  const fdVide = new FormData();
  fdVide.append('line_kind', 'ajout');
  fdVide.append('line_label', '   ');
  fdVide.append('line_amount', '50000');
  fdVide.append('line_kind', 'retenue');
  fdVide.append('line_label', 'Pénalité');
  fdVide.append('line_amount', '3000');
  const parsedVide = rhConst.payslipLinesFromForm(fdVide);
  assert.equal(parsedVide.length, 1, "La ligne sans libellé est ignorée");
  assert.equal(parsedVide[0].label, 'Pénalité', "La ligne suivante n’est pas décalée");

  // Un montant illisible ne doit pas devenir NaN dans un bulletin.
  const fdNaN = new FormData();
  fdNaN.append('line_kind', 'ajout');
  fdNaN.append('line_label', 'Prime');
  fdNaN.append('line_amount', 'abc');
  assert.deepEqual(rhConst.payslipLinesFromForm(fdNaN), [], "Un montant illisible ne devient pas une ligne");

  // La virgule décimale est acceptée : un pavé numérique en français en produit une.
  const fdVirgule = new FormData();
  fdVirgule.append('line_kind', 'ajout');
  fdVirgule.append('line_label', 'Prime');
  fdVirgule.append('line_amount', '1500,50');
  assert.equal(rhConst.payslipLinesFromForm(fdVirgule)[0].amount, 1500.5, "La virgule décimale est comprise");

  // Aucun champ de ligne : un bulletin sans ligne complémentaire reste un bulletin valide.
  assert.deepEqual(rhConst.payslipLinesFromForm(new FormData()), [], "Sans champ, aucune ligne");
});

test("Paie : les lignes libres sont enregistrées, modifiées et supprimées avec le bulletin", async () => {  const company = await makeCompany('rh3@company.tg');
  const emp = await empLib.saveEmployee(company, {
    first_name: 'Yao',
    last_name: 'Mensah',
    base_salary: 200000,
    status: 'actif',
  });

  const cree = await payLib.savePayslip(company, {
    employee_id: emp.id,
    period_month: 12,
    period_year: 2026,
    status: 'brouillon',
    base_salary: 200000,
    cnss_employee_rate: 4.0,
    cnss_employer_rate: 17.5,
    lines: [
      { kind: 'ajout', label: 'Prime de fin d’année', amount: 60000 },
      { kind: 'retenue', label: 'Avance sur salaire', amount: 20000 },
    ],
  });

  let lu = await payLib.getPayslip(company.id, cree.id);
  assert.equal(lu.lines.length, 2, "Les deux lignes sont relues avec le bulletin");
  assert.deepEqual(lu.lines.map((l) => l.kind), ['ajout', 'retenue'], "L’ordre de saisie est conservé");
  assert.equal(lu.lines[0].label, "Prime de fin d’année");
  assert.equal(lu.gross_salary, 260000, "Le brut enregistré intègre la prime");
  assert.equal(lu.net_salary, 260000 - (260000 * 0.04) - 20000, "Le net enregistré intègre la retenue");

  // Une ligne supprimée dans le formulaire ne doit pas survivre à l’enregistrement.
  const modifie = await payLib.savePayslip(company, {
    id: cree.id,
    employee_id: emp.id,
    period_month: 12,
    period_year: 2026,
    status: 'brouillon',
    base_salary: 200000,
    cnss_employee_rate: 4.0,
    cnss_employer_rate: 17.5,
    lines: [{ kind: 'ajout', label: 'Prime de fin d’année', amount: 75000 }],
  });

  lu = await payLib.getPayslip(company.id, cree.id);
  assert.equal(lu.lines.length, 1, "La retenue retirée du formulaire disparaît du bulletin");
  assert.equal(lu.lines[0].amount, 75000, "Le montant modifié est celui qui est relu");
  assert.equal(lu.gross_salary, 275000, "Les montants du bulletin suivent la ligne modifiée");
  assert.equal(modifie.id, cree.id, "La modification ne crée pas de second bulletin");

  // Retirer toutes les lignes doit laisser un bulletin cohérent, pas des lignes fantômes.
  await payLib.savePayslip(company, {
    id: cree.id,
    employee_id: emp.id,
    period_month: 12,
    period_year: 2026,
    status: 'brouillon',
    base_salary: 200000,
    cnss_employee_rate: 4.0,
    cnss_employer_rate: 17.5,
    lines: [],
  });
  lu = await payLib.getPayslip(company.id, cree.id);
  assert.equal(lu.lines.length, 0, "Plus aucune ligne ne subsiste");
  assert.equal(lu.gross_salary, 200000, "Le brut revient au salaire de base");

  // La date d’émission est saisie à la création puis conservée : le formulaire ne renvoie
  // une date que si l’utilisateur en choisit une, sinon le serveur ne doit pas réécrire
  // « édité aujourd’hui » sur un bulletin émis le mois dernier.
  await q("UPDATE payslips SET issue_date = '2026-12-31' WHERE id = $1", [cree.id]);
  await payLib.savePayslip(company, {
    id: cree.id,
    employee_id: emp.id,
    period_month: 12,
    period_year: 2026,
    status: 'brouillon',
    base_salary: 200000,
    cnss_employee_rate: 4.0,
    cnss_employer_rate: 17.5,
  });
  lu = await payLib.getPayslip(company.id, cree.id);
  assert.equal(lu.issue_date, '2026-12-31', "La date d’émission d’origine est conservée");
});

test("Paie : un bulletin validé ou payé devient figé", async () => {
  const company = await makeCompany('rh4@company.tg');
  const emp = await empLib.saveEmployee(company, {
    first_name: 'Aya',
    last_name: 'Koffi',
    base_salary: 180000,
    status: 'actif',
  });

  const draft = await payLib.savePayslip(company, {
    employee_id: emp.id,
    period_month: 10,
    period_year: 2026,
    status: 'brouillon',
    base_salary: 180000,
    cnss_employee_rate: 4.0,
    cnss_employer_rate: 17.5,
    lines: [{ kind: 'ajout', label: 'Prime exceptionnelle', amount: 20000 }],
  });
  assert.equal(payLib.isPayslipEditable(draft), true, "Un brouillon reste modifiable");

  const valide = await payLib.savePayslip(company, {
    id: draft.id,
    employee_id: emp.id,
    period_month: 10,
    period_year: 2026,
    status: 'valide',
    base_salary: 180000,
    cnss_employee_rate: 4.0,
    cnss_employer_rate: 17.5,
    lines: [{ kind: 'ajout', label: 'Prime exceptionnelle', amount: 20000 }],
  });
  assert.equal(valide.status, 'valide');
  assert.equal(payLib.isPayslipEditable(valide), false, "Un bulletin validé n’est plus modifiable");

  // La porte est dans la fonction du serveur, pas dans le bouton : un formulaire fabriqué à la
  // main doit échouer aussi. Sans cela, il suffirait de rouvrir la page pour réécrire l’historique.
  await assert.rejects(
    () => payLib.savePayslip(company, {
      id: draft.id,
      employee_id: emp.id,
      period_month: 10,
      period_year: 2026,
      status: 'brouillon',
      base_salary: 900000,
      cnss_employee_rate: 4.0,
      cnss_employer_rate: 17.5,
    }),
    /n’est plus modifiable/,
    "Un bulletin validé refuse toute nouvelle écriture",
  );

  await assert.rejects(
    () => payLib.deletePayslip(company.id, draft.id),
    /ne peut pas être supprimé/,
    "Un bulletin validé ne peut plus être supprimé",
  );

  const lu = await payLib.getPayslip(company.id, draft.id);
  assert.equal(lu.base_salary, 180000, "Le salaire d’origine est intact après les tentatives");

  const paye = await payLib.markPayslipPaid(company, draft.id, {
    payment_date: '2026-10-31',
    payment_method: 'bank',
  });
  assert.equal(paye.status, 'paye');
  assert.equal(payLib.isPayslipEditable(paye), false, "Un bulletin payé n’est plus modifiable");

  await assert.rejects(
    () => payLib.savePayslip(company, {
      id: draft.id,
      employee_id: emp.id,
      period_month: 10,
      period_year: 2026,
      status: 'paye',
      base_salary: 900000,
      cnss_employee_rate: 4.0,
      cnss_employer_rate: 17.5,
    }),
    /n’est plus modifiable/,
    "Un bulletin payé refuse toute nouvelle écriture",
  );

  // Le brouillon qu’on a laissé de côté, lui, se supprime toujours.
  const jetable = await payLib.savePayslip(company, {
    employee_id: emp.id,
    period_month: 11,
    period_year: 2026,
    status: 'brouillon',
    base_salary: 180000,
    cnss_employee_rate: 4.0,
    cnss_employer_rate: 17.5,
  });
  const supprime = await payLib.deletePayslip(company.id, jetable.id);
  assert.equal(supprime, true, "Un brouillon se supprime");
  assert.equal(await payLib.getPayslip(company.id, jetable.id), null, "Le brouillon supprimé a disparu");

  // Supprimer un bulletin doit emporter ses lignes : la base ne doit pas garder des montants
  // orphelins attachés à une fiche qui n’existe plus.
  const orphans = await q('SELECT id FROM payslip_lines WHERE payslip_id = $1', [jetable.id]);
  assert.equal(orphans.length, 0, "Aucune ligne ne survit à la suppression de son bulletin");
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
