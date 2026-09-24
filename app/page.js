/*
THESIS: la page montre une vraie facture FactPay au travail (F CFA ↔ €, retenue, Mobile Money) au lieu d'un slogan sur fond vide ; elle refuse la grille de cartes icône + titre.
OWN-WORLD: celui de l'application — gris clair, papier blanc, encre bleu nuit, bleu marine pour l'action, vert « payé », Public Sans, filets fins.
STORY: le freelance voit la facture que recevra son client, suit son trajet jusqu'à « Payée », reconnaît ses réalités locales, comprend son net, puis crée son compte.
FIRST VIEWPORT: à gauche, logo, titre en deux temps et bouton « Créer mon compte » ; à droite, la facture d'exemple à l'échelle réelle avec son sélecteur F CFA / €.
FORM: structure n° 1 de ma liste (démonstration du produit d'abord) ; mise en scène : la facture comme feuille posée sur le fond gris, le reste en spécimens.
*/
import Link from 'next/link';
import { redirect } from 'next/navigation';
import Logo from '@/components/Logo';
import CurrencySwitch from '@/components/CurrencySwitch';
import { currentUser } from '@/lib/auth';
import { money, totals, convert, fixedRate } from '@/lib/money';

// Facture d'exemple (fictive), calculée avec les vraies règles du logiciel
const LINES = [
  { description: 'Développement du site vitrine', quantity: 12, unit: 'jours', unit_price: 125000 },
  { description: 'Mise en ligne et formation', quantity: 1, unit: 'forfait', unit_price: 150000 },
];
const T = totals(LINES, 0, 5, 'XOF');
const TO_EUR = fixedRate('XOF', 'EUR');

// Montant en F CFA, et son équivalent en euros affiché quand le visiteur bascule
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
  { cls: 'draft', label: 'Brouillon', text: "Tu ajoutes tes lignes : jours, heures ou forfait. Le total se calcule pendant que tu tapes." },
  { cls: 'wait', label: 'Envoyée', text: "Ton client reçoit un e-mail avec le PDF et un lien. Tu peux aussi programmer l'envoi à une date." },
  { cls: 'check', label: 'Paiement signalé', text: "Il paie par virement ou Mobile Money, puis envoie la référence et une capture depuis le lien." },
  { cls: 'paid', label: 'Payée', text: "Tu vérifies que l'argent est arrivé et tu confirmes. Le tableau de bord se met à jour." },
];

const LOCAL = [
  { specimen: '1 567 500 F CFA', title: 'Le franc CFA, sans centimes', text: 'Montants arrondis au franc, comme sur un vrai reçu. XOF, XAF, euro, dollar et six autres devises au choix.' },
  { specimen: '1 € = 655,957 F CFA', title: 'La conversion à la parité fixe', text: "Ton client voit le montant dans les deux devises et bascule d'un clic. Pour le dollar, tu indiques le taux du jour." },
  { specimen: 'Flooz · Mixx by Yas · SPI', title: 'Les moyens de paiement d\'ici', text: 'Tes numéros Mobile Money, ton RIB et ton alias SPI de la BCEAO figurent sur la facture et dans l\'e-mail.' },
  { specimen: 'Retenue à la source 5 %', title: 'La retenue, déduite du net', text: 'Le client voit ce qu\'il retient et le net exact à te verser. Rien à recalculer à la main.' },
  { specimen: 'NIF · RCCM', title: 'Tes mentions légales', text: 'Tes identifiants apparaissent sur chaque facture, numérotée sans trou : FAC-2026-0001, 0002…' },
];

// Tableau de bord d'exemple (fictif) : de ce qui est facturé à ce qui te reste
const NET = [
  { label: 'Facturé hors taxes en 2026', value: 4500000 },
  { label: 'Retenu par tes clients', value: -225000 },
  { label: 'Encaissé', value: 4275000, rule: true },
  { label: 'Encore à mettre de côté pour les impôts', value: -450000, note: '15 % du HT, moins les retenues déjà versées' },
];

