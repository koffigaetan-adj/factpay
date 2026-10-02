'use client';

import { useState } from 'react';
import { MONTHS, calculatePayslip, PAYMENT_METHODS } from '@/lib/rh-constants';
import { savePayslipAction } from '@/app/actions';
import { money } from '@/lib/money';
import Icon from '@/components/Icon';

export default function PayslipForm({ employees, payslip = null, defaultEmployeeId = null, companyCurrency = 'XOF' }) {
  const isEdit = Boolean(payslip?.id);
  const now = new Date();

  const [selectedEmpId, setSelectedEmpId] = useState(
    payslip?.employee_id || defaultEmployeeId || (employees[0]?.id ?? '')
  );

  const selectedEmployee = employees.find((e) => String(e.id) === String(selectedEmpId));

  const [baseSalary, setBaseSalary] = useState(
    payslip?.base_salary ?? selectedEmployee?.base_salary ?? 0
  );
  const [seniorityBonus, setSeniorityBonus] = useState(payslip?.seniority_bonus ?? 0);
  const [transportAllowance, setTransportAllowance] = useState(payslip?.transport_allowance ?? 0);
  const [functionAllowance, setFunctionAllowance] = useState(payslip?.function_allowance ?? 0);
  const [otherAllowances, setOtherAllowances] = useState(payslip?.other_allowances ?? 0);
  const [overtimeAmount, setOvertimeAmount] = useState(payslip?.overtime_amount ?? 0);

  const [cnssEmployeeRate, setCnssEmployeeRate] = useState(payslip?.cnss_employee_rate ?? 4.0);
  const [taxSalaryAmount, setTaxSalaryAmount] = useState(payslip?.tax_salary_amount ?? 0);
  const [salaryAdvances, setSalaryAdvances] = useState(payslip?.salary_advances ?? 0);
  const [otherDeductions, setOtherDeductions] = useState(payslip?.other_deductions ?? 0);
  const [cnssEmployerRate, setCnssEmployerRate] = useState(payslip?.cnss_employer_rate ?? 17.5);

  const onEmployeeChange = (e) => {
    const id = e.target.value;
    setSelectedEmpId(id);
    const emp = employees.find((x) => String(x.id) === String(id));
    if (emp && !isEdit) {
      setBaseSalary(emp.base_salary);
    }
  };

  const calc = calculatePayslip({
    base_salary: baseSalary,
    seniority_bonus: seniorityBonus,
    transport_allowance: transportAllowance,
    function_allowance: functionAllowance,
    other_allowances: otherAllowances,
    overtime_amount: overtimeAmount,
    cnss_employee_rate: cnssEmployeeRate,
    tax_salary_amount: taxSalaryAmount,
    salary_advances: salaryAdvances,
    other_deductions: otherDeductions,
    cnss_employer_rate: cnssEmployerRate,
  }, companyCurrency);

  return (
    <form action={savePayslipAction} className="form-stack">
      {isEdit && <input type="hidden" name="id" value={payslip.id} />}

      <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '16px', marginBottom: '16px' }}>1. Salarié & Période</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="employee_id">Salarié <span className="req">*</span></label>
            <select
              id="employee_id"
              name="employee_id"
              required
              value={selectedEmpId}
              onChange={onEmployeeChange}
              disabled={isEdit}
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name} ({emp.job_title || emp.contract_type})
                </option>
              ))}
            </select>
            {isEdit && <input type="hidden" name="employee_id" value={selectedEmpId} />}
          </div>

          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div className="field">
              <label htmlFor="period_month">Mois</label>
              <select
                id="period_month"
                name="period_month"
                defaultValue={payslip?.period_month || now.getUTCMonth() + 1}
              >
                {MONTHS.map((m, idx) => (
                  <option key={idx + 1} value={idx + 1}>{m}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="period_year">Année</label>
              <input
                id="period_year"
                name="period_year"
                type="number"
                min="2000"
                max="2100"
                defaultValue={payslip?.period_year || now.getUTCFullYear()}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '16px', marginBottom: '16px' }}>2. Rémunération & Primes (Gains)</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="base_salary">Salaire de base ({companyCurrency}) <span className="req">*</span></label>
            <input
              id="base_salary"
              name="base_salary"
              type="number"
              min="0"
              step="any"
              value={baseSalary}
              onChange={(e) => setBaseSalary(Number(e.target.value) || 0)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="transport_allowance">Indemnité de transport ({companyCurrency})</label>
            <input
              id="transport_allowance"
              name="transport_allowance"
              type="number"
              min="0"
              step="any"
              value={transportAllowance}
              onChange={(e) => setTransportAllowance(Number(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="function_allowance">Prime de fonction / Responsabilité</label>
            <input
              id="function_allowance"
              name="function_allowance"
              type="number"
              min="0"
              step="any"
              value={functionAllowance}
              onChange={(e) => setFunctionAllowance(Number(e.target.value) || 0)}
            />
          </div>

          <div className="field">
            <label htmlFor="seniority_bonus">Prime d'ancienneté</label>
            <input
              id="seniority_bonus"
              name="seniority_bonus"
              type="number"
              min="0"
              step="any"
              value={seniorityBonus}
              onChange={(e) => setSeniorityBonus(Number(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="overtime_amount">Heures supplémentaires</label>
            <input
              id="overtime_amount"
              name="overtime_amount"
              type="number"
              min="0"
              step="any"
              value={overtimeAmount}
              onChange={(e) => setOvertimeAmount(Number(e.target.value) || 0)}
            />
          </div>

          <div className="field">
            <label htmlFor="other_allowances">Autres primes / Gratifications</label>
            <input
              id="other_allowances"
              name="other_allowances"
              type="number"
              min="0"
              step="any"
              value={otherAllowances}
              onChange={(e) => setOtherAllowances(Number(e.target.value) || 0)}
            />
          </div>
        </div>

        <div style={{ background: 'var(--bg)', padding: '12px 16px', borderRadius: '8px', marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>Salaire Brut Total :</strong>
          <span style={{ fontSize: '18px', fontWeight: 700 }}>{money(calc.grossSalary, companyCurrency)}</span>
        </div>
      </div>

      <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '16px', marginBottom: '16px' }}>3. Retenues & Cotisations</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="cnss_employee_rate">Taux CNSS Salariale (%)</label>
            <input
              id="cnss_employee_rate"
              name="cnss_employee_rate"
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={cnssEmployeeRate}
              onChange={(e) => setCnssEmployeeRate(Number(e.target.value) || 0)}
            />
            <span className="help">Part employé : {money(calc.cnssEmployeeAmount, companyCurrency)}</span>
          </div>

          <div className="field">
            <label htmlFor="tax_salary_amount">Impôt sur salaire / IRPP ({companyCurrency})</label>
            <input
              id="tax_salary_amount"
              name="tax_salary_amount"
              type="number"
              min="0"
              step="any"
              value={taxSalaryAmount}
              onChange={(e) => setTaxSalaryAmount(Number(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="salary_advances">Acomptes versés en cours de mois</label>
            <input
              id="salary_advances"
              name="salary_advances"
              type="number"
              min="0"
              step="any"
              value={salaryAdvances}
              onChange={(e) => setSalaryAdvances(Number(e.target.value) || 0)}
            />
          </div>

          <div className="field">
            <label htmlFor="other_deductions">Autres retenues</label>
            <input
              id="other_deductions"
              name="other_deductions"
              type="number"
              min="0"
              step="any"
              value={otherDeductions}
              onChange={(e) => setOtherDeductions(Number(e.target.value) || 0)}
            />
          </div>
        </div>

        <div style={{ background: 'var(--bg)', padding: '12px 16px', borderRadius: '8px', marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>Total des Retenues :</strong>
          <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--late)' }}>− {money(calc.totalDeductions, companyCurrency)}</span>
        </div>
      </div>

      <div className="card" style={{ padding: '20px', marginBottom: '24px', border: '2px solid var(--brand)', background: 'color-mix(in srgb, var(--brand) 4%, var(--paper))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', fontWeight: 600 }}>Net à payer au salarié</span>
            <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--brand-text)' }}>
              {money(calc.netSalary, companyCurrency)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="sub">Coût total employeur (Brut + CNSS Patronale {cnssEmployerRate}%) :</span>
            <strong style={{ fontSize: '16px' }}>{money(calc.totalEmployerCost, companyCurrency)}</strong>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '16px', marginBottom: '16px' }}>4. Règlement & Statut</h2>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="status">Statut du bulletin</label>
            <select id="status" name="status" defaultValue={payslip?.status || 'brouillon'}>
              <option value="brouillon">Brouillon (en préparation)</option>
              <option value="valide">Validé (prêt pour paiement)</option>
              <option value="paye">Payé</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="payment_method">Mode de règlement</label>
            <select
              id="payment_method"
              name="payment_method"
              defaultValue={payslip?.payment_method || selectedEmployee?.payment_method || 'bank'}
            >
              {Object.entries(PAYMENT_METHODS).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor="payment_reference">Référence de transaction (N° TMoney/Flooz ou Virement)</label>
            <input
              id="payment_reference"
              name="payment_reference"
              type="text"
              defaultValue={payslip?.payment_reference || ''}
              placeholder="Ex: TXN-89412984 ou VIR-0926"
            />
          </div>

          <div className="field">
            <label htmlFor="payment_date">Date de paiement</label>
            <input
              id="payment_date"
              name="payment_date"
              type="date"
              defaultValue={payslip?.payment_date || ''}
            />
          </div>
        </div>

        <div className="field" style={{ marginTop: '12px' }}>
          <label htmlFor="notes">Notes internes / Observations</label>
          <textarea
            id="notes"
            name="notes"
            rows="2"
            defaultValue={payslip?.notes || ''}
            placeholder="Commentaires facultatifs..."
          />
        </div>
      </div>

      <div className="actions">
        <button type="submit" className="button">
          <Icon name="save" size={16} />
          {isEdit ? 'Mettre à jour le bulletin' : 'Créer le bulletin de paie'}
        </button>
      </div>
    </form>
  );
}
