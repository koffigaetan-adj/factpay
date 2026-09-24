import Link from 'next/link';
import Logo from '@/components/Logo';
import { confirmEmail, currentUser } from '@/lib/auth';

export const metadata = { title: 'Confirmation de l\'adresse e-mail', robots: { index: false } };

// Lien reçu par e-mail après l'inscription
export default async function Page({ params }) {
  const { token } = await params;
  const ok = await confirmEmail(token);
  const user = await currentUser();
  const done = ok || user?.email_verified_at;

  return (
    <main className="auth">
      <Link href="/" className="logo"><Logo height={48} priority /></Link>
      <div className="card">
        {done ? (
          <>
            <h1>Adresse confirmée</h1>
            <p className="hint">Ton compte est activé.</p>
            <Link className="button" href={user ? '/bienvenue' : '/connexion'}>{user ? 'Continuer' : 'Se connecter'}</Link>
          </>
        ) : (
          <>
            <h1>Lien expiré</h1>
            <p className="hint">Ce lien n'est plus valable. Connecte-toi pour en recevoir un nouveau.</p>
            <Link className="button" href={user ? '/confirmer-email' : '/connexion'}>{user ? 'Recevoir un nouveau lien' : 'Se connecter'}</Link>
          </>
        )}
      </div>
    </main>
  );
}
