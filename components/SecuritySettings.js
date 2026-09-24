import QRCode from 'qrcode';
import { cookies } from 'next/headers';
import { one } from '@/lib/db';
import { decrypt } from '@/lib/twofa';
import { otpauthUrl } from '@/lib/totp';
import {
  enableEmail2fa, startTotpSetup, confirmTotpSetup, disable2fa, newBackupCodes, hideBackupCodes,
} from '@/app/actions';

// Champ mot de passe demandé avant chaque changement de sécurité
const Password = () => <label>Mot de passe actuel<input name="password" type="password" required autoComplete="current-password" /></label>;

// Onglet Sécurité : double authentification par e-mail ou par application, et codes de secours
export default async function SecuritySettings({ userId, step }) {
  const u = await one('SELECT email, twofa_method, totp_pending, backup_codes FROM users WHERE id = $1', [userId]);
  const shown = (await cookies()).get('backup_codes_once')?.value;
  const left = JSON.parse(u.backup_codes || '[]').length;

  // Codes de secours tout juste créés : affichés une seule fois
  if (shown) {
    return (
      <section className="settings-form">
        <h2>Tes codes de secours</h2>
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
      <section className="settings-form">
        <h2>Relier ton application d'authentification</h2>
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
        <form action={confirmTotpSetup} className="stack" style={{ maxWidth: 320 }}>
          <label>Code de l'application<input name="code" required autoComplete="one-time-code" inputMode="numeric" maxLength={7} className="otp" placeholder="000000" /></label>
          <div><button>Activer</button></div>
        </form>
      </section>
    );
  }

  if (u.twofa_method) {
    return (
      <div className="settings-grid">
        <section>
          <h2>Double authentification activée</h2>
          <p className="status paid" style={{ margin: '0 0 12px' }}>{u.twofa_method === 'email' ? `Code envoyé par e-mail à ${u.email}` : "Code de l'application d'authentification"}</p>
          <p className="hint">À chaque connexion, après ton mot de passe, FactPay te demande ce code.</p>
          <p className="hint">Codes de secours restants : <strong>{left}</strong> sur 8.{left <= 2 ? ' Pense à en créer de nouveaux.' : ''}</p>
          <details className="cancel">
            <summary className="neutral">Créer de nouveaux codes de secours</summary>
            <form action={newBackupCodes} className="stack"><Password /><div><button className="secondary">Créer de nouveaux codes</button></div></form>
          </details>
        </section>
        <section>
          <h2>Désactiver</h2>
          <p className="hint">Ton compte ne sera plus protégé que par ton mot de passe. Pour changer de méthode, désactive puis réactive.</p>
          <form action={disable2fa} className="stack"><Password /><div><button className="danger">Désactiver la double authentification</button></div></form>
        </section>
      </div>
    );
  }

  return (
    <>
      <div className="settings-grid">
        <section>
          <h2>Code par e-mail</h2>
          <p className="hint">À chaque connexion, un code à 6 chiffres est envoyé à <strong>{u.email}</strong>. Simple, rien à installer.</p>
          <form action={enableEmail2fa} className="stack"><Password /><div><button>Activer par e-mail</button></div></form>
        </section>
        <section>
          <h2>Application d'authentification</h2>
          <p className="hint">Google Authenticator, Microsoft Authenticator, Authy… Le plus sûr : le code est sur ton téléphone, même sans réseau.</p>
          <form action={startTotpSetup} className="stack"><Password /><div><button>Configurer l'application</button></div></form>
        </section>
      </div>
    </>
  );
}
