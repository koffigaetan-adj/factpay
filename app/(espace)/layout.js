import AppShell from '@/components/AppShell';
import { requireCompany } from '@/lib/auth';
import { unreadCount } from '@/lib/notifications';
import { getSidebarCounts } from '@/lib/invoices';

// Espace connecté : barre latérale commune avec arborescence et badges d'actions
export default async function EspaceLayout({ children }) {
  const { user, company } = await requireCompany();
  const [unread, sidebarCounts] = await Promise.all([
    unreadCount(user.id),
    getSidebarCounts(company, user),
  ]);

  return (
    <AppShell companyName={company.name} userName={user.name} email={user.email}
      avatarUrl={user.avatar_key ? `/compte/photo?v=${new Date(user.avatar_updated_at).getTime()}` : null}
      initialUnread={unread}
      sidebarCounts={sidebarCounts}>
      {children}
    </AppShell>
  );
}
