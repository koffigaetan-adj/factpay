import { CURRENCIES } from '@/lib/money';

// Champs de l'entreprise, utilisés à l'inscription (/bienvenue) et dans les paramètres
export default function CompanyFields({ c = {} }) {
  return (
    <>
      <fieldset>
        <legend>Ton entreprise</legend>
        <label>Nom de l'entreprise ou ton nom<input name="name" required defaultValue={c.name} autoComplete="organization" /></label>
        <label>Adresse<textarea name="address" rows={2} defaultValue={c.address} placeholder="Quartier, rue, BP, ville, pays" /></label>
        <div className="row">
          <label>Téléphone<input name="phone" defaultValue={c.phone} placeholder="+228 90 00 00 00" autoComplete="tel" /></label>
          <label>E-mail affiché sur les factures<input name="email" type="email" defaultValue={c.email} /></label>
        </div>
        <label>Identifiants légaux <span className="help">Au Togo : NIF et RCCM. Affichés sur chaque facture.</span>
          <input name="legal_ids" defaultValue={c.legal_ids} placeholder="NIF 1000000000 · RCCM TG-LFW-01-2026-A10-00000" />
        </label>
      </fieldset>

      <fieldset>
        <legend>Comment tes clients te paient</legend>
        <div className="row">
          <label>Banque<input name="bank_name" defaultValue={c.bank_name} placeholder="Ex. Ecobank Togo" /></label>
          <label>BIC / SWIFT <span className="help">facultatif</span><input name="bic" defaultValue={c.bic} /></label>
        </div>
        <label>IBAN ou RIB<input name="iban" defaultValue={c.iban} placeholder="TG00 0000 0000 0000 0000 0000 000" /></label>
        <label>Mobile Money <span className="help">Laisse vide si tu ne l'utilises pas.</span>
          <input name="mobile_money" defaultValue={c.mobile_money} placeholder="Flooz +228 90 00 00 00 / T-Money +228 70 00 00 00" />
        </label>
      </fieldset>

      <fieldset>
        <legend>Tes factures</legend>
        <div className="row">
          <label>Devise
            <select name="currency" defaultValue={c.currency || 'XOF'}>
              {Object.entries(CURRENCIES).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
          </label>
          <label>Délai de paiement (jours)<input name="payment_terms" type="number" min="0" max="365" defaultValue={c.payment_terms ?? 14} /></label>
        </div>
        <label className="check">
          <input type="checkbox" name="show_alt_currency" defaultChecked={c.show_alt_currency ?? true} />
          <span>Afficher aussi le montant dans l'autre devise (€ ↔ F CFA, parité fixe 1 € = 655,957 F CFA). Tes clients pourront basculer de l'une à l'autre.</span>
        </label>
        <div className="row3">
          <label>TVA par défaut (%) <span className="help">0 si tu n'y es pas assujetti</span>
            <input name="default_vat_rate" type="number" step="0.01" min="0" max="100" defaultValue={c.default_vat_rate ?? 0} />
          </label>
          <label>À mettre de côté pour tes impôts (%) <span className="help">visible par toi seul</span>
            <input name="tax_reserve_rate" type="number" step="0.1" min="0" max="100" defaultValue={c.tax_reserve_rate ?? 0} />
          </label>
          <label>Préfixe des numéros <span className="help">FAC → FAC-2026-0001</span>
            <input name="invoice_prefix" maxLength={10} defaultValue={c.invoice_prefix || 'FAC'} />
          </label>
        </div>
        <label>Mention en bas de facture <span className="help">facultatif, par exemple une mention légale</span>
          <textarea name="footer_note" rows={2} defaultValue={c.footer_note} />
        </label>
      </fieldset>
    </>
  );
}
