import Link from 'next/link';
import { redirect } from 'next/navigation';
import Logo from '@/components/Logo';
import CurrencySwitch from '@/components/CurrencySwitch';
import { currentUser } from '@/lib/auth';
import { money, totals, convert, fixedRate } from '@/lib/money';

// Facture d'exemple (fictive)
const LINES = [
  { description: 'Développement d’application web', quantity: 12, unit: 'jours', unit_price: 125000 },
  { description: 'Formation équipe & déploiement', quantity: 1, unit: 'forfait', unit_price: 150000 },
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

const STEPS = [
  { cls: 'draft', label: '1. Facturation & Devis', text: "Créez des factures en F CFA ou en euros, avec calcul automatique des taxes et de la retenue à la source." },
  { cls: 'wait', label: '2. Paiement Mobile Money & Virement', text: "Vos clients règlent via Flooz, TMoney, Mixx by Yas, Wave ou virement et transmettent leur reçu en direct." },
  { cls: 'check', label: '3. Paie & RH Conformes', text: "Éditez les bulletins de salaire conformes aux barèmes légaux Togo et UEMOA (CNSS 4 %, primes, impôts)." },
  { cls: 'paid', label: '4. Espace Collaborateur Salarié', text: "Vos collaborateurs activent leur compte avec mot de passe personnel, posent leurs congés et téléchargent leurs fiches de paie." },
];

const LOCAL = [
  { specimen: '1 567 500 F CFA', title: 'Le franc CFA, sans centimes', text: 'Montants arrondis au franc, comme sur vos vrais reçus. XOF, XAF, euro, dollar et devises internationales.' },
  { specimen: '1 € = 655,957 F CFA', title: 'La parité fixe instantanée', text: 'Vos clients basculent d’un clic entre F CFA et euros pour leurs partenaires locaux ou internationaux.' },
  { specimen: 'Flooz · TMoney · Mixx · Wave', title: 'Les moyens de paiement d’Afrique de l’Ouest', text: 'Vos numéros Mobile Money, votre RIB bancaire et vos alias figurent sur chaque facture et e-mail.' },
  { specimen: 'CNSS 4 % · Retenue 5 %', title: 'Barèmes fiscaux et sociaux automatisés', text: 'Prélèvements CNSS, retenues à la source et impôts sur salaires calculés selon le code du travail.' },
  { specimen: 'Espace Salarié Sécurisé', title: 'Portail collaborateur en libre-service', text: 'Activation par mot de passe personnel, consultation des fiches de paie, gestion des congés et acomptes.' },
  { specimen: 'NIF · RCCM · N° CNSS', title: 'Mentions légales & traçabilité', text: 'Numérotation continue infalsifiable, mentions d’entreprise et attestations certifiées en un clic.' },
];

const NET = [
  { label: 'Facturé hors taxes en 2026', value: 4500000 },
  { label: 'Retenu par vos clients', value: -225000 },
  { label: 'Encaissé sur vos comptes', value: 4275000, rule: true },
  { label: 'Provision pour impôts & charges sociales', value: -450000, note: 'Net net après retenues et prélèvements légaux' },
];

export default async function Home({ searchParams }) {
  if (await currentUser()) redirect('/tableau-de-bord');
  const deleted = (await searchParams)?.compte === 'supprime';

  return (
    <div className="landing">
      {deleted && <p className="flash deleted" role="status">Votre compte et ses données ont été supprimés.</p>}

      {/* HEADER DE NAVIGATION */}
      <div className="site-top">
        <header className="site-head" style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px' }}>
          <Link href="/" aria-label="FactPay, accueil"><Logo height={44} priority /></Link>
          <nav className="site-nav" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link className="button secondary hide-xs" href="/portail/connexion" style={{ fontSize: '13.5px' }}>
              Espace Salarié
            </Link>
            <Link className="button secondary" href="/connexion" style={{ fontSize: '13.5px' }}>
              Connexion
            </Link>
            <Link className="button" href="/inscription" style={{ fontSize: '13.5px' }}>
              Créer un compte
            </Link>
          </nav>
        </header>
      </div>

      <main className="land">
        {/* HERO SECTION */}
        <section className="land-hero" aria-labelledby="hero-title" style={{ padding: '40px 0 60px' }}>
          <div className="hero-copy">
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 14px',
              borderRadius: '999px',
              background: 'color-mix(in srgb, var(--brand, #2B4C7E) 12%, transparent)',
              color: 'var(--brand, #2B4C7E)',
              fontSize: '12.5px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '16px',
            }}>
              ✨ La suite tout-en-un · Facturation, RH & Paie
            </div>
            <h1 id="hero-title" style={{ fontSize: '38px', lineHeight: 1.15, fontWeight: 800, letterSpacing: '-0.025em', margin: '0 0 16px' }}>
              Facturez vos clients.<br />
              <span style={{ color: 'var(--brand, #2B4C7E)' }}>Gérez vos paies & vos salariés.</span>
            </h1>
            <p className="lede" style={{ fontSize: '16.5px', lineHeight: 1.6, color: 'var(--muted)', maxWidth: '580px', margin: '0 0 28px' }}>
              FactPay réunit la <strong>facturation professionnelle</strong> (F CFA / €, Mobile Money, retenues) et la <strong>gestion RH & Paie</strong> conforme aux normes d'Afrique de l'Ouest (Togo, UEMOA). Offrez à votre équipe un portail collaborateur moderne et sécurisé.
            </p>
            <div className="hero-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <Link className="button big" href="/inscription">Démarrer gratuitement</Link>
              <Link className="button big secondary" href="/portail/connexion">Accéder au portail salarié</Link>
            </div>
            <span className="hero-note" style={{ display: 'block', marginTop: '12px', fontSize: '13px', color: 'var(--muted)' }}>
              Aucune carte bancaire requise · Configuration en 2 minutes
            </span>
          </div>

          {/* DÉMO INTERACTIVE : FACTURE OU BULLETIN */}
          <figure className="demo" aria-label="Exemple de document FactPay" style={{ margin: 0 }}>
            <div className="demo-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid var(--line)' }}>
              <span className="demo-tag" style={{ fontSize: '12px', fontWeight: 650, color: 'var(--brand)' }}>
                Facture & Fiche de Paie conformes
              </span>
              <CurrencySwitch main="F CFA" alt="€" />
            </div>

            <article className="demo-sheet" style={{ padding: '24px' }}>
              <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', borderBottom: '1px solid var(--line)', paddingBottom: '14px' }}>
                <div>
                  <strong className="demo-title" style={{ fontSize: '16px', display: 'block' }}>Facture FAC-FP481-0014</strong>
                  <span className="sub">Échéance : 15 octobre 2026</span>
                </div>
                <address style={{ textAlign: 'right', fontStyle: 'normal', fontSize: '13px' }}>
                  <strong>Studio Tech SARL</strong><br />Lomé, Togo<br />NIF : 1000000000
                </address>
              </header>

              <p className="demo-client" style={{ fontSize: '13.5px', marginBottom: '16px' }}>
                <span className="sub" style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>Facturé à</span>
                <strong>Société Lumière UEMOA</strong>
              </p>

              <table>
                <thead><tr><th>Prestation</th><th className="n hide-xs">Qté</th><th className="n">Montant</th></tr></thead>
                <tbody>
                  {LINES.map((l) => (
                    <tr key={l.description}>
                      <td>{l.description}</td>
                      <td className="n hide-xs">{l.quantity} {l.unit}</td>
                      <td className="n"><Amount n={l.quantity * l.unit_price} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <dl className="demo-sum" style={{ marginTop: '16px' }}>
                <div><dt>Total HT</dt><dd><Amount n={T.total} /></dd></div>
                <div><dt>Retenue à la source (5 %)</dt><dd><Amount n={T.withholding} minus /></dd></div>
                <div className="due"><dt>Net à payer</dt><dd><Amount n={T.due} /></dd></div>
              </dl>

              <p className="demo-pay" style={{ fontSize: '12px', background: 'var(--bg)', padding: '8px 12px', borderRadius: '8px', marginTop: '14px' }}>
                TMoney +228 90 00 00 00 · Flooz +228 99 00 00 00 · Virement Ecobank Togo
              </p>
              <div className="demo-cta" aria-hidden="true" style={{ marginTop: '14px', textAlign: 'center', padding: '10px', background: 'var(--brand)', color: '#fff', borderRadius: '8px', fontWeight: 600, fontSize: '13px' }}>
                Espace Salarié & Bulletins de Paie intégrés
              </div>
            </article>
          </figure>
        </section>

        {/* SECTION 4 ÉTAPES CLÉS */}
        <section className="land-steps" aria-labelledby="steps-title" style={{ padding: '60px 0' }}>
          <h2 id="steps-title" style={{ textAlign: 'center', marginBottom: '36px', fontSize: '26px', fontWeight: 800 }}>
            Toute votre gestion d’entreprise en 4 étapes
          </h2>
          <ol className="track" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', listStyle: 'none', padding: 0 }}>
            {STEPS.map((s) => (
              <li key={s.label} className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <span className={`status ${s.cls}`} style={{ alignSelf: 'flex-start' }}>{s.label}</span>
                <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.55, color: 'var(--muted)' }}>{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* SECTION NORMES LOCALES (TOGO & UEMOA) */}
        <section className="land-local" aria-labelledby="local-title" style={{ padding: '60px 0' }}>
          <div className="local-head" style={{ textAlign: 'center', maxWidth: '700px', margin: '0 auto 40px' }}>
            <h2 id="local-title" style={{ fontSize: '26px', fontWeight: 800, margin: '0 0 8px' }}>
              Pensé pour Lomé, Cotonou, Abidjan et Dakar
            </h2>
            <p className="hint" style={{ fontSize: '15px' }}>
              Pas un logiciel étranger inadapté : les réalités juridiques, bancaires et mobiles de l’UEMOA sont intégrées au cœur de FactPay.
            </p>
          </div>

          <dl className="specimens" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            {LOCAL.map((x) => (
              <div key={x.title} className="card" style={{ padding: '22px' }}>
                <dt className="specimen" style={{ fontSize: '16px', fontWeight: 800, color: 'var(--brand)', marginBottom: '8px' }}>{x.specimen}</dt>
                <dd style={{ margin: 0 }}>
                  <strong style={{ display: 'block', fontSize: '15px', color: 'var(--ink)', marginBottom: '4px' }}>{x.title}</strong>
                  <span style={{ fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.5 }}>{x.text}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* SECTION RÉSUMÉ NET & TRÉSORERIE */}
        <section className="land-net" aria-labelledby="net-title" style={{ padding: '60px 0' }}>
          <div>
            <h2 id="net-title" style={{ fontSize: '26px', fontWeight: 800, margin: '0 0 10px' }}>
              Votre trésorerie réelle, pas seulement votre chiffre d'affaires
            </h2>
            <p className="hint" style={{ fontSize: '15px', lineHeight: 1.6 }}>
              FactPay sépare ce que vous facturez, ce que vos clients ont déjà versé, les retenues fiscales appliquées et ce que vous devez provisionner pour les cotisations sociales (CNSS) et impôts. Vous savez exactement ce qui vous appartient.
            </p>
          </div>

          <div className="receipt" aria-label="Exemple de calcul du net" style={{ padding: '24px', background: 'var(--paper)', borderRadius: '16px', border: '1px solid var(--line)' }}>
            <span className="demo-tag" style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--brand)' }}>Suivi financier temps réel</span>
            <dl style={{ margin: '14px 0 0' }}>
              {NET.map((r) => (
                <div key={r.label} className={r.rule ? 'rule' : ''} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: r.rule ? '2px solid var(--ink)' : '1px solid var(--line)' }}>
                  <dt style={{ fontSize: '13.5px', color: 'var(--muted)' }}>
                    {r.label}
                    {r.note && <span className="sub" style={{ display: 'block', fontSize: '11.5px' }}>{r.note}</span>}
                  </dt>
                  <dd style={{ fontSize: '14px', fontWeight: 700 }}>
                    {r.value < 0 ? `− ${money(-r.value, 'XOF')}` : money(r.value, 'XOF')}
                  </dd>
                </div>
              ))}
              <div className="net" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 0', marginTop: '6px' }}>
                <dt style={{ fontSize: '16px', fontWeight: 800, color: 'var(--brand)' }}>Net disponible réel</dt>
                <dd style={{ fontSize: '18px', fontWeight: 800, color: 'var(--brand)' }}>{money(3825000, 'XOF')}</dd>
              </div>
            </dl>
          </div>
        </section>
      </main>

      {/* BANDEAU FINAL D'APPEL À L'ACTION */}
      <section className="land-close" aria-labelledby="close-title" style={{ padding: '80px 24px', textAlign: 'center', background: 'var(--band)', color: '#fff' }}>
        <div className="close-inner" style={{ maxWidth: '640px', margin: '0 auto' }}>
          <h2 id="close-title" style={{ fontSize: '32px', fontWeight: 800, margin: '0 0 14px', color: '#fff' }}>
            Passez à la gestion professionnelle dès aujourd'hui.
          </h2>
          <p style={{ fontSize: '16px', color: '#A0AEC0', lineHeight: 1.6, margin: '0 0 28px' }}>
            Facturation complète, fiches de paie conformes et portail collaborateur. Créez votre entreprise en 60 secondes.
          </p>
          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link className="button big light" href="/inscription" style={{ fontWeight: 700 }}>
              Créer mon compte entreprise
            </Link>
            <Link className="button big secondary" href="/portail/connexion" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.25)' }}>
              Accéder à l'espace salarié
            </Link>
          </div>
          <p className="soon" style={{ marginTop: '24px', fontSize: '12.5px', color: '#718096' }}>
            FactPay · Conçu pour les entreprises, créateurs et salariés d'Afrique de l'Ouest.
          </p>
        </div>
      </section>

      {/* PIED DE PAGE */}
      <footer className="site-foot" style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <Logo height={28} />
        <nav style={{ display: 'flex', gap: '20px', fontSize: '13px' }}>
          <Link href="/portail/connexion">Espace Salarié</Link>
          <Link href="/conditions">Conditions</Link>
          <Link href="/confidentialite">Confidentialité</Link>
          <Link href="/connexion">Se connecter</Link>
        </nav>
      </footer>
    </div>
  );
}
