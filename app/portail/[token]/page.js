import { notFound } from 'next/navigation';
import { getEmployeeByPortalToken, getEmployeePortalData, touchPortalAccess, portalIsExpired, portalViewOf, TOKEN_DAYS } from '@/lib/portal';
import PortalView from '@/components/PortalView';
import PortalPasswordSetup from '@/components/PortalPasswordSetup';
import Flash from '@/components/Flash';

// Le portail contient le salaire net, le N° CNSS et les coordonnées de paiement du salarié :
// il ne doit jamais entrer dans un index de recherche, ni être suivi par un robot.
export const metadata = {
  title: 'Espace Collaborateur · FactPay RH',
  description: 'Portail salarié : bulletins de paie, congés, acomptes, notes de frais et organigramme',
  robots: { index: false, follow: false, nocache: true },
};

// Une page par salarié : aucune donnée ne doit être conservée par un cache partagé.
export const dynamic = 'force-dynamic';

export default async function EmployeePortalPage({ params, searchParams }) {
  const { token } = await params;
  if (!token) notFound();

  const sp = await searchParams;
  const expired = sp?.expire === '1' || (await portalIsExpired(token));

  const employee = expired ? null : await getEmployeeByPortalToken(token);
  if (!employee) {
    return (
      <div style={{ maxWidth: '480px', margin: '80px auto', padding: '32px', textAlign: 'center' }} className="card">
        <h1 style={{ fontSize: '20px', color: 'var(--brand-text)', marginBottom: '12px' }}>
          {expired ? 'Lien d\'accès expiré' : 'Accès introuvable'}
        </h1>
        <p style={{ color: 'var(--sub)', fontSize: '14px', lineHeight: 1.6 }}>
          {expired
            ? 'Pour votre sécurité, les liens d\'accès au portail collaborateur sont renouvés régulièrement. Demandez-en un nouveau à votre service RH : il vous en enverra un neuf.'
            : 'Ce lien d\'accès au portail collaborateur est invalide ou a été coupé. Veuillez contacter votre service des Ressources Humaines.'}
        </p>
      </div>
    );
  }

  // Étape obligatoire : le salarié doit définir son mot de passe pour activer son espace collaborateur
  const needsPasswordSetup = !employee.portal_confirmed_at || !employee.portal_password_hash;
  if (needsPasswordSetup) {
    return (
      <PortalPasswordSetup
        employee={portalViewOf(employee)}
        token={token}
        flash={<Flash searchParams={searchParams} />}
      />
    );
  }

  await touchPortalAccess(employee);
  const data = await getEmployeePortalData(employee);

  return (
    <PortalView
      data={data}
      token={token}
      expired={expired}
      tokenDays={TOKEN_DAYS}
      flash={<Flash searchParams={searchParams} />}
    />
  );
}