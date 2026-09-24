import Link from 'next/link';
import Flash from '@/components/Flash';
import PasswordFields from '@/components/PasswordFields';
import CompanyFields from '@/components/CompanyFields';
import ThemePicker from '@/components/ThemePicker';
import SecuritySettings from '@/components/SecuritySettings';
import { cookies } from 'next/headers';
import { saveCompany, changePassword, updateProfile, requestEmailChange, deleteAccount } from '@/app/actions';
import { requireCompany } from '@/lib/auth';
import { one } from '@/lib/db';

export const metadata = { title: 'Paramètres' };

// Un onglet par rubrique, pour ne pas tout afficher d'un coup
const TABS = {
  entreprise: { label: 'Entreprise', hint: 'Ce qui apparaît en haut de tes factures : nom, identifiants légaux, coordonnées et logo.' },
  paiement: { label: 'Paiement', hint: 'Les moyens de paiement indiqués à tes clients sur la facture, la page de paiement et l\'e-mail.' },
  factures: { label: 'Factures', hint: 'Les réglages par défaut des nouvelles factures. Les factures déjà émises ne changent pas.' },
  securite: { label: 'Sécurité', hint: "La double authentification protège ton compte même si quelqu'un connaît ton mot de passe." },
  apparence: { label: 'Apparence', hint: 'Mode clair ou sombre. Ce choix vaut pour ce navigateur.' },
  compte: { label: 'Mon compte', hint: 'Ton nom, ton adresse de connexion et ton mot de passe.' },
};

export default async function Page({ searchParams }) {
  const { user, company } = await requireCompany();
  const sp = await searchParams;
  const tab = TABS[sp.onglet] ? sp.onglet : 'entreprise';
  const profile = tab === 'compte' ? await one('SELECT first_name, last_name, email FROM users WHERE id = $1', [user.id]) : null;

  return (
    <>
      <div className="page-head"><h1>Paramètres</h1></div>
      <nav className="tabs" aria-label="Rubriques des paramètres">
        {Object.entries(TABS).map(([k, t]) => (
          <Link key={k} href={`/parametres?onglet=${k}`} aria-current={k === tab ? 'page' : undefined}>{t.label}</Link>
        ))}
      </nav>
      <Flash searchParams={searchParams} />
      <p className="hint">{TABS[tab].hint}</p>

      {tab === 'securite' ? (
        <SecuritySettings userId={user.id} step={sp.etape} />
      ) : tab === 'apparence' ? (
        <section className="settings-form">
          <h2>Mode d'affichage</h2>
          <ThemePicker current={['light', 'dark'].includes((await cookies()).get('theme')?.value) ? (await cookies()).get('theme').value : 'auto'} />
        </section>
      ) : tab === 'compte' ? (
        <div className="settings-grid">
          <section>
            <h2>Profil</h2>
            <form action={updateProfile} className="stack">
              <div className="row">
                <label>Prénom<input name="first_name" required maxLength={60} defaultValue={profile.first_name} autoComplete="given-name" /></label>
                <label>Nom<input name="last_name" required maxLength={60} defaultValue={profile.last_name} autoComplete="family-name" /></label>
              </div>
              <div><button>Enregistrer</button></div>
            </form>
          </section>
          <section>
            <h2>Adresse e-mail</h2>
            <p className="hint">Actuelle : <strong>{profile.email}</strong>. La nouvelle adresse ne remplace l'ancienne qu'une fois confirmée.</p>
            <form action={requestEmailChange} className="stack">
              <label>Nouvelle adresse<input name="email" type="email" required autoComplete="email" /></label>
              <label>Mot de passe actuel<input name="password" type="password" required autoComplete="current-password" /></label>
              <div><button className="secondary">Recevoir le lien de confirmation</button></div>
            </form>
          </section>
          <section>
            <h2>Mot de passe</h2>
            <form action={changePassword} className="stack">
              <label>Mot de passe actuel<input name="current" type="password" required autoComplete="current-password" /></label>
              <PasswordFields label="Nouveau mot de passe" />
              <div><button>Changer le mot de passe</button></div>
            </form>
          </section>
          <section className="danger-zone">
            <h2>Supprimer mon compte</h2>
            <p className="hint">Supprime définitivement ton compte, ton entreprise, tes clients, tes factures et tes devis. Pense à exporter tes factures avant : c'est irréversible.</p>
            <details>
              <summary>Je veux supprimer mon compte</summary>
              <form action={deleteAccount} className="stack">
                <label>Tape SUPPRIMER pour confirmer<input name="confirm_word" required autoComplete="off" /></label>
                <label>Mot de passe<input name="password" type="password" required autoComplete="current-password" /></label>
                <div><button className="danger">Supprimer définitivement</button></div>
              </form>
            </details>
          </section>
        </div>
      ) : (
        <form action={saveCompany} className="card stack settings-form" key={tab}>
          <input type="hidden" name="from" value="parametres" />
          <CompanyFields c={company} sections={[tab]} />
          <div className="form-foot"><button>Enregistrer</button></div>
        </form>
      )}
    </>
  );
}
