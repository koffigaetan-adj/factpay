'use client';

import { useState } from 'react';
import { CURRENCIES } from '@/lib/money';
import { logoUrl } from '@/lib/url';
import { COUNTRIES, countryOf, localNumber, parseMobiles } from '@/lib/payment';
import { BANKS } from '@/lib/providers';
import LogoSelect from '@/components/LogoSelect';

const row = (m = {}) => ({ key: Math.random(), operator: m.operator || '', other: '', number: m.number || '' });

// Numéros Mobile Money : un opérateur (liste du pays, ou « Autre ») et un numéro au format du pays
function MobileAccounts({ country, initial, legacy }) {
  const c = countryOf(country);
  const [rows, setRows] = useState(() => (initial.length ? initial.map(row) : [row()]));
  const update = (k, patch) => setRows((rs) => rs.map((r) => (r.key === k ? { ...r, ...patch } : r)));
  const payload = rows.map(({ operator, number }) => ({ operator, number }));

  return (
    <div className="stack">
      <input type="hidden" name="mobile_accounts" value={JSON.stringify(payload)} />
      <span className="help">Un numéro par opérateur. Laisse vide si tu ne l'utilises pas.</span>
      {legacy && !initial.length && <p className="help" style={{ margin: 0 }}>Ancienne saisie : « {legacy} ». Ressaisis-la ci-dessous, opérateur par opérateur.</p>}
      {rows.map((r, i) => {
        const bad = r.number && !localNumber(r.number, country);
        return (
          <div className="mm-row" key={r.key}>
            <LogoSelect label={`Opérateur ${i + 1}`} options={c.operators} value={r.operator} placeholder="Opérateur"
              otherLabel="Autre opérateur…" onChange={(v) => update(r.key, { operator: v })} />
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
  const [reminders, setReminders] = useState(c.reminders_enabled ?? true);
  // Milieu des numéros : « FP » + code du compte (FAC-FP481-0001)
  const code = `FP${c.fp_code ?? '481'}`;
  const show = (x) => sections.includes(x);
  return (
    <>
      {sections.map((x) => <input key={x} type="hidden" name="sections" value={x} />)}

      {show('entreprise') && (
        <>
          <fieldset className="card" style={{ padding: '24px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Identité</h3>
            <label>Nom de l'entreprise ou ton nom<input name="name" required defaultValue={c.name} autoComplete="organization" /></label>
            <label>Identifiants légaux <span className="help">Au Togo : NIF et RCCM. Affichés sur chaque facture.</span>
              <input name="legal_ids" defaultValue={c.legal_ids} placeholder="NIF 1000000000 · RCCM TG-LFW-01-2026-A10-00000" />
            </label>
          </fieldset>

          <fieldset className="card" style={{ padding: '24px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Coordonnées</h3>
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

          <fieldset className="card" style={{ padding: '24px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Logo</h3>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
              {logoUrl(c) && (
                <div style={{ flex: 'none', width: '88px', height: '88px', padding: '8px', border: '1px solid var(--line)', borderRadius: '8px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src={logoUrl(c)} alt="Logo actuel" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                </div>
              )}
              <div style={{ flex: 1, display: 'grid', gap: '12px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontWeight: 500 }}>Importer une nouvelle image</span>
                  <span className="help" style={{ margin: 0 }}>PNG ou JPEG (1 Mo max). Sera affiché sur tes factures.</span>
                  <input name="logo" type="file" accept="image/png,image/jpeg" style={{ marginTop: '4px' }} />
                </label>
                {logoUrl(c) && (
                  <label className="switch-row" style={{ margin: 0, padding: '12px' }}>
                    <span>
                      <strong style={{ color: 'var(--late)' }}>Supprimer le logo actuel</strong><br />
                      <span className="help" style={{ display: 'block', margin: 0 }}>Attention : il ne s'affichera plus sur aucune facture.</span>
                    </span>
                    <input type="checkbox" name="remove_logo" />
                  </label>
                )}
              </div>
            </div>
          </fieldset>
        </>
      )}

      {show('paiement') && (
        <>
          <fieldset className="card" style={{ padding: '24px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Virement bancaire</h3>
            <div className="row">
              <div className="field">
                <span className="field-title">Banque</span>
                <LogoSelect name="bank_name" label="Banque" options={Object.keys(BANKS)} value={c.bank_name || ''}
                  placeholder="Choisir ta banque" otherLabel="Autre banque…" />
              </div>
              <label>BIC / SWIFT <span className="help">facultatif</span><input name="bic" defaultValue={c.bic} /></label>
            </div>
            <label>IBAN ou RIB<input name="iban" defaultValue={c.iban} placeholder="TG00 0000 0000 0000 0000 0000 000" /></label>
          </fieldset>

          <fieldset className="card" style={{ padding: '24px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Mobile Money</h3>
            {!show('entreprise') && <p className="help" style={{ margin: '-6px 0 0' }}>Numéros de {countryOf(country).name} (+{countryOf(country).dial}). Le pays se change dans l'onglet Entreprise.</p>}
            <input type="hidden" name="mobile_money" value={c.mobile_money || ''} />
            <MobileAccounts key={country} country={country} initial={parseMobiles(c)} legacy={c.mobile_money} />
          </fieldset>

          <fieldset className="soon-box card" style={{ padding: '24px', opacity: 0.8 }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Paiement en ligne <span className="soon-badge" style={{ fontSize: '12px', verticalAlign: 'middle', marginLeft: '8px' }}>Prochainement</span></h3>
            <p className="help" style={{ margin: 0 }}>Bientôt, ton client pourra payer par Mobile Money ou par carte directement depuis la facture, et elle passera « payée » toute seule, sans justificatif à vérifier.</p>
          </fieldset>

          <fieldset className="card" style={{ padding: '24px' }}>
            <h3 className="legend-logo" style={{ marginTop: 0, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><img src="/brands/spi-full.png" alt="SPI BCEAO" height={26} /> Alias SPI</h3>
            <label>Alias <span className="help">facultatif. Virements instantanés entre banques et portefeuilles de l'UEMOA ; ce n'est pas un compte Mobile Money.</span>
              <input name="spi_alias" maxLength={100} defaultValue={c.spi_alias} placeholder="Ton alias SPI" />
            </label>
          </fieldset>
        </>
      )}

      {show('factures') && (
        <>
          <fieldset className="card" style={{ padding: '24px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Devise et échéance</h3>
            <div className="row">
              <label>Devise par défaut
                <select name="currency" defaultValue={c.currency || 'XOF'}>
                  {Object.entries(CURRENCIES).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                </select>
              </label>
              <label>Délai de paiement (jours)<input name="payment_terms" type="number" min="0" max="365" defaultValue={c.payment_terms ?? 14} /></label>
            </div>
            <label className="switch-row">
              <span>Sur les nouvelles factures, proposer par défaut l'équivalent € ↔ F CFA (parité fixe 1 € = 655,957 F CFA). Modifiable facture par facture.</span>
              <input type="checkbox" name="show_alt_currency" defaultChecked={c.show_alt_currency ?? true} />
            </label>
          </fieldset>

          <fieldset className="card" style={{ padding: '24px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Taxes</h3>
            <div className="row">
              <label>TVA par défaut (%) <span className="help">0 si tu n'y es pas assujetti</span>
                <input name="default_vat_rate" type="number" step="0.01" min="0" max="100" defaultValue={c.default_vat_rate ?? 0} />
              </label>
              <label>À mettre de côté pour tes impôts (%) <span className="help">visible par toi seul</span>
                <input name="tax_reserve_rate" type="number" step="0.1" min="0" max="100" defaultValue={c.tax_reserve_rate ?? 0} />
              </label>
            </div>
          </fieldset>

          <fieldset className="card" style={{ padding: '24px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Relances</h3>
            <label className="switch-row">
              <span>Relancer automatiquement les clients quand une facture dépasse son échéance (un e-mail poli avec la facture et le lien de paiement).</span>
              <input type="checkbox" name="reminders_enabled" checked={reminders} onChange={(e) => setReminders(e.target.checked)} />
            </label>
            {reminders && (
              <label style={{ marginTop: '16px' }}>
                Calendrier des relances automatiques
                <span className="help">
                  Indique le nombre de jours de retard pour chaque relance (ex: <b>3, 10, 15</b> enverra un email le 3e jour de retard, puis le 10e, etc.). Maximum 5 relances.
                </span>
                <input name="reminder_days" defaultValue={c.reminder_days || '3,10'} placeholder="3, 10" style={{ maxWidth: 200 }} />
              </label>
            )}
          </fieldset>

          <fieldset className="card" style={{ padding: '24px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Devis</h3>
            <div className="row">
              <label>Préfixe des devis <span className="help">{`DEV → DEV-${code}-0001`}</span>
                <input name="quote_prefix" maxLength={10} defaultValue={c.quote_prefix || 'DEV'} />
              </label>
              <label>Durée de validité (jours)<input name="quote_validity" type="number" min="1" max="365" defaultValue={c.quote_validity ?? 30} /></label>
            </div>
          </fieldset>

          <fieldset className="card" style={{ padding: '24px' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Numérotation et mentions</h3>
            <label>Préfixe des factures <span className="help">{`FAC → FAC-${code}-0001 (${code} = ton code de compte ; le compteur ne repart jamais à zéro)`}</span>
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
