'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '@/components/Icon';
import { WORKSPACES, SIDEBAR_SECTIONS, isCurrentPath } from '@/lib/nav';

/**
 * La colonne de navigation qu'on trouve à gauche d'une page.
 *
 * Elle se lit dans `lib/nav.js`, le même fichier que la barre latérale : les libellés, les icônes
 * et les compteurs ne sont donc écrits qu'une fois. Avant, chaque page avait sa propre copie
 * (« Bulletins de paie », « Fiches de paie », « Ressources Humaines »…) et le même module
 * changeait de nom selon la page où l'on se trouvait.
 *
 * La barre latérale ne liste que les espaces ; c'est ici que le détail de leurs pages est donné.
 * Un espace qui n'a qu'une page n'affiche pas de colonne : la barre suffit.
 */
export default function ModuleLayout({
  workspaceId,
  title,
  subtitle,
  actions,
  counts = {},
  children,
}) {
  const pathname = usePathname();
  const workspace = WORKSPACES.find((candidate) => candidate.id === workspaceId);
  const sections = workspace
    ? workspace.sectionIds
        .map((id) => SIDEBAR_SECTIONS.find((section) => section.id === id))
        .filter(Boolean)
    : [];

  return (
    <div className="inpage-layout">
      <aside className="inpage-sidebar" aria-label={`Navigation ${workspace?.label || ''}`}>
        <nav className="inpage-nav">
          {sections.map((section) => (
            <div key={section.id} className="inpage-nav-group">
              <div className="inpage-section-title">{section.title}</div>
              {section.items.map((item) => {
                const active = isCurrentPath(pathname, item.href);
                const count = item.count ? Number(counts[item.count]) || 0 : 0;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inpage-nav-link${active ? ' is-active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span className="inpage-link-icon">
                      <Icon name={item.icon} size={18} />
                    </span>
                    <span className="inpage-link-label">{item.label}</span>
                    {count > 0 && (
                      <span
                        className={`inpage-badge ${item.tone === 'action' ? 'warning' : 'muted'}`}
                        title={`${count} ${item.hint}`}
                      >
                        {count}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      <div className="inpage-content">
        {(title || actions) && (
          <div className="page-head inpage-head">
            <div>
              {title && <h1>{title}</h1>}
              {subtitle && <p className="hint" style={{ margin: '6px 0 0' }}>{subtitle}</p>}
            </div>
            {actions && <div className="actions">{actions}</div>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}