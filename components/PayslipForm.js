'use client';

import { useState } from 'react';
import Link from 'next/link';
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

  // Les lignes libres : une prime exceptionnelle, un remboursement, une retenue. Le tableau
  // ci-dessus garde les rubriques que la paie connaît tous les mois ; ces lignes, elles, sont
  // ce qui arrive une fois par an. Chacune est explicitement un ajout ou une retenue, pour
  // qu'on ne se demande jamais dans quel sens un montant a été saisi.
  const [lines, setLines] = useState(() => (payslip?.lines ?? []).map((l) => ({
    key: l.id ?? `${l.kind}-${l.label}`,
    kind: l.kind === 'retenue' ? 'retenue' : 'ajout',
    label: l.label ?? '',
    amount: l.amount ?? 0,
  })));

  const addLine = (kind = 'ajout') => setLines((current) => [
    ...current,
    { key: `new-${current.length}-${kind}`, kind, label: '', amount: 0 },
  ]);

  const updateLine = (key, patch) => setLines((current) => current.map(
    (line) => (line.key === key ? { ...line, ...patch } : line)
  ));

  const removeLine = (key) => setLines((current) => current.filter((line) => line.key !== key));

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
    lines,
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

            {/* Le champ manquait : le serveur remettait la date du jour à chaque sauvegarde,
                y compris sur un bulletin émis le mois dernier. */}
            <div className="field">
              <label htmlFor="issue_date">Date d’émission</label>
              <input
                id="issue_date"
                name="issue_date"
                type="date"
                defaultValue={payslip?.issue_date || ''}
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

          <div className="field">
            <label htmlFor="cnss_employer_rate">Taux CNSS Patronale (%)</label>
            <input
              id="cnss_employer_rate"
              name="cnss_employer_rate"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={cnssEmployerRate}
              onChange={(e) => setCnssEmployerRate(Number(e.target.value) || 0)}
            />
          </div>
        </div>

        <div style={{ background: 'var(--bg)', padding: '12px 16px', borderRadius: '8px', marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>Total des Retenues :</strong>
          <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--late)' }}>− {money(calc.totalDeductions, companyCurrency)}</span>
        </div>
      </div>

      {/* Lignes libres. Elles viennent s'ajouter aux rubriques du dessus, sans les remplacer :
          une prime de fin d'année se saisit ici, pas dans « Autres primes ». */}
      <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap', marginBottom: '4px' }}>
          <div>
            <h2 style={{ fontSize: '16px' }}>4. Lignes complémentaires</h2>
            <p className="hint" style={{ margin: '4px 0 0' }}>
              Ce qui arrive une fois, pas tous les mois : prime exceptionnelle, remboursement
              de frais, retenue pour casse. Un ajout majore le brut, une retenue diminue le net.
            </p>
          </div>
          <div className="actions" style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="button secondary small"
              onClick={() => addLine('ajout')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Icon name="plus" size={14} /> Ajouter un ajout
            </button>
            <button
              type="button"
              className="button secondary small"
              onClick={() => addLine('retenue')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Icon name="percent" size={14} /> Ajouter une retenue
            </button>
          </div>
        </div>

        {lines.length === 0 ? (
          <p className="empty" style={{ marginTop: '12px' }}>
            Aucune ligne complémentaire. Le brut se compose uniquement des rubriques ci-dessus.
          </p>
        ) : (
          <div className="scroll" style={{ marginTop: '16px' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: '150px' }}>Sens</th>
                  <th>Libellé</th>
                  <th className="n" style={{ width: '160px' }}>Montant</th>
                  <th className="n" style={{ width: '150px' }}>Effet</th>
                  <th style={{ width: '48px' }}><span className="sr">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.key}>
                    <td>
                      <input type="hidden" name="line_kind" value={line.kind} />
                      <select
                        aria-label="Sens de la ligne"
                        value={line.kind}
                        onChange={(e) => updateLine(line.key, { kind: e.target.value })}
                      >
                        <option value="ajout">Ajout</option>
                        <option value="retenue">Retenue</option>
                      </select>
                    </td>
                    <td>
                      <input
                        name="line_label"
                        aria-label="Libellé de la ligne"
                        placeholder="Prime de fin d'année…"
                        maxLength={160}
                        value={line.label}
                        onChange={(e) => updateLine(line.key, { label: e.target.value })}
                      />
                    </td>
                    <td className="n">
                      <input
                        name="line_amount"
                        aria-label="Montant de la ligne"
                        type="number"
                        min="0"
                        step="any"
                        value={line.amount}
                        onChange={(e) => updateLine(line.key, { amount: Number(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="n sub">
                      {line.amount > 0 && (
                        line.kind === 'ajout'
                          ? `+ ${money(line.amount, companyCurrency)} au brut`
                          : `− ${money(line.amount, companyCurrency)} sur le net`
                      )}
                    </td>
                    <td className="n">
                      <button
                        type="button"
                        className="button secondary small"
                        onClick={() => removeLine(line.key)}
                        aria-label="Supprimer la ligne"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {calc.extraGains > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px' }}>
            <span className="sub">Ajouts repris dans le brut</span>
            <span style={{ fontWeight: 700 }}>+ {money(calc.extraGains, companyCurrency)}</span>
          </div>
        )}
        {calc.extraDeductions > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
            <span className="sub">Retenues reprises sur le net</span>
            <span style={{ fontWeight: 700 }}>− {money(calc.extraDeductions, companyCurrency)}</span>
          </div>
        )}
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
        <h2 style={{ fontSize: '16px', marginBottom: '16px' }}>5. Règlement & Statut</h2>
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
        {isEdit && (
          <Link href={`/fiches-de-paie/${payslip.id}`} className="button secondary">
            Annuler
          </Link>
        )}
      </div>
    </form>
  );
}
