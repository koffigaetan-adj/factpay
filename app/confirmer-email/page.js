import Link from 'next/link';
import Logo from '@/components/Logo';
import { redirect } from 'next/navigation';
import Flash from '@/components/Flash';
import { resendVerification, logout } from '@/app/actions';
import { currentUser } from '@/lib/auth';

export const metadata = { title: 'Confirme ton adresse e-mail' };

// Après l'inscription : le compte reste bloqué tant que l'adresse n'est pas confirmée
export default async function Page({ searchParams }) {
  const user = await currentUser();
  if (!user) redirect('/connexion');
  if (user.email_verified_at) redirect('/tableau-de-bord');
  return (
    <main className="auth">
      <Link href="/" className="logo"><Logo height={48} priority /></Link>
      <div className="card">
        <h1>Confirme ton adresse</h1>
        <p className="hint">
          Un lien vient d'être envoyé à <strong>{user.email}</strong>. Ouvre-le pour activer ton compte.
          Pense à regarder dans les spams.
        </p>
        <Flash searchParams={searchParams} />
        <form action={resendVerification}><button className="secondary">Renvoyer le lien</button></form>
      </div>
      <form action={logout} className="below">
        Ce n'est pas la bonne adresse ? <button className="link">Se déconnecter</button> et créer un autre compte.
      </form>
    </main>
  );
}
