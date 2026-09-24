import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Logo from '@/components/Logo';
import Flash from '@/components/Flash';
import { verifyLogin, resendLoginCode } from '@/app/actions';
import { findChallenge } from '@/lib/twofa';

export const metadata = { title: 'Vérification', robots: { index: false } };

// Second étape de la connexion : code reçu par e-mail, code de l'application, ou code de secours
export default async function Page({ searchParams }) {
  const ch = await findChallenge((await cookies()).get('login_2fa')?.value);
  if (!ch) redirect('/connexion');
  const byEmail = ch.twofa_method === 'email';
  return (
    <main className="auth">
      <Link href="/" className="logo"><Logo height={48} priority /></Link>
      <div className="card">
        <h1>Vérification</h1>
        <p className="hint">
          {byEmail
            ? <>Un code à 6 chiffres vient d'être envoyé à <strong>{ch.email}</strong>. Pense à regarder dans les spams.</>
            : "Ouvre ton application d'authentification et tape le code à 6 chiffres affiché pour FactPay."}
        </p>
        <Flash searchParams={searchParams} />
        <form action={verifyLogin} className="stack">
          <label>Code
            <input name="code" required autoFocus autoComplete="one-time-code" inputMode="numeric" maxLength={11}
              className="otp" placeholder="000000" />
          </label>
          <button>Vérifier</button>
        </form>
        {byEmail && (
          <form action={resendLoginCode} className="below"><button className="link">Renvoyer le code</button></form>
        )}
        <p className="help" style={{ marginTop: 16 }}>Plus accès à {byEmail ? 'ta messagerie' : 'ton téléphone'} ? Tape un de tes codes de secours (format ABCDE-12345).</p>
      </div>
      <p className="below"><Link href="/connexion">Revenir à la connexion</Link></p>
    </main>
  );
}
