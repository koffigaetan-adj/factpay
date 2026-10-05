import AppShell from '@/components/AppShell';
import { requireCompany } from '@/lib/auth';
import { unreadCount } from '@/lib/notifications';
import { getSidebarCounts, opportunisticScheduledCheck } from '@/lib/invoices';
import { getRhNavCounts } from '@/lib/employees';
import { logoUrl } from '@/lib/url';

// Espace connecté : barre latérale commune avec arborescence et badges d'actions
export default async function EspaceLayout({ children }) {
  const { user, company } = await requireCompany();
  // Traitement automatique en tâche de fond des factures échues
  opportunisticScheduledCheck().catch(() => {});
  const [unread, invoiceCounts, rhCounts] = await Promise.all([
    unreadCount(user.id),
    getSidebarCounts(company, user),
    getRhNavCounts(company.id),
  ]);

  return (
    <AppShell
      companyName={company.name}
      companyLogoUrl={logoUrl(company)}
      userName={user.name}
      email={user.email}
      avatarUrl={user.avatar_key ? `/compte/photo?v=${new Date(user.avatar_updated_at).getTime()}` : null}
      initialUnread={unread}
      sidebarCounts={{ ...invoiceCounts, ...rhCounts }}
    >
      {children}
    </AppShell>
  );
}
