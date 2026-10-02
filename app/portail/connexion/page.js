import Link from 'next/link';
import Flash from '@/components/Flash';
import SubmitButton from '@/components/SubmitButton';
import PasswordInput from '@/components/PasswordInput';
import { loginPortalEmployeeAction } from '@/app/actions';

export const metadata = {
  title: 'Connexion Espace Collaborateur · FactPay',
  description: 'Connectez-vous à votre portail salarié FactPay pour consulter vos fiches de paie et congés.',
  robots: { index: false, follow: false, nocache: true },
};

export default async function Page({ searchParams }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#F8FAFC',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '32px 16px 48px',
      fontFamily: 'var(--font-sans, -apple-system, sans-serif)',
      color: '#0F172A',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '460px',
        background: '#FFFFFF',
        borderRadius: '24px',
        border: '1px solid #E2E8F0',
        padding: '36px 32px 40px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <Link href="/">
            <img
              src="/logo_factpay_dark.png"
              alt="FactPay"
              height={36}
              style={{ height: '36px', width: 'auto', display: 'block', margin: '0 auto 14px' }}
            />
          </Link>
          <span style={{
            display: 'inline-block',
            background: 'color-mix(in srgb, var(--brand, #2B4C7E) 10%, transparent)',
            color: 'var(--brand, #2B4C7E)',
            fontSize: '11px',
            fontWeight: 700,
            padding: '3px 10px',
            borderRadius: '999px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            Espace Collaborateur Salarié
          </span>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
            Connexion au portail RH
          </h1>
          <p style={{ fontSize: '13.5px', color: '#64748B', margin: 0 }}>
            Accédez à vos bulletins de paie, vos congés et vos documents.
          </p>
        </div>

        <Flash searchParams={searchParams} />

        <form action={loginPortalEmployeeAction} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 650, color: '#334155' }}>
            Adresse e-mail ou téléphone
            <input
              name="identifier"
              type="text"
              required
              autoFocus
              placeholder="ex: koffi.adj@entreprise.com"
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: '10px',
                border: '1px solid #CBD5E1',
                fontSize: '14.5px',
                marginTop: '6px',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
          </label>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 650, color: '#334155', marginBottom: '6px' }}>
              Mot de passe
            </label>
            <PasswordInput />
          </div>

          <SubmitButton
            pendingText="Connexion..."
            style={{
              marginTop: '6px',
              padding: '12px 20px',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '14.5px',
              width: '100%',
              justifyContent: 'center',
            }}
          >
            Se connecter
          </SubmitButton>
        </form>

        <p style={{ fontSize: '12.5px', color: '#94A3B8', textAlign: 'center', marginTop: '24px', lineHeight: 1.5, marginBottom: 0 }}>
          Première visite ? Utilisez le lien d'invitation envoyé par votre employeur pour activer votre espace.
        </p>
      </div>

      <div style={{ marginTop: '20px', fontSize: '13px', color: '#64748B' }}>
        Vous êtes employeur ou freelance ? <Link href="/connexion" style={{ color: 'var(--brand)', fontWeight: 600 }}>Connexion entreprise</Link>
      </div>
    </div>
  );
}
