import Link from 'next/link';
import Icon from '@/components/Icon';
import InvoiceTable from '@/components/InvoiceTable';
import { money, moneyAlt, round2, roundFor, fixedRate } from '@/lib/money';
import { today, frDate } from '@/lib/dates';

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

// Graduation « ronde » de l'axe : 1, 2 ou 5 × une puissance de 10
function niceMax(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((k) => k * p).find((m) => m >= v);
}

// Montants compacts pour l'axe : 1,5 M · 250 k
const compact = (n) => new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

// Le tableau de bord à partir des données déjà lues (séparé pour pouvoir l'afficher avec des données d'exemple)
export default function Dashboard({ user, company, invoices, quotes = [], expiring = [], clientCount, flash }) {
  const cur = company.currency;
  const year = new Date().getUTCFullYear();
  const now = today();

  // Les totaux sont dans la devise de l'entreprise. Une facture dans une autre devise est comptée
  // si elle a un taux vers cette devise (parité fixe, ou taux saisi sur la facture).
  const rateOf = (i) => (i.currency === cur ? 1 : fixedRate(i.currency, cur) ?? (i.alt_currency === cur ? i.alt_rate : null));
  const sum = (list, field) => roundFor(list.reduce((s, i) => s + i[field] * rateOf(i), 0), cur);
  const issued = invoices.filter((i) => !['brouillon', 'programmee', 'annulee'].includes(i.status));
  const mine = issued.filter((i) => rateOf(i));
  const skipped = issued.length - mine.length;

  // À encaisser, réparti par situation
  const open = mine.filter((i) => ['emise', 'envoyee', 'signalee'].includes(i.status));
  const late = open.filter((i) => i.status !== 'signalee' && i.due_date && i.due_date < now);
  const toCheck = invoices.filter((i) => i.status === 'signalee');
  const onTime = open.filter((i) => !late.includes(i) && i.status !== 'signalee');
  const toCollect = sum(open, 'amount_due');

  // Année en cours : encaissé, retenues, impôts, TVA, net
  const paidYear = mine.filter((i) => i.status === 'payee' && new Date(i.confirmed_at).getUTCFullYear() === year);
  const cashed = sum(paidYear, 'amount_due');
  // Les retenues sont versées aux impôts par tes clients, pour ton compte : elles réduisent ce qu'il reste à mettre de côté.
  const withheld = sum(paidYear, 'withholding_amount');
  const withheldPending = sum(open, 'withholding_amount');
  // Impôts à mettre de côté : sur le montant hors TVA (la TVA est reversée à l'État)
  const reserve = Math.max(0, round2(sum(paidYear, 'subtotal') * (company.tax_reserve_rate / 100) - withheld));
  const vatDue = sum(paidYear, 'vat_amount');
  const net = cashed - reserve - vatDue;

  // Encaissé par mois (date de confirmation du paiement)
  const byMonth = MONTHS.map((_, m) => sum(paidYear.filter((i) => new Date(i.confirmed_at).getUTCMonth() === m), 'amount_due'));
  const top = niceMax(Math.max(...byMonth));
  const ticks = [0, top / 2, top];
  const thisMonth = new Date().getUTCMonth();

  // Ce qui demande une action, du plus urgent au moins urgent
  const failed = invoices.filter((i) => i.status === 'emise' && i.send_error);
  const acceptedQuotes = quotes.filter((i) => i.status === 'acceptee');
  const scheduled = invoices.filter((i) => i.status === 'programmee').sort((a, b) => a.send_on.localeCompare(b.send_on));
  const todo = [
    toCheck.length && { cls: 'check', href: '/factures?filtre=attente', label: `${toCheck.length} paiement${toCheck.length > 1 ? 's' : ''} signalé${toCheck.length > 1 ? 's' : ''} à vérifier`, detail: 'Vérifie que l\'argent est arrivé, puis confirme.' },
    late.length && { cls: 'late', href: '/factures?filtre=retard', label: `${late.length} facture${late.length > 1 ? 's' : ''} en retard`, detail: `${money(sum(late, 'amount_due'), cur)} attendus. Relance ou renvoie la facture.` },
    failed.length && { cls: 'late', href: `/factures/${failed[0].id}`, label: `${failed.length} envoi${failed.length > 1 ? 's' : ''} en échec`, detail: 'Nouvel essai automatique chaque matin, ou renvoie à la main.' },
    acceptedQuotes.length && { cls: 'paid', href: `/factures/${acceptedQuotes[0].id}`, label: `${acceptedQuotes.length} devis accepté${acceptedQuotes.length > 1 ? 's' : ''} à facturer`, detail: 'Transforme-le en facture en un clic.' },
    expiring.length && { cls: 'wait', href: '/documents?type=contrat', label: `${expiring.length} document${expiring.length > 1 ? 's' : ''} à échéance`, detail: 'Contrat ou attestation échu ou qui arrive à son terme dans les 30 jours.' },
    scheduled.length && { cls: 'draft', href: `/factures/${scheduled[0].id}`, label: `${scheduled.length} envoi${scheduled.length > 1 ? 's' : ''} programmé${scheduled.length > 1 ? 's' : ''}`, detail: `Prochain le ${frDate(scheduled[0].send_on)}.` },
  ].filter(Boolean);

  const firstName = user.first_name || user.name.split(' ')[0];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Bonjour {firstName}</h1>
          <p className="hint" style={{ margin: '6px 0 0' }}>{frDate(now)} · {company.name}</p>
        </div>
        <div className="actions"><Link className="button" href="/factures/nouvelle">Nouvelle facture</Link></div>
      </div>
      {flash}

      {clientCount === 0 && (
        <section className="start">
          <h2>Pour commencer</h2>
          <p className="hint">Ajoute ton premier client, puis crée ta première facture.</p>
          <Link className="button" href="/clients">Ajouter un client</Link>
        </section>
      )}

      {todo.length > 0 && (
        <section className="todo" aria-labelledby="todo-title">
          <h2 id="todo-title" style={{ marginBottom: '16px', fontSize: '18px' }}>À faire</h2>
          <div className="todo-stack">
            {todo.map((t) => (
              <Link key={t.label} href={t.href} className={`todo-card ${t.cls}`}>
                <div className="todo-content">
                  <span className="todo-label">{t.label}</span>
                  <span className="todo-detail">{t.detail}</span>
                </div>
                <span className="todo-go" aria-hidden="true">→</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="dash">
        <section className="dash-card dash-net" aria-labelledby="net-title">
          <div className="dash-card-header">
            <div className="dash-card-icon"><Icon name="dashboard" size={20} /></div>
            <h2 id="net-title" style={{ margin: 0 }}>Ton net en {year}</h2>
          </div>
          <p className="net-figure">{money(net, cur)}</p>
          {company.show_alt_currency && moneyAlt(net, cur) && <p className="dash-sub">soit {moneyAlt(net, cur)}</p>}
          <dl className="calc">
            <div><dt>Encaissé</dt><dd>{money(cashed, cur)}</dd></div>
            <div>
              <dt>Retenue à la source<span className="sub">déjà versée aux impôts par tes clients{withheldPending > 0 ? ` · + ${money(withheldPending, cur)} sur factures en attente` : ''}</span></dt>
              <dd className="muted">{money(withheld, cur)}</dd>
            </div>
            {company.tax_reserve_rate > 0 && (
              <div><dt>À mettre de côté pour les impôts<span className="sub">{company.tax_reserve_rate} % du HT{withheld > 0 ? ', moins retenues' : ''}</span></dt><dd>− {money(reserve, cur)}</dd></div>
            )}
            {vatDue > 0 && <div><dt>TVA à reverser</dt><dd>− {money(vatDue, cur)}</dd></div>}
            <div className="calc-total"><dt>Net pour toi</dt><dd>{money(net, cur)}</dd></div>
          </dl>
          {company.tax_reserve_rate === 0 && (
            <p className="help" style={{ marginBottom: 0, marginTop: '12px' }}>Indique dans <Link href="/parametres">Paramètres</Link> le pourcentage à garder pour tes impôts : il sera retiré ici.</p>
          )}
        </section>

        <section className="dash-card dash-open" aria-labelledby="open-title">
          <div className="dash-card-header">
            <div className="dash-card-icon" style={{ background: 'color-mix(in srgb, var(--ink) 10%, transparent)', color: 'var(--ink)' }}><Icon name="report" size={20} /></div>
            <h2 id="open-title" style={{ margin: 0 }}>À encaisser</h2>
          </div>
          <p className="open-figure">{money(toCollect, cur)}</p>
          {company.show_alt_currency && toCollect > 0 && moneyAlt(toCollect, cur) && <p className="dash-sub">soit {moneyAlt(toCollect, cur)}</p>}
          <dl className="calc">
            <div><dt><span className="status wait">Dans les temps</span></dt><dd>{money(sum(onTime, 'amount_due'), cur)}</dd></div>
            <div><dt><span className="status check">Paiement signalé</span></dt><dd>{money(sum(open.filter((i) => i.status === 'signalee'), 'amount_due'), cur)}</dd></div>
            <div><dt><span className="status late">En retard</span></dt><dd>{money(sum(late, 'amount_due'), cur)}</dd></div>
          </dl>
          <div style={{ marginTop: '20px' }}>
            <Link className="button secondary" href="/factures?filtre=attente">Voir les factures en attente</Link>
          </div>
        </section>

        <section className="dash-chart" aria-labelledby="chart-title">
          <div className="chart-head">
            <h2 id="chart-title">Encaissé par mois en {year}</h2>
            <span className="muted">Total {money(cashed, cur)}</span>
          </div>
          <div className="bars" role="img" aria-label={`Montants encaissés chaque mois en ${year}. Le détail est dans le tableau qui suit.`}>
            <div className="bars-axis" aria-hidden="true">
              {[...ticks].reverse().map((t) => <span key={t}>{compact(t)}</span>)}
            </div>
            <div className="bars-plot">
              {ticks.map((t) => <span key={t} className="grid" style={{ bottom: `${(t / top) * 100}%` }} aria-hidden="true" />)}
              {byMonth.map((v, m) => (
                <div key={m} className={`bar-col${m === thisMonth ? ' now' : ''}${m > thisMonth ? ' future' : ''}`} tabIndex={0}>
                  <span className="bar" style={{ height: `${(v / top) * 100}%` }} />
                  <span className="tip" role="tooltip"><strong>{money(v, cur)}</strong>{MONTHS[m]} {year}</span>
                  <span className="bar-label">{MONTHS[m]}</span>
                </div>
              ))}
            </div>
          </div>
          <table className="sr">
            <caption>Encaissé par mois en {year}</caption>
            <thead><tr><th>Mois</th><th>Encaissé</th></tr></thead>
            <tbody>{byMonth.map((v, m) => <tr key={m}><td>{MONTHS[m]}</td><td>{money(v, cur)}</td></tr>)}</tbody>
          </table>
          {skipped > 0 && <p className="help" style={{ margin: '12px 0 0' }}>{skipped} facture{skipped > 1 ? 's' : ''} dans une autre devise, sans taux vers {cur}, {skipped > 1 ? 'ne sont' : "n'est"} pas comptée{skipped > 1 ? 's' : ''} ici.</p>}
        </section>
      </div>

      <section>
        <div className="chart-head">
          <h2>Dernières factures</h2>
          {invoices.length > 6 && <Link href="/factures">Toutes les factures</Link>}
        </div>
        {invoices.length
          ? <InvoiceTable invoices={invoices.slice(0, 6)} />
          : <p className="empty">Pas encore de facture. <Link href="/factures/nouvelle">Crée la première</Link>.</p>}
      </section>
    </>
  );
}
