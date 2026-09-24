import { cookies } from 'next/headers';
import AppShell from '@/components/AppShell';
import { requireCompany } from '@/lib/auth';

// Espace connecté : barre latérale commune (réduite ou non selon le dernier choix, gardé dans un cookie)
export default async function EspaceLayout({ children }) {
  const { user, company } = await requireCompany();
  const collapsed = (await cookies()).get('sidebar')?.value === 'collapsed';
  return (
    <AppShell companyName={company.name} userName={user.name} email={user.email} initialCollapsed={collapsed}
      avatarUrl={user.avatar_key ? `/compte/photo?v=${new Date(user.avatar_updated_at).getTime()}` : null}>
      {children}
    </AppShell>
  );
}
