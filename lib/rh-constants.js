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

// Une ligne libre de bulletin. `kind` decides si elle majore le brut ou le net ; c’est la
// seule information nécessaire pour le calcul, le libellé ne sert qu’à l’affichage.
// Un bulletin s’arrête d’être modifiable dès qu’il quitte le brouillon.
//
// Un bulletin validé a déjà pu être transmis au salarié, un bulletin payé a déjà été versé.
// Les réécrire après coup laisse un document qui ne correspond plus à ce qui a été payé, et
// personne ne pourra plus dire quel était le bon montant. La correction se fait donc en
// établissant un nouveau bulletin, pas en réécrivant l’ancien.
//
// La règle vit ici et non dans lib/payroll.js pour que le bouton « Modifier » du navigateur et
// la porte du serveur jugent sur la même définition : si elles divergeaient, l’interface
// proposerait un enregistrement que le serveur refuse.
export const EDITABLE_PAYSLIP_STATUSES = ['brouillon'];

export function isPayslipEditable(payslip) {
  return Boolean(payslip) && EDITABLE_PAYSLIP_STATUSES.includes(payslip.status);
}

export const PAYSLIP_STATUS_LABELS = {
  brouillon: 'brouillon',
  valide: 'validé',
  paye: 'payé',
};

export const PAYSLIP_LINE_KINDS = {
  ajout: { label: 'Ajout', hint: 'Majoration du salaire brut' },
  retenue: { label: 'Retenue', hint: 'Prélèvement sur le net à payer' },
};

// Nettoie les lignes d’un bulletin : il suffit d’un libellé et d’un montant positif, et le
// sens est ajouté ou retenue. Une ligne sans libellé est une ligne inachevée : on la retire,
// sinon elle gonflerait le bulletin d’un montant que personne ne peut expliquer.
export function normalizePayslipLines(input) {
  const list = Array.isArray(input) ? input : [];
  const lines = [];
  let extraGains = 0;
  let extraDeductions = 0;

  for (const raw of list) {
    const label = String(raw?.label ?? '').trim().slice(0, 160);
    const amount = Math.max(0, Number(raw?.amount) || 0);
    if (!label || !amount) continue;

    const kind = raw?.kind === 'retenue' ? 'retenue' : 'ajout';
    lines.push({ kind, label, amount });
    if (kind === 'ajout') extraGains += amount;
    else extraDeductions += amount;
  }

  return { lines, extraGains, extraDeductions };
}

// Reconstruit les lignes libres à partir d’un formulaire de navigateur.
//
// Un <input name="line_label"> répété n’a pas de clef : le navigateur envoie trois tableaux
// parallèles, `line_kind[]`, `line_label[]` et `line_amount[]`, dont les indices se
// correspondent parce que chaque ligne rend ses trois champs dans le même ordre. C’est cet
// alignement qu’il faut conserver à la main à chaque fois qu’on touche au formulaire : un
// champ mal placé décale les montants d’une ligne sans jamais lever d’erreur.
export function payslipLinesFromForm(fd) {
  const kinds = fd.getAll('line_kind');
  const labels = fd.getAll('line_label');
  const amounts = fd.getAll('line_amount');
  const lines = [];

  for (const [i, label] of labels.entries()) {
    // Même nettoyage que le helper text() du serveur : le retour chariot saisi sous Windows
    // arrive ici sous forme d’un Ð qui ferait partie du libellé affiché.
    const clean = String(label ?? '').replace(/Ð/g, '').trim().slice(0, 160);
    if (!clean) continue;

    // Un montant absent, non numérique ou négatif ne devient pas une ligne : il disparaît,
    // comme le ferait normalizePayslipLines, et le total reste celui des lignes saisies.
    const amount = Number(String(amounts[i] ?? '').replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) continue;

    lines.push({ kind: kinds[i] === 'retenue' ? 'retenue' : 'ajout', label: clean, amount });
  }

  return lines;
}

// Calcule tous les montants d'un bulletin de paie selon les règles UEMOA / Togo
//
// `lines` : les lignes libres du bulletin. Chacune est un ajout au brut ou une retenue sur
// le net, et les deux se cumulent aux rubriques habituelles. Elles sont normalisées ici
// plutôt que dans le formulaire, pour que le calcul reste le même que l’on soit sur le
// navigateur, sur le serveur, ou dans un test.
export function calculatePayslip(data, currency = 'XOF') {
  const baseSalary = Math.max(0, Number(data.base_salary) || 0);
  const seniorityBonus = Math.max(0, Number(data.seniority_bonus) || 0);
  const transportAllowance = Math.max(0, Number(data.transport_allowance) || 0);
  const functionAllowance = Math.max(0, Number(data.function_allowance) || 0);
  const otherAllowances = Math.max(0, Number(data.other_allowances) || 0);
  const overtimeAmount = Math.max(0, Number(data.overtime_amount) || 0);

  const lines = normalizePayslipLines(data.lines);

  // Salaire Brut
  const grossSalary = roundFor(
    baseSalary + seniorityBonus + transportAllowance + functionAllowance + otherAllowances
      + overtimeAmount + lines.extraGains,
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
    cnssEmployeeAmount + taxSalaryAmount + salaryAdvances + otherDeductions + lines.extraDeductions,
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
    extraGains: lines.extraGains,
    extraDeductions: lines.extraDeductions,
    lines: lines.lines,
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
