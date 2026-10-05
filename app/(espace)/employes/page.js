import Link from 'next/link';
import Flash from '@/components/Flash';
import Modal from '@/components/Modal';
import EmployeeForm from '@/components/EmployeeForm';
import EmployeeTable from '@/components/EmployeeTable';
import ModuleLayout from '@/components/ModuleLayout';
import Icon from '@/components/Icon';
import { requireCompany } from '@/lib/auth';
import { listEmployees, getRhNavCounts } from '@/lib/employees';
import { portalAccessState, PORTAL_ACTIVE, PORTAL_NONE } from '@/lib/portal-state';

export const metadata = { title: 'Salariés & Équipe' };

const FILTERS = {
  all: { label: 'Tous', match: () => true },
  actif: { label: 'Actifs', match: (e) => e.status === 'actif' },
  conge: { label: 'En congé', match: (e) => e.status === 'conge' },
  inactif: { label: 'Inactifs', match: (e) => e.status === 'inactif' },
  archive: { label: 'Archivés', match: (e) => e.status === 'archive' },
};

export default async function Page({ searchParams }) {
  const { company } = await requireCompany();
  const sp = await searchParams;
  const filterKey = FILTERS[sp.filtre] ? sp.filtre : 'all';
  const onlySansPortail = sp.portail === 'absent';

  const [allEmployees, rhCounts] = await Promise.all([
    listEmployees(company.id),
    getRhNavCounts(company.id),
  ]);

  const filtered = allEmployees
    .filter(FILTERS[filterKey].match)
    .filter((e) => !onlySansPortail || portalAccessState(e) === PORTAL_NONE);

  const activeCount = allEmployees.filter((e) => e.status === 'actif').length;
  const congeCount = allEmployees.filter((e) => e.status === 'conge').length;
  const withPortalCount = allEmployees.filter((e) => portalAccessState(e) !== PORTAL_NONE).length;
  const sansPortailCount = allEmployees.filter((e) => portalAccessState(e) === PORTAL_NONE).length;

  const returnTo = onlySansPortail ? '/employes?portail=absent' : `/employes${filterKey === 'all' ? '' : `?filtre=${filterKey}`}`;

  return (
    <ModuleLayout
      workspaceId="rh"
      title="Équipe & Salariés"
      subtitle="Fiches collaborateurs, contrats, accès au portail en ligne et rémunérations."
      actions={
        <Modal label="Nouveau salarié" icon="plus" title="Ajouter un salarié" buttonClass="button" openInitially={sp.nouveau === '1'}>
          <EmployeeForm companyCurrency={company.currency} />
        </Modal>
      }
      counts={rhCounts}
    >
      <Flash searchParams={searchParams} />

      {/* 1. Métriques Équipe PayFit compact */}
      <div className="page-kpi-grid">
        <div className="page-kpi-card">
          <div className="page-kpi-icon" style={{ background: '#f5f0ff', color: '#6e39c4' }}>
            <Icon name="people" size={18} />
          </div>
          <div className="page-kpi-info">
            <span className="page-kpi-label">Actifs</span>
            <span className="page-kpi-value">{activeCount}</span>
            <span className="page-kpi-hint">Sur {allEmployees.length} déclarés</span>
          </div>
        </div>

        <div className="page-kpi-card">
          <div className="page-kpi-icon" style={{ background: '#eef8f2', color: '#1a7f37' }}>
            <Icon name="calendar" size={18} />
          </div>
          <div className="page-kpi-info">
            <span className="page-kpi-label">En Congé</span>
            <span className="page-kpi-value">{congeCount}</span>
            <span className="page-kpi-hint">{congeCount > 0 ? 'Actuellement' : 'Au complet'}</span>
          </div>
        </div>

        <div className="page-kpi-card">
          <div className="page-kpi-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}>
            <Icon name="link" size={18} />
          </div>
          <div className="page-kpi-info">
            <span className="page-kpi-label">Portail</span>
            <span className="page-kpi-value">{withPortalCount} / {allEmployees.length}</span>
            <span className="page-kpi-hint">{sansPortailCount > 0 ? `${sansPortailCount} à inviter` : 'Tous connectés'}</span>
          </div>
        </div>
      </div>

      {/* 2. Alerte sans portail si pertinent */}
      {sansPortailCount > 0 && !onlySansPortail && (
        <div className="doc-expiring-alert" style={{ marginBottom: '20px' }}>
          <div className="doc-expiring-text">
            <span className="doc-expiring-icon">🌐</span>
            <div>
              <strong>{sansPortailCount} salarié{sansPortailCount > 1 ? 's' : ''} sans accès portail</strong>
              <p>Générez leur lien d'accès pour qu'ils consultent leurs fiches de paie et posent leurs congés.</p>
            </div>
          </div>
          <Link href="/employes?portail=absent" className="doc-expiring-btn">
            Filtrer sans accès &rarr;
          </Link>
        </div>
      )}

      {/* 3. Section tableau et filtres pilules */}
      <section className="doc-section" style={{ padding: '20px' }}>
        <div className="doc-filter-header">
          <nav className="doc-tabs-bar" aria-label="Filtrer les salariés">
            {Object.entries(FILTERS).map(([k, f]) => {
              const count = allEmployees.filter(f.match).length;
              return (
                <Link
                  key={k}
                  href={`/employes${k === 'all' ? '' : `?filtre=${k}`}`}
                  className={`doc-tab-pill${k === filterKey && !onlySansPortail ? ' is-active' : ''}`}
                >
                  {f.label}
                  <span className="doc-tab-count">{count}</span>
                </Link>
              );
            })}

            {sansPortailCount > 0 && (
              <Link
                href="/employes?portail=absent"
                className={`doc-tab-pill doc-tab-pill-expiring${onlySansPortail ? ' is-active' : ''}`}
              >
                Sans portail
                <span className="doc-tab-count count-late">{sansPortailCount}</span>
              </Link>
            )}
          </nav>
        </div>

        <EmployeeTable employees={filtered} companyCurrency={company.currency} returnTo={returnTo} />
      </section>
    </ModuleLayout>
  );
}
