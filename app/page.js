import Link from 'next/link';
import { redirect } from 'next/navigation';
import Logo from '@/components/Logo';
import CurrencySwitch from '@/components/CurrencySwitch';
import Icon from '@/components/Icon';
import { currentUser } from '@/lib/auth';
import { money, totals, convert, fixedRate } from '@/lib/money';

// Facture d'exemple
const LINES = [
  { description: 'Développement d’application web & mobile', quantity: 10, unit: 'jours', unit_price: 125000 },
  { description: 'Formation de l’équipe & mise en production', quantity: 1, unit: 'forfait', unit_price: 150000 },
];
const T = totals(LINES, 0, 5, 'XOF');
const TO_EUR = fixedRate('XOF', 'EUR');

function Amount({ n, minus = false }) {
  const sign = minus ? '− ' : '';
  return (
    <>
      <span className="m-main">{sign}{money(n, 'XOF')}</span>
      <span className="m-alt">{sign}{money(convert(n, TO_EUR, 'EUR'), 'EUR')}</span>
    </>
  );
}

const STATS = [
  { icon: 'shield', number: '100%', label: 'Conforme CNSS & Code du travail' },
  { icon: 'building', number: '15+', label: 'Pays & Devises (F CFA, EUR, USD)' },
  { icon: 'cash', number: '100%', label: 'Mobile Money & Virement (Flooz, TMoney, Wave)' },
  { icon: 'clock', number: '60s', label: 'Pour émettre facture ou fiche de paie' },
];

const PILLARS = [
  {
    icon: 'invoice',
    cls: 'p1',
    title: 'Facturation & Devis Intelligents',
    desc: 'Éditez des factures professionnelles en F CFA ou en devises internationales avec calcul automatique de la TVA et de la retenue à la source.',
    items: [
      'Calcul instantané de la retenue à la source (5 %)',
      'Bascule automatique F CFA ⇄ Euros',
      'Coordonnées Flooz, TMoney, Mixx & Wave intégrées',
      'QR Code et code d’authenticité infalsifiable',
    ],
  },
  {
    icon: 'people',
    cls: 'p2',
    title: 'Paie & Gestion RH Automatisée',
    desc: 'Générez des bulletins de paie conformes aux barèmes fiscaux et sociaux du Togo et de la zone UEMOA sans aucune prise de tête.',
    items: [
      'Cotisations CNSS calculées automatiquement (4 % & 17,5 %)',
      'Gestion des primes, indemnités et acomptes sur salaire',
      'Suivi des congés acquis et absences de l’équipe',
      'Génération d’attestations de travail certifiées',
    ],
  },
  {
    icon: 'user',
    cls: 'p3',
    title: 'Portail Salarié Self-Service',
    desc: 'Donnez à chaque collaborateur un accès personnel et sécurisé sur mobile pour consulter ses bulletins et faire ses demandes RH.',
    items: [
      'Définition de mot de passe personnel sécurisé',
      'Téléchargement direct des fiches de paie PDF',
      'Dépôt des demandes de congés en 2 clics',
      'Demandes d’acomptes et notes de frais avec reçus',
    ],
  },
];

const LOCAL = [
  { icon: 'cash', tag: '1 567 500 F CFA', title: 'Le franc CFA sans centimes', text: 'Montants arrondis au franc, conformes à vos reçus réels. Compatible XOF, XAF, EUR et USD.' },
  { icon: 'repeat', tag: '1 € = 655,957 F CFA', title: 'Parité fixe instantanée', text: 'Vos clients basculent d’un clic entre F CFA et euros pour leurs partenaires locaux ou internationaux.' },
  { icon: 'cash', tag: 'Flooz · TMoney · Wave · Mixx', title: 'Paiements d’Afrique de l’Ouest', text: 'Vos comptes Mobile Money, votre RIB bancaire et SPI figurent directement sur vos factures.' },
  { icon: 'percent', tag: 'CNSS 4 % · Retenue 5 %', title: 'Barèmes fiscaux intégrés', text: 'Cotisations sociales CNSS et retenues fiscales à la source calculées automatiquement à la virgule près.' },
  { icon: 'user', tag: 'Espace Salarié Sécurisé', title: 'Portail collaborateur moderne', text: 'Vos employés se connectent, téléchargent leurs fiches de paie et posent leurs congés en toute autonomie.' },
  { icon: 'shield', tag: 'NIF · RCCM · Numérotation', title: 'Conformité légale garantie', text: 'Numérotation continue sans trou, mentions d’entreprise et traçabilité pour votre comptabilité.' },
];

