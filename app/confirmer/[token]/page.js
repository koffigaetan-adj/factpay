import Link from 'next/link';
import Logo from '@/components/Logo';
import { confirmEmail, currentUser } from '@/lib/auth';
import { sendMail } from '@/lib/mail';
import { securityNoticeEmail, withImages } from '@/lib/emails';

export const metadata = { title: 'Confirmation de l\'adresse e-mail', robots: { index: false } };

// Lien reçu par e-mail après l'inscription, ou après une demande de changement d'adresse
export default async function Page({ params }) {
  const { token } = await params;
  const result = await confirmEmail(token);
  // Changement d'adresse confirmé : l'ancienne adresse est prévenue (au cas où ce ne serait pas elle
  // qui a demandé le changement), et le lien lui-même reste valable si quelqu'un le rouvre par erreur.
  if (result?.changed) {
    try {
      await sendMail({ to: result.oldEmail, ...(await withImages(securityNoticeEmail(result.name, 'Adresse e-mail changée'))) });
    } catch (err) {
      console.error('Alerte de changement d\'adresse non envoyée :', err.message);
    }
  }
  const ok = !!result;
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
