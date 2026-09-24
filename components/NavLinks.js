'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  ['/tableau-de-bord', 'Tableau de bord'],
  ['/factures', 'Factures'],
  ['/devis', 'Devis'],
  ['/clients', 'Clients'],
  ['/documents', 'Documents'],
  ['/parametres', 'Paramètres'],
];

export default function NavLinks() {
  const path = usePathname();
  return (
    <nav className="nav-links" aria-label="Menu principal">
      {links.map(([href, label]) => (
        <Link key={href} href={href} aria-current={path.startsWith(href) ? 'page' : undefined}>{label}</Link>
      ))}
    </nav>
  );
}
