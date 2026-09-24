'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from '@/components/Logo';
import Icon from '@/components/Icon';
import { logout } from '@/app/actions';



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
    <Link key={href} href={href} aria-current={path.startsWith(href) ? 'page' : undefined}>
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
          aria-label={collapsed ? 'Agrandir le menu' : 'Réduire le menu'}>
          <Icon name="chevron" size={16} />
        </button>

        <div className="sb-top">
          <Link href="/tableau-de-bord" className="sb-brand">
            <Logo height={30} />
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