const FAQS = [
  {
    q: 'Comment mes salariés accèdent-ils à leur espace ?',
    a: 'Lors de l’ajout du salarié, vous renseignez son adresse e-mail. Il reçoit une invitation personnelle lui permettant de définir son mot de passe et d’accéder à son portail depuis son smartphone ou ordinateur.',
  },
  {
    q: 'Les bulletins de paie sont-ils conformes au droit du travail ?',
    a: 'Oui ! FactPay intègre nativement les taux de cotisations sociales CNSS Togo / UEMOA (4 % part salariale, 17,5 % part patronale), les primes, indemnités de transport et exonérations légales.',
  },
  {
    q: 'Quels modes de règlement puis-je afficher sur mes factures ?',
    a: 'Vous pouvez configurer vos comptes TMoney (Togocom), Flooz (Moov Africa), Wave, Mixx by Yas, ainsi que vos coordonnées bancaires (IBAN, BIC / SWIFT) avec le titulaire exact du compte.',
  },
  {
    q: 'Puis-je partager mes données avec mon comptable ?',
    a: 'Absolument. FactPay propose un lien d’accès sécurisé en lecture seule pour votre expert-comptable ainsi que des exports CSV et PDF complets de vos factures et paies.',
  },
];

const NET = [
  { label: 'Facturé hors taxes en 2026', value: 4500000 },
  { label: 'Retenu par vos clients (5 %)', value: -225000 },
  { label: 'Encaissé sur vos comptes', value: 4275000, rule: true },
  { label: 'Provision pour charges sociales & impôts', value: -450000, note: 'Net net après retenues et prélèvements légaux' },
];

