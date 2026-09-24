import LegalPage from '@/components/LegalPage';

export const metadata = { title: "Conditions d'utilisation" };

export default function Page() {
  return (
    <LegalPage title="Conditions d'utilisation" updated="24 septembre 2026">
      <h2>1. Le service</h2>
      <p>FactPay est un logiciel en ligne qui permet de créer, envoyer et suivre des factures et des devis, de ranger des documents et de suivre ses encaissements. Il est édité par [nom de l'éditeur, forme juridique, adresse, NIF / RCCM], joignable à [adresse e-mail de contact].</p>

      <h2>2. Ton compte</h2>
      <p>Pour utiliser FactPay, tu crées un compte avec une adresse e-mail valide, que tu confirmes. Tu es responsable de la confidentialité de ton mot de passe et de tout ce qui est fait depuis ton compte. Nous te conseillons d'activer la double authentification (Paramètres → Sécurité).</p>

      <h2>3. Tes factures et tes données</h2>
      <p>Tu restes seul propriétaire des informations que tu saisis : entreprise, clients, factures, devis et documents. Tu es responsable de leur exactitude et du respect des règles qui s'appliquent à ton activité (mentions obligatoires, TVA, retenues, déclarations fiscales). FactPay t'aide à produire tes documents mais ne remplace pas un expert-comptable.</p>
      <p>Tu peux exporter tes factures à tout moment (Factures → Exporter) et supprimer ton compte (Paramètres → Mon compte), ce qui efface tes données.</p>

      <h2>4. Tes clients</h2>
      <p>Tes clients reçoivent tes factures par e-mail et y accèdent par un lien personnel. Ils peuvent y signaler un paiement, accepter un devis ou t'écrire. Tu t'engages à n'enregistrer que des clients avec lesquels tu as une relation commerciale réelle.</p>

      <h2>5. Usages interdits</h2>
      <p>Il est interdit d'utiliser FactPay pour envoyer des messages non sollicités, émettre de fausses factures, tromper des tiers ou porter atteinte au fonctionnement du service.</p>

      <h2>6. Prix</h2>
      <p>FactPay est gratuit pour commencer. Si une offre payante est proposée plus tard, ses conditions te seront présentées avant tout paiement, et tu resteras libre de ne pas y souscrire.</p>

      <h2>7. Disponibilité et responsabilité</h2>
      <p>Nous faisons notre possible pour que FactPay fonctionne en continu et que tes données soient sauvegardées, sans pouvoir garantir une absence totale d'interruption. Notre responsabilité ne saurait être engagée pour un dommage indirect, ni au-delà de [montant, ou « des sommes payées au cours des douze derniers mois »].</p>

      <h2>8. Évolution des conditions</h2>
      <p>Ces conditions peuvent évoluer. En cas de changement important, tu en seras prévenu par e-mail ou dans le logiciel.</p>

      <h2>9. Droit applicable</h2>
      <p>Ces conditions sont soumises au droit [togolais]. En cas de litige, une solution amiable sera recherchée en priorité ; à défaut, les tribunaux de [Lomé] seront compétents.</p>
    </LegalPage>
  );
}
