import AppShell from '@/components/AppShell';
import { requireCompany } from '@/lib/auth';
import { unreadCount } from '@/lib/notifications';
import { getSidebarCounts } from '@/lib/invoices';
import { getRhNavCounts } from '@/lib/employees';
import { logoUrl } from '@/lib/url';
import { mailTestMode } from '@/lib/mail';

// Espace connecté : barre latérale commune avec arborescence et badges d'actions
export default async function EspaceLayout({ children }) {
  const { user, company } = await requireCompany();
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
      {/* Sans SMTP_USER / SMTP_PASS les e-mails ne partent pas, mais les factures sont marquées
          « envoyées ». Il faut le dire à l'écran : c'est le réglage le plus souvent oublié en ligne. */}
      {mailTestMode() && (
        <p className="flash err" role="alert">
          Mode test : les e-mails ne sont pas envoyés (SMTP_USER et SMTP_PASS absents des variables
          du projet). Les factures programmées partiront en mode test, puis donneront l&apos;impression
          d&apos;avoir été envoyées. Renseigne ces deux variables dans Vercel → Settings → Environment
          Variables, puis redéploie.
        </p>
      )}
      {children}
    </AppShell>
  );
}
