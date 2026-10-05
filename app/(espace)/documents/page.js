import Link from 'next/link';
import Flash from '@/components/Flash';
import ModuleLayout from '@/components/ModuleLayout';
import { DocumentForm, DocumentList } from '@/components/Documents';
import Modal from '@/components/Modal';
import Icon from '@/components/Icon';
import { requireCompany } from '@/lib/auth';
import { q } from '@/lib/db';
import { listDocuments, CATEGORIES, expiryState } from '@/lib/documents';

export const metadata = { title: 'Documents' };

export default async function Page({ searchParams }) {
  const { company } = await requireCompany();
  const sp = await searchParams;
  const category = CATEGORIES[sp.type] ? sp.type : '';
  const filterExpiring = sp.type === 'echeance';

  const [all, clients] = await Promise.all([
    listDocuments(company.id),
    q('SELECT id, name FROM clients WHERE company_id = $1 ORDER BY name', [company.id]),
  ]);

  const expiringDocs = all.filter((d) => expiryState(d));

  let docs = all;
  if (filterExpiring) {
    docs = expiringDocs;
  } else if (category) {
    docs = all.filter((d) => d.category === category);
  }

  const used = Object.entries(CATEGORIES).filter(([k]) => all.some((d) => d.category === k));
  const countOf = (cat) => all.filter((d) => d.category === cat).length;

  return (
    <ModuleLayout
      workspaceId="suivi"
      title="Documents"
      subtitle="Contrats, attestations, pièces administratives et justificatifs de l'entreprise."
      actions={
        <Modal label="Ajouter un document" icon="plus" title="Ajouter un document" buttonClass="button">
          <DocumentForm clients={clients} defaultClient={sp.client || ''} />
        </Modal>
      }
    >
      <Flash searchParams={searchParams} />

      {/* 1. Dossiers PayFit (Grandes catégories cliquables) */}
      <div className="doc-folders-grid">
        <Link
          href={category === 'contrat' ? '/documents' : '/documents?type=contrat'}
          className={`doc-folder-card${category === 'contrat' ? ' is-active' : ''}`}
        >
          <div className="doc-folder-icon icon-contrat">
            <Icon name="documents" size={22} />
          </div>
          <div className="doc-folder-info">
            <span className="doc-folder-name">Contrats & Accords</span>
            <span className="doc-folder-count">
              {countOf('contrat')} document{countOf('contrat') > 1 ? 's' : ''}
            </span>
          </div>
        </Link>

        <Link
          href={category === 'administratif' ? '/documents' : '/documents?type=administratif'}
          className={`doc-folder-card${category === 'administratif' ? ' is-active' : ''}`}
        >
          <div className="doc-folder-icon icon-admin">
            <Icon name="briefcase" size={22} />
          </div>
          <div className="doc-folder-info">
            <span className="doc-folder-name">Administratif & Légal</span>
            <span className="doc-folder-count">
              {countOf('administratif')} document{countOf('administratif') > 1 ? 's' : ''}
            </span>
          </div>
        </Link>

        <Link
          href={category === 'bon_commande' ? '/documents' : '/documents?type=bon_commande'}
          className={`doc-folder-card${category === 'bon_commande' ? ' is-active' : ''}`}
        >
          <div className="doc-folder-icon icon-commande">
            <Icon name="quote" size={22} />
          </div>
          <div className="doc-folder-info">
            <span className="doc-folder-name">Commandes & Devis</span>
            <span className="doc-folder-count">
              {countOf('bon_commande') + countOf('devis_signe')} document{(countOf('bon_commande') + countOf('devis_signe')) > 1 ? 's' : ''}
            </span>
          </div>
        </Link>

        <Link
          href={category === 'rib' ? '/documents' : '/documents?type=rib'}
          className={`doc-folder-card${category === 'rib' ? ' is-active' : ''}`}
        >
          <div className="doc-folder-icon icon-rib">
            <Icon name="cash" size={22} />
          </div>
          <div className="doc-folder-info">
            <span className="doc-folder-name">RIB & Attestations</span>
            <span className="doc-folder-count">
              {countOf('rib') + countOf('attestation')} document{(countOf('rib') + countOf('attestation')) > 1 ? 's' : ''}
            </span>
          </div>
        </Link>
      </div>

      {/* 2. Alerte d'échéances PayFit */}
      {expiringDocs.length > 0 && !filterExpiring && (
        <div className="doc-expiring-alert">
          <div className="doc-expiring-text">
            <span className="doc-expiring-icon">⚠️</span>
            <div>
              <strong>{expiringDocs.length} document{expiringDocs.length > 1 ? 's' : ''} à échéance</strong>
              <p>Des contrats ou pièces arrivent à échéance ou sont échus : pensez à vérifier vos renouvellements.</p>
            </div>
          </div>
          <Link href="/documents?type=echeance" className="doc-expiring-btn">
            Voir les échéances &rarr;
          </Link>
        </div>
      )}

      {/* 3. Filtres en pilules style PayFit */}
      <section className="doc-section">
        <div className="doc-filter-header">
          <nav className="doc-tabs-bar" aria-label="Filtrer les documents">
            <Link
              href="/documents"
              className={`doc-tab-pill${!category && !filterExpiring ? ' is-active' : ''}`}
            >
              Tous <span className="doc-tab-count">{all.length}</span>
            </Link>
            {used.map(([k, label]) => (
              <Link
                key={k}
                href={`/documents?type=${k}`}
                className={`doc-tab-pill${category === k ? ' is-active' : ''}`}
              >
                {label.split(' (')[0]}
                <span className="doc-tab-count">{all.filter((d) => d.category === k).length}</span>
              </Link>
            ))}
            {expiringDocs.length > 0 && (
              <Link
                href="/documents?type=echeance"
                className={`doc-tab-pill doc-tab-pill-expiring${filterExpiring ? ' is-active' : ''}`}
              >
                À échéance
                <span className="doc-tab-count count-late">{expiringDocs.length}</span>
              </Link>
            )}
          </nav>
        </div>

        <DocumentList docs={docs} />
      </section>
    </ModuleLayout>
  );
}
