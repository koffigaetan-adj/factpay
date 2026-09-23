// Champs d'un client (création et modification)
export default function ClientFields({ c = {} }) {
  return (
    <>
      <label>Nom ou société<input name="name" required maxLength={160} defaultValue={c.name} /></label>
      <label>E-mail de la personne qui paie <span className="help">la facture y est envoyée</span>
        <input name="email" type="email" required defaultValue={c.email} />
      </label>
      <label>Téléphone <span className="help">facultatif</span><input name="phone" defaultValue={c.phone} /></label>
      <label>Adresse de facturation<textarea name="address" rows={3} defaultValue={c.address} /></label>
    </>
  );
}
