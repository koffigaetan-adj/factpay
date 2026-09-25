import { uploadDocument, deleteDocument } from '@/app/actions';
import { CATEGORIES, badgeOf, sizeLabel, expiryState } from '@/lib/documents';
import { frDate } from '@/lib/dates';
import DatePicker from '@/components/DatePicker';
import Icon from '@/components/Icon';
import { pubId } from '@/lib/ids';

// Formulaire d'ajout. clientId : document rattaché d'office à ce client (page client).
export function DocumentForm({ clients = [], clientId = null, defaultClient = '' }) {
  return (
    <form action={uploadDocument} className="stack">
      {clientId && <><input type="hidden" name="client_id" value={clientId} /><input type="hidden" name="from" value="client" /></>}
      <label>Fichier <span className="help">PDF, image, Word, Excel ou texte, 1 Mo au plus</span>
        <input name="file" type="file" required
          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.odt,.txt,application/pdf,image/*" />
      </label>
      <div className="row">
        <label>Nom <span className="help">facultatif</span><input name="title" maxLength={160} placeholder="Ex. Contrat de prestation 2026" /></label>
        <label>Type
          <select name="category" defaultValue="contrat">
            {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      </div>
      {!clientId && (
        <label>Client <span className="help">facultatif</span>
          <select name="client_id" defaultValue={defaultClient}>
            <option value="">Aucun (document de l'entreprise)</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      )}
      <div className="row">
        <div className="field"><span className="field-title">Date du document <span className="help">facultatif</span></span><DatePicker name="doc_date" label="Date du document" /></div>
        <div className="field"><span className="field-title">Échéance <span className="help">fin de contrat, validité…</span></span><DatePicker name="expires_on" label="Échéance" /></div>
      </div>
      <label>Note <span className="help">facultatif</span><textarea name="notes" rows={2} maxLength={500} /></label>
      <div><button><Icon name="plus" size={16} /> Ajouter le document</button></div>
    </form>
  );
}

// Liste des documents, avec ouverture, échéance et suppression
export function DocumentList({ docs, showClient = true, clientId = null }) {
  if (!docs.length) return <p className="empty">Aucun document pour l'instant.</p>;
  return (
    <ul className="docs">
      {docs.map((d) => {
        const exp = expiryState(d);
        return (
          <li key={d.id}>
            <span className="doc-kind" aria-hidden="true">{badgeOf(d.file_mime)}</span>
            <div className="doc-main">
              <a href={`/documents/${pubId('document', d.id)}/fichier`} target="_blank" rel="noopener" className="row-link">{d.title}</a>
              <span className="sub">
                {CATEGORIES[d.category] || 'Autre'}
                {showClient && d.client_name && ` · ${d.client_name}`}
                {d.doc_date && ` · du ${frDate(d.doc_date)}`}
                {` · ${sizeLabel(d.file_size)}`}
              </span>
              {d.expires_on && (
                <span className={`status ${exp === 'expired' ? 'late' : exp === 'soon' ? 'wait' : 'draft'}`}>
                  {exp === 'expired' ? 'Échu le' : "Jusqu'au"} {frDate(d.expires_on)}
                </span>
              )}
              {d.notes && <p className="muted doc-note">{d.notes}</p>}
            </div>
            <form action={deleteDocument}>
              <input type="hidden" name="id" value={d.id} />
              {clientId && <><input type="hidden" name="from" value="client" /><input type="hidden" name="client_id" value={clientId} /></>}
              <button className="remove" aria-label={`Supprimer ${d.title}`} title="Supprimer"><Icon name="trash" size={14} /></button>
            </form>
          </li>
        );
      })}
    </ul>
  );
}
