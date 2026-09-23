import Link from 'next/link';
import Flash from '@/components/Flash';
import { resetPassword } from '@/app/actions';
import { findPasswordReset } from '@/lib/auth';

export const metadata = { title: 'Nouveau mot de passe' };

export default async function Page({ params, searchParams }) {
  const { token } = await params;
  const valid = await findPasswordReset(token);
  return (
    <main className="auth">
      <Link href="/" className="logo">Factures &amp; Paie</Link>
      <div className="card">
        <h1>Nouveau mot de passe</h1>
        <Flash searchParams={searchParams} />
        {valid ? (
          <form action={resetPassword} className="stack">
            <input type="hidden" name="token" value={token} />
            <label>Nouveau mot de passe <span className="help">8 caractères minimum</span>
              <input name="password" type="password" required minLength={8} autoComplete="new-password" autoFocus />
            </label>
            <button>Enregistrer</button>
          </form>
        ) : (
          <p>Ce lien a expiré ou a déjà servi. <Link href="/mot-de-passe-oublie">Demande un nouveau lien</Link>.</p>
        )}
      </div>
    </main>
  );
}
