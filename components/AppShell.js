'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import Icon from '@/components/Icon';
import { logout, flushDueSends } from '@/app/actions';
import {
  WORKSPACES,
  FOOTER_LINKS,
  isCurrentPath,
  isWorkspaceCurrent,
  actionsInWorkspace,
} from '@/lib/nav';

function userInitials(name) {
  if (!name) return 'FP';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function AppShell({
  companyName,
  companyLogoUrl = null,
  userName,
  email,
  avatarUrl = null,
  sidebarCounts = {},
  children,
}) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  // Factures programmées dont l'heure vient de passer : la tâche quotidienne ne passe qu'une fois
  // par jour, on ne veut pas laisser attendre une facture prévue pour l'après-midi.
  // C'est le seul déclencheur en dehors du cron : il doit repasser régulièrement, sinon une facture
  // qui échoit pendant que l'onglet reste ouvert n'attendrait qu'une actualisation manuelle.
  // Le serveur borne lui-même les appels (au plus un par minute), l'intervalle suit le même rythme
  // pour ne pas lui envoyer d'appels inutiles.
  useEffect(() => {
    let stop = false;
    const check = () => {
      if (document.visibilityState === 'hidden') return;
      flushDueSends()
        .then((r) => { if (!stop && r?.sent) router.refresh(); })
        .catch(() => { /* connexion perdue : on réessaiera à la minute suivante */ });
    };
    check();
    const timer = setInterval(check, 60_000);
    const reshow = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', reshow);
    window.addEventListener('focus', reshow);
    return () => {
      stop = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', reshow);
      window.removeEventListener('focus', reshow);
    };
    // À chaque changement de page aussi : un envoi vient souvent d'être programmé, le serveur
    // filtre lui-même les appels trop rapprochés, donc la requête reste anodine.
  }, [path]);

  // Fermer la sidebar et le menu profil lors d'un changement de page
  useEffect(() => {
    setOpen(false);
    setProfileOpen(false);
  }, [path]);

  // Fermer le menu profil quand on clique en dehors
  useEffect(() => {
    if (!profileOpen) return;
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [profileOpen]);

  return (
    <div className={`app${open ? ' is-open' : ''}`}>
      {/* 1. Header supérieur pleine largeur (style Payfit) */}
      <header className="app-topbar">
        <div className="topbar-left">
          <button
            type="button"
            className="topbar-menu-btn"
            onClick={() => setOpen(!open)}
            aria-label="Ouvrir le menu"
            aria-expanded={open}
          >
            <Icon name="menu" size={22} />
          </button>
          <Link href="/tableau-de-bord" className="topbar-brand" title="FactPay">
            <Logo height={34} />
          </Link>
        </div>

        <div className="topbar-right">
          <div className="topbar-profile-wrap" ref={profileRef}>
            <button
              type="button"
              className="topbar-profile-btn"
              onClick={() => setProfileOpen(!profileOpen)}
              aria-expanded={profileOpen}
              aria-haspopup="menu"
            >
              <span className="topbar-avatar">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={userName} />
                ) : (
                  <span>{userInitials(userName)}</span>
                )}
              </span>
              <div className="topbar-profile-info">
                <span className="topbar-user-name">{userName}</span>
                <span className="topbar-company-name">
                  {companyLogoUrl && (
                    <img src={companyLogoUrl} alt="" className="topbar-company-mini-logo" />
                  )}
                  {companyName}
                </span>
              </div>
              <span className={`topbar-chevron${profileOpen ? ' is-open' : ''}`} aria-hidden="true">
                <Icon name="chevronDown" size={14} />
              </span>
            </button>

            {/* Menu déroulant profil & entreprise */}
            {profileOpen && (
              <div className="topbar-dropdown" role="menu">
                <div className="topbar-dropdown-header">
                  <span className="dropdown-user-name">{userName}</span>
                  <span className="dropdown-email">{email}</span>
                  <div className="dropdown-company-badge">
                    {companyLogoUrl ? (
                      <img src={companyLogoUrl} alt="" className="dropdown-company-logo" />
                    ) : (
                      <span className="dropdown-company-initials">{companyName.slice(0, 2).toUpperCase()}</span>
                    )}
                    <span className="dropdown-company-name">{companyName}</span>
                  </div>
                </div>
                <div className="topbar-dropdown-sep" />
                <Link
                  href="/parametres"
                  className="topbar-dropdown-item"
                  onClick={() => setProfileOpen(false)}
                >
                  <Icon name="settings" size={16} />
                  <span>Paramètres de l'entreprise</span>
                </Link>
                <Link
                  href="/parametres#securite"
                  className="topbar-dropdown-item"
                  onClick={() => setProfileOpen(false)}
                >
                  <Icon name="user" size={16} />
                  <span>Mon compte & Sécurité</span>
                </Link>
                <div className="topbar-dropdown-sep" />
                <form action={logout}>
                  <button type="submit" className="topbar-dropdown-item topbar-dropdown-logout">
                    <Icon name="logout" size={16} />
                    <span>Se déconnecter</span>
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. Barre latérale sous le header (style Payfit, non réductible) */}
      <aside className="sidebar" aria-label="Menu principal">
        {/* Bouton de fermeture mobile */}
        <button
          type="button"
          className="sb-icon-btn sb-close"
          onClick={() => setOpen(false)}
          aria-label="Fermer le menu"
        >
          <Icon name="close" size={20} />
        </button>

        <nav className="sb-scroll" aria-label="Menu principal">
          {/* Section 1 : Les essentiels (exactement comme le screenshot Payfit) */}
          <div className="sb-section">
            <span className="sb-section-title sb-label">Les essentiels</span>
            <div className="sb-group">
              <Link
                href="/tableau-de-bord"
                className={`sb-nav-link${isCurrentPath(path, '/tableau-de-bord') ? ' is-active' : ''}`}
                aria-current={isCurrentPath(path, '/tableau-de-bord') ? 'page' : undefined}
              >
                <span className="sb-link-icon">
                  <Icon name="dashboard" size={18} />
                </span>
                <span className="sb-label">Tableau de bord</span>
              </Link>

              {/* Espaces clés */}
              {WORKSPACES.map((workspace) => {
                const active = isWorkspaceCurrent(path, workspace);
                const pending = actionsInWorkspace(workspace, sidebarCounts);

                return (
                  <Link
                    key={workspace.id}
                    href={workspace.href}
                    className={`sb-nav-link${active ? ' is-active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span className="sb-link-icon">
                      <Icon name={workspace.icon} size={18} />
                    </span>
                    <span className="sb-label">{workspace.label}</span>
                    {pending > 0 && (
                      <span className="sb-badge" aria-label={`${pending} action(s) attendue(s)`}>
                        {pending}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Section 2 : Mon entreprise */}
          <div className="sb-section" style={{ marginTop: 'auto', paddingTop: '16px' }}>
            <span className="sb-section-title sb-label">Mon entreprise</span>
            <div className="sb-group">
              {FOOTER_LINKS.map((link) => {
                const active = isCurrentPath(path, link.href);

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`sb-nav-link sb-nav-link-subtle${active ? ' is-active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span className="sb-link-icon">
                      <Icon name={link.icon} size={17} />
                    </span>
                    <span className="sb-label">{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
      </aside>

      {/* Rideau sombre sur mobile */}
      {open && <div className="sb-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />}

      {/* Contenu principal */}
      <main>{children}</main>
    </div>
  );
}