import { redirect } from 'next/navigation';
import Flash from '@/components/Flash';
import CompanyFields from '@/components/CompanyFields';
import { saveCompany } from '@/app/actions';
import { requireUser } from '@/lib/auth';
import { one } from '@/lib/db';

export const metadata = { title: 'Bienvenue' };

// Juste après l'inscription : on demande les informations qui figurent sur les factures.
export default async function Page({ searchParams }) {
  const user = await requireUser();
  if (await one('SELECT id FROM companies WHERE owner_id = $1', [user.id])) redirect('/tableau-de-bord');
  return (
    <main className="narrow">
      <div className="page-head">
        <div>
          <h1>Bienvenue, {user.name}</h1>
          <p className="hint" style={{ marginTop: 8 }}>Ces informations apparaîtront sur tes factures. Seul le nom est obligatoire, tu pourras tout modifier plus tard dans les paramètres.</p>
        </div>
      </div>
      <Flash searchParams={searchParams} />
      <form action={saveCompany} className="card stack">
        <CompanyFields c={{ email: user.email }} />
        <div><button>Terminer</button></div>
      </form>
    </main>
  );
}
