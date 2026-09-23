'use client';

import { useState } from 'react';
import { money, moneyAlt, totals } from '@/lib/money';
import { saveInvoice } from '@/app/actions';

const UNITS = ['heure(s)', 'jour(s)', 'forfait', 'unité(s)', 'mois'];
const emptyLine = () => ({ key: Math.random(), description: '', quantity: '1', unit: 'heure(s)', unit_price: '' });
const toNumber = (v) => Number(String(v).replace(',', '.')) || 0;

export default function InvoiceEditor({ clients, invoice, currency, showAlt, defaultVat, tomorrow }) {
  const [lines, setLines] = useState(() => (invoice?.lines?.length
    ? invoice.lines.map((l) => ({ key: l.id, description: l.description, quantity: String(l.quantity), unit: l.unit, unit_price: String(l.unit_price) }))
    : [emptyLine()]));
  const [vat, setVat] = useState(String(invoice?.vat_rate ?? defaultVat ?? 0));
  const [intent, setIntent] = useState(invoice?.send_on ? 'programmer' : 'envoyer');

  const update = (key, field, value) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  const numeric = lines.map((l) => ({ ...l, quantity: toNumber(l.quantity), unit_price: toNumber(l.unit_price) }));
  const t = totals(numeric, toNumber(vat), currency);

  const submitLabel = { envoyer: 'Enregistrer et envoyer au client', programmer: "Programmer l'envoi", brouillon: 'Enregistrer le brouillon' }[intent];

  return (
    <form action={saveInvoice} className="stack">
      {invoice && <input type="hidden" name="id" value={invoice.id} />}
      <input type="hidden" name="lines" value={JSON.stringify(numeric.map(({ key, ...l }) => l))} />

      <section className="stack">
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
      </section>

      <section>
        <h2>Lignes</h2>
        <div className="scroll">
          <table className="lines-edit">
            <thead>
              <tr>
                <th className="c-desc">Description</th><th className="c-qty">Quantité</th><th className="c-unit">Unité</th>
                <th className="c-price">Prix unitaire</th><th className="c-amount n">Montant</th><th><span className="sr">Retirer</span></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={l.key}>
                  <td><input aria-label={`Description, ligne ${i + 1}`} value={l.description} onChange={(e) => update(l.key, 'description', e.target.value)} placeholder="Ex. Développement" /></td>
                  <td><input aria-label={`Quantité, ligne ${i + 1}`} inputMode="decimal" value={l.quantity} onChange={(e) => update(l.key, 'quantity', e.target.value)} /></td>
                  <td>
                    <select aria-label={`Unité, ligne ${i + 1}`} value={l.unit} onChange={(e) => update(l.key, 'unit', e.target.value)}>
                      {[...new Set([...UNITS, l.unit])].map((u) => <option key={u} value={u}>{u || '—'}</option>)}
                    </select>
                  </td>
                  <td><input aria-label={`Prix unitaire, ligne ${i + 1}`} inputMode="decimal" value={l.unit_price} onChange={(e) => update(l.key, 'unit_price', e.target.value)} placeholder="0" /></td>
                  <td className="n">{money(toNumber(l.quantity) * toNumber(l.unit_price), currency)}</td>
                  <td>
                    {lines.length > 1 && (
                      <button type="button" className="remove" aria-label={`Retirer la ligne ${i + 1}`} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>×</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" className="secondary" onClick={() => setLines((ls) => [...ls, emptyLine()])}>Ajouter une ligne</button>

        <div className="sum">
          <div>
            <label htmlFor="vat" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>TVA (%)</label>
            <input id="vat" name="vat_rate" inputMode="decimal" value={vat} onChange={(e) => setVat(e.target.value)} style={{ width: 90, textAlign: 'right' }} />
          </div>
          {t.vat > 0 && <div><span>Total HT</span><span>{money(t.subtotal, currency)}</span></div>}
          {t.vat > 0 && <div><span>TVA</span><span>{money(t.vat, currency)}</span></div>}
          <div className="total"><span>Total{t.vat > 0 ? ' TTC' : ''}</span><span>{money(t.total, currency)}</span></div>
          {showAlt && <div className="muted"><span>soit</span><span>{moneyAlt(t.total, currency)}</span></div>}
        </div>
      </section>

      <section className="stack">
        <label>Note pour le client <span className="help">facultatif, imprimée sur la facture</span>
          <textarea name="notes" rows={2} maxLength={1000} defaultValue={invoice?.notes} />
        </label>

        <fieldset>
          <legend>Que faire de cette facture ?</legend>
          <div className="choices">
            <label className="check"><input type="radio" name="intent" value="envoyer" checked={intent === 'envoyer'} onChange={() => setIntent('envoyer')} />
              <span>L'envoyer maintenant au client, avec le PDF et le lien de paiement</span></label>
            <label className="check"><input type="radio" name="intent" value="programmer" checked={intent === 'programmer'} onChange={() => setIntent('programmer')} />
              <span>L'envoyer automatiquement à une date (par exemple la fin de la mission)</span></label>
            {intent === 'programmer' && (
              <label style={{ maxWidth: 240, marginLeft: 28 }}>Date d'envoi
                <input type="date" name="send_on" required min={tomorrow} defaultValue={invoice?.send_on || ''} />
              </label>
            )}
            <label className="check"><input type="radio" name="intent" value="brouillon" checked={intent === 'brouillon'} onChange={() => setIntent('brouillon')} />
              <span>La garder en brouillon</span></label>
          </div>
        </fieldset>
        <div><button>{submitLabel}</button></div>
      </section>
    </form>
  );
}
