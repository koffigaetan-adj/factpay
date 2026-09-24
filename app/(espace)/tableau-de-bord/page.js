import Flash from '@/components/Flash';
import Dashboard from '@/components/Dashboard';
import { requireCompany } from '@/lib/auth';
import { listInvoices } from '@/lib/invoices';
import { q } from '@/lib/db';
import { listDocuments, expiryState } from '@/lib/documents';

export const metadata = { title: 'Tableau de bord' };

export default async function Page({ searchParams }) {
  const { user, company } = await requireCompany();
  const [invoices, quotes, clients, docs] = await Promise.all([
    listInvoices(company.id),
    listInvoices(company.id, 'devis'),
    q('SELECT count(*)::int AS n FROM clients WHERE company_id = $1', [company.id]),
    listDocuments(company.id),
  ]);
  return <Dashboard user={user} company={company} invoices={invoices} quotes={quotes} expiring={docs.filter((d) => expiryState(d))} clientCount={clients[0].n} flash={<Flash searchParams={searchParams} />} />;
}
