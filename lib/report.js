import { roundFor, fixedRate } from './money.js';

// Récapitulatif d'une année, dans la devise de l'entreprise :
// factures émises dans l'année (hors annulées), par client et par mois, avec TVA, retenues et encaissé.
export function yearReport(company, invoices, year) {
  const cur = company.currency;
  // Taux vers la devise de l'entreprise : identique, parité fixe, ou taux saisi sur la facture
  const rateOf = (i) => (i.currency === cur ? 1 : fixedRate(i.currency, cur) ?? (i.alt_currency === cur ? i.alt_rate : null));
  const y = String(year);
  const issued = invoices.filter((i) => i.number && i.issue_date?.startsWith(y) && i.status !== 'annulee');
  const counted = issued.filter((i) => rateOf(i));
  const skipped = issued.length - counted.length;

  const empty = () => ({ count: 0, subtotal: 0, vat: 0, total: 0, withholding: 0, due: 0, cashed: 0 });
  const add = (acc, i) => {
    const r = rateOf(i);
    acc.count += 1;
    acc.subtotal += i.subtotal * r;
    acc.vat += i.vat_amount * r;
    acc.total += i.total * r;
    acc.withholding += i.withholding_amount * r;
    acc.due += i.amount_due * r;
    if (i.status === 'payee') acc.cashed += i.amount_due * r;
    return acc;
  };
  const round = (acc) => Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, k === 'count' ? v : roundFor(v, cur)]));

  const byClient = new Map();
  for (const i of counted) byClient.set(i.client_name, add(byClient.get(i.client_name) || empty(), i));
  const months = Array.from({ length: 12 }, () => empty());
  for (const i of counted) add(months[Number(i.issue_date.slice(5, 7)) - 1], i);

  return {
    currency: cur,
    total: round(counted.reduce(add, empty())),
    clients: [...byClient.entries()].map(([name, acc]) => ({ name, ...round(acc) })).sort((a, b) => b.subtotal - a.subtotal),
    months: months.map(round),
    skipped,
  };
}

// Années proposées : de la plus ancienne opération à l'année en cours (la plus récente d'abord)
export function yearsOf(invoices = [], payslips = []) {
  const now = new Date().getUTCFullYear();
  const invoiceYears = invoices.filter((i) => i.issue_date).map((i) => Number(i.issue_date.slice(0, 4)));
  const payslipYears = payslips.map((p) => Number(p.period_year)).filter(Boolean);
  const all = [...invoiceYears, ...payslipYears];
  const first = all.length ? Math.min(now, ...all) : now;
  return Array.from({ length: now - first + 1 }, (_, k) => now - k);
}

// Récapitulatif annuel de la paie et des charges sociales CNSS
export function payrollYearReport(company, payslips, year) {
  const cur = company.currency || 'XOF';
  const y = Number(year);
  const relevant = payslips.filter((p) => Number(p.period_year) === y && p.status !== 'annulee');

  const empty = () => ({
    count: 0,
    gross: 0,
    cnssEmployee: 0,
    taxSalary: 0,
    advances: 0,
    deductions: 0,
    net: 0,
    cnssEmployer: 0,
    employerCost: 0,
  });

  const add = (acc, p) => {
    acc.count += 1;
    acc.gross += Number(p.gross_salary || 0);
    acc.cnssEmployee += Number(p.cnss_employee_amount || 0);
    acc.taxSalary += Number(p.tax_salary_amount || 0);
    acc.advances += Number(p.salary_advances || 0);
    acc.deductions += Number(p.total_deductions || 0);
    acc.net += Number(p.net_salary || 0);
    acc.cnssEmployer += Number(p.cnss_employer_amount || 0);
    acc.employerCost += Number(p.total_employer_cost || 0);
    return acc;
  };

  const round = (acc) => Object.fromEntries(
    Object.entries(acc).map(([k, v]) => [k, k === 'count' ? v : roundFor(v, cur)])
  );

  const byEmployee = new Map();
  for (const p of relevant) {
    const key = p.employee_id;
    const name = `${p.first_name || ''} ${p.last_name || ''}`.trim() || `Salarié #${p.employee_id}`;
    const empData = byEmployee.get(key) || {
      id: key,
      name,
      job_title: p.job_title || '',
      department: p.department || '',
      cnss_number: p.cnss_number || '',
      ...empty(),
    };
    add(empData, p);
    byEmployee.set(key, empData);
  }

  const months = Array.from({ length: 12 }, () => empty());
  for (const p of relevant) {
    const mIdx = Math.max(0, Math.min(11, (Number(p.period_month) || 1) - 1));
    add(months[mIdx], p);
  }

  return {
    currency: cur,
    total: round(relevant.reduce(add, empty())),
    employees: [...byEmployee.values()].map((e) => ({
      ...e,
      ...round(e),
    })).sort((a, b) => b.gross - a.gross),
    months: months.map(round),
  };
}

