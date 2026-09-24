import CopyButton from '@/components/CopyButton';
import { createAccountantAccess, revokeAccountantAccess } from '@/app/actions';
import { accountantToken } from '@/lib/accountant';
import { appUrl } from '@/lib/url';
import { frDate } from '@/lib/dates';
import { whatsappLink } from '@/lib/payment';

// Onglet Comptable : un lien secret, en lecture seule, à donner à son comptable
export default function AccountantSettings({ company }) {
  const token = accountantToken(company);
  const link = token ? `${appUrl()}/comptable/${token}` : null;
  return (
    <div className="settings-grid">
      <section className="card" style={{ padding: '24px' }}>
        <h3 style={{ marginTop: 0 }}>Accès pour ton comptable</h3>
        <p className="hint">Ton comptable voit tes factures, avoirs et devis, le récapitulatif de l'année et peut tout exporter et télécharger en PDF. Il ne peut <strong>rien modifier</strong> et n'a pas besoin de compte.</p>
        {link ? (
          <div className="stack">
            <input value={link} readOnly aria-label="Lien pour ton comptable" className="link-field" />
            <div className="line-actions">
              <CopyButton text={link} />
              <a className="button secondary" href={`mailto:?subject=${encodeURIComponent(`Accès aux factures de ${company.name}`)}&body=${encodeURIComponent(`Bonjour,\n\nVoici l'accès en lecture seule à mes factures FactPay :\n${link}\n\nMerci.`)}`}>Envoyer par e-mail</a>
              <a className="button secondary" href={whatsappLink('', `Bonjour, voici l'accès en lecture seule à mes factures FactPay : ${link}`, company.country)} target="_blank" rel="noopener">WhatsApp</a>
            </div>
            <p className="help" style={{ margin: 0 }}>Lien créé le {frDate(company.accountant_since)}. Garde-le pour toi et ton comptable : toute personne qui l'a peut consulter tes factures.</p>
          </div>
        ) : (
          <form action={createAccountantAccess}><button>Créer le lien pour mon comptable</button></form>
        )}
      </section>
      {link && (
        <section className="card danger-zone" style={{ padding: '24px' }}>
          <h3 style={{ marginTop: 0, color: 'inherit' }}>Couper l'accès</h3>
          <p className="hint">Fin de mission, lien partagé par erreur : désactive-le. Un nouveau lien, différent, pourra être créé ensuite.</p>
          <form action={revokeAccountantAccess}><button className="danger">Désactiver le lien</button></form>
        </section>
      )}
    </div>
  );
}
