import Link from 'next/link';
import { redirect } from 'next/navigation';
import Flash from '@/components/Flash';
import { signup } from '@/app/actions';
import { currentUser } from '@/lib/auth';

export const metadata = { title: 'Créer un compte' };

export default async function Page({ searchParams }) {
  if (await currentUser()) redirect('/tableau-de-bord');
  return (
    <main className="auth">
      <Link href="/" className="logo">Factures &amp; Paie</Link>
      <div className="card">
        <h1>Créer un compte</h1>
        <p className="hint">Gratuit. Tu renseigneras ton entreprise juste après.</p>
        <Flash searchParams={searchParams} />
        <form action={signup} className="stack">
          <label>Ton nom<input name="name" required autoComplete="name" autoFocus /></label>
          <label>Adresse e-mail<input name="email" type="email" required autoComplete="email" /></label>
          <label>Mot de passe <span className="help">8 caractères minimum</span>
            <input name="password" type="password" required minLength={8} autoComplete="new-password" />
          </label>
          <button>Créer mon compte</button>
        </form>
      </div>
      <p className="below">Déjà un compte ? <Link href="/connexion">Se connecter</Link></p>
    </main>
  );
}
