import Link from 'next/link';
import Flash from '@/components/Flash';
import PasswordFields from '@/components/PasswordFields';
import CompanyFields from '@/components/CompanyFields';
import ThemePicker from '@/components/ThemePicker';
import SecuritySettings from '@/components/SecuritySettings';
import AccountantSettings from '@/components/AccountantSettings';
import { cookies } from 'next/headers';
import { saveCompany, changePassword, updateProfile, requestEmailChange } from '@/app/actions';
import AvatarPicker from '@/components/AvatarPicker';
import SubmitButton from '@/components/SubmitButton';
import PasswordInput from '@/components/PasswordInput';
import DeleteAccountForm from '@/components/DeleteAccountForm';
import Modal from '@/components/Modal';
import Icon from '@/components/Icon';
import { requireCompany } from '@/lib/auth';
import { one } from '@/lib/db';
import { logoUrl } from '@/lib/url';
import PushToggle from '@/components/PushToggle';

export const metadata = { title: 'Paramètres' };

const THEME_LABELS = { light: 'Clair', dark: 'Sombre', auto: "Automatique (réglage de l'appareil)" };

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
  const themeCookie = (await cookies()).get('theme')?.value;
  const theme = ['auto', 'dark'].includes(themeCookie) ? themeCookie : 'light';
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
                <div><SubmitButton pendingText="Enregistrement..."><Icon name="save" size={16} /> Enregistrer</SubmitButton></div>
              </form>
            </div>
          </section>

          {/* Réglages du compte en lignes compactes : chacun s'ouvre dans une fenêtre */}
          <section className="card setting-rows" style={{ padding: '8px 24px' }}>
            <div className="setting-row">
              <div>
                <strong>Adresse e-mail</strong>
                <span className="sub">{profile.email}</span>
              </div>
              <Modal label="Modifier" title="Changer d'adresse e-mail" buttonClass="secondary small">
                <p className="hint">Actuelle : <strong>{profile.email}</strong>. La nouvelle adresse ne remplace l'ancienne qu'une fois confirmée.</p>
                <form action={requestEmailChange} className="stack">
                  <label>Nouvelle adresse<input name="email" type="email" required autoComplete="email" /></label>
                  <PasswordInput label="Mot de passe actuel" />
                  <div className="form-actions"><SubmitButton pendingText="Envoi...">Recevoir le lien de confirmation</SubmitButton></div>
                </form>
              </Modal>
            </div>
            <div className="setting-row">
              <div>
                <strong>Mot de passe</strong>
                <span className="sub">••••••••••</span>
              </div>
              <Modal label="Modifier" title="Changer de mot de passe" buttonClass="secondary small">
                <form action={changePassword} className="stack">
                  <PasswordInput label="Mot de passe actuel" name="current" />
                  <PasswordFields label="Nouveau mot de passe" />
                  <div className="form-actions"><SubmitButton pendingText="Changement...">Changer le mot de passe</SubmitButton></div>
                </form>
              </Modal>
            </div>
            <div className="setting-row">
              <div>
                <strong>Apparence</strong>
                <span className="sub">{THEME_LABELS[theme]}</span>
              </div>
              <Modal label="Modifier" title="Apparence" buttonClass="secondary small">
                <ThemePicker current={theme} />
              </Modal>
            </div>
            <div className="setting-row">
              <div>
                <strong>Notifications</strong>
                <span className="sub">Paiement signalé, devis accepté... même appli fermée, sur cet appareil</span>
              </div>
              <PushToggle vapidPublicKey={process.env.VAPID_PUBLIC_KEY || ''} />
            </div>
          </section>

          <section className="card danger-zone" style={{ padding: '24px' }}>
            <h3 style={{ marginTop: 0, color: 'inherit' }}>Supprimer le compte</h3>
            <p className="hint">Ton entreprise, tes clients, tes factures et tous tes fichiers (photo, logo, documents) seront effacés <strong>définitivement</strong>. Cette action est irréversible.</p>
            <div>
              <Modal label="Supprimer mon compte" icon="trash" title="Supprimer mon compte" buttonClass="danger">
                <DeleteAccountForm />
              </Modal>
            </div>
          </section>
        </div>
      ) : (
        <form action={saveCompany} className="stack settings-form" key={tab}>
          <input type="hidden" name="from" value="parametres" />
          <CompanyFields c={{ ...company, logo_src: logoUrl(company) }} sections={[tab]} />
          <div className="form-foot"><SubmitButton pendingText="Enregistrement..."><Icon name="save" size={16} /> Enregistrer</SubmitButton></div>
        </form>
      )}
        </div>
      </div>
    </>
  );
}
