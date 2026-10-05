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
      {clientId && (
        <>
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="from" value="client" />
        </>
      )}
      <label>
        Fichier <span className="help">PDF, image, Word, Excel ou texte, 1 Mo au plus</span>
        <input
          name="file"
          type="file"
          required
          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.odt,.txt,application/pdf,image/*"
        />
      </label>
      <div className="row">
        <label>
          Nom <span className="help">facultatif</span>
          <input name="title" maxLength={160} placeholder="Ex. Contrat de prestation 2026" />
        </label>
        <label>
          Type
          <select name="category" defaultValue="contrat">
            {Object.entries(CATEGORIES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
      </div>
      {!clientId && (
        <label>
          Client <span className="help">facultatif</span>
          <select name="client_id" defaultValue={defaultClient}>
            <option value="">Aucun (document de l'entreprise)</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
      )}
      <div className="row">
        <div className="field">
          <span className="field-title">Date du document <span className="help">facultatif</span></span>
          <DatePicker name="doc_date" label="Date du document" />
        </div>
        <div className="field">
          <span className="field-title">Échéance <span className="help">fin de contrat, validité…</span></span>
          <DatePicker name="expires_on" label="Échéance" />
        </div>
      </div>
      <label>
        Note <span className="help">facultatif</span>
        <textarea name="notes" rows={2} maxLength={500} placeholder="Informations complémentaires..." />
      </label>
      <div style={{ marginTop: '8px' }}>
        <button type="submit" className="button" style={{ width: '100%', justifyContent: 'center' }}>
          <Icon name="plus" size={16} />
          Ajouter le document
        </button>
      </div>
    </form>
  );
}

// Liste des documents style PayFit avec cartes détaillées et actions rapides
export function DocumentList({ docs, showClient = true, clientId = null }) {
  if (!docs.length) {
    return (
      <div className="doc-empty-state">
        <div className="doc-empty-icon">
          <Icon name="documents" size={32} />
        </div>
        <h3>Aucun document dans cette sélection</h3>
        <p>Déposez vos contrats, pièces d'identité, attestations ou accords pour les centraliser en toute sécurité.</p>
      </div>
    );
  }

  return (
    <div className="doc-list-stack">
      {docs.map((d) => {
        const exp = expiryState(d);
        const badgeText = badgeOf(d.file_mime);
        const badgeCls = badgeText.toLowerCase();

        return (
          <div key={d.id} className={`doc-item-card${exp ? ` is-${exp}` : ''}`}>
            <div className="doc-item-left">
              {/* Badge d'extension fichier */}
              <div className={`doc-file-tag doc-file-${badgeCls}`}>
                <span className="doc-file-ext">{badgeText}</span>
              </div>

              {/* Informations du document */}
              <div className="doc-item-info">
                <div className="doc-item-title-row">
                  <a
                    href={`/documents/${d.pub_id || pubId('document', d.id)}/fichier`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="doc-item-title row-link"
                    title="Consulter ce fichier dans un nouvel onglet"
                  >
                    {d.title}
                  </a>
                  <span className="doc-size-badge">{sizeLabel(d.file_size)}</span>
                </div>

                <div className="doc-item-meta">
                  <span className="doc-cat-tag">
                    {CATEGORIES[d.category] || 'Autre'}
                  </span>

                  {showClient && d.client_name && (
                    <span className="doc-client-tag">
                      <Icon name="user" size={12} />
                      {d.client_name}
                    </span>
                  )}

                  {d.doc_date && (
                    <span className="doc-date-info">
                      du {frDate(d.doc_date)}
                    </span>
                  )}

                  {d.expires_on && (
                    <span className={`doc-expiry-pill ${exp === 'expired' ? 'late' : exp === 'soon' ? 'wait' : 'ok'}`}>
                      <span className="doc-expiry-dot" />
                      {exp === 'expired'
                        ? `Échu le ${frDate(d.expires_on)}`
                        : exp === 'soon'
                        ? `Expire le ${frDate(d.expires_on)}`
                        : `Valide jusqu'au ${frDate(d.expires_on)}`}
                    </span>
                  )}
                </div>

                {d.notes && (
                  <p className="doc-item-note">
                    {d.notes}
                  </p>
                )}
              </div>
            </div>

            {/* Actions rapides */}
            <div className="doc-item-actions">
              <a
                href={`/documents/${d.pub_id || pubId('document', d.id)}/fichier`}
                target="_blank"
                rel="noopener noreferrer"
                className="doc-btn-open"
                title="Télécharger / Ouvrir le fichier"
              >
                <Icon name="download" size={15} />
                <span>Ouvrir</span>
              </a>

              <form action={deleteDocument}>
                <input type="hidden" name="id" value={d.id} />
                {clientId && (
                  <>
                    <input type="hidden" name="from" value="client" />
                    <input type="hidden" name="client_id" value={clientId} />
                  </>
                )}
                <button
                  type="submit"
                  className="doc-btn-delete"
                  aria-label={`Supprimer ${d.title}`}
                  title="Supprimer ce document"
                >
                  <Icon name="trash" size={15} />
                </button>
              </form>
            </div>
          </div>
        );
      })}
    </div>
  );
}
