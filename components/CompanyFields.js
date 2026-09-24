'use client';

import { useState } from 'react';
import { CURRENCIES } from '@/lib/money';
import { logoUrl } from '@/lib/url';
import { COUNTRIES, OTHER, countryOf, localNumber, parseMobiles } from '@/lib/payment';

const row = (m = {}) => ({ key: Math.random(), operator: m.operator || '', other: '', number: m.number || '' });

// Numéros Mobile Money : un opérateur (liste du pays, ou « Autre ») et un numéro au format du pays
function MobileAccounts({ country, initial, legacy }) {
  const c = countryOf(country);
  const [rows, setRows] = useState(() => {
    const list = initial.map((m) => (c.operators.includes(m.operator) ? row(m) : { ...row(m), operator: OTHER, other: m.operator }));
    return list.length ? list : [row()];
  });
  const update = (k, patch) => setRows((rs) => rs.map((r) => (r.key === k ? { ...r, ...patch } : r)));
  const payload = rows.map(({ operator, other, number }) => ({ operator, other, number }));

  return (
    <div className="stack">
      <input type="hidden" name="mobile_accounts" value={JSON.stringify(payload)} />
      <span className="help">Un numéro par opérateur. Laisse vide si tu ne l'utilises pas.</span>
      {legacy && !initial.length && <p className="help" style={{ margin: 0 }}>Ancienne saisie : « {legacy} ». Ressaisis-la ci-dessous, opérateur par opérateur.</p>}
      {rows.map((r, i) => {
        const bad = r.number && !localNumber(r.number, country);
        return (
          <div className="mm-row" key={r.key}>
            <select aria-label={`Opérateur ${i + 1}`} value={r.operator} onChange={(e) => update(r.key, { operator: e.target.value })}>
              <option value="">Opérateur</option>
              {c.operators.map((o) => <option key={o} value={o}>{o}</option>)}
              <option value={OTHER}>Autre…</option>
            </select>
            {r.operator === OTHER && (
              <input aria-label={`Nom de l'opérateur ${i + 1}`} placeholder="Nom de l'opérateur" maxLength={40}
                value={r.other} onChange={(e) => update(r.key, { other: e.target.value })} />
            )}
            <span className="phone">
              <span className="dial">+{c.dial}</span>
              <input aria-label={`Numéro ${i + 1}`} inputMode="tel" value={r.number} placeholder={'0'.repeat(c.digits).replace(/(\d{2})(?=\d)/g, '$1 ')}
                aria-invalid={bad || undefined} onChange={(e) => update(r.key, { number: e.target.value })} />
            </span>
            <button type="button" className="remove" aria-label={`Retirer le numéro ${i + 1}`}
              onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : [row()]))}>×</button>
            {bad && <span className="mm-err">{c.digits} chiffres attendus pour un numéro {c.name === 'Togo' ? 'togolais' : `du pays (${c.name})`}.</span>}
          </div>
        );
      })}
      {rows.length < 6 && (
        <div><button type="button" className="secondary small" onClick={() => setRows((rs) => [...rs, row()])}>Ajouter un numéro</button></div>
      )}
    </div>
  );
}

