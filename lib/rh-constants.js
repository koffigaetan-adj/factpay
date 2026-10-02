import { roundFor } from './money.js';

export const RH_MODULE_TABS = [
  { href: '/fiches-de-paie', label: 'Fiches de paie', icon: 'payslip' },
  { href: '/acomptes', label: 'Acomptes', icon: 'cash' },
  { href: '/notes-de-frais', label: 'Notes de frais', icon: 'file' },
  { href: '/employes', label: 'Employés & Contrats', icon: 'people' },
  { href: '/conges', label: 'Congés & Absences', icon: 'calendar' },
  { href: '/organigramme', label: 'Organigramme', icon: 'briefcase' },
];

export const FACTURATION_MODULE_TABS = [
  { href: '/factures', label: 'Mes factures', icon: 'invoice' },
  { href: '/factures-recues', label: 'Factures reçues', icon: 'inbox' },
  { href: '/devis', label: 'Mes devis', icon: 'quote' },
  { href: '/devis-recus', label: 'Devis reçus', icon: 'inbox' },
  { href: '/rapports', label: 'Rapports & Ventes', icon: 'report' },
  { href: '/clients', label: 'Clients', icon: 'clients' },
];

export const CONTRACT_TYPES = {
  cdi: 'Contrat à Durée Indéterminée (CDI)',
  cdd: 'Contrat à Durée Déterminée (CDD)',
  stage: 'Stage / Convention',
  prestation: 'Prestation / Consultant',
  journalier: 'Journalier / Temporaire',
  apprentissage: 'Apprentissage',
  CDI: 'Contrat à Durée Indéterminée (CDI)',
  CDD: 'Contrat à Durée Déterminée (CDD)',
  Stage: 'Stage / Convention',
  Prestation: 'Prestation / Consultant',
  Journalier: 'Journalier / Temporaire',
};

export const PAYMENT_METHODS = {
  bank: 'Virement bancaire',
  tmoney: 'TMoney (Togocom)',
  flooz: 'Moov Money / Flooz',
  cash: 'Espèces',
  wave: 'Wave',
  cheque: 'Chèque',
};

export const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export const LEAVE_TYPES = {
  conge_paye: 'Congé payé annuel',
  maladie: 'Maladie / Convalescence',
  maternite: 'Maternité (14 semaines)',
  paternite: 'Paternité',
  evenement_familial: 'Événement familial (Mariage, Décès)',
  sans_solde: 'Congé sans solde',
  autre: 'Autre absence',
};

export const EXPENSE_CATEGORIES = {
  transport: 'Transport & Déplacement',
  carburant: 'Carburant',
  repas: 'Repas & Réception client',
  hebergement: 'Hébergement / Hôtel',
  fournitures: 'Fournitures de bureau',
  communication: 'Télécom / Internet / Crédit',
  autre: 'Autre frais',
};

// Calcule tous les montants d'un bulletin de paie selon les règles UEMOA / Togo
export function calculatePayslip(data, currency = 'XOF') {
  const baseSalary = Math.max(0, Number(data.base_salary) || 0);
  const seniorityBonus = Math.max(0, Number(data.seniority_bonus) || 0);
  const transportAllowance = Math.max(0, Number(data.transport_allowance) || 0);
  const functionAllowance = Math.max(0, Number(data.function_allowance) || 0);
  const otherAllowances = Math.max(0, Number(data.other_allowances) || 0);
  const overtimeAmount = Math.max(0, Number(data.overtime_amount) || 0);

  // Salaire Brut
  const grossSalary = roundFor(
    baseSalary + seniorityBonus + transportAllowance + functionAllowance + otherAllowances + overtimeAmount,
    currency
  );

  // CNSS Salariale (Part employé : 4% par défaut au Togo)
  const cnssEmployeeRate = Number(data.cnss_employee_rate ?? 4.0);
  const cnssEmployeeAmount = roundFor(grossSalary * (cnssEmployeeRate / 100), currency);

  // Impôt sur salaire (IRPP)
  const taxSalaryAmount = Math.max(0, Number(data.tax_salary_amount) || 0);

  // Acomptes & autres déductions
  const salaryAdvances = Math.max(0, Number(data.salary_advances) || 0);
  const otherDeductions = Math.max(0, Number(data.other_deductions) || 0);

  // Total des déductions
  const totalDeductions = roundFor(
    cnssEmployeeAmount + taxSalaryAmount + salaryAdvances + otherDeductions,
    currency
  );

  // Net à payer
  const netSalary = Math.max(0, roundFor(grossSalary - totalDeductions, currency));

  // CNSS Patronale (Part employeur : 17.5% par défaut au Togo)
  const cnssEmployerRate = Number(data.cnss_employer_rate ?? 17.5);
  const cnssEmployerAmount = roundFor(grossSalary * (cnssEmployerRate / 100), currency);

  // Coût total pour l'employeur
  const totalEmployerCost = roundFor(grossSalary + cnssEmployerAmount, currency);

  return {
    baseSalary,
    seniorityBonus,
    transportAllowance,
    functionAllowance,
    otherAllowances,
    overtimeAmount,
    grossSalary,
    cnssEmployeeRate,
    cnssEmployeeAmount,
    taxSalaryAmount,
    salaryAdvances,
    otherDeductions,
    totalDeductions,
    netSalary,
    cnssEmployerRate,
    cnssEmployerAmount,
    totalEmployerCost,
    currency,
  };
}
