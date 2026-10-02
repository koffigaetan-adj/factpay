import Link from 'next/link';
import Icon from '@/components/Icon';
import { money } from '@/lib/money';

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

export default function YearReport({
  report,
  payrollReport,
  expensesReport,
  summaryReport,
  year,
  years = [],
  basePath = '/rapports',
  exportHref,
  vue = 'ventes',
}) {
  const cur = report?.currency || payrollReport?.currency || expensesReport?.currency || 'XOF';
  const m = (n) => money(n, cur);

  const hasMultiViews = Boolean(payrollReport || expensesReport);

  // Vue Ventes
  const t = report?.total || { count: 0, subtotal: 0, vat: 0, total: 0, withholding: 0, due: 0, cashed: 0 };
  const clients = report?.clients || [];
  const salesMonths = report?.months || [];

  // Vue Salaires
  const pt = payrollReport?.total || { count: 0, gross: 0, cnssEmployee: 0, taxSalary: 0, advances: 0, deductions: 0, net: 0, cnssEmployer: 0, employerCost: 0 };
  const employees = payrollReport?.employees || [];
  const payrollMonths = payrollReport?.months || [];

  // Vue Dépenses
  const et = expensesReport?.total || { invoices: 0, expenses: 0, grandTotal: 0, invoicesCount: 0, expensesCount: 0 };
  const categories = expensesReport?.categories || [];
  const expenseMonths = expensesReport?.months || [];

  // Export href
  const activeExportHref = exportHref || (hasMultiViews ? `${basePath}/export?annee=${year}&vue=${vue}` : `${basePath}/export?annee=${year}`);

  return (
    <>
      {hasMultiViews && (
        <div style={{ marginBottom: '20px' }}>
          <nav className="doc-tabs-bar" aria-label="Sections du rapport">
            <Link
              href={`${basePath}?vue=ventes&annee=${year}`}
              className={`doc-tab-pill ${vue === 'ventes' ? 'is-active' : ''}`}
              aria-current={vue === 'ventes' ? 'page' : undefined}
            >
              <Icon name="invoice" size={15} />
              <span>Ventes & Facturation</span>
            </Link>
            <Link
              href={`${basePath}?vue=salaires&annee=${year}`}
              className={`doc-tab-pill ${vue === 'salaires' ? 'is-active' : ''}`}
              aria-current={vue === 'salaires' ? 'page' : undefined}
            >
              <Icon name="briefcase" size={15} />
              <span>Masse salariale & CNSS</span>
            </Link>
            <Link
              href={`${basePath}?vue=depenses&annee=${year}`}
              className={`doc-tab-pill ${vue === 'depenses' ? 'is-active' : ''}`}
              aria-current={vue === 'depenses' ? 'page' : undefined}
            >
              <Icon name="report" size={15} />
              <span>Dépenses & Achats</span>
            </Link>
            <Link
              href={`${basePath}?vue=bilan&annee=${year}`}
              className={`doc-tab-pill ${vue === 'bilan' ? 'is-active' : ''}`}
              aria-current={vue === 'bilan' ? 'page' : undefined}
            >
              <Icon name="dashboard" size={15} />
              <span>Bilan d'exploitation</span>
            </Link>
          </nav>
        </div>
      )}

      <div className="report-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <nav className="doc-tabs-bar" aria-label="Année">
          {years.map((y) => (
            <Link
              key={y}
              href={hasMultiViews ? `${basePath}?vue=${vue}&annee=${y}` : `${basePath}?annee=${y}`}
              className={`doc-tab-pill ${y === year ? 'is-active' : ''}`}
              aria-current={y === year ? 'page' : undefined}
            >
              {y}
            </Link>
          ))}
        </nav>
        {activeExportHref && (
          <a className="button secondary" href={activeExportHref}>
            <Icon name="download" size={16} />
            Exporter (Excel / CSV)
          </a>
        )}
      </div>

      {vue === 'ventes' && (
        <>
          <section>
            <dl className="calc report-totals">
              <div>
                <dt>
                  Chiffre d'affaires hors taxes
                  <span className="sub">{t.count} facture{t.count > 1 ? 's' : ''} émise{t.count > 1 ? 's' : ''} en {year}, hors annulées</span>
                </dt>
                <dd>{m(t.subtotal)}</dd>
              </div>
              <div><dt>TVA facturée</dt><dd>{m(t.vat)}</dd></div>
              <div><dt>Total TTC facturé</dt><dd>{m(t.total)}</dd></div>
              <div>
                <dt>
                  Retenues à la source
                  <span className="sub">prélevées par tes clients, à déduire de tes impôts</span>
                </dt>
                <dd>{m(t.withholding)}</dd>
              </div>
              <div><dt>Net à percevoir</dt><dd>{m(t.due)}</dd></div>
              <div className="calc-total"><dt>Déjà encaissé</dt><dd>{m(t.cashed)}</dd></div>
            </dl>
            {report?.skipped > 0 && (
              <p className="help" style={{ margin: 0 }}>
                {report.skipped} facture{report.skipped > 1 ? 's' : ''} dans une autre devise, sans taux vers {cur}, {report.skipped > 1 ? 'ne sont' : "n'est"} pas comptée{report.skipped > 1 ? 's' : ''}.
              </p>
            )}
          </section>

          <section>
            <h2>Par client</h2>
            {clients.length ? (
              <div className="scroll">
                <table>
                  <thead>
                    <tr><th>Client</th><th className="n">Factures</th><th className="n">HT</th><th className="n">TVA</th><th className="n">Retenues</th><th className="n">Encaissé</th></tr>
                  </thead>
                  <tbody>
                    {clients.map((c) => (
                      <tr key={c.name}>
                        <td>{c.name}</td>
                        <td className="n">{c.count}</td>
                        <td className="n">{m(c.subtotal)}</td>
                        <td className="n">{m(c.vat)}</td>
                        <td className="n">{m(c.withholding)}</td>
                        <td className="n">{m(c.cashed)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="empty">Aucune facture émise en {year}.</p>}
          </section>

          <section>
            <h2>Par mois</h2>
            <div className="scroll">
              <table>
                <thead>
                  <tr><th>Mois</th><th className="n">Factures</th><th className="n">HT</th><th className="n">TVA</th><th className="n">Retenues</th></tr>
                </thead>
                <tbody>
                  {salesMonths.map((r, i) => (
                    <tr key={i} className={r.count ? '' : 'muted'}>
                      <td>{MONTHS[i]}</td>
                      <td className="n">{r.count}</td>
                      <td className="n">{m(r.subtotal)}</td>
                      <td className="n">{m(r.vat)}</td>
                      <td className="n">{m(r.withholding)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {vue === 'salaires' && (
        <>
          <section>
            <dl className="calc report-totals">
              <div>
                <dt>
                  Masse salariale brute
                  <span className="sub">{pt.count} bulletin{pt.count > 1 ? 's' : ''} de paie en {year}</span>
                </dt>
                <dd>{m(pt.gross)}</dd>
              </div>
              <div>
                <dt>
                  Cotisations CNSS Salarié (4%)
                  <span className="sub">Retenue à la source sur le brut</span>
                </dt>
                <dd>{m(pt.cnssEmployee)}</dd>
              </div>
              <div>
                <dt>
                  Net versé aux salariés
                  <span className="sub">Montant net perçu par les employés</span>
                </dt>
                <dd>{m(pt.net)}</dd>
              </div>
              <div>
                <dt>
                  Cotisations CNSS Patronale (17.5%)
                  <span className="sub">Charges patronales entreprise</span>
                </dt>
                <dd>{m(pt.cnssEmployer)}</dd>
              </div>
              <div>
                <dt>
                  Total cotisations CNSS à verser
                  <span className="sub">CNSS Salariale (4%) + CNSS Patronale (17.5%)</span>
                </dt>
                <dd>{m(pt.cnssEmployee + pt.cnssEmployer)}</dd>
              </div>
              <div className="calc-total">
                <dt>
                  Coût total employeur
                  <span className="sub">Brut + Charges patronales</span>
                </dt>
                <dd>{m(pt.employerCost)}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h2>Par salarié</h2>
            {employees.length ? (
              <div className="scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Salarié</th>
                      <th>Poste</th>
                      <th>N° CNSS</th>
                      <th className="n">Bulletins</th>
                      <th className="n">Brut</th>
                      <th className="n">CNSS Salarié</th>
                      <th className="n">Net versé</th>
                      <th className="n">CNSS Patronale</th>
                      <th className="n">Coût Entreprise</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((e) => (
                      <tr key={e.id}>
                        <td><strong>{e.name}</strong></td>
                        <td>{e.job_title || '—'}</td>
                        <td><code>{e.cnss_number || '—'}</code></td>
                        <td className="n">{e.count}</td>
                        <td className="n">{m(e.gross)}</td>
                        <td className="n">{m(e.cnssEmployee)}</td>
                        <td className="n">{m(e.net)}</td>
                        <td className="n">{m(e.cnssEmployer)}</td>
                        <td className="n"><strong>{m(e.employerCost)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty">Aucun bulletin de paie enregistré pour l'année {year}.</p>
            )}
          </section>

          <section>
            <h2>Ventilation mensuelle de la paie</h2>
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>Mois</th>
                    <th className="n">Bulletins</th>
                    <th className="n">Brut</th>
                    <th className="n">CNSS Salariée (4%)</th>
                    <th className="n">Net Versé</th>
                    <th className="n">CNSS Patronale (17.5%)</th>
                    <th className="n">Coût Total</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollMonths.map((r, i) => (
                    <tr key={i} className={r.count ? '' : 'muted'}>
                      <td>{MONTHS[i]}</td>
                      <td className="n">{r.count}</td>
                      <td className="n">{m(r.gross)}</td>
                      <td className="n">{m(r.cnssEmployee)}</td>
                      <td className="n">{m(r.net)}</td>
                      <td className="n">{m(r.cnssEmployer)}</td>
                      <td className="n"><strong>{m(r.employerCost)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {vue === 'depenses' && (
        <>
          <section>
            <dl className="calc report-totals">
              <div>
                <dt>
                  Factures fournisseurs reçues
                  <span className="sub">{et.invoicesCount} facture{et.invoicesCount > 1 ? 's' : ''} reçue{et.invoicesCount > 1 ? 's' : ''}</span>
                </dt>
                <dd>{m(et.invoices)}</dd>
              </div>
              <div>
                <dt>
                  Notes de frais d'équipe
                  <span className="sub">{et.expensesCount} note{et.expensesCount > 1 ? 's' : ''} approuvée{et.expensesCount > 1 ? 's' : ''}</span>
                </dt>
                <dd>{m(et.expenses)}</dd>
              </div>
              <div className="calc-total">
                <dt>Total dépenses de l'année</dt>
                <dd>{m(et.grandTotal)}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h2>Par catégorie</h2>
            {categories.length ? (
              <div className="scroll">
                <table>
                  <thead>
                    <tr><th>Catégorie</th><th className="n">Total dépensé</th></tr>
                  </thead>
                  <tbody>
                    {categories.map((c) => (
                      <tr key={c.name}>
                        <td>{c.name}</td>
                        <td className="n">{m(c.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty">Aucune dépense ni facture reçue pour l'année {year}.</p>
            )}
          </section>

          <section>
            <h2>Par mois</h2>
            <div className="scroll">
              <table>
                <thead>
                  <tr><th>Mois</th><th className="n">Fournisseurs</th><th className="n">Notes de frais</th><th className="n">Total mois</th></tr>
                </thead>
                <tbody>
                  {expenseMonths.map((r, i) => (
                    <tr key={i} className={r.total ? '' : 'muted'}>
                      <td>{MONTHS[i]}</td>
                      <td className="n">{m(r.invoices)}</td>
                      <td className="n">{m(r.expenses)}</td>
                      <td className="n"><strong>{m(r.total)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {vue === 'bilan' && summaryReport && (
        <>
          <section>
            <div style={{
              background: summaryReport.isPositive ? 'color-mix(in srgb, var(--paid) 12%, transparent)' : 'color-mix(in srgb, var(--late) 12%, transparent)',
              border: `1px solid ${summaryReport.isPositive ? 'var(--paid)' : 'var(--late)'}`,
              borderRadius: 'var(--radius)',
              padding: '24px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap'
            }}>
              <div>
                <span className="sub" style={{ fontSize: '13px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Résultat d'exploitation estimé {year}
                </span>
                <p style={{ margin: '6px 0 0', fontSize: '32px', fontWeight: '700', color: summaryReport.isPositive ? 'var(--paid)' : 'var(--late)' }}>
                  {summaryReport.isPositive ? '+' : ''}{m(summaryReport.result)}
                </p>
                <p className="hint" style={{ margin: '4px 0 0' }}>
                  {summaryReport.isPositive
                    ? 'Ton activité génère un résultat net positif après salaires, charges et dépenses.'
                    : 'Les décaissements (salaires et dépenses) dépassent les encaissements clients enregistrés.'}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className={`status ${summaryReport.isPositive ? 'paid' : 'late'}`} style={{ fontSize: '14px', padding: '6px 14px' }}>
                  {summaryReport.isPositive ? 'Bénéficiaire' : 'Déficitaire'}
                </span>
              </div>
            </div>

            <dl className="calc report-totals">
              <div>
                <dt>
                  1. Encaissements clients (CA réel encaissé)
                  <span className="sub">Factures payées en {year}</span>
                </dt>
                <dd style={{ color: 'var(--paid)', fontWeight: '600' }}>+ {m(summaryReport.revenue)}</dd>
              </div>
              <div>
                <dt>
                  2. Masse salariale & Cotisations CNSS
                  <span className="sub">Coût global employeur versé</span>
                </dt>
                <dd style={{ color: 'var(--late)' }}>− {m(summaryReport.payroll)}</dd>
              </div>
              <div>
                <dt>
                  3. Dépenses & Achats (Fournisseurs & Frais)
                  <span className="sub">Factures reçues et frais d'équipe</span>
                </dt>
                <dd style={{ color: 'var(--late)' }}>− {m(summaryReport.expenses)}</dd>
              </div>
              <div className="calc-total">
                <dt>Résultat net estimé</dt>
                <dd style={{ color: summaryReport.isPositive ? 'var(--paid)' : 'var(--late)' }}>
                  {m(summaryReport.result)}
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <h2>Comparatif mensuel (Recettes vs Coûts)</h2>
            <div className="scroll">
              <table>
                <thead>
                  <tr>
                    <th>Mois</th>
                    <th className="n">CA Encaissé</th>
                    <th className="n">Salaires & CNSS</th>
                    <th className="n">Dépenses & Achats</th>
                    <th className="n">Marge du mois</th>
                  </tr>
                </thead>
                <tbody>
                  {MONTHS.map((name, i) => {
                    const rev = salesMonths[i]?.cashed || 0;
                    const pay = payrollMonths[i]?.employerCost || 0;
                    const exp = expenseMonths[i]?.total || 0;
                    const diff = rev - pay - exp;
                    const isZero = rev === 0 && pay === 0 && exp === 0;
                    return (
                      <tr key={name} className={isZero ? 'muted' : ''}>
                        <td>{name}</td>
                        <td className="n" style={{ color: rev > 0 ? 'var(--paid)' : undefined }}>{m(rev)}</td>
                        <td className="n" style={{ color: pay > 0 ? 'var(--ink)' : undefined }}>{m(pay)}</td>
                        <td className="n" style={{ color: exp > 0 ? 'var(--ink)' : undefined }}>{m(exp)}</td>
                        <td className="n" style={{
                          fontWeight: '600',
                          color: diff > 0 ? 'var(--paid)' : (diff < 0 ? 'var(--late)' : 'inherit')
                        }}>
                          {diff > 0 ? '+' : ''}{m(diff)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
