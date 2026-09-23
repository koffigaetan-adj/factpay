import Link from 'next/link';
import NavLinks from '@/components/NavLinks';
import { logout } from '@/app/actions';
import { requireCompany } from '@/lib/auth';

// Espace connecté : barre de navigation commune
export default async function EspaceLayout({ children }) {
  const { user, company } = await requireCompany();
  return (
    <>
      <header className="nav">
        <div className="nav-inner">
          <Link href="/tableau-de-bord" className="brand">{company.name}</Link>
          <NavLinks />
          <div className="who">
            <span>{user.email}</span>
            <form action={logout} className="inline"><button className="link">Se déconnecter</button></form>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </>
  );
}
