'use client';

import { useState } from 'react';
import { PASSWORD_RULES } from '@/lib/password';
import Icon from '@/components/Icon';
import SubmitButton from '@/components/SubmitButton';
import { confirmPortalAccountAction } from '@/app/actions';

export default function PortalPasswordSetup({ employee, token, flash }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const ruleResults = PASSWORD_RULES.map((rule) => ({
    label: rule.label,
    passed: rule.test(password),
  }));

  const allPassed = ruleResults.every((r) => r.passed);
  const passwordsMatch = password.length > 0 && password === confirm;
  const canSubmit = allPassed && passwordsMatch;

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
        maxWidth: '520px',
        background: '#FFFFFF',
        borderRadius: '24px',
        border: '1px solid #E2E8F0',
        padding: '36px 32px 40px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)',
      }}>
        {/* En-tête : Logo & Badge */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <img
            src="/logo_factpay_dark.png"
            alt="FactPay"
            height={36}
            style={{ height: '36px', width: 'auto', display: 'block', margin: '0 auto 14px' }}
          />
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'color-mix(in srgb, var(--brand, #2B4C7E) 10%, transparent)',
            color: 'var(--brand, #2B4C7E)',
            fontSize: '12px',
            fontWeight: 700,
            padding: '3px 12px',
            borderRadius: '999px',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}>
            <Icon name="check" size={13} />
            Activation de votre espace salarié
          </div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h1 style={{
            fontSize: '22px',
            fontWeight: 800,
            color: '#0F172A',
            letterSpacing: '-0.02em',
            margin: '0 0 8px',
          }}>
            Définissez votre mot de passe
          </h1>
          <p style={{
            fontSize: '14px',
            color: '#64748B',
            lineHeight: 1.5,
            margin: 0,
          }}>
            Bonjour <strong>{employee?.first_name} {employee?.last_name}</strong>,{' '}
            <strong>{employee?.company_name}</strong> vous invite à activer votre espace sécurisé pour consulter vos bulletins de paie et poser vos congés.
          </p>
        </div>

        {flash}

        {/* Récapitulatif collaborateur */}
        <div style={{
          background: '#F8FAFC',
          borderRadius: '12px',
          border: '1px solid #F1F5F9',
          padding: '12px 16px',
          marginBottom: '24px',
          fontSize: '13px',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '8px',
        }}>
          <div>
            <span style={{ color: '#94A3B8', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Salarié</span>
            <strong style={{ color: '#1E293B' }}>{employee?.first_name} {employee?.last_name}</strong>
          </div>
          <div>
            <span style={{ color: '#94A3B8', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Entreprise</span>
            <strong style={{ color: '#1E293B' }}>{employee?.company_name}</strong>
          </div>
          {(employee?.email || employee?.phone) && (
            <div style={{ gridColumn: 'span 2', borderTop: '1px solid #E2E8F0', paddingTop: '6px', marginTop: '2px' }}>
              <span style={{ color: '#94A3B8', display: 'block', fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>Identifiant</span>
              <span style={{ color: '#475569', fontWeight: 500 }}>{employee.email || employee.phone}</span>
            </div>
          )}
        </div>

        {/* Formulaire de mot de passe */}
        <form action={confirmPortalAccountAction} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <input type="hidden" name="token" value={token} />

          <div>
            <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 650, color: '#334155', marginBottom: '6px' }}>
              Créer votre mot de passe personnel
            </label>
            <div style={{ position: 'relative' }}>
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                style={{
                  width: '100%',
                  padding: '11px 42px 11px 14px',
                  borderRadius: '10px',
                  border: '1px solid #CBD5E1',
                  fontSize: '15px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  background: '#FFFFFF',
                  color: '#0F172A',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748B',
                  padding: '4px',
                  display: 'grid',
                  placeItems: 'center',
                }}
                tabIndex={-1}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                <Icon name={showPassword ? 'close' : 'check'} size={16} />
              </button>
            </div>
          </div>

          {/* Liste des règles du mot de passe */}
          <div style={{
            background: '#F8FAFC',
            borderRadius: '10px',
            border: '1px solid #F1F5F9',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}>
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Exigences de sécurité :
            </span>
            {ruleResults.map((r, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12.5px',
                color: r.passed ? '#059669' : '#64748B',
                fontWeight: r.passed ? 600 : 400,
                transition: 'all 0.15s ease',
              }}>
                <div style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  background: r.passed ? '#059669' : '#CBD5E1',
                  color: '#FFFFFF',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '10px',
                  flexShrink: 0,
                }}>
                  {r.passed ? '✓' : '•'}
                </div>
                <span>{r.label}</span>
              </div>
            ))}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13.5px', fontWeight: 650, color: '#334155', marginBottom: '6px' }}>
              Confirmer le mot de passe
            </label>
            <div style={{ position: 'relative' }}>
              <input
                name="confirm"
                type={showConfirm ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••••••"
                style={{
                  width: '100%',
                  padding: '11px 42px 11px 14px',
                  borderRadius: '10px',
                  border: `1px solid ${confirm ? (passwordsMatch ? '#10B981' : '#EF4444') : '#CBD5E1'}`,
                  fontSize: '15px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  background: '#FFFFFF',
                  color: '#0F172A',
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748B',
                  padding: '4px',
                  display: 'grid',
                  placeItems: 'center',
                }}
                tabIndex={-1}
                aria-label={showConfirm ? 'Masquer' : 'Afficher'}
              >
                <Icon name={showConfirm ? 'close' : 'check'} size={16} />
              </button>
            </div>
            {confirm && !passwordsMatch && (
              <span style={{ fontSize: '12px', color: '#EF4444', marginTop: '4px', display: 'block' }}>
                Les deux mots de passe ne correspondent pas.
              </span>
            )}
            {passwordsMatch && (
              <span style={{ fontSize: '12px', color: '#059669', marginTop: '4px', display: 'block', fontWeight: 600 }}>
                ✓ Les mots de passe correspondent
              </span>
            )}
          </div>

          <SubmitButton
            disabled={!canSubmit}
            pendingText="Enregistrement..."
            style={{
              marginTop: '8px',
              padding: '12px 20px',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '14.5px',
              width: '100%',
              justifyContent: 'center',
            }}
          >
            Activer mon espace collaborateur
          </SubmitButton>
        </form>

        <p style={{
          fontSize: '12px',
          color: '#94A3B8',
          textAlign: 'center',
          marginTop: '24px',
          lineHeight: 1.5,
          marginBottom: 0,
        }}>
          Vos bulletins de paie et informations professionnelles sont strictement confidentiels et chiffrés.
        </p>
      </div>
    </div>
  );
}
