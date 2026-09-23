import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';

export default async function Home() {
  if (await currentUser()) redirect('/tableau-de-bord');
  return (
    <main>
      <div className="hero">
        <strong>Factures &amp; Paie</strong>
        <h1>Tes factures envoyées et suivies, en euros ou en francs CFA.</h1>
        <p>Crée une facture en une minute. Ton client la reçoit par e-mail avec le PDF, voit le montant dans sa devise, paie par virement ou Mobile Money et t'envoie son justificatif.</p>
        <div className="actions">
          <Link className="button" href="/inscription">Créer mon compte</Link>
          <Link className="button secondary" href="/connexion">Se connecter</Link>
        </div>
        <ul>
          <li>Numérotation automatique des factures, TVA facultative</li>
          <li>Conversion € ↔ F CFA à la parité fixe</li>
          <li>Envoi automatique à la date de ton choix</li>
          <li>Fiches de paie : bientôt disponibles</li>
        </ul>
      </div>
    </main>
  );
}
