import QRCode from 'qrcode';
import { cookies } from 'next/headers';
import { one } from '@/lib/db';
import { decrypt } from '@/lib/twofa';
import { otpauthUrl } from '@/lib/totp';
import PasswordInput from '@/components/PasswordInput';
import AuthAppBadge from '@/components/AuthAppBadge';
import { AUTH_APPS, authApp } from '@/lib/authenticators';
import {
  enableEmail2fa, startTotpSetup, confirmTotpSetup, disable2fa, newBackupCodes, hideBackupCodes,
} from '@/app/actions';

// Champ mot de passe demandé avant chaque changement de sécurité
const Password = () => <PasswordInput label="Mot de passe actuel" />;

// Onglet Sécurité : double authentification par e-mail ou par application, et codes de secours
export default async function SecuritySettings({ userId, step }) {
  const u = await one('SELECT email, twofa_method, totp_pending, totp_app, backup_codes FROM users WHERE id = $1', [userId]);
  const shown = (await cookies()).get('backup_codes_once')?.value;
  const left = JSON.parse(u.backup_codes || '[]').length;

  // Codes de secours tout juste créés : affichés une seule fois
  if (shown) {
    return (
      <section className="settings-form card" style={{ padding: '24px' }}>
        <h3 style={{ marginTop: 0 }}>Tes codes de secours</h3>
        <p className="hint">Note-les ou imprime-les maintenant, puis range-les en lieu sûr : ils ne seront plus affichés. Chacun permet une seule connexion si tu n'as plus accès à {u.twofa_method === 'email' ? 'ta messagerie' : 'ton téléphone'}.</p>
        <ol className="backup-codes">{shown.split(' ').map((c) => <li key={c}><code>{c}</code></li>)}</ol>
        <form action={hideBackupCodes}><button>J'ai noté mes codes</button></form>
      </section>
    );
  }

  // Configuration de l'application : QR code, puis premier code
  if (step === 'application' && u.totp_pending && !u.twofa_method) {
    const secret = decrypt(u.totp_pending);
    const qr = await QRCode.toDataURL(otpauthUrl(secret, u.email), { margin: 1, width: 220 });
    return (
      <section className="settings-form card" style={{ padding: '24px' }}>
        <h3 style={{ marginTop: 0 }}>Relier ton application d'authentification</h3>
        <ol className="setup-steps">
          <li>Installe une application comme <strong>Google Authenticator</strong>, <strong>Microsoft Authenticator</strong> ou <strong>Authy</strong> sur ton téléphone.</li>
          <li>Dans l'application, ajoute un compte et <strong>scanne ce QR code</strong>.
            <div className="qr-box">
              <img src={qr} alt="QR code à scanner avec ton application d'authentification" width={220} height={220} />
              <p className="help">Impossible de scanner ? Tape cette clé dans l'application :<br /><code className="secret">{secret.match(/.{1,4}/g).join(' ')}</code></p>
            </div>
          </li>
          <li>Tape le code à 6 chiffres que l'application affiche maintenant.</li>
        </ol>
        <form action={confirmTotpSetup} className="stack" style={{ maxWidth: 520 }}>
          <fieldset className="app-choices">
            <legend>Application utilisée</legend>
            {AUTH_APPS.map((a, i) => (
              <label key={a.id}>
                <input type="radio" name="app" value={a.id} defaultChecked={i === 0} required />
                <AuthAppBadge app={a.id} size={28} />
                <span>{a.name}</span>
              </label>
            ))}
          </fieldset>
          <label style={{ maxWidth: 320 }}>Code de l'application<input name="code" required autoComplete="one-time-code" inputMode="numeric" maxLength={7} className="otp" placeholder="000000" /></label>
          <div><button>Activer</button></div>
        </form>
      </section>
    );
  }

  if (u.twofa_method) {
    return (
      <div className="settings-grid">
        <section className="card" style={{ padding: '24px' }}>
          <h3 style={{ marginTop: 0 }}>Double authentification activée</h3>
          {u.twofa_method === 'email' ? (
            <p className="status paid" style={{ margin: '0 0 12px' }}>Code envoyé par e-mail à {u.email}</p>
          ) : (
            <div className="auth-app">
              <AuthAppBadge app={u.totp_app} size={40} />
              <div><strong>{u.totp_app ? authApp(u.totp_app).name : "Application d'authentification"}</strong><span className="status paid">Activée</span></div>
            </div>
          )}
          <p className="hint">À chaque connexion, après ton mot de passe, FactPay te demande ce code.</p>
          <p className="hint">Codes de secours restants : <strong>{left}</strong> sur 8.{left <= 2 ? ' Pense à en créer de nouveaux.' : ''}</p>
          <details className="cancel">
            <summary className="neutral">Créer de nouveaux codes de secours</summary>
            <form action={newBackupCodes} className="stack"><Password /><div><button className="secondary">Créer de nouveaux codes</button></div></form>
          </details>
        </section>
        <section className="card danger-zone" style={{ padding: '24px' }}>
          <h3 style={{ marginTop: 0, color: 'inherit' }}>Désactiver</h3>
          <p className="hint">Ton compte ne sera plus protégé que par ton mot de passe. Pour changer de méthode, désactive puis réactive.</p>
          <form action={disable2fa} className="stack"><Password /><div><button className="danger">Désactiver la double authentification</button></div></form>
        </section>
      </div>
    );
  }

  return (
    <>
      <div className="card stack" style={{ padding: '24px' }}>
        <h3 style={{ marginTop: 0 }}>Ajouter la double authentification</h3>
        <p className="hint" style={{ marginBottom: '16px' }}>Choisis une méthode pour sécuriser ton compte lors de la connexion.</p>

        <details className="settings-expandable" style={{ border: '1px solid var(--line)', borderRadius: '8px', padding: '16px' }}>
          <summary style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontWeight: 600 }}>
            <div>Code par e-mail<br/><span className="sub" style={{ fontWeight: 400 }}>Un code à 6 chiffres envoyé à {u.email}</span></div>
            <span className="button secondary small">Activer</span>
          </summary>
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--line)' }}>
            <form action={enableEmail2fa} className="stack">
              <Password />
              <div><button>Confirmer l'activation</button></div>
            </form>
          </div>
        </details>

        <details className="settings-expandable" style={{ border: '1px solid var(--line)', borderRadius: '8px', padding: '16px' }}>
          <summary style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontWeight: 600 }}>
            <div>Application d'authentification<br/><span className="sub" style={{ fontWeight: 400 }}>Code généré sur ton téléphone (Google Auth, Authy...)</span></div>
            <span className="button secondary small">Configurer</span>
          </summary>
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--line)' }}>
            <form action={startTotpSetup} className="stack">
              <Password />
              <div><button>Commencer la configuration</button></div>
            </form>
          </div>
        </details>
      </div>
    </>
  );
}
