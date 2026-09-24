import LegalPage from '@/components/LegalPage';

export const metadata = { title: 'Confidentialité' };

export default function Page() {
  return (
    <LegalPage title="Politique de confidentialité" updated="24 septembre 2026">
      <h2>Qui est responsable</h2>
      <p>[Nom de l'éditeur, adresse], joignable à [adresse e-mail de contact], est responsable des données de ton compte. Pour les données de tes clients que tu saisis dans FactPay, c'est toi qui en es responsable ; FactPay les traite pour ton compte, uniquement pour faire fonctionner le service.</p>

      <h2>Les données que nous gardons</h2>
      <ul>
        <li><strong>Ton compte</strong> : prénom, nom, adresse e-mail, mot de passe (jamais en clair : seule une empreinte est gardée), photo de profil si tu en ajoutes une, réglages de sécurité.</li>
        <li><strong>Ton entreprise</strong> : nom, coordonnées, identifiants légaux, logo, coordonnées bancaires et Mobile Money.</li>
        <li><strong>Tes clients et tes documents</strong> : noms, e-mails, téléphones, adresses, factures, devis, justificatifs de paiement, documents que tu ranges.</li>
        <li><strong>Données techniques</strong> : cookies nécessaires à la connexion et à tes préférences d'affichage. Aucun cookie publicitaire, aucun traceur.</li>
      </ul>

      <h2>Pourquoi</h2>
      <p>Uniquement pour faire fonctionner FactPay : te connecter, envoyer tes factures et tes relances, afficher ton tableau de bord, sécuriser ton compte. Tes données ne sont ni vendues, ni louées, ni utilisées pour de la publicité.</p>

      <h2>Où elles sont</h2>
      <p>FactPay est hébergé par Vercel ; la base de données par Neon ; les fichiers dans un espace privé Vercel Blob ; les e-mails partent par [Gmail, ou ton fournisseur d'envoi]. Ces prestataires peuvent stocker les données hors du Togo [à préciser : pays et garanties].</p>

      <h2>Combien de temps</h2>
      <p>Tant que ton compte existe. Quand tu le supprimes, ton compte, ton entreprise, tes clients, tes factures et tes documents sont effacés. Les obligations légales de conservation des factures (en général plusieurs années) restent de ta responsabilité : exporte-les avant de supprimer ton compte.</p>

      <h2>Tes droits</h2>
      <p>Tu peux consulter et corriger tes données dans les Paramètres, les exporter, et supprimer ton compte. Pour toute autre demande (accès, rectification, opposition), écris à [adresse e-mail de contact]. Tu peux aussi saisir l'autorité de protection des données de ton pays (au Togo : [nom exact de l'autorité, à vérifier]).</p>

      <h2>Sécurité</h2>
      <p>Connexions chiffrées, mots de passe protégés, double authentification possible, secrets chiffrés, fichiers privés accessibles seulement par leur propriétaire.</p>
    </LegalPage>
  );
}