export default async function Home() {
  if (await currentUser()) redirect('/tableau-de-bord');
  return (
    <div className="landing">
      <header className="site-head">
        <Link href="/" aria-label="FactPay, accueil"><Logo height={48} priority /></Link>
        <nav className="site-nav">
          <Link href="/connexion">Se connecter</Link>
          <Link className="button" href="/inscription">Créer mon compte</Link>
        </nav>
      </header>

      <main className="land">
        <section className="land-hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <h1 id="hero-title">Envoie ta facture.<br /><span>Suis-la jusqu'au paiement.</span></h1>
            <p className="lede">
              FactPay est fait pour les freelances d'Afrique de l'Ouest. Ton client reçoit une facture claire, en F CFA ou en euros,
              paie par virement ou Mobile Money et t'envoie son justificatif. Toi, tu vois ce qui est payé et ce qui te reste.
            </p>
            <div className="hero-actions">
              <Link className="button big" href="/inscription">Créer mon compte</Link>
              <span className="hero-note">Gratuit pour commencer</span>
            </div>
          </div>

          <figure className="demo" aria-label="Exemple de facture reçue par un client">
            <div className="demo-bar">
              <span className="demo-tag">Exemple fictif</span>
              <CurrencySwitch main="F CFA" alt="€" />
            </div>
            <article className="demo-sheet">
              <header>
                <div>
                  <strong className="demo-title">Facture FAC-2026-0014</strong>
                  <span className="sub">À payer avant le 15 octobre 2026</span>
                </div>
                <address><strong>Studio Kodjo</strong><br />Lomé, Togo<br />NIF 1000000000</address>
              </header>
              <p className="demo-client"><span className="sub">Facturé à</span>Agence Lumière SARL</p>
              <table>
                <thead><tr><th>Description</th><th className="n hide-xs">Qté</th><th className="n">Montant</th></tr></thead>
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
              <dl className="demo-sum">
                <div><dt>Total</dt><dd><Amount n={T.total} /></dd></div>
                <div><dt>Retenue à la source (5 % du HT)</dt><dd><Amount n={T.withholding} minus /></dd></div>
                <div className="due"><dt>Net à payer</dt><dd><Amount n={T.due} /></dd></div>
              </dl>
              <p className="demo-pay">Flooz +228 90 00 00 00 · Mixx by Yas +228 70 00 00 00 · Référence FAC-2026-0014</p>
              <div className="demo-cta" aria-hidden="true">Signaler la facture comme payée</div>
            </article>
          </figure>
        </section>

        <section className="land-steps" aria-labelledby="steps-title">
          <h2 id="steps-title">Une facture, du brouillon à l'argent reçu</h2>
          <ol className="track">
            {STEPS.map((s) => (
              <li key={s.label}>
                <span className={`status ${s.cls}`}>{s.label}</span>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="land-local" aria-labelledby="local-title">
          <div className="local-head">
            <h2 id="local-title">Pensé pour facturer depuis Lomé, Cotonou ou Dakar</h2>
            <p className="hint">Pas un logiciel européen traduit : les réalités de ton métier sont là dès le départ.</p>
          </div>
          <dl className="specimens">
            {LOCAL.map((x) => (
              <div key={x.title}>
                <dt className="specimen">{x.specimen}</dt>
                <dd><strong>{x.title}</strong><span>{x.text}</span></dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="land-net" aria-labelledby="net-title">
          <div>
            <h2 id="net-title">Ton net, pas seulement ton chiffre d'affaires</h2>
            <p className="hint">
              Le tableau de bord part de ce que tu as facturé, retire ce que tes clients ont retenu et ce que tu dois garder pour les impôts.
              Il reste ce qui est vraiment à toi.
            </p>
          </div>
          <div className="receipt" aria-label="Exemple de calcul du net (chiffres fictifs)">
            <span className="demo-tag">Exemple fictif</span>
            <dl>
              {NET.map((r) => (
                <div key={r.label} className={r.rule ? 'rule' : ''}>
                  <dt>{r.label}{r.note && <span className="sub">{r.note}</span>}</dt>
                  <dd>{r.value < 0 ? `− ${money(-r.value, 'XOF')}` : money(r.value, 'XOF')}</dd>
                </div>
              ))}
              <div className="net"><dt>Net pour toi</dt><dd>{money(3825000, 'XOF')}</dd></div>
            </dl>
          </div>
        </section>
      </main>

      <section className="land-close" aria-labelledby="close-title">
        <div className="close-inner">
          <Logo onDark height={56} />
          <h2 id="close-title">Ta prochaine facture part en une minute.</h2>
          <p>Crée ton compte, renseigne ton entreprise, ajoute ton client. C'est tout.</p>
          <Link className="button big light" href="/inscription">Créer mon compte, gratuit pour commencer</Link>
          <p className="soon">Fiches de paie : bientôt disponibles.</p>
        </div>
      </section>

      <footer className="site-foot">
        <Logo height={28} />
        <nav><Link href="/connexion">Se connecter</Link><Link href="/inscription">Créer un compte</Link></nav>
      </footer>
    </div>
  );
}