// Récapitulatif annuel des dépenses & achats (fournisseurs + notes de frais)
export function expensesYearReport(company, receivedInvoices = [], expenseReports = [], year) {
  const cur = company.currency || 'XOF';
  const y = String(year);

  // Factures fournisseurs reçues
  const relevantInvoices = receivedInvoices.filter(
    (i) => i.issue_date?.startsWith(y) && i.status !== 'annulee'
  );
  // Notes de frais validées ou remboursées
  const relevantExpenses = expenseReports.filter(
    (e) => (e.expense_date?.startsWith(y) || e.created_at?.slice(0, 4) === y) && e.status !== 'refusee'
  );

  let totalInvoices = 0;
  let totalExpenses = 0;
  const byMonth = Array.from({ length: 12 }, () => ({ invoices: 0, expenses: 0, total: 0 }));
  const byCategory = new Map();

  for (const inv of relevantInvoices) {
    const amt = Number(inv.amount_due || inv.total || 0);
    totalInvoices += amt;
    const m = Math.max(0, Math.min(11, (Number(inv.issue_date?.slice(5, 7)) || 1) - 1));
    byMonth[m].invoices += amt;
    byMonth[m].total += amt;

    const cat = 'Fournisseurs (factures reçues)';
    byCategory.set(cat, (byCategory.get(cat) || 0) + amt);
  }

  for (const exp of relevantExpenses) {
    const amt = Number(exp.amount || 0);
    totalExpenses += amt;
    const mDate = exp.expense_date || exp.created_at || '';
    const m = Math.max(0, Math.min(11, (Number(mDate.slice(5, 7)) || 1) - 1));
    byMonth[m].expenses += amt;
    byMonth[m].total += amt;

    const cat = exp.category ? `Note de frais : ${exp.category}` : 'Note de frais : Divers';
    byCategory.set(cat, (byCategory.get(cat) || 0) + amt);
  }

  const roundNum = (n) => roundFor(n, cur);

  return {
    currency: cur,
    total: {
      invoices: roundNum(totalInvoices),
      expenses: roundNum(totalExpenses),
      grandTotal: roundNum(totalInvoices + totalExpenses),
      invoicesCount: relevantInvoices.length,
      expensesCount: relevantExpenses.length,
    },
    months: byMonth.map((m) => ({
      invoices: roundNum(m.invoices),
      expenses: roundNum(m.expenses),
      total: roundNum(m.total),
    })),
    categories: [...byCategory.entries()]
      .map(([name, amount]) => ({ name, amount: roundNum(amount) }))
      .sort((a, b) => b.amount - a.amount),
  };
}

// Bilan financier annuel synthétique (Résultat d'exploitation estimé)
export function annualSummary(salesRep, payrollRep, expensesRep) {
  const cur = salesRep.currency;
  const caCashed = salesRep.total.cashed || 0;
  const payrollCost = payrollRep.total.employerCost || 0;
  const expensesCost = expensesRep.total.grandTotal || 0;
  const netResult = roundFor(caCashed - payrollCost - expensesCost, cur);

  return {
    currency: cur,
    revenue: caCashed,
    payroll: payrollCost,
    expenses: expensesCost,
    result: netResult,
    isPositive: netResult >= 0,
  };
}

