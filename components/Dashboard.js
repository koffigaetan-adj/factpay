'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import InvoiceTable from '@/components/InvoiceTable';
import { money, moneyAlt, round2, roundFor, fixedRate } from '@/lib/money';
import { today, frDate, frDateTime } from '@/lib/dates';
import { pubId } from '@/lib/ids';
import { WORKSPACES, actionsInWorkspace } from '@/lib/nav';

const MONTHS_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
const MONTHS_FULL = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

function niceMax(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((k) => k * p).find((m) => m >= v);
}

const compact = (n) => new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

function formatFullDate(d) {
  try {
    const s = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
    return `Nous sommes le ${s}`;
  } catch (e) {
    return `Nous sommes le ${frDate(d)}`;
  }
}

export default function Dashboard({
  user,
  company,
  invoices,
  quotes = [],
  receivedInvoices = [],
  receivedQuotes = [],
  expiring = [],
  clientCount,
  rhCounts = {},
  sansPortail = 0,
  payrollMonth = null,
  expensesPending = null,
  nowMonth = new Date().getUTCMonth() + 1,
  nowYear = new Date().getUTCFullYear(),
  flash,
}) {
  const cur = company.currency;
  const year = nowYear;
  const now = today();

  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const actionMenuRef = useRef(null);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && localStorage.getItem('factpay_banner_dismissed') === 'true') {
        setBannerDismissed(true);
      }
    } catch {
      // ignore localStorage error
    }
  }, []);

  const dismissBanner = () => {
    setBannerDismissed(true);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('factpay_banner_dismissed', 'true');
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    function handleClickOutside(e) {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target)) {
        setActionMenuOpen(false);
      }
    }
    if (actionMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [actionMenuOpen]);

  // Les totaux sont dans la devise de l'entreprise
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

  // Factures et devis reçus (Fournisseurs / Dépenses)
  const receivedOpen = receivedInvoices.filter((i) => ['emise', 'envoyee', 'signalee'].includes(i.status));
  const receivedQuotesPending = receivedQuotes.filter((i) => ['emise', 'envoyee'].includes(i.status));

  // Année en cours : encaissé, retenues, impôts, TVA, net
  const paidYear = mine.filter((i) => i.status === 'payee' && new Date(i.confirmed_at).getUTCFullYear() === year);
  const cashed = sum(paidYear, 'amount_due');
  const withheld = sum(paidYear, 'withholding_amount');
  const withheldPending = sum(open, 'withholding_amount');
  const reserve = Math.max(0, round2(sum(paidYear, 'subtotal') * (company.tax_reserve_rate / 100) - withheld));
  const vatDue = sum(paidYear, 'vat_amount');
  const net = cashed - reserve - vatDue;

  // Encaissé par mois
  const byMonth = MONTHS_SHORT.map((_, m) => sum(paidYear.filter((i) => new Date(i.confirmed_at).getUTCMonth() === m), 'amount_due'));
  const top = niceMax(Math.max(...byMonth));
  const ticks = [0, top / 2, top];
  const thisMonth = new Date().getUTCMonth();

  // Ce qui demande une action, du plus urgent au moins urgent
  const failed = invoices.filter((i) => i.status === 'emise' && i.send_error);
  const acceptedQuotes = quotes.filter((i) => i.status === 'acceptee');
  const scheduled = invoices.filter((i) => i.status === 'programmee').sort((a, b) => a.send_on.localeCompare(b.send_on));

  const effectiveSansPortail = rhCounts.sansPortail ?? sansPortail;

  const spaceCounts = {
    ...rhCounts,
    mesFactures: toCheck.length,
    mesDevis: acceptedQuotes.length,
  };
  const spaces = WORKSPACES.map((space) => ({
    ...space,
    pending: actionsInWorkspace(space, spaceCounts),
  }));

  const todo = [
    toCheck.length && {
      cls: 'check',
      href: '/factures?filtre=attente',
      label: `${toCheck.length} paiement${toCheck.length > 1 ? 's' : ''} signalé${toCheck.length > 1 ? 's' : ''} à vérifier`,
      detail: "Vérifie que l'argent est arrivé, puis confirme.",
    },
    rhCounts.bulletinsAPayer > 0 && {
      cls: 'check',
      href: '/fiches-de-paie?filtre=valide',
      label: `${rhCounts.bulletinsAPayer} bulletin${rhCounts.bulletinsAPayer > 1 ? 's' : ''} de paie à payer`,
      detail: 'Bulletins validés prêts pour le versement du salaire aux employés.',
    },
    rhCounts.conges > 0 && {
      cls: 'wait',
      href: '/conges?filtre=en_attente',
      label: `${rhCounts.conges} demande${rhCounts.conges > 1 ? 's' : ''} de congés en attente`,
      detail: "Demandes d'absence soumises par tes salariés à valider.",
    },
    rhCounts.notes > 0 && {
      cls: 'wait',
      href: '/notes-de-frais?filtre=en_attente',
      label: `${rhCounts.notes} note${rhCounts.notes > 1 ? 's' : ''} de frais en attente`,
      detail: `${expensesPending?.total ? money(expensesPending.total, cur) + ' ' : ''}soumis par l'équipe à valider et rembourser.`,
    },
    rhCounts.acomptes > 0 && {
      cls: 'wait',
      href: '/acomptes?filtre=en_attente',
      label: `${rhCounts.acomptes} demande${rhCounts.acomptes > 1 ? 's' : ''} d'acompte sur salaire`,
      detail: 'Avances financières demandées par les salariés.',
    },
    receivedOpen.length && {
      cls: 'late',
      href: '/factures-recues?filtre=attente',
      label: `${receivedOpen.length} facture${receivedOpen.length > 1 ? 's' : ''} reçue${receivedOpen.length > 1 ? 's' : ''} à payer`,
      detail: `${money(sum(receivedOpen, 'amount_due'), cur)} à régler à tes fournisseurs.`,
    },
    late.length && {
      cls: 'late',
      href: '/factures?filtre=retard',
      label: `${late.length} facture${late.length > 1 ? 's' : ''} en retard`,
      detail: `${money(sum(late, 'amount_due'), cur)} attendus. Relance ou renvoie la facture.`,
    },
    receivedQuotesPending.length && {
      cls: 'wait',
      href: '/devis-recus?filtre=attente',
      label: `${receivedQuotesPending.length} devis reçu${receivedQuotesPending.length > 1 ? 's' : ''} en attente`,
      detail: 'Consulte et réponds à tes fournisseurs.',
    },
    failed.length && {
      cls: 'late',
      href: `/factures/${failed[0].pub_id || pubId('facture', failed[0].id)}`,
      label: `${failed.length} envoi${failed.length > 1 ? 's' : ''} en échec`,
      detail: 'Nouvel essai automatique chaque matin, ou renvoie à la main.',
    },
    acceptedQuotes.length && {
      cls: 'paid',
      href: `/factures/${acceptedQuotes[0].pub_id || pubId('facture', acceptedQuotes[0].id)}`,
      label: `${acceptedQuotes.length} devis accepté${acceptedQuotes.length > 1 ? 's' : ''} à facturer`,
      detail: 'Transforme-le en facture en un clic.',
    },
    expiring.length && {
      cls: 'wait',
      href: '/documents?type=contrat',
      label: `${expiring.length} document${expiring.length > 1 ? 's' : ''} à échéance`,
      detail: 'Contrat ou attestation échu ou qui arrive à son terme dans les 30 jours.',
    },
    effectiveSansPortail > 0 && {
      cls: 'wait',
      href: '/employes?portail=absent',
      label: `${effectiveSansPortail} salari${effectiveSansPortail > 1 ? 'és' : 'é'} sans accès à son espace`,
      detail: "Crée son lien de portail pour qu'il consulte ses bulletins et pose ses congés.",
    },
    scheduled.length && {
      cls: 'draft',
      href: `/factures/${scheduled[0].pub_id || pubId('facture', scheduled[0].id)}`,
      label: `${scheduled.length} envoi${scheduled.length > 1 ? 's' : ''} programmé${scheduled.length > 1 ? 's' : ''}`,
      detail: `Prochain le ${frDateTime(scheduled[0].send_on, scheduled[0].send_tz)}.`,
    },
  ].filter(Boolean);

  const displayName = user.name || 'Utilisateur';

  return (
    <div className="dash-container">
      {/* En-tête PayFit avec Salutation, date du jour et bouton d'action principale */}
      <div className="dash-head">
        <div className="dash-title-group">
          <h1 className="dash-greeting">Bonjour {displayName}</h1>
          <p className="dash-date">{formatFullDate(new Date())}</p>
        </div>

        <div className="dash-action-menu" ref={actionMenuRef}>
          <button
            type="button"
            className="dash-action-btn"
            onClick={() => setActionMenuOpen(!actionMenuOpen)}
            aria-expanded={actionMenuOpen}
          >
            <span>Nouvelle action</span>
            <Icon name="chevronDown" size={14} />
          </button>

          {actionMenuOpen && (
            <div className="dash-action-dropdown">
              <div className="dash-action-group">
                <span className="dash-action-group-title">Facturation & Devis</span>
                <Link href="/factures/nouvelle" className="dash-action-item" onClick={() => setActionMenuOpen(false)}>
                  <span className="dash-action-item-icon"><Icon name="plus" size={16} /></span>
                  <div>
                    <strong>Nouvelle facture</strong>
                    <small>Créer et envoyer une facture client</small>
                  </div>
                </Link>
                <Link href="/devis/nouveau" className="dash-action-item" onClick={() => setActionMenuOpen(false)}>
                  <span className="dash-action-item-icon"><Icon name="quote" size={16} /></span>
                  <div>
                    <strong>Nouveau devis</strong>
                    <small>Établir une proposition commerciale</small>
                  </div>
                </Link>
                <Link href="/clients" className="dash-action-item" onClick={() => setActionMenuOpen(false)}>
                  <span className="dash-action-item-icon"><Icon name="user" size={16} /></span>
                  <div>
                    <strong>Nouveau client</strong>
                    <small>Ajouter un client à votre carnet</small>
                  </div>
                </Link>
              </div>

              <div className="dash-action-group">
                <span className="dash-action-group-title">Paie & Documents</span>
                <Link href="/fiches-de-paie/nouvelle" className="dash-action-item" onClick={() => setActionMenuOpen(false)}>
                  <span className="dash-action-item-icon"><Icon name="payslip" size={16} /></span>
                  <div>
                    <strong>Nouveau bulletin de paie</strong>
                    <small>Éditer une fiche de paie</small>
                  </div>
                </Link>
                <Link href="/employes" className="dash-action-item" onClick={() => setActionMenuOpen(false)}>
                  <span className="dash-action-item-icon"><Icon name="briefcase" size={16} /></span>
                  <div>
                    <strong>Nouveau salarié</strong>
                    <small>Déclarer un collaborateur</small>
                  </div>
                </Link>
                <Link href="/documents" className="dash-action-item" onClick={() => setActionMenuOpen(false)}>
                  <span className="dash-action-item-icon"><Icon name="documents" size={16} /></span>
                  <div>
                    <strong>Ajouter un document</strong>
                    <small>Contrat, attestation, justificatif</small>
                  </div>
                </Link>
                <Link href="/notes-de-frais" className="dash-action-item" onClick={() => setActionMenuOpen(false)}>
                  <span className="dash-action-item-icon"><Icon name="report" size={16} /></span>
                  <div>
                    <strong>Note de frais</strong>
                    <small>Remboursement de frais pro</small>
                  </div>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {flash}


      {/* Section Aperçu (style PayFit) */}
      <section className="dash-section" aria-labelledby="apercu-title">
        <div className="dash-section-header">
          <h2 id="apercu-title" className="dash-section-title">Aperçu</h2>
        </div>
        <div className="dash-overview-grid">
          {/* Card 1 : Congés & Absences */}
          <div className="dash-overview-card">
            <div className="overview-card-top">
              <div className="overview-icon overview-icon-conges">
                <Icon name="calendar" size={22} />
              </div>
              <div className="overview-info">
                <span className="overview-label">Congés à valider</span>
                <span className="overview-value">
                  {rhCounts.conges || 0} {(rhCounts.conges || 0) > 1 ? 'demandes' : 'demande'}
                </span>
                <span className="overview-hint">
                  {(rhCounts.conges || 0) > 0 ? 'En attente de validation' : 'Aucune demande en cours'}
                </span>
              </div>
            </div>
            <Link href="/conges" className="overview-link">
              Voir le détail &rarr;
            </Link>
          </div>

          {/* Card 2 : Factures à encaisser */}
          <div className="dash-overview-card">
            <div className="overview-card-top">
              <div className="overview-icon overview-icon-factures">
                <Icon name="invoice" size={22} />
              </div>
              <div className="overview-info">
                <span className="overview-label">À encaisser</span>
                <span className="overview-value">{money(toCollect, cur)}</span>
                <span className="overview-hint">
                  {late.length > 0 ? (
                    <span style={{ color: 'var(--late)', fontWeight: '600' }}>{late.length} facture{late.length > 1 ? 's' : ''} en retard</span>
                  ) : (
                    'Paiements à jour'
                  )}
                </span>
              </div>
            </div>
            <Link href="/factures?filtre=attente" className="overview-link">
              Voir le détail &rarr;
            </Link>
          </div>

          {/* Card 3 : Masse salariale du mois */}
          <div className="dash-overview-card">
            <div className="overview-card-top">
              <div className="overview-icon overview-icon-paie">
                <Icon name="briefcase" size={22} />
              </div>
              <div className="overview-info">
                <span className="overview-label">Masse salariale · {MONTHS_FULL[nowMonth - 1]}</span>
                <span className="overview-value">{money(payrollMonth?.net_total || 0, cur)}</span>
                <span className="overview-hint">
                  {rhCounts.effectif || 0} salarié{(rhCounts.effectif || 0) > 1 ? 's' : ''} · {payrollMonth?.valid_payslips || 0} à payer
                </span>
              </div>
            </div>
            <Link href="/fiches-de-paie" className="overview-link">
              Voir le détail &rarr;
            </Link>
          </div>

          {/* Card 4 : Net entreprise */}
          <div className="dash-overview-card">
            <div className="overview-card-top">
              <div className="overview-icon overview-icon-net">
                <Icon name="dashboard" size={22} />
              </div>
              <div className="overview-info">
                <span className="overview-label">Net encaissé en {year}</span>
                <span className="overview-value" style={{ color: 'var(--paid)' }}>{money(net, cur)}</span>
                <span className="overview-hint">
                  Total encaissé : {money(cashed, cur)}
                </span>
              </div>
            </div>
            <Link href="/rapports" className="overview-link">
              Voir le détail &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* Section Tâches à compléter (style PayFit) */}
      <section className="dash-section" aria-labelledby="tasks-title">
        <div className="dash-section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 id="tasks-title" className="dash-section-title" style={{ margin: 0 }}>
              Tâches à compléter
            </h2>
            {todo.length > 0 && (
              <span className="dash-badge-count">{todo.length}</span>
            )}
          </div>
        </div>

        {todo.length > 0 ? (
          <div className="dash-tasks-list">
            {todo.map((t) => (
              <Link key={t.label} href={t.href} className={`dash-task-row ${t.cls}`}>
                <div className="dash-task-indicator" />
                <div className="dash-task-body">
                  <span className="dash-task-label">{t.label}</span>
                  <span className="dash-task-detail">{t.detail}</span>
                </div>
                <span className="dash-task-action">
                  Traiter &rarr;
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="dash-tasks-empty">
            <span className="dash-tasks-empty-icon">✓</span>
            <div>
              <strong>Tout est à jour !</strong>
              <p>Aucune tâche urgente ni paiement en attente d'action.</p>
            </div>
          </div>
        )}
      </section>

      {/* Espaces de travail rapides */}
      <nav className="spaces" aria-label="Espaces de travail">
        {spaces.map((space) => (
          <Link key={space.id} href={space.href} className="space-card">
            <span className="space-icon">
              <Icon name={space.icon} size={18} />
            </span>
            <span className="space-text">
              <span className="space-label">{space.label}</span>
              <span className="space-detail">{space.detail}</span>
            </span>
            {space.pending > 0 && (
              <span className="space-count" title={`${space.pending} décision(s) en attente`}>
                {space.pending} à traiter
              </span>
            )}
          </Link>
        ))}
      </nav>

      {clientCount === 0 && (
        <section className="start">
          <h2>Pour commencer</h2>
          <p className="hint">Ajoute ton premier client, puis crée ta première facture.</p>
          <Link className="button" href="/clients">
            <Icon name="plus" size={16} />
            Ajouter un client
          </Link>
        </section>
      )}

      {/* Graphique des encaissements par mois */}
      <section className="dash-chart" aria-labelledby="chart-title">
        <div className="chart-head">
          <div>
            <h2 id="chart-title">Encaissé par mois en {year}</h2>
            <span className="sub" style={{ marginTop: '4px' }}>Date de confirmation de chaque paiement</span>
          </div>
          <span className="muted" style={{ fontWeight: '600', fontSize: '15px' }}>Total {money(cashed, cur)}</span>
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
                <span className="tip" role="tooltip"><strong>{money(v, cur)}</strong>{MONTHS_FULL[m]} {year}</span>
                <span className="bar-label">{MONTHS_SHORT[m]}</span>
              </div>
            ))}
          </div>
        </div>
        <table className="sr">
          <caption>Encaissé par mois en {year}</caption>
          <thead><tr><th>Mois</th><th>Encaissé</th></tr></thead>
          <tbody>{byMonth.map((v, m) => <tr key={m}><td>{MONTHS_FULL[m]}</td><td>{money(v, cur)}</td></tr>)}</tbody>
        </table>
        {skipped > 0 && <p className="help" style={{ margin: '12px 0 0' }}>{skipped} facture{skipped > 1 ? 's' : ''} dans une autre devise, sans taux vers {cur}, {skipped > 1 ? 'ne sont' : "n'est"} pas comptée{skipped > 1 ? 's' : ''} ici.</p>}
      </section>

      <section>
        <div className="chart-head">
          <h2>Dernières factures</h2>
          {invoices.length > 5 && (
            <Link className="button secondary small" href="/factures" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              Toutes les factures
              <span aria-hidden="true">&rarr;</span>
            </Link>
          )}
        </div>
        {invoices.length ? (
          <>
            <InvoiceTable invoices={invoices.slice(0, 5)} />
            {invoices.length > 5 && (
              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
                <Link className="button secondary" href="/factures" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  Voir plus de factures ({invoices.length})
                  <span aria-hidden="true">&rarr;</span>
                </Link>
              </div>
            )}
          </>
        ) : (
          <p className="empty">Pas encore de facture. <Link href="/factures/nouvelle">Crée la première</Link>.</p>
        )}
      </section>
    </div>
  );
}
