'use client';

import { useEffect, useState } from 'react';
import { CURRENCIES, money, totals, fixedRate, convert, rateLabel, short, isPrime } from '@/lib/money';
import { periodHours } from '@/lib/period';
import PeriodPicker, { newPeriod } from '@/components/PeriodPicker';
import { saveInvoice } from '@/app/actions';
import SubmitButton from '@/components/SubmitButton';
import Icon from '@/components/Icon';

const UNITS = ['heure(s)', 'jour(s)', 'forfait', 'unité(s)', 'mois'];
const key = () => Math.random();
const emptyLine = () => ({ key: key(), kind: 'service', description: '', quantity: '1', unit: 'heure(s)', unit_price: '' });
const primeLine = () => ({ key: key(), kind: 'prime', description: 'Prime', quantity: '1', unit: '', unit_price: '' });
const periodLine = () => ({ key: key(), kind: 'period', description: 'Prestation', quantity: '0', unit: 'heure(s)', unit_price: '' });
const toNumber = (v) => Number(String(v).replace(',', '.')) || 0;
const hoursLabel = (n) => String(Math.round(n * 100) / 100).replace('.', ',');

export default function InvoiceEditor({ clients, invoice, defaultCurrency, defaultAlt, defaultVat, tomorrow, thisMonth, docType = 'facture' }) {
  const quote = (invoice?.doc_type || docType) === 'devis';
  const [lines, setLines] = useState(() => (invoice?.lines?.length
    ? invoice.lines.map((l) => ({ key: l.id, kind: l.kind || 'service', description: l.description, quantity: String(l.quantity), unit: l.unit, unit_price: String(l.unit_price) }))
    : [emptyLine()]));
  const [period, setPeriod] = useState(invoice?.period || null);
  // TVA : activée si la facture en a déjà une (ou si un taux par défaut est réglé) ; le taux se garde quand on la coupe
  const initialVat = Number(invoice?.id ? invoice.vat_rate : defaultVat) || 0;
  const [vatOn, setVatOn] = useState(initialVat > 0);
  const [vat, setVat] = useState(String(initialVat || 18));
  const [whOn, setWhOn] = useState((invoice?.withholding_rate ?? 0) > 0);
  const [wh, setWh] = useState(String(invoice?.withholding_rate || 5));
  const [whLabel, setWhLabel] = useState(invoice?.withholding_label || 'Retenue à la source');
  const [currency, setCurrency] = useState(invoice?.currency || defaultCurrency);
  const [alt, setAlt] = useState(invoice?.id ? invoice.alt_currency || '' : defaultAlt || '');
  const [manualRate, setManualRate] = useState(invoice?.alt_rate && !fixedRate(invoice.currency, invoice.alt_currency) ? String(invoice.alt_rate) : '');
  // « Programmer l'envoi » fait apparaître la date ; les autres boutons envoient le formulaire directement
  const [scheduling, setScheduling] = useState(!!invoice?.send_on);

  const update = (k, field, value) => setLines((ls) => ls.map((l) => (l.key === k ? { ...l, [field]: value } : l)));
  const remove = (k) => setLines((ls) => ls.filter((l) => l.key !== k));
  const hasPeriod = lines.some((l) => l.kind === 'period');

  // La ligne « période » prend ses heures dans le calendrier : jours travaillés × heures par jour
  const numeric = lines.map((l) => ({
    ...l,
    quantity: l.kind === 'period' ? (period ? periodHours(period) : 0) : toNumber(l.quantity),
    unit_price: toNumber(l.unit_price),
  }));
  const whRate = whOn ? toNumber(wh) : 0;
  const vatRate = vatOn ? toNumber(vat) : 0;
  const t = totals(numeric, vatRate, whRate, currency);
  const fixed = alt ? fixedRate(currency, alt) : null;
  const rate = fixed ?? toNumber(manualRate);

  // Taux du jour récupéré automatiquement pour les devises sans parité fixe (modifiable à la main)
  const [live, setLive] = useState(null); // { rate, date, source } ou { error }
  const fetchRate = async (force = false) => {
    if (!alt || fixed) return;
    setLive({ loading: true });
    try {
      const r = await fetch(`/api/taux?de=${currency}&vers=${alt}`).then((res) => res.json());
      if (r.error) throw new Error(r.error);
      setLive(r);
      if (force || !manualRate) setManualRate(String(r.rate).replace('.', ','));
    } catch (err) {
      setLive({ error: "Taux du jour indisponible pour l'instant : saisis-le à la main." });
    }
  };
  useEffect(() => { fetchRate(); }, [currency, alt]); // eslint-disable-line react-hooks/exhaustive-deps
  const hasPrime = lines.some(isPrime);

  const togglePeriod = (on) => {
    if (on) {
      setPeriod((p) => p || newPeriod(thisMonth));
      // Le brouillon vide de départ devient la ligne « période »
      setLines((ls) => {
        const blank = ls.length === 1 && !ls[0].description && !ls[0].unit_price;
        return blank ? [periodLine()] : [periodLine(), ...ls];
      });
    } else {
      setLines((ls) => {
        const rest = ls.filter((l) => l.kind !== 'period');
        return rest.length ? rest : [emptyLine()];
      });
    }
  };

  const pickCurrency = (c) => {
    setCurrency(c);
    if (c === alt) setAlt('');
    setManualRate('');
  };


  return (
    <form action={saveInvoice} className="stack">
      {invoice?.id && <input type="hidden" name="id" value={invoice.id} />}
      <input type="hidden" name="doc_type" value={quote ? 'devis' : 'facture'} />
      <input type="hidden" name="lines" value={JSON.stringify(numeric.map(({ key: _, ...l }) => l))} />
      <input type="hidden" name="period" value={hasPeriod && period ? JSON.stringify(period) : ''} />
      <input type="hidden" name="withholding_rate" value={whRate} />

      <section className="stack">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon name="people" /> Client
        </h2>
        <div className="row">
          <label>Client
            <select name="client_id" required defaultValue={invoice?.client_id ?? ''}>
              <option value="" disabled>Choisir un client</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
            </select>
          </label>
          <label>Objet <span className="help">facultatif</span>
            <input name="title" maxLength={200} defaultValue={invoice?.title} placeholder="Ex. Développement du site, septembre" />
          </label>
        </div>
        <details className="advanced-options" style={{ marginTop: '8px' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon name="settings" size={16} /> Paramètres avancés (Devise et taux)
          </summary>
          <div className="row3" style={{ marginTop: '16px' }}>
            <label>Devise de la facture
              <select name="currency" value={currency} onChange={(e) => pickCurrency(e.target.value)}>
                {Object.entries(CURRENCIES).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
              </select>
            </label>
            <label>Montant converti en <span className="help">affiché au client</span>
              <select name="alt_currency" value={alt} onChange={(e) => { setAlt(e.target.value); setManualRate(''); }}>
                <option value="">Pas de conversion</option>
                {Object.entries(CURRENCIES).filter(([code]) => code !== currency).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
              </select>
            </label>
            {alt && (fixed ? (
              <div className="rate-fixed"><span className="help">Taux</span>{rateLabel(currency, alt, fixed)}</div>
            ) : (
              <div className="rate-live">
                <label>Taux du jour <span className="help">1 {short(currency)} = … {short(alt)}</span>
                  <input name="alt_rate" inputMode="decimal" required value={manualRate} onChange={(e) => setManualRate(e.target.value)} placeholder="Ex. 600" />
                </label>
                <span className="help">
                  {live?.loading && 'Recherche du taux du jour…'}
                  {live?.error}
                  {live?.rate && <>≈ {rateLabel(currency, alt, toNumber(manualRate) || live.rate)} · source {live.source}{live.date ? `, ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(live.date))}` : ''}</>}
                  {!live?.loading && <> · <button type="button" className="link" onClick={() => fetchRate(true)}>Actualiser</button></>}
                </span>
              </div>
            ))}
          </div>
        </details>
      </section>

      <section className="stack">
        <label className="switch-row">
          <span><strong>Facturer une période travaillée</strong><br />
            <span className="help" style={{ display: 'block', marginTop: '4px' }}>Choisis le mois ou les jours travaillés : les heures se calculent toutes seules.</span></span>
          <input type="checkbox" checked={hasPeriod} onChange={(e) => togglePeriod(e.target.checked)} />
        </label>
        {hasPeriod && period && <PeriodPicker value={period} onChange={setPeriod} />}
      </section>

      <section>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon name="invoice" /> Lignes
        </h2>
        <div className="scroll">
          <table className="lines-edit">
            <thead>
              <tr>
                <th className="c-desc">Description</th><th className="c-qty">Quantité</th><th className="c-unit">Unité</th>
                <th className="c-price">Prix unitaire</th><th className="c-amount n">Montant</th><th><span className="sr">Retirer</span></th>
              </tr>
            </thead>
            <tbody>
              {numeric.map((l, i) => (
                <tr key={l.key} className={l.kind !== 'service' ? `k-${l.kind}` : undefined}>
                  <td>
                    <input aria-label={`Description, ligne ${i + 1}`} value={lines[i].description} onChange={(e) => update(l.key, 'description', e.target.value)} placeholder="Ex. Développement" />
                    {l.kind === 'period' && <span className="line-tag">Heures de la période travaillée</span>}
                    {l.kind === 'prime' && <span className="line-tag prime">Prime · sans retenue</span>}
                  </td>
                  <td>
                    {l.kind === 'prime' ? (
                      <span className="times">×<input aria-label={`Nombre de primes, ligne ${i + 1}`} inputMode="decimal" value={lines[i].quantity} onChange={(e) => update(l.key, 'quantity', e.target.value)} /></span>
                    ) : l.kind === 'period'
                      ? <output className="qty-locked" aria-label={`Quantité, ligne ${i + 1}`}>{hoursLabel(l.quantity)}</output>
                      : <input aria-label={`Quantité, ligne ${i + 1}`} inputMode="decimal" value={lines[i].quantity} onChange={(e) => update(l.key, 'quantity', e.target.value)} />}
                  </td>
                  <td>
                    {l.kind === 'prime' ? null : l.kind === 'period'
                      ? <span className="qty-locked">heure(s)</span>
                      : (
                        <select aria-label={`Unité, ligne ${i + 1}`} value={l.unit} onChange={(e) => update(l.key, 'unit', e.target.value)}>
                          {[...new Set([...UNITS, l.unit])].map((u) => <option key={u} value={u}>{u || '—'}</option>)}
                        </select>
                      )}
                  </td>
                  <td>
                    <input aria-label={`${{ period: 'Taux horaire', prime: 'Montant de la prime' }[l.kind] || 'Prix unitaire'}, ligne ${i + 1}`} inputMode="decimal"
                      value={lines[i].unit_price} onChange={(e) => update(l.key, 'unit_price', e.target.value)}
                      placeholder={{ period: 'Taux horaire', prime: 'Montant' }[l.kind] || '0'} />
                  </td>
                  <td className="n">{money(l.quantity * l.unit_price, currency)}</td>
                  <td>
                    {(lines.length > 1 || l.kind === 'period') && (
                      <button type="button" className="remove" aria-label={`Retirer la ligne ${i + 1}`}
                        onClick={() => (l.kind === 'period' ? togglePeriod(false) : remove(l.key))}>×</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="line-actions">
          <button type="button" className="secondary" onClick={() => setLines((ls) => [...ls, emptyLine()])}>Ajouter une ligne</button>
          <button type="button" className="secondary" onClick={() => setLines((ls) => [...ls, primeLine()])}>Ajouter une prime</button>
        </div>

        <div className="sum-wrapper">
          <div className="sum">
            {/* Réglages : TVA, puis juste après la retenue (interrupteur) */}
            <div className="sum-settings">
              <input type="hidden" name="vat_rate" value={vatRate} />
              <div>
                <span id="vat-label">TVA</span>
                <button type="button" role="switch" aria-checked={vatOn} aria-labelledby="vat-label" className="switch" onClick={() => setVatOn((v) => !v)}>
                  <span className="switch-knob" />
                </button>
              </div>
              {vatOn && (
                <div className="wh-box">
                  <div>
                    <label htmlFor="vat">Taux (%)</label>
                    <input id="vat" inputMode="decimal" value={vat} onChange={(e) => setVat(e.target.value)} className="pct" />
                  </div>
                </div>
              )}
              <div>
                <span id="wh-label">Retenue du client</span>
                <button type="button" role="switch" aria-checked={whOn} aria-labelledby="wh-label" className="switch" onClick={() => setWhOn((v) => !v)}>
                  <span className="switch-knob" />
                </button>
              </div>
              {whOn && (
                <div className="wh-box">
                  <input name="withholding_label" aria-label="Nom de la retenue" maxLength={80} value={whLabel} onChange={(e) => setWhLabel(e.target.value)} />
                  <div>
                    <label htmlFor="wh">Taux (%)</label>
                    <input id="wh" inputMode="decimal" value={wh} onChange={(e) => setWh(e.target.value)} className="pct" />
                  </div>
                </div>
              )}
            </div>

            {t.vat > 0 && <div><span>Total HT</span><span>{money(t.subtotal, currency)}</span></div>}
            {t.vat > 0 && <div><span>TVA</span><span>{money(t.vat, currency)}</span></div>}
            <div className="total"><span>Total{t.vat > 0 ? ' TTC' : ''}</span><span>{money(t.total, currency)}</span></div>
            {whOn && (
              <>
                <div className="muted"><span>Base{hasPrime ? ' (hors primes)' : ''}</span><span>{money(t.base, currency)}</span></div>
                <div><span>{whLabel || 'Retenue'} ({hoursLabel(whRate)} %)</span><span>− {money(t.withholding, currency)}</span></div>
              </>
            )}
            {t.withholding > 0 && <div className="total net"><span>Net à payer</span><span>{money(t.due, currency)}</span></div>}
            {alt && rate > 0 && <div className="muted"><span>soit</span><span>{money(convert(t.due, rate, alt), alt)}</span></div>}
          </div>
        </div>
      </section>

      <section className="stack">
        <label><span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '16px', marginBottom: '8px' }}><Icon name="documents" size={20} /> Note pour le client</span> <span className="help">facultatif, imprimée sur la facture</span>
          <textarea name="notes" rows={2} maxLength={1000} defaultValue={invoice?.notes} style={{ marginTop: '4px' }} />
        </label>

        {!quote && scheduling && (
          <div className="schedule-box">
            <label>Date d'envoi automatique <span className="help">par exemple la fin de la mission</span>
              <input type="date" name="send_on" min={tomorrow} defaultValue={invoice?.send_on || ''} />
            </label>
            <SubmitButton name="intent" value="programmer" pendingText="Prog...">Programmer l'envoi</SubmitButton>
            <button type="button" className="link" onClick={() => setScheduling(false)}>Annuler</button>
          </div>
        )}
        <div className="form-actions">
          <SubmitButton name="intent" value="brouillon" className="secondary" formNoValidate pendingText="Brouillon...">Enregistrer en brouillon</SubmitButton>
          {!quote && !scheduling && <button type="button" className="secondary" onClick={() => setScheduling(true)}>Programmer l'envoi…</button>}
          <SubmitButton name="intent" value="envoyer" pendingText="Envoi...">{quote ? 'Envoyer le devis au client' : 'Envoyer au client'}</SubmitButton>
        </div>
        <p className="help" style={{ margin: 0 }}>{quote
          ? "Envoyer : ton client reçoit le PDF et un lien pour accepter ou refuser le devis."
          : "Envoyer : ton client reçoit le PDF et un lien pour payer ou signaler son paiement."}</p>
      </section>
    </form>
  );
}
