import Link from 'next/link';
import Logo from '@/components/Logo';
import Flash from '@/components/Flash';
import PasswordFields from '@/components/PasswordFields';
import { resetPassword } from '@/app/actions';
import { findPasswordReset } from '@/lib/auth';
import SubmitButton from '@/components/SubmitButton';

export const metadata = { title: 'Nouveau mot de passe' };

export default async function Page({ params, searchParams }) {
  const { token } = await params;
  const valid = await findPasswordReset(token);
  return (
    <main className="auth">
      <Link href="/" className="logo"><Logo height={48} priority /></Link>
      <div className="card">
        <h1>Nouveau mot de passe</h1>
        <Flash searchParams={searchParams} />
        {valid ? (
          <form action={resetPassword} className="stack">
            <input type="hidden" name="token" value={token} />
            <PasswordFields label="Nouveau mot de passe" autoFocus />
            <SubmitButton pendingText="Enregistrement...">Enregistrer</SubmitButton>
          </form>
        ) : (
          <p>Ce lien a expiré ou a déjà servi. <Link href="/mot-de-passe-oublie">Demande un nouveau lien</Link>.</p>
        )}
      </div>
    </main>
  );
}
