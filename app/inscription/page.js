import Link from 'next/link';
import Logo from '@/components/Logo';
import { redirect } from 'next/navigation';
import Flash from '@/components/Flash';
import PasswordFields from '@/components/PasswordFields';
import { signup } from '@/app/actions';
import { currentUser } from '@/lib/auth';
import SubmitButton from '@/components/SubmitButton';

export const metadata = { title: 'Créer un compte' };

export default async function Page({ searchParams }) {
  if (await currentUser()) redirect('/tableau-de-bord');
  return (
    <main className="auth">
      <Link href="/" className="logo"><Logo height={48} priority /></Link>
      <div className="card">
        <h1>Créer un compte</h1>
        <p className="hint">Gratuit. Tu confirmeras ton adresse e-mail, puis tu renseigneras ton entreprise.</p>
        <Flash searchParams={searchParams} />
        <form action={signup} className="stack">
          <div className="row">
            <label>Prénom<input name="first_name" required maxLength={60} autoComplete="given-name" autoFocus /></label>
            <label>Nom<input name="last_name" required maxLength={60} autoComplete="family-name" /></label>
          </div>
          <label>Adresse e-mail<input name="email" type="email" required autoComplete="email" /></label>
          <PasswordFields />
          <label className="check terms">
            <input type="checkbox" name="terms" required />
            <span>J'accepte les <Link href="/conditions" target="_blank">conditions d'utilisation</Link> et la <Link href="/confidentialite" target="_blank">politique de confidentialité</Link>.</span>
          </label>
          <SubmitButton pendingText="Création...">Créer mon compte</SubmitButton>
        </form>
      </div>
      <p className="below">Déjà un compte ? <Link href="/connexion">Se connecter</Link></p>
    </main>
  );
}
