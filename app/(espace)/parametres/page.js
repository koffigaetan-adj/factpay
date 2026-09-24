import Link from 'next/link';
import Flash from '@/components/Flash';
import PasswordFields from '@/components/PasswordFields';
import CompanyFields from '@/components/CompanyFields';
import ThemePicker from '@/components/ThemePicker';
import SecuritySettings from '@/components/SecuritySettings';
import AccountantSettings from '@/components/AccountantSettings';
import { cookies } from 'next/headers';
import { saveCompany, changePassword, updateProfile, requestEmailChange, deleteAccount } from '@/app/actions';
import AvatarPicker from '@/components/AvatarPicker';
import SubmitButton from '@/components/SubmitButton';
import PasswordInput from '@/components/PasswordInput';
import Icon from '@/components/Icon';
import { requireCompany } from '@/lib/auth';
import { one } from '@/lib/db';

export const metadata = { title: 'Paramètres' };

// Un onglet par rubrique, pour ne pas tout afficher d'un coup
const TABS = {
  compte: { label: 'Mon compte', icon: 'user', hint: 'Ton nom, ton mot de passe et l\'apparence de FactPay.' },
  entreprise: { label: 'Entreprise', icon: 'dashboard', hint: 'Ce qui apparaît en haut de tes factures : nom, identifiants légaux, coordonnées et logo.' },
  paiement: { label: 'Paiement', icon: 'invoice', hint: 'Les moyens de paiement indiqués à tes clients sur la facture, la page de paiement et l\'e-mail.' },
  factures: { label: 'Factures', icon: 'documents', hint: 'Les réglages par défaut des nouvelles factures. Les factures déjà émises ne changent pas.' },
  comptable: { label: 'Comptable', icon: 'people', hint: 'Donne à ton comptable un accès en lecture seule à tes factures.' },
  securite: { label: 'Sécurité', icon: 'settings', hint: "La double authentification protège ton compte même si quelqu'un connaît ton mot de passe." },
};

export default async function Page({ searchParams }) {
  const { user, company } = await requireCompany();
  const sp = await searchParams;
  const tab = TABS[sp.onglet] ? sp.onglet : 'compte';
  const profile = tab === 'compte' ? await one('SELECT first_name, last_name, email, avatar_key, avatar_updated_at FROM users WHERE id = $1', [user.id]) : null;

  return (
    <>
      <div className="page-head"><h1>Paramètres</h1></div>
      
      <div className="settings-layout">
        <aside className="settings-sidebar">
          <nav className="settings-nav" aria-label="Rubriques des paramètres">
            {Object.entries(TABS).map(([k, t]) => (
              <Link key={k} href={`/parametres?onglet=${k}`} aria-current={k === tab ? 'page' : undefined}>
                <Icon name={t.icon} size={18} />
                <span>{t.label}</span>
              </Link>
            ))}
          </nav>
        </aside>

        <div className="settings-content">
          <div className="settings-header">
            <h2>{TABS[tab].label}</h2>
            <p className="hint">{TABS[tab].hint}</p>
          </div>
          <Flash searchParams={searchParams} />

      {tab === 'comptable' ? (
        <AccountantSettings company={company} />
      ) : tab === 'securite' ? (
        <SecuritySettings userId={user.id} step={sp.etape} />
      ) : tab === 'compte' ? (
        <div className="stack account-stack">
          <section className="card" style={{ padding: '24px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Informations personnelles</h3>
            <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ display: 'grid', gap: '8px', justifyItems: 'center' }}>
                <AvatarPicker url={profile.avatar_key ? `/compte/photo?v=${new Date(profile.avatar_updated_at).getTime()}` : null} />
                <span className="help" style={{ margin: 0 }}>Photo de profil</span>
              </div>
              <form action={updateProfile} className="stack" style={{ flex: 1, minWidth: '240px' }}>
                <div className="row">
                  <label>Prénom<input name="first_name" required maxLength={60} defaultValue={profile.first_name} autoComplete="given-name" /></label>
                  <label>Nom<input name="last_name" required maxLength={60} defaultValue={profile.last_name} autoComplete="family-name" /></label>
                </div>
                <div><SubmitButton pendingText="Enregistrement...">Enregistrer</SubmitButton></div>
              </form>
            </div>
          </section>

          <section className="card" style={{ padding: '24px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Préférences d'affichage</h3>
            <ThemePicker current={['auto', 'dark'].includes((await cookies()).get('theme')?.value) ? (await cookies()).get('theme').value : 'light'} />
          </section>

          <section className="card" style={{ padding: '24px' }}>
            <h3 style={{ marginTop: 0 }}>Adresse e-mail</h3>
            <p className="hint">Actuelle : <strong>{profile.email}</strong>. La nouvelle adresse ne remplace l'ancienne qu'une fois confirmée.</p>
            <form action={requestEmailChange} className="stack">
              <label>Nouvelle adresse<input name="email" type="email" required autoComplete="email" /></label>
              <PasswordInput label="Mot de passe actuel" />
              <div><SubmitButton className="secondary" pendingText="Envoi...">Recevoir le lien de confirmation</SubmitButton></div>
            </form>
          </section>

          <section className="card" style={{ padding: '24px' }}>
            <h3 style={{ marginTop: 0 }}>Mot de passe</h3>
            <form action={changePassword} className="stack">
              <PasswordInput label="Mot de passe actuel" name="current" />
              <PasswordFields label="Nouveau mot de passe" />
              <div><SubmitButton pendingText="Changement...">Changer le mot de passe</SubmitButton></div>
            </form>
          </section>

          <div>
            <form action={deleteAccount}>
              <SubmitButton className="danger" pendingText="Suppression...">Supprimer le compte</SubmitButton>
            </form>
          </div>
        </div>
      ) : (
        <form action={saveCompany} className="stack settings-form" key={tab}>
          <input type="hidden" name="from" value="parametres" />
          <CompanyFields c={company} sections={[tab]} />
          <div className="form-foot"><SubmitButton pendingText="Enregistrement...">Enregistrer</SubmitButton></div>
        </form>
      )}
        </div>
      </div>
    </>
  );
}