// Champs de l'entreprise, par rubrique. L'inscription (/bienvenue) les affiche toutes,
// les paramètres une seule par onglet. Chaque rubrique affichée est signalée au serveur (champ « sections »).
export default function CompanyFields({ c = {}, sections = ['entreprise', 'paiement', 'factures'] }) {
  const [country, setCountry] = useState(c.country || 'TG');
  // Milieu des numéros : année sur 2 chiffres + numéro du compte (FAC-2612-0001)
  const code = `${String(new Date().getFullYear()).slice(-2)}${c.owner_id ?? ''}`;
  const show = (x) => sections.includes(x);
  return (
    <>
      {sections.map((x) => <input key={x} type="hidden" name="sections" value={x} />)}

      {show('entreprise') && (
        <>
          <fieldset>
            <legend>Identité</legend>
            <label>Nom de l'entreprise ou ton nom<input name="name" required defaultValue={c.name} autoComplete="organization" /></label>
            <label>Identifiants légaux <span className="help">Au Togo : NIF et RCCM. Affichés sur chaque facture.</span>
              <input name="legal_ids" defaultValue={c.legal_ids} placeholder="NIF 1000000000 · RCCM TG-LFW-01-2026-A10-00000" />
            </label>
          </fieldset>

          <fieldset>
            <legend>Coordonnées</legend>
            <label>Adresse<textarea name="address" rows={2} defaultValue={c.address} placeholder="Quartier, rue, BP, ville" /></label>
            <div className="row">
              <label>Pays <span className="help">vérifie les numéros Mobile Money</span>
                <select name="country" value={country} onChange={(e) => setCountry(e.target.value)}>
                  {Object.entries(COUNTRIES).map(([code, x]) => <option key={code} value={code}>{x.name} (+{x.dial})</option>)}
                </select>
              </label>
              <label>Téléphone<input name="phone" defaultValue={c.phone} placeholder={`+${countryOf(country).dial} …`} autoComplete="tel" /></label>
            </div>
            <label>E-mail affiché sur les factures<input name="email" type="email" defaultValue={c.email} /></label>
          </fieldset>

          <fieldset>
            <legend>Logo</legend>
            <div className="logo-field">
              {logoUrl(c) && <img src={logoUrl(c)} alt="Logo actuel" className="logo-preview" />}
              <div className="stack">
                <label>Image <span className="help">PNG ou JPEG, 1 Mo maximum. En haut de tes factures et de tes e-mails.</span>
                  <input name="logo" type="file" accept="image/png,image/jpeg" />
                </label>
                {logoUrl(c) && <label className="check"><input type="checkbox" name="remove_logo" /><span>Retirer le logo</span></label>}
              </div>
            </div>
          </fieldset>
        </>
      )}

      {show('paiement') && (
        <>
          <fieldset>
            <legend>Virement bancaire</legend>
            <div className="row">
              <label>Banque<input name="bank_name" defaultValue={c.bank_name} placeholder="Ex. Ecobank Togo" /></label>
              <label>BIC / SWIFT <span className="help">facultatif</span><input name="bic" defaultValue={c.bic} /></label>
            </div>
            <label>IBAN ou RIB<input name="iban" defaultValue={c.iban} placeholder="TG00 0000 0000 0000 0000 0000 000" /></label>
          </fieldset>

          <fieldset>
            <legend>Mobile Money</legend>
            {!show('entreprise') && <p className="help" style={{ margin: '-6px 0 0' }}>Numéros de {countryOf(country).name} (+{countryOf(country).dial}). Le pays se change dans l'onglet Entreprise.</p>}
            <input type="hidden" name="mobile_money" value={c.mobile_money || ''} />
            <MobileAccounts key={country} country={country} initial={parseMobiles(c)} legacy={c.mobile_money} />
          </fieldset>

          <fieldset className="soon-box">
            <legend>Paiement en ligne <span className="soon-badge">Prochainement</span></legend>
            <p className="help" style={{ margin: 0 }}>Bientôt, ton client pourra payer par Mobile Money ou par carte directement depuis la facture, et elle passera « payée » toute seule, sans justificatif à vérifier.</p>
          </fieldset>

          <fieldset>
            <legend>Alias SPI (BCEAO)</legend>
            <label>Alias <span className="help">facultatif. Virements instantanés entre banques et portefeuilles de l'UEMOA ; ce n'est pas un compte Mobile Money.</span>
              <input name="spi_alias" maxLength={100} defaultValue={c.spi_alias} placeholder="Ton alias SPI" />
            </label>
          </fieldset>
        </>
      )}

      {show('factures') && (
        <>
          <fieldset>
            <legend>Devise et échéance</legend>
            <div className="row">
              <label>Devise par défaut
                <select name="currency" defaultValue={c.currency || 'XOF'}>
                  {Object.entries(CURRENCIES).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                </select>
              </label>
              <label>Délai de paiement (jours)<input name="payment_terms" type="number" min="0" max="365" defaultValue={c.payment_terms ?? 14} /></label>
            </div>
            <label className="check">
              <input type="checkbox" name="show_alt_currency" defaultChecked={c.show_alt_currency ?? true} />
              <span>Sur les nouvelles factures, proposer par défaut l'équivalent € ↔ F CFA (parité fixe 1 € = 655,957 F CFA). Modifiable facture par facture.</span>
            </label>
          </fieldset>

          <fieldset>
            <legend>Taxes</legend>
            <div className="row">
              <label>TVA par défaut (%) <span className="help">0 si tu n'y es pas assujetti</span>
                <input name="default_vat_rate" type="number" step="0.01" min="0" max="100" defaultValue={c.default_vat_rate ?? 0} />
              </label>
              <label>À mettre de côté pour tes impôts (%) <span className="help">visible par toi seul</span>
                <input name="tax_reserve_rate" type="number" step="0.1" min="0" max="100" defaultValue={c.tax_reserve_rate ?? 0} />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Relances</legend>
            <label className="check">
              <input type="checkbox" name="reminders_enabled" defaultChecked={c.reminders_enabled ?? true} />
              <span>Relancer automatiquement les clients quand une facture dépasse son échéance (un e-mail poli avec la facture et le lien de paiement).</span>
            </label>
            <label>Jours après l'échéance <span className="help">séparés par des virgules, 5 relances au plus</span>
              <input name="reminder_days" defaultValue={c.reminder_days || '3,10'} placeholder="3,10" style={{ maxWidth: 200 }} />
            </label>
          </fieldset>

          <fieldset>
            <legend>Devis</legend>
            <div className="row">
              <label>Préfixe des devis <span className="help">{`DEV → DEV-${code}-0001`}</span>
                <input name="quote_prefix" maxLength={10} defaultValue={c.quote_prefix || 'DEV'} />
              </label>
              <label>Durée de validité (jours)<input name="quote_validity" type="number" min="1" max="365" defaultValue={c.quote_validity ?? 30} /></label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Numérotation et mentions</legend>
            <label>Préfixe des factures <span className="help">{`FAC → FAC-${code}-0001 (${code.slice(0, 2)} = année${c.owner_id ? `, ${c.owner_id} = ton n° de compte` : ''})`}</span>
              <input name="invoice_prefix" maxLength={10} defaultValue={c.invoice_prefix || 'FAC'} style={{ maxWidth: 200 }} />
            </label>
            <label>Mention en bas de facture <span className="help">facultatif, par exemple une mention légale</span>
              <textarea name="footer_note" rows={2} defaultValue={c.footer_note} />
            </label>
          </fieldset>
        </>
      )}
    </>
  );
}
