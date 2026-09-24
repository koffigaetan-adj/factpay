import Link from 'next/link';
import Logo from '@/components/Logo';
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
          <Link href="/tableau-de-bord" className="brand"><Logo onDark height={30} /><span>{company.name}</span></Link>
          <NavLinks />
          <div className="who">
            <span className="email" title={user.email}>{user.email}</span>
            <form action={logout} className="inline">
              <button className="logout">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" />
                </svg>
                Se déconnecter
              </button>
            </form>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </>
  );
}
