import Link from 'next/link';
import Logo from '@/components/Logo';

// Mise en page commune des pages légales
export default function LegalPage({ title, updated, children }) {
  return (
    <main className="narrow legal">
      <Link href="/" className="legal-logo" aria-label="FactPay, accueil"><Logo height={40} /></Link>
      <h1>{title}</h1>
      <p className="sub">Dernière mise à jour : {updated}</p>
      <p className="legal-todo">À compléter avant l'ouverture au public : les passages entre crochets [ ] sont à remplir, et l'ensemble est à faire relire par un juriste.</p>
      {children}
      <p className="legal-foot"><Link href="/conditions">Conditions d'utilisation</Link> · <Link href="/confidentialite">Confidentialité</Link> · <Link href="/">Accueil</Link></p>
    </main>
  );
}
