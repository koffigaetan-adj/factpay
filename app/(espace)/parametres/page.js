import Flash from '@/components/Flash';
import CompanyFields from '@/components/CompanyFields';
import { saveCompany, changePassword } from '@/app/actions';
import { requireCompany } from '@/lib/auth';

export const metadata = { title: 'Paramètres' };

export default async function Page({ searchParams }) {
  const { user, company } = await requireCompany();
  return (
    <>
      <div className="page-head"><h1>Paramètres</h1></div>
      <Flash searchParams={searchParams} />
      <div className="grid2">
        <form action={saveCompany} className="card stack">
          <input type="hidden" name="from" value="parametres" />
          <CompanyFields c={company} />
          <p className="help">Les factures déjà émises gardent leur devise. Les changements s'appliquent aux prochaines factures.</p>
          <div><button>Enregistrer</button></div>
        </form>
        <section>
          <h2>Mon compte</h2>
          <p className="muted">{user.name}, {user.email}</p>
          <form action={changePassword} className="stack">
            <label>Mot de passe actuel<input name="current" type="password" required autoComplete="current-password" /></label>
            <label>Nouveau mot de passe <span className="help">8 caractères minimum</span>
              <input name="password" type="password" required minLength={8} autoComplete="new-password" />
            </label>
            <div><button>Changer le mot de passe</button></div>
          </form>
        </section>
      </div>
    </>
  );
}