export default async function Home({ searchParams }) {
  if (await currentUser()) redirect('/tableau-de-bord');
  const deleted = (await searchParams)?.compte === 'supprime';

  return (
    <div className="lp-wrap">
      {deleted && (
        <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '12px 24px', textAlign: 'center', fontWeight: 600, fontSize: '14px' }}>
          Votre compte et ses données ont été supprimés.
        </div>
      )}

      {/* HEADER DE NAVIGATION */}
      <header className="lp-header">
        <div className="lp-container">
          <nav className="lp-nav" aria-label="Navigation principale">
            <Link href="/" aria-label="FactPay, retour à l'accueil">
              <Logo height={42} priority />
            </Link>
            <div className="lp-nav-links">
              <Link className="lp-nav-btn ghost hide-xs" href="/portail/connexion">
                <Icon name="user" size={16} /> Espace Salarié
              </Link>
              <Link className="lp-nav-btn outline" href="/connexion">
                Connexion
              </Link>
              <Link className="lp-nav-btn primary" href="/inscription">
                Créer un compte
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="lp-hero">
        <div className="lp-container">
          <div className="lp-hero-grid">
            <div>
              <div className="lp-badge">
                <Icon name="shield" size={14} /> La suite tout-en-un · Facturation, RH & Paie
              </div>
              <h1 className="lp-hero-title">
                Facturez vos clients.<br />
                <span>Gérez vos paies & vos salariés.</span>
              </h1>
              <p className="lp-hero-desc">
                FactPay réunit la <strong>facturation professionnelle</strong> (F CFA / €, Mobile Money Flooz / TMoney / Wave, retenues) et la <strong>gestion RH & Paie</strong> conforme aux normes d’Afrique de l'Ouest (Togo, UEMOA). Offrez à votre équipe un portail collaborateur moderne et sécurisé.
              </p>
              <div className="lp-hero-ctas">
                <Link className="lp-btn-cta-primary" href="/inscription">
                  <Icon name="plus" size={16} /> Démarrer gratuitement
                </Link>
                <Link className="lp-btn-cta-secondary" href="/portail/connexion">
                  <Icon name="user" size={16} /> Portail Salarié
                </Link>
              </div>
              <div className="lp-hero-trust">
                <span className="lp-hero-trust-item">
                  <Icon name="lock" size={14} /> Données chiffrées & 2FA
                </span>
                <span className="lp-hero-trust-item">
                  <Icon name="clock" size={14} /> Prise en main en 2 minutes
                </span>
                <span className="lp-hero-trust-item">
                  <Icon name="cash" size={14} /> Sans carte bancaire
                </span>
              </div>
            </div>

            {/* APERÇU DOCUMENT FACTURE & BULLETIN */}
            <div>
              <div className="lp-mockup">
                <div className="lp-mockup-bar">
                  <div className="lp-mockup-dots">
                    <span className="lp-mockup-dot red"></span>
                    <span className="lp-mockup-dot yellow"></span>
                    <span className="lp-mockup-dot green"></span>
                  </div>
                  <CurrencySwitch main="F CFA" alt="€" />
                </div>

                <div className="lp-mockup-body">
                  <div className="lp-doc-header">
                    <div>
                      <span className="lp-doc-badge">Émise & Prête</span>
                      <strong style={{ display: 'block', fontSize: '15px', color: '#0F172A', marginTop: '2px' }}>
                        Facture FAC-FP481-0014
                      </strong>
                      <span style={{ fontSize: '12px', color: '#64748B' }}>Échéance : 15 octobre 2026</span>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: '12.5px', color: '#475569' }}>
                      <strong>Studio Tech SARL</strong><br />
                      Lomé, Togo · NIF : 1000000000
                    </div>
                  </div>

                  <div style={{ marginBottom: '14px', fontSize: '13px' }}>
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748B', fontWeight: 700, display: 'block' }}>
                      Facturé à
                    </span>
                    <strong style={{ color: '#0F172A' }}>Société Lumière UEMOA</strong>
                  </div>

                  <table className="lp-doc-table">
                    <thead>
                      <tr>
                        <th>Prestation</th>
                        <th className="n hide-xs">Qté</th>
                        <th className="n">Montant</th>
                      </tr>
                    </thead>
                    <tbody>
                      {LINES.map((l) => (
                        <tr key={l.description}>
                          <td>{l.description}</td>
                          <td className="n hide-xs" style={{ color: '#64748B' }}>{l.quantity} {l.unit}</td>
                          <td className="n" style={{ fontWeight: 650 }}><Amount n={l.quantity * l.unit_price} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="lp-doc-totals">
                    <div className="lp-doc-totals-row">
                      <span>Total HT</span>
                      <span style={{ fontWeight: 600 }}><Amount n={T.total} /></span>
                    </div>
                    <div className="lp-doc-totals-row">
                      <span>Retenue à la source (5 %)</span>
                      <span style={{ color: '#DC2626', fontWeight: 600 }}><Amount n={T.withholding} minus /></span>
                    </div>
                    <div className="lp-doc-totals-row final">
                      <span>Net à payer</span>
                      <span><Amount n={T.due} /></span>
                    </div>
                  </div>

                  <div className="lp-doc-paymethods">
                    <Icon name="cash" size={16} />
                    <span><strong>Paiement Mobile :</strong> TMoney +228 90 00 00 00 · Flooz +228 99 00 00 00 · Virement Ecobank</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BANDEAU DE STATISTIQUES */}
      <section className="lp-stats">
        <div className="lp-container">
          <div className="lp-stats-grid">
            {STATS.map((s, i) => (
              <div key={i} className="lp-stat-item">
                <div className="lp-stat-number">
                  <span style={{ color: 'var(--brand)', display: 'inline-flex' }}><Icon name={s.icon} size={24} /></span>
                  <span>{s.number}</span>
                </div>
                <div className="lp-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LES 3 PILIERS DE FACTPAY */}
      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-section-head">
            <div className="lp-badge">
              <Icon name="briefcase" size={14} /> Fonctionnalités Clés
            </div>
            <h2 className="lp-section-title">Tout ce dont votre entreprise a besoin au quotidien</h2>
            <p className="lp-section-subtitle">
              Une plateforme moderne conçue pour simplifier la vie des dirigeants, comptables et salariés.
            </p>
          </div>

          <div className="lp-pillars-grid">
            {PILLARS.map((p, i) => (
              <div key={i} className={`lp-pillar-card ${p.cls}`}>
                <div className="lp-pillar-icon" style={{ color: 'var(--brand)' }}>
                  <Icon name={p.icon} size={26} />
                </div>
                <h3 className="lp-pillar-title">{p.title}</h3>
                <p className="lp-pillar-desc">{p.desc}</p>
                <ul className="lp-pillar-list">
                  {p.items.map((it, idx) => (
                    <li key={idx}>
                      <span style={{ color: '#059669', display: 'inline-flex' }}>
                        <Icon name="check" size={15} />
                      </span>
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONÇU POUR L'AFRIQUE DE L'OUEST */}
      <section className="lp-section" style={{ background: '#FFFFFF', borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0' }}>
        <div className="lp-container">
          <div className="lp-section-head">
            <div className="lp-badge">
              <Icon name="building" size={14} /> Ancrage Régional
            </div>
            <h2 className="lp-section-title">Pensé pour Lomé, Cotonou, Abidjan et Dakar</h2>
            <p className="lp-section-subtitle">
              Pas un outil étranger inadapté : les spécificités juridiques, fiscales, bancaires et mobiles de l’UEMOA sont intégrées au cœur de FactPay.
            </p>
          </div>

          <div className="lp-local-grid">
            {LOCAL.map((x, i) => (
              <div key={i} className="lp-local-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'var(--brand)', display: 'inline-flex' }}>
                    <Icon name={x.icon} size={16} />
                  </span>
                  <span className="lp-local-tag">{x.tag}</span>
                </div>
                <h3 className="lp-local-title">{x.title}</h3>
                <p className="lp-local-text">{x.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SUIVI RÉEL DE LA TRÉSORERIE */}
      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-hero-grid" style={{ alignItems: 'center' }}>
            <div>
              <div className="lp-badge">
                <Icon name="report" size={14} /> Trésorerie Claire
              </div>
              <h2 className="lp-section-title">Votre trésorerie réelle, pas juste votre chiffre d'affaires</h2>
              <p className="lp-hero-desc">
                FactPay distingue précisément ce que vous facturez, ce que vos clients ont effectivement réglé, les retenues fiscales appliquées et vos provisions pour cotisations sociales (CNSS).
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14.5px', color: '#334155' }}>
                  <span style={{ color: '#059669', display: 'inline-flex' }}><Icon name="check" size={18} /></span>
                  <span><strong>Zéro surprise fiscale :</strong> vos provisions sont calculées automatiquement.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14.5px', color: '#334155' }}>
                  <span style={{ color: '#059669', display: 'inline-flex' }}><Icon name="check" size={18} /></span>
                  <span><strong>Gestion des avoirs :</strong> annulation propre et conforme en comptabilité.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14.5px', color: '#334155' }}>
                  <span style={{ color: '#059669', display: 'inline-flex' }}><Icon name="check" size={18} /></span>
                  <span><strong>Relances automatisées :</strong> rappels par e-mail programmés sans effort.</span>
                </div>
              </div>
            </div>

            <div className="lp-mockup" style={{ padding: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <strong style={{ fontSize: '15px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon name="trendingUp" size={18} /> Tableau de bord financier 2026
                </strong>
                <span className="lp-doc-badge">Temps Réel</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {NET.map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: r.rule ? '2px solid #0F172A' : '1px solid #F1F5F9' }}>
                    <div>
                      <div style={{ fontSize: '13.5px', color: '#475569', fontWeight: 550 }}>{r.label}</div>
                      {r.note && <div style={{ fontSize: '11.5px', color: '#94A3B8' }}>{r.note}</div>}
                    </div>
                    <div style={{ fontSize: '14.5px', fontWeight: 700, color: r.value < 0 ? '#DC2626' : '#0F172A' }}>
                      {r.value < 0 ? `− ${money(-r.value, 'XOF')}` : money(r.value, 'XOF')}
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', marginTop: '4px' }}>
                  <strong style={{ fontSize: '16px', color: 'var(--brand)' }}>Net disponible réel</strong>
                  <strong style={{ fontSize: '19px', color: 'var(--brand)' }}>{money(3825000, 'XOF')}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="lp-section" style={{ background: '#FFFFFF', borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0' }}>
        <div className="lp-container">
          <div className="lp-section-head">
            <div className="lp-badge">
              <Icon name="help" size={14} /> Questions Fréquentes
            </div>
            <h2 className="lp-section-title">Tout ce que vous devez savoir sur FactPay</h2>
            <p className="lp-section-subtitle">
              Des réponses claires pour vous lancer en toute sérénité.
            </p>
          </div>

          <div className="lp-faq-grid">
            {FAQS.map((f, i) => (
              <div key={i} className="lp-faq-card">
                <h3 className="lp-faq-q">
                  <span style={{ color: 'var(--brand)', display: 'inline-flex' }}>
                    <Icon name="help" size={18} />
                  </span>
                  <span>{f.q}</span>
                </h3>
                <p className="lp-faq-a">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BANNER FINAL */}
      <section className="lp-cta-section">
        <div className="lp-container">
          <div className="lp-cta-box">
            <h2 className="lp-cta-title">
              Prêt à simplifier votre facturation et vos paies ?
            </h2>
            <p className="lp-cta-desc">
              Rejoignez les entreprises et créateurs qui gagnent du temps chaque mois. Créez votre compte en 60 secondes.
            </p>
            <div className="lp-cta-buttons">
              <Link className="lp-cta-btn-white" href="/inscription">
                <Icon name="plus" size={16} /> Créer mon compte entreprise
              </Link>
              <Link className="lp-cta-btn-ghost" href="/portail/connexion">
                <Icon name="user" size={16} /> Accéder au portail salarié
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer-inner">
            <Logo height={32} />
            <div className="lp-footer-links">
              <Link href="/portail/connexion">Espace Salarié</Link>
              <Link href="/conditions">Conditions</Link>
              <Link href="/confidentialite">Confidentialité</Link>
              <Link href="/connexion">Connexion Entreprise</Link>
            </div>
            <div className="lp-footer-copy">
              © 2026 FactPay. Conçu pour les entreprises et équipes d'Afrique de l'Ouest.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
