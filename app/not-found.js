import Link from 'next/link';
import Logo from '@/components/Logo';

export const metadata = { title: 'Page introuvable' };

// Adresse inconnue, facture supprimée ou lien mal copié
export default function NotFound() {
  return (
    <main className="auth">
      <Link href="/" className="logo"><Logo height={48} /></Link>
      <div className="card">
        <h1>Page introuvable</h1>
        <p className="hint">Cette page n'existe pas ou n'est plus disponible. Si tu as suivi un lien reçu par e-mail, vérifie qu'il a été copié en entier.</p>
        <div className="line-actions">
          <Link className="button" href="/tableau-de-bord">Aller au tableau de bord</Link>
          <Link className="button secondary" href="/">Accueil</Link>
        </div>
      </div>
    </main>
  );
}
