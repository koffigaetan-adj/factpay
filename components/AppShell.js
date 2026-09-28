'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from '@/components/Logo';
import Icon from '@/components/Icon';
import NotificationBell from '@/components/NotificationBell';
import { logout } from '@/app/actions';

const MANAGEMENT = [
  ['/clients', 'Clients', 'clients'],
  ['/documents', 'Documents', 'documents'],
  ['/parametres', 'Paramètres', 'settings'],
];

export default function AppShell({ companyName, userName, email, avatarUrl = null, initialUnread = 0, sidebarCounts = {}, children }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  const counts = {
    mesFactures: sidebarCounts.mesFactures || 0,
    facturesRecues: sidebarCounts.facturesRecues || 0,
    facturesTotal: sidebarCounts.facturesTotal || 0,
    mesDevis: sidebarCounts.mesDevis || 0,
    devisRecus: sidebarCounts.devisRecus || 0,
    devisTotal: sidebarCounts.devisTotal || 0,
  };

  // Détection de la section active pour ouvrir automatiquement les sous-menus
  const isFacturesActive = path.startsWith('/factures') || path.startsWith('/factures-recues');
  const isDevisActive = path.startsWith('/devis') || path.startsWith('/devis-recus');

  const [facturesOpen, setFacturesOpen] = useState(true);
  const [devisOpen, setDevisOpen] = useState(true);

  // Sur téléphone, le menu se referme quand on change de page
  useEffect(() => { setOpen(false); }, [path]);

  // Si on navigue vers une section, on s'assure qu'elle est bien dépliée
  useEffect(() => {
    if (isFacturesActive) setFacturesOpen(true);
    if (isDevisActive) setDevisOpen(true);
  }, [path, isFacturesActive, isDevisActive]);

  const isCurrent = (href) => {
    if (path === href) return true;
    if (href === '/tableau-de-bord') return false;
    return path.startsWith(`${href}/`);
  };

  const managementLinks = MANAGEMENT.map(([href, label, icon]) => (
    <Link key={href} href={href} aria-current={isCurrent(href) ? 'page' : undefined}>
      <Icon name={icon} /><span className="sb-label">{label}</span>
    </Link>
  ));

  return (
    <div className={`app${open ? ' is-open' : ''}`}>
      <div className="mobile-bar">
        <button type="button" className="sb-icon-btn" onClick={() => setOpen(true)} aria-label="Ouvrir le menu" aria-expanded={open}>
          <Icon name="menu" size={22} />
        </button>
        <Link href="/tableau-de-bord" className="mobile-brand"><Logo height={26} /><span>{companyName}</span></Link>
        <NotificationBell initialUnread={initialUnread} />
      </div>

      <aside className="sidebar" aria-label="Menu principal">
        <div className="sb-top">
          <Link href="/tableau-de-bord" className="sb-brand">
            <Logo height={28} />
            <span className="sb-brand-divider sb-label" aria-hidden="true"></span>
            <span className="sb-label sb-company">{companyName}</span>
          </Link>
          <button type="button" className="sb-icon-btn sb-close" onClick={() => setOpen(false)} aria-label="Fermer le menu">
            <Icon name="close" />
          </button>
        </div>

        <Link href="/factures/nouvelle" className="sb-new">
          <Icon name="plus" /><span className="sb-label">Nouvelle facture</span>
        </Link>

        <nav className="sb-nav" aria-label="Activité">
          <span className="sb-group-label sb-label">Activité</span>

          {/* Tableau de bord */}
          <Link href="/tableau-de-bord" aria-current={path === '/tableau-de-bord' ? 'page' : undefined}>
            <Icon name="dashboard" /><span className="sb-label">Tableau de bord</span>
          </Link>

          {/* Groupe Factures avec sous-menus */}
          <div>
            <button
              type="button"
              className="sb-group-toggle"
              onClick={() => setFacturesOpen(!facturesOpen)}
              aria-expanded={facturesOpen}
            >
              <span className="sb-group-toggle-title">
                <Icon name="invoice" />
                <span className="sb-label">Factures</span>
              </span>
              <span className="sb-toggle-meta">
                {counts.facturesTotal > 0 && (
                  <span className="sb-badge" title={`${counts.facturesTotal} action(s) requise(s)`}>
                    {counts.facturesTotal}
                  </span>
                )}
                <span className="sb-chevron">
                  <Icon name="chevronRight" size={14} />
                </span>
              </span>
            </button>
            {facturesOpen && (
              <div className="sb-subnav">
                <Link href="/factures" aria-current={path === '/factures' || (path.startsWith('/factures/') && !path.startsWith('/factures-recues')) ? 'page' : undefined}>
                  <span>Mes factures</span>
                  {counts.mesFactures > 0 && (
                    <span className="sb-badge warning" title={`${counts.mesFactures} paiement(s) signalé(s) à confirmer`}>
                      {counts.mesFactures}
                    </span>
                  )}
                </Link>
                <Link href="/factures-recues" aria-current={path.startsWith('/factures-recues') ? 'page' : undefined}>
                  <span>Factures reçues</span>
                  {counts.facturesRecues > 0 && (
                    <span className="sb-badge accent" title={`${counts.facturesRecues} facture(s) reçue(s) à payer`}>
                      {counts.facturesRecues}
                    </span>
                  )}
                </Link>
              </div>
            )}
          </div>

          {/* Groupe Devis avec sous-menus */}
          <div>
            <button
              type="button"
              className="sb-group-toggle"
              onClick={() => setDevisOpen(!devisOpen)}
              aria-expanded={devisOpen}
            >
              <span className="sb-group-toggle-title">
                <Icon name="quote" />
                <span className="sb-label">Devis</span>
              </span>
              <span className="sb-toggle-meta">
                {counts.devisTotal > 0 && (
                  <span className="sb-badge" title={`${counts.devisTotal} action(s) requise(s)`}>
                    {counts.devisTotal}
                  </span>
                )}
                <span className="sb-chevron">
                  <Icon name="chevronRight" size={14} />
                </span>
              </span>
            </button>
            {devisOpen && (
              <div className="sb-subnav">
                <Link href="/devis" aria-current={path === '/devis' || (path.startsWith('/devis/') && !path.startsWith('/devis-recus')) ? 'page' : undefined}>
                  <span>Mes devis</span>
                  {counts.mesDevis > 0 && (
                    <span className="sb-badge success" title={`${counts.mesDevis} devis accepté(s) à convertir en facture`}>
                      {counts.mesDevis}
                    </span>
                  )}
                </Link>
                <Link href="/devis-recus" aria-current={path.startsWith('/devis-recus') ? 'page' : undefined}>
                  <span>Devis reçus</span>
                  {counts.devisRecus > 0 && (
                    <span className="sb-badge accent" title={`${counts.devisRecus} devis reçu(s) en attente de réponse`}>
                      {counts.devisRecus}
                    </span>
                  )}
                </Link>
              </div>
            )}
          </div>

          {/* Rapports */}
          <Link href="/rapports" aria-current={isCurrent('/rapports') ? 'page' : undefined}>
            <Icon name="report" /><span className="sb-label">Rapports</span>
          </Link>
        </nav>

        <nav className="sb-nav sb-manage" aria-label="Gestion">
          <span className="sb-group-label sb-label">Gestion</span>
          {managementLinks}
        </nav>

        <div className="sb-profile">
          <Link href="/parametres?onglet=compte" className="sb-avatar" title="Mon compte : changer la photo">
            {avatarUrl ? <img src={avatarUrl} alt="" width={36} height={36} /> : <Icon name="user" size={20} />}
            <span className="sr">Mon compte</span>
          </Link>
          <span className="sb-label sb-who">
            <strong>{userName}</strong>
            <span title={email}>{email}</span>
          </span>
          <form action={logout}>
            <button className="sb-icon-btn sb-logout" aria-label="Se déconnecter" title="Se déconnecter"><Icon name="logout" /></button>
          </form>
        </div>
      </aside>

      <div className="sb-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
      <header className="desktop-topbar">
        <NotificationBell initialUnread={initialUnread} />
      </header>
      <main>{children}</main>
    </div>
  );
}
