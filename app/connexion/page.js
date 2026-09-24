import Link from 'next/link';
import Logo from '@/components/Logo';
import { redirect } from 'next/navigation';
import Flash from '@/components/Flash';
import { login } from '@/app/actions';
import { currentUser } from '@/lib/auth';

export const metadata = { title: 'Connexion' };

export default async function Page({ searchParams }) {
  if (await currentUser()) redirect('/tableau-de-bord');
  return (
    <main className="auth">
      <Link href="/" className="logo"><Logo height={48} priority /></Link>
      <div className="card">
        <h1>Connexion</h1>
        <p className="hint">Accède à tes factures.</p>
        <Flash searchParams={searchParams} />
        <form action={login} className="stack">
          <label>Adresse e-mail<input name="email" type="email" required autoComplete="email" autoFocus /></label>
          <label>Mot de passe<input name="password" type="password" required autoComplete="current-password" /></label>
          <button>Se connecter</button>
        </form>
        <p className="below"><Link href="/mot-de-passe-oublie">Mot de passe oublié ?</Link></p>
      </div>
      <p className="below">Pas encore de compte ? <Link href="/inscription">Créer un compte</Link></p>
    </main>
  );
}
