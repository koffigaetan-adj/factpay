import { notFound } from 'next/navigation';
import Logo from '@/components/Logo';
import YearReport from '@/components/YearReport';
import { companyByAccountantToken } from '@/lib/accountant';
import { listInvoices } from '@/lib/invoices';
import { yearReport, yearsOf } from '@/lib/report';
import { money } from '@/lib/money';
import { frDate } from '@/lib/dates';
import { statusOf } from '@/lib/status';

export const metadata = { title: 'Accès comptable', robots: { index: false, follow: false } };

// Accès comptable, en lecture seule, par lien secret : factures, avoirs, récapitulatif et exports
export default async function Page({ params, searchParams }) {
  const { token } = await params;
  const company = await companyByAccountantToken(token);
  if (!company) notFound();
  const sp = await searchParams;
  const invoices = await listInvoices(company.id);
  const years = yearsOf(invoices);
  const year = years.includes(Number(sp.annee)) ? Number(sp.annee) : years[0];
  const base = `/comptable/${token}`;
  const ofYear = invoices.filter((i) => i.number && i.issue_date?.startsWith(String(year)));

  return (
    <main className="accountant">
      <div className="page-head">
        <div>
          <Logo height={36} />
          <h1 style={{ marginTop: 12 }}>{company.name}</h1>
          <p className="hint" style={{ margin: '6px 0 0' }}>Accès comptable en lecture seule. Montants du récapitulatif en {company.currency}.</p>
        </div>
        <div className="actions">
          <a className="button secondary" href={`${base}/export?annee=${year}`}>Factures {year} (Excel)</a>
        </div>
      </div>

      <YearReport report={yearReport(company, invoices, year)} year={year} years={years} basePath={base} exportHref={`${base}/recap?annee=${year}`} />

      <section>
        <h2>Factures émises en {year}</h2>
        {ofYear.length ? (
          <div className="scroll">
            <table>
              <thead><tr><th>Numéro</th><th>Client</th><th>Émise le</th><th className="n">Net</th><th>Statut</th><th><span className="sr">Documents</span></th></tr></thead>
              <tbody>
                {ofYear.map((i) => {
                  const st = statusOf(i);
                  return (
                    <tr key={i.id}>
                      <td>{i.number}</td>
                      <td>{i.client_name}</td>
                      <td>{frDate(i.issue_date)}</td>
                      <td className="n">{money(i.amount_due, i.currency)}</td>
                      <td><span className={`status ${st.cls}`}>{st.label}</span></td>
                      <td className="n">
                        <a href={`${base}/pdf/${i.id}`} target="_blank" rel="noopener">PDF</a>
                        {i.credit_number && <> · <a href={`${base}/avoir/${i.id}`} target="_blank" rel="noopener">Avoir</a></>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <p className="empty">Aucune facture émise en {year}.</p>}
      </section>
    </main>
  );
}
