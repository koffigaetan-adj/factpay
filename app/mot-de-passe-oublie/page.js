import Link from 'next/link';
import Logo from '@/components/Logo';
import Flash from '@/components/Flash';
import { requestPasswordReset } from '@/app/actions';

export const metadata = { title: 'Mot de passe oublié' };

export default function Page({ searchParams }) {
  return (
    <main className="auth">
      <Link href="/" className="logo"><Logo height={48} priority /></Link>
      <div className="card">
        <h1>Mot de passe oublié</h1>
        <p className="hint">Indique ton adresse : tu recevras un lien pour choisir un nouveau mot de passe.</p>
        <Flash searchParams={searchParams} />
        <form action={requestPasswordReset} className="stack">
          <label>Adresse e-mail<input name="email" type="email" required autoComplete="email" autoFocus /></label>
          <button>Recevoir le lien</button>
        </form>
      </div>
      <p className="below"><Link href="/connexion">Retour à la connexion</Link></p>
    </main>
  );
}
