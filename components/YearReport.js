import Link from 'next/link';
import Icon from '@/components/Icon';
import { money } from '@/lib/money';

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

// Récapitulatif fiscal d'une année : totaux, par client, par mois.
// basePath : page où changer d'année ; exportHref : lien du CSV.
export default function YearReport({ report, year, years, basePath, exportHref }) {
  const cur = report.currency;
  const m = (n) => money(n, cur);
  const t = report.total;
  return (
    <>
      <div className="report-bar">
        <nav className="tabs" aria-label="Année">
          {years.map((y) => <Link key={y} href={`${basePath}?annee=${y}`} aria-current={y === year ? 'page' : undefined}>{y}</Link>)}
        </nav>
        {exportHref && (
          <a className="button secondary" href={exportHref}>
            <Icon name="download" size={16} />
            Exporter le récapitulatif (Excel)
          </a>
        )}
      </div>

      <section>
        <dl className="calc report-totals">
          <div><dt>Chiffre d'affaires hors taxes<span className="sub">{t.count} facture{t.count > 1 ? 's' : ''} émise{t.count > 1 ? 's' : ''} en {year}, hors annulées</span></dt><dd>{m(t.subtotal)}</dd></div>
          <div><dt>TVA facturée</dt><dd>{m(t.vat)}</dd></div>
          <div><dt>Total TTC facturé</dt><dd>{m(t.total)}</dd></div>
          <div><dt>Retenues à la source<span className="sub">prélevées par tes clients, à déduire de tes impôts</span></dt><dd>{m(t.withholding)}</dd></div>
          <div><dt>Net à percevoir</dt><dd>{m(t.due)}</dd></div>
          <div className="calc-total"><dt>Déjà encaissé</dt><dd>{m(t.cashed)}</dd></div>
        </dl>
        {report.skipped > 0 && <p className="help" style={{ margin: 0 }}>{report.skipped} facture{report.skipped > 1 ? 's' : ''} dans une autre devise, sans taux vers {cur}, {report.skipped > 1 ? 'ne sont' : "n'est"} pas comptée{report.skipped > 1 ? 's' : ''}.</p>}
      </section>

      <section>
        <h2>Par client</h2>
        {report.clients.length ? (
          <div className="scroll">
            <table>
              <thead><tr><th>Client</th><th className="n">Factures</th><th className="n">HT</th><th className="n">TVA</th><th className="n">Retenues</th><th className="n">Encaissé</th></tr></thead>
              <tbody>
                {report.clients.map((c) => (
                  <tr key={c.name}><td>{c.name}</td><td className="n">{c.count}</td><td className="n">{m(c.subtotal)}</td><td className="n">{m(c.vat)}</td><td className="n">{m(c.withholding)}</td><td className="n">{m(c.cashed)}</td></tr>
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
            <thead><tr><th>Mois</th><th className="n">Factures</th><th className="n">HT</th><th className="n">TVA</th><th className="n">Retenues</th></tr></thead>
            <tbody>
              {report.months.map((r, i) => (
                <tr key={i} className={r.count ? '' : 'muted'}><td>{MONTHS[i]}</td><td className="n">{r.count}</td><td className="n">{m(r.subtotal)}</td><td className="n">{m(r.vat)}</td><td className="n">{m(r.withholding)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
