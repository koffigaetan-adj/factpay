'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from '@/components/Logo';
import { logout } from '@/app/actions';

// Icônes au trait (24 × 24), dessinées dans la couleur du texte
const PATHS = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  invoice: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h4" /></>,
  quote: <><path d="M9 4H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" /><rect x="9" y="2.5" width="6" height="3.5" rx="1" /><path d="M9 14l2 2 4-4" /></>,
  clients: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" /></>,
  documents: <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></>,
  chevron: <path d="M15 6l-6 6 6 6" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  user: <><circle cx="12" cy="8.5" r="4" /><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" /></>,
  whatsapp: <><path d="M3.5 20.5l1.3-4.2A8.5 8.5 0 1 1 8 19.4z" /><path d="M9 8.5c0 3.3 3.2 6.5 6.5 6.5l1.2-1.5-2-1-1 .9a5 5 0 0 1-3.1-3.1l.9-1-1-2z" /></>,
  report: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
};

export function Icon({ name, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}

// Menu : « Activité » en haut, « Gestion » en bas, juste au-dessus du profil
const ACTIVITY = [
  ['/tableau-de-bord', 'Tableau de bord', 'dashboard'],
  ['/factures', 'Factures', 'invoice'],
  ['/devis', 'Devis', 'quote'],
  ['/rapports', 'Rapports', 'report'],
];
const MANAGEMENT = [
  ['/clients', 'Clients', 'clients'],
  ['/documents', 'Documents', 'documents'],
  ['/parametres', 'Paramètres', 'settings'],
];

// Espace connecté : barre latérale à gauche, réductible aux seules icônes (choix mémorisé dans un cookie),
// et menu coulissant sur téléphone.
export default function AppShell({ companyName, userName, email, avatarUrl = null, initialCollapsed = false, children }) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [open, setOpen] = useState(false);

  // Sur téléphone, le menu se referme quand on change de page
  useEffect(() => { setOpen(false); }, [path]);

  const links = (list) => list.map(([href, label, icon]) => (
    <Link key={href} href={href} aria-current={path.startsWith(href) ? 'page' : undefined} title={collapsed ? label : undefined}>
      <Icon name={icon} /><span className="sb-label">{label}</span>
    </Link>
  ));

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `sidebar=${next ? 'collapsed' : 'open'}; path=/; max-age=31536000; samesite=lax`;
  };

  return (
    <div className={`app${collapsed ? ' is-collapsed' : ''}${open ? ' is-open' : ''}`}>
      <div className="mobile-bar">
        <button type="button" className="sb-icon-btn" onClick={() => setOpen(true)} aria-label="Ouvrir le menu" aria-expanded={open}>
          <Icon name="menu" size={22} />
        </button>
        <Link href="/tableau-de-bord" className="mobile-brand"><Logo onDark height={28} /><span>{companyName}</span></Link>
      </div>

      <aside className="sidebar" aria-label="Menu principal">
        {/* Réduire / agrandir : bouton rond posé sur le bord de la barre */}
        <button type="button" className="sb-edge" onClick={toggle} aria-expanded={!collapsed}
          aria-label={collapsed ? 'Agrandir le menu' : 'Réduire le menu'} title={collapsed ? 'Agrandir le menu' : 'Réduire le menu'}>
          <Icon name="chevron" size={16} />
        </button>

        <div className="sb-top">
          <Link href="/tableau-de-bord" className="sb-brand" title={companyName}>
            <Logo height={30} />
            <span className="sb-brand-divider sb-label" aria-hidden="true"></span>
            <span className="sb-label sb-company">{companyName}</span>
          </Link>
          <button type="button" className="sb-icon-btn sb-close" onClick={() => setOpen(false)} aria-label="Fermer le menu">
            <Icon name="close" />
          </button>
        </div>

        <Link href="/factures/nouvelle" className="sb-new" title="Nouvelle facture">
          <Icon name="plus" /><span className="sb-label">Nouvelle facture</span>
        </Link>

        <nav className="sb-nav" aria-label="Activité">
          <span className="sb-group-label sb-label">Activité</span>
          {links(ACTIVITY)}
        </nav>

        <nav className="sb-nav sb-manage" aria-label="Gestion">
          <span className="sb-group-label sb-label">Gestion</span>
          {links(MANAGEMENT)}
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
      <main>{children}</main>
    </div>
  );
}
