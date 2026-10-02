'use client';

import { useState } from 'react';
import Link from 'next/link';
import { money } from '@/lib/money';
import { MONTHS, LEAVE_TYPES, EXPENSE_CATEGORIES, PAYMENT_METHODS } from '@/lib/rh-constants';
import { frDate } from '@/lib/dates';
import { getWorkCertificateText } from '@/lib/certificates';
import Icon from '@/components/Icon';
import Logo from '@/components/Logo';
import OrgChartView from '@/components/OrgChartView';
import { portalLeaveRequestAction, portalAdvanceRequestAction, portalExpenseReportAction, changePortalPasswordAction } from '@/app/actions';

function getInitials(first, last) {
  const f = (first || '').trim()[0] || '';
  const l = (last || '').trim()[0] || '';
  return (f + l).toUpperCase() || 'CO';
}

function getFormattedDate() {
  const now = new Date();
  try {
    const str = now.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return str.charAt(0).toUpperCase() + str.slice(1);
  } catch {
    return 'Aujourd\'hui';
  }
}

export default function PortalView({ data, token, flash, expired = false, tokenDays = 90 }) {
  const { employee, payslips = [], leaves = [], advances = [], expenses = [], orgChart = {}, announcements = [] } = data;
  const [activeTab, setActiveTab] = useState('accueil');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const cur = employee?.currency || 'XOF';
  const initials = getInitials(employee?.first_name, employee?.last_name);
  const formattedDate = getFormattedDate();
  const latestPayslip = payslips.length > 0 ? payslips[0] : null;

  // Attestation de travail certifiée
  const cert = getWorkCertificateText(
    { name: employee?.company_name, address: employee?.company_address, legal_ids: employee?.company_legal_ids },
    employee,
  );

  const navItems = [
    {
      group: 'Les essentiels',
      items: [
        { key: 'accueil', label: 'Tableau de bord', icon: 'dashboard', color: '#E11D48' },
        { key: 'bulletins', label: 'Bulletins de paie', icon: 'payslip', badge: payslips.length, color: '#2563EB' },
      ],
    },
    {
      group: 'Au quotidien',
      items: [
        { key: 'conges', label: 'Absences', icon: 'calendar', badge: `${employee?.leave_balance || 0}j`, color: '#059669' },
        { key: 'acomptes', label: 'Acomptes sur salaire', icon: 'cash', badge: advances.length || undefined, color: '#D97706' },
        { key: 'frais', label: 'Notes de frais', icon: 'file', badge: expenses.length || undefined, color: '#7C3AED' },
      ],
    },
    {
      group: 'Mon entreprise',
      items: [
        { key: 'documents', label: 'Documents', icon: 'documents', color: '#0284C7' },
        { key: 'equipe', label: 'Équipe & Organigramme', icon: 'people', color: '#4F46E5' },
        { key: 'profil', label: 'Mon profil & Contrat', icon: 'user', color: '#475569' },
      ],
    },
  ];

  return (
    <div className="payfit-portal-root" style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', color: '#1E293B', fontFamily: 'var(--font-sans, -apple-system, sans-serif)' }}>
      {/* 1. BARRE LATÉRALE (SIDEBAR PAYFIT) */}
      <aside
        className={`payfit-portal-sidebar ${mobileMenuOpen ? 'is-open' : ''}`}
        style={{
          width: '260px',
          background: '#FFFFFF',
          borderRight: '1px solid #E2E8F0',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 50,
          transition: 'transform 0.25s ease',
        }}
      >
        {/* Logo FactPay Salarié */}
        <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img
              src="/logo_factpay_dark.png"
              alt="FactPay"
              height={28}
              style={{ height: '28px', width: 'auto', display: 'block' }}
            />
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '999px',
              background: 'color-mix(in srgb, var(--brand, #2B4C7E) 10%, transparent)',
              color: 'var(--brand, #2B4C7E)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              Salarié
            </span>
          </div>

          <button
            type="button"
            className="mobile-close-btn"
            onClick={() => setMobileMenuOpen(false)}
            style={{ display: 'none', background: 'none', border: 'none', padding: '6px', cursor: 'pointer', color: '#64748B' }}
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        {/* Navigation Groupée PayFit */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '20px 14px' }}>
          {navItems.map((group, gIdx) => (
            <div key={gIdx} style={{ marginBottom: '24px' }}>
              <div style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                color: '#94A3B8',
                padding: '0 10px 10px',
              }}>
                {group.group}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {group.items.map((item) => {
                  const isActive = activeTab === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.key);
                        setMobileMenuOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '12px',
                        border: isActive ? '1px solid #E2E8F0' : '1px solid transparent',
                        background: isActive ? '#FFFFFF' : 'transparent',
                        boxShadow: isActive ? '0 2px 6px rgba(0,0,0,0.04)' : 'none',
                        color: isActive ? '#0F172A' : '#475569',
                        fontWeight: isActive ? 650 : 500,
                        fontSize: '14px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.background = '#F8FAFC';
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          display: 'grid',
                          placeItems: 'center',
                          background: isActive ? `color-mix(in srgb, ${item.color} 14%, transparent)` : 'transparent',
                          color: isActive ? item.color : '#64748B',
                          transition: 'all 0.15s ease',
                        }}>
                          <Icon name={item.icon} size={17} />
                        </div>
                        <span>{item.label}</span>
                      </div>

                      {item.badge !== undefined && (
                        <span style={{
                          fontSize: '11.5px',
                          fontWeight: 700,
                          padding: '1px 7px',
                          borderRadius: '10px',
                          background: isActive ? 'color-mix(in srgb, var(--brand, #2B4C7E) 12%, transparent)' : '#F1F5F9',
                          color: isActive ? 'var(--brand, #2B4C7E)' : '#64748B',
                        }}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Pied de sidebar : Sécurité & Entreprise */}
        <div style={{ padding: '16px 18px', borderTop: '1px solid #F1F5F9', background: '#FAFAFA' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: expired ? '#D97706' : '#10B981',
              boxShadow: expired ? '0 0 0 3px rgba(217, 119, 6, 0.15)' : '0 0 0 3px rgba(16, 185, 129, 0.15)',
            }} />
            <div style={{ fontSize: '12px', color: '#64748B', lineHeight: 1.3 }}>
              <div style={{ fontWeight: 600, color: '#334155' }}>{expired ? 'Lien expiré' : 'Espace connecté'}</div>
              <div style={{ fontSize: '11px' }}>{employee?.company_name}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* 2. ZONE PRINCIPALE (HEADER + CANEVAS BLANC PAYFIT) */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* BARRE SUPÉRIEURE (TOPBAR PAYFIT) */}
        <header style={{
          height: '64px',
          background: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 32px',
          position: 'sticky',
          top: 0,
          zIndex: 40,
        }}>
          {/* Côté gauche : Burger mobile & Contexte */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              className="payfit-mobile-burger"
              onClick={() => setMobileMenuOpen(true)}
              style={{ display: 'none', background: 'none', border: 'none', padding: '6px', cursor: 'pointer', color: '#0F172A' }}
              aria-label="Ouvrir le menu"
            >
              <Icon name="menu" size={22} />
            </button>
            <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 500 }}>
              Espace Collaborateur · <strong>{employee?.company_name}</strong>
            </span>
          </div>

          {/* Côté droit : Aide (?) & Pilule Profil PayFit */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* Bouton d'aide (?) soigné */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setHelpOpen(!helpOpen)}
                title="Aide et assistance RH"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  border: '1px solid #E2E8F0',
                  background: helpOpen ? '#F1F5F9' : '#FFFFFF',
                  color: helpOpen ? '#0F172A' : '#64748B',
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.color = '#0F172A'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = helpOpen ? '#F1F5F9' : '#FFFFFF'; e.currentTarget.style.color = helpOpen ? '#0F172A' : '#64748B'; }}
              >
                <Icon name="help" size={18} />
              </button>

              {helpOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '10px',
                  width: '300px',
                  background: '#FFFFFF',
                  borderRadius: '16px',
                  boxShadow: '0 12px 30px rgba(0,0,0,0.12), 0 4px 10px rgba(0,0,0,0.06)',
                  border: '1px solid #E2E8F0',
                  padding: '18px',
                  zIndex: 100,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <strong style={{ fontSize: '14px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Icon name="help" size={16} /> Assistance RH
                    </strong>
                    <button type="button" onClick={() => setHelpOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '2px' }}>
                      <Icon name="close" size={14} />
                    </button>
                  </div>
                  <p style={{ margin: '0 0 10px', fontSize: '12.5px', color: '#64748B', lineHeight: 1.5 }}>
                    Pour toute question sur vos fiches de paie ou vos congés, contactez votre service RH :
                  </p>
                  <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: '8px', fontSize: '12.5px', color: '#334155', border: '1px solid #F1F5F9' }}>
                    <div>Entreprise : <strong>{employee?.company_name}</strong></div>
                    {employee?.company_email && <div style={{ marginTop: '3px' }}>E-mail : <strong>{employee.company_email}</strong></div>}
                    {employee?.company_phone && <div style={{ marginTop: '3px' }}>Tél : <strong>{employee.company_phone}</strong></div>}
                  </div>
                </div>
              )}
            </div>

            {/* Pilule Salarié (identique à la capture PayFit) */}
            <div style={{ position: 'relative' }}>
              <div
                onClick={() => setShowProfileModal(!showProfileModal)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: 'pointer',
                  padding: '4px 10px 4px 4px',
                  borderRadius: '24px',
                  border: '1px solid transparent',
                  transition: 'all 0.15s ease',
                  background: showProfileModal ? '#F8FAFC' : 'transparent',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#F8FAFC'; }}
                onMouseLeave={(e) => { if (!showProfileModal) e.currentTarget.style.background = 'transparent'; }}
              >
                {/* Avatar rond avec initiales (ex: KA) */}
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: '#F1F5F9',
                  color: '#1E293B',
                  border: '1px solid #CBD5E1',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: '13px',
                  fontWeight: 750,
                  letterSpacing: '-0.02em',
                  flexShrink: 0,
                }}>
                  {initials}
                </div>

                {/* Nom & Entreprise */}
                <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', lineHeight: 1.25 }}>
                  <span style={{ fontSize: '13.5px', fontWeight: 650, color: '#0F172A' }}>
                    {employee?.first_name} {employee?.last_name}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {employee?.company_name}
                  </span>
                </div>

                <div style={{ color: '#94A3B8', display: 'grid', placeItems: 'center', marginLeft: '2px' }}>
                  <Icon name="chevronDown" size={14} />
                </div>
              </div>

              {/* Menu Profil Déroulant avec icônes par ligne */}
              {showProfileModal && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '10px',
                  width: '260px',
                  background: '#FFFFFF',
                  borderRadius: '16px',
                  boxShadow: '0 12px 30px rgba(0, 0, 0, 0.12), 0 4px 10px rgba(0, 0, 0, 0.06)',
                  border: '1px solid #E2E8F0',
                  padding: '8px',
                  zIndex: 100,
                }}>
                  <div style={{ padding: '8px 12px 10px', borderBottom: '1px solid #F1F5F9', marginBottom: '6px' }}>
                    <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#0F172A' }}>{employee?.first_name} {employee?.last_name}</div>
                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px', wordBreak: 'break-all' }}>{employee?.email || 'Salarié'}</div>
                  </div>

                  <button
                    type="button"
                    onClick={() => { setActiveTab('profil'); setShowProfileModal(false); }}
                    style={{
                      width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: '8px', border: 'none',
                      background: 'none', fontSize: '13px', cursor: 'pointer', color: '#334155',
                      display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    <div style={{ color: '#64748B', display: 'grid', placeItems: 'center' }}><Icon name="user" size={16} /></div>
                    <span>Mon profil & contrat</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setActiveTab('bulletins'); setShowProfileModal(false); }}
                    style={{
                      width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: '8px', border: 'none',
                      background: 'none', fontSize: '13px', cursor: 'pointer', color: '#334155',
                      display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    <div style={{ color: '#2563EB', display: 'grid', placeItems: 'center' }}><Icon name="payslip" size={16} /></div>
                    <span>Mes bulletins de paie</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setActiveTab('conges'); setShowProfileModal(false); }}
                    style={{
                      width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: '8px', border: 'none',
                      background: 'none', fontSize: '13px', cursor: 'pointer', color: '#334155',
                      display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    <div style={{ color: '#059669', display: 'grid', placeItems: 'center' }}><Icon name="calendar" size={16} /></div>
                    <span>Mes congés & absences</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setActiveTab('documents'); setShowProfileModal(false); }}
                    style={{
                      width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: '8px', border: 'none',
                      background: 'none', fontSize: '13px', cursor: 'pointer', color: '#334155',
                      display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    <div style={{ color: '#7C3AED', display: 'grid', placeItems: 'center' }}><Icon name="file" size={16} /></div>
                    <span>Mon attestation de travail</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setShowPasswordModal(true); setShowProfileModal(false); }}
                    style={{
                      width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: '8px', border: 'none',
                      background: 'none', fontSize: '13px', cursor: 'pointer', color: '#334155',
                      display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    <div style={{ color: '#0F172A', display: 'grid', placeItems: 'center' }}><Icon name="lock" size={16} /></div>
                    <span>Sécurité & mot de passe</span>
                  </button>

                  <div style={{ borderTop: '1px solid #F1F5F9', margin: '4px 0' }} />

                  <Link
                    href="/portail/connexion"
                    style={{
                      width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: '8px', border: 'none',
                      background: 'none', fontSize: '13px', cursor: 'pointer', color: '#DC2626', textDecoration: 'none',
                      display: 'flex', alignItems: 'center', gap: '10px', transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#FEF2F2'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                  >
                    <div style={{ color: '#DC2626', display: 'grid', placeItems: 'center' }}><Icon name="logout" size={16} /></div>
                    <span>Déconnexion</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Overlay fond sombre sur mobile quand menu ouvert */}
        {mobileMenuOpen && (
          <div
            className="payfit-portal-backdrop"
            onClick={() => setMobileMenuOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.45)',
              backdropFilter: 'blur(3px)',
              zIndex: 45,
            }}
          />
        )}

        {/* CANEVAS CENTRAL AVEC COURBURE PAYFIT */}
        <main className="payfit-portal-main" style={{ flex: 1, padding: '24px 32px 48px', overflowY: 'auto' }}>
          {flash}

          {/* Pop-up Aide si ouvert */}
          {helpOpen && (
            <div style={{
              background: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: '14px',
              padding: '16px 20px',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <strong style={{ color: '#1E40AF', fontSize: '14px' }}>Besoin d'aide sur votre espace salarié ?</strong>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#1E3A8A' }}>
                  Vos bulletins sont mis à jour chaque mois par votre employeur ({employee?.company_name}).
                  Pour toute question concernant vos fiches de paie ou vos congés, contactez votre service RH :{' '}
                  <strong>{employee?.company_email || 'votre employeur'}</strong>.
                </p>
              </div>
              <button type="button" onClick={() => setHelpOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1E40AF' }}>
                <Icon name="close" size={16} />
              </button>
            </div>
          )}

          {/* CAS : ESPACE DÉSACTIVÉ OU EXPIRÉ (Rendu exact de la capture PayFit) */}
          {expired ? (
            <div style={{
              background: '#FFFFFF',
              borderRadius: '24px',
              border: '1px solid #E2E8F0',
              padding: '60px 32px',
              textAlign: 'center',
              boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
              maxWidth: '720px',
              margin: '40px auto',
            }}>
              {/* Icône d'utilisateur dans un cercle gris */}
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#F1F5F9',
                color: '#64748B',
                display: 'grid',
                placeItems: 'center',
                margin: '0 auto 20px',
              }}>
                <Icon name="user" size={32} />
              </div>

              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', marginBottom: '10px' }}>
                Votre espace collaborateur a été désactivé
              </h2>

              <p style={{ fontSize: '14px', color: '#64748B', lineHeight: 1.6, maxWidth: '520px', margin: '0 auto 24px' }}>
                Vous pouvez cependant toujours consulter vos bulletins de paie ainsi que l'historique de vos absences, notes de frais et temps de travail.
              </p>

              <div style={{ display: 'inline-flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('bulletins')}
                  className="button secondary"
                >
                  <Icon name="payslip" size={16} />
                  Consulter mes bulletins
                </button>
              </div>
            </div>
          ) : (
            /* CANEVAS ACTIF PAYFIT */
            <div className="payfit-portal-canvas" style={{
              background: '#FFFFFF',
              borderRadius: '24px',
              border: '1px solid #E2E8F0',
              padding: '36px 40px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
              minHeight: 'calc(100vh - 140px)',
            }}>
              {/* EN-TÊTE BONJOUR (Identique à la capture PayFit) */}
              <div style={{ marginBottom: '32px' }}>
                <h1 style={{
                  fontSize: '28px',
                  fontWeight: '800',
                  margin: 0,
                  color: '#0F172A',
                  letterSpacing: '-0.025em',
                }}>
                  Bonjour {employee?.first_name} {employee?.last_name}
                </h1>

                <p style={{ margin: '6px 0 0', fontSize: '14.5px', color: '#64748B', fontWeight: 500 }}>
                  Nous sommes le {formattedDate.toLowerCase()}
                </p>
              </div>

              {/* BANNIÈRE SÉCURITÉ / MOT DE PASSE (si non défini) */}
              {!employee?.has_password && (
                <div style={{
                  background: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  borderRadius: '16px',
                  padding: '16px 20px',
                  marginBottom: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  flexWrap: 'wrap',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#DBEAFE', color: '#2563EB', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <Icon name="lock" size={18} />
                    </div>
                    <div>
                      <strong style={{ fontSize: '14px', color: '#1E40AF', display: 'block' }}>
                        Sécurisez votre espace collaborateur
                      </strong>
                      <span style={{ fontSize: '13px', color: '#3B82F6' }}>
                        Vous pouvez définir un mot de passe personnel pour vous reconnecter plus rapidement sans dépendre du lien.
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(true)}
                    className="button"
                    style={{ fontSize: '13px', padding: '8px 16px', background: '#2563EB', borderColor: '#2563EB' }}
                  >
                    Définir mon mot de passe
                  </button>
                </div>
              )}

              {/* ANNONCE D'ENTREPRISE (si publiée) */}
              {announcements.length > 0 && (
                <div style={{
                  background: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  borderRadius: '14px',
                  padding: '16px 20px',
                  marginBottom: '28px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                }}>
                  <div style={{ color: '#16A34A', marginTop: '2px' }}>
                    <Icon name="bell" size={20} />
                  </div>
                  <div>
                    <strong style={{ fontSize: '14.5px', color: '#166534' }}>{announcements[0].title}</strong>
                    <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: '#15803D' }}>{announcements[0].content}</p>
                  </div>
                </div>
              )}

              {/* ========================================================
                  VUE 1 : TABLEAU DE BORD (DASHBOARD PAYFIT ERGONOMIQUE)
                 ======================================================== */}
              {activeTab === 'accueil' && (
                <div>
                  {/* Grille des 4 widgets d'action immédiate */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: '20px',
                    marginBottom: '36px',
                  }}>
                    {/* Widget 1 : Congés & Absences */}
                    <div style={{
                      background: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '16px',
                      padding: '24px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                      transition: 'all 0.2s ease',
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 650, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Congés payés
                          </span>
                          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ECFDF5', color: '#059669', display: 'grid', placeItems: 'center' }}>
                            <Icon name="calendar" size={18} />
                          </div>
                        </div>

                        <div style={{ fontSize: '30px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                          {employee?.leave_balance || 0} <span style={{ fontSize: '16px', fontWeight: 600, color: '#64748B' }}>jours</span>
                        </div>
                        <span style={{ fontSize: '12.5px', color: '#10B981', fontWeight: 600, marginTop: '4px', display: 'block' }}>
                          Solde disponible
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveTab('conges')}
                        className="button"
                        style={{ marginTop: '20px', width: '100%', justifyContent: 'center' }}
                      >
                        Poser un congé
                      </button>
                    </div>

                    {/* Widget 2 : Dernier bulletin de paie */}
                    <div style={{
                      background: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '16px',
                      padding: '24px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 650, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Dernier bulletin
                          </span>
                          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#EFF6FF', color: '#2563EB', display: 'grid', placeItems: 'center' }}>
                            <Icon name="payslip" size={18} />
                          </div>
                        </div>

                        {latestPayslip ? (
                          <>
                            <div style={{ fontSize: '26px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                              {money(latestPayslip.net_salary, cur)}
                            </div>
                            <span style={{ fontSize: '12.5px', color: '#64748B', marginTop: '4px', display: 'block' }}>
                              {MONTHS[latestPayslip.period_month - 1]} {latestPayslip.period_year} · Net à payer
                            </span>
                          </>
                        ) : (
                          <>
                            <div style={{ fontSize: '20px', fontWeight: 700, color: '#94A3B8' }}>
                              En attente
                            </div>
                            <span style={{ fontSize: '12.5px', color: '#64748B', marginTop: '4px', display: 'block' }}>
                              Aucun bulletin émis pour l'instant
                            </span>
                          </>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveTab('bulletins')}
                        className="button secondary"
                        style={{ marginTop: '20px', width: '100%', justifyContent: 'center' }}
                      >
                        Consulter mes bulletins
                      </button>
                    </div>

                    {/* Widget 3 : Acomptes sur salaire */}
                    <div style={{
                      background: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '16px',
                      padding: '24px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 650, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Acomptes sur salaire
                          </span>
                          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#FFFBEB', color: '#D97706', display: 'grid', placeItems: 'center' }}>
                            <Icon name="cash" size={18} />
                          </div>
                        </div>

                        <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                          {advances.length > 0 ? `${advances.length} demande${advances.length > 1 ? 's' : ''}` : '0 en cours'}
                        </div>
                        <span style={{ fontSize: '12.5px', color: '#64748B', marginTop: '4px', display: 'block' }}>
                          Versement rapide par virement ou mobile money
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveTab('acomptes')}
                        className="button secondary"
                        style={{ marginTop: '20px', width: '100%', justifyContent: 'center' }}
                      >
                        Demander un acompte
                      </button>
                    </div>

                    {/* Widget 4 : Attestation officielle */}
                    <div style={{
                      background: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      borderRadius: '16px',
                      padding: '24px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 650, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Attestation de travail
                          </span>
                          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#F5F3FF', color: '#7C3AED', display: 'grid', placeItems: 'center' }}>
                            <Icon name="file" size={18} />
                          </div>
                        </div>

                        <div style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                          Prête en 1 clic
                        </div>
                        <span style={{ fontSize: '12.5px', color: '#64748B', marginTop: '4px', display: 'block' }}>
                          Document officiel certifié par {employee?.company_name}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveTab('documents')}
                        className="button secondary"
                        style={{ marginTop: '20px', width: '100%', justifyContent: 'center' }}
                      >
                        Générer mon attestation
                      </button>
                    </div>
                  </div>

                  {/* Section Activités & Bulletins récents */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                    {/* Colonne 1 : Historique des bulletins */}
                    <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0F172A' }}>
                          Derniers bulletins de paie
                        </h2>
                        {payslips.length > 3 && (
                          <button type="button" onClick={() => setActiveTab('bulletins')} className="button ghost small" style={{ fontSize: '12.5px' }}>
                            Tout voir &rarr;
                          </button>
                        )}
                      </div>

                      {payslips.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {payslips.slice(0, 3).map((p) => (
                            <div
                              key={p.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '12px 14px',
                                borderRadius: '10px',
                                background: '#F8FAFC',
                                border: '1px solid #F1F5F9',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#EFF6FF', color: '#2563EB', display: 'grid', placeItems: 'center' }}>
                                  <Icon name="payslip" size={16} />
                                </div>
                                <div>
                                  <div style={{ fontWeight: 650, fontSize: '14px', color: '#0F172A' }}>
                                    {MONTHS[p.period_month - 1]} {p.period_year}
                                  </div>
                                  <div style={{ fontSize: '12px', color: '#64748B' }}>Bulletin {p.number}</div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <strong style={{ fontSize: '14px', color: '#0F172A' }}>{money(p.net_salary, cur)}</strong>
                                <Link
                                  href={`/fiches-de-paie/${p.id}`}
                                  target="_blank"
                                  className="button secondary small icon-only"
                                  title="Consulter le bulletin"
                                >
                                  <Icon name="external" size={14} />
                                </Link>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ margin: 0, fontSize: '13.5px', color: '#94A3B8' }}>Aucun bulletin édité pour le moment.</p>
                      )}
                    </div>

                    {/* Colonne 2 : Dernières demandes d'absences */}
                    <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h2 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: '#0F172A' }}>
                          Mes demandes récentes
                        </h2>
                        {leaves.length > 3 && (
                          <button type="button" onClick={() => setActiveTab('conges')} className="button ghost small" style={{ fontSize: '12.5px' }}>
                            Tout voir &rarr;
                          </button>
                        )}
                      </div>

                      {leaves.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {leaves.slice(0, 3).map((l) => (
                            <div
                              key={l.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '12px 14px',
                                borderRadius: '10px',
                                background: '#F8FAFC',
                                border: '1px solid #F1F5F9',
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 650, fontSize: '13.5px', color: '#0F172A' }}>
                                  {LEAVE_TYPES[l.type] || l.type}
                                </div>
                                <div style={{ fontSize: '12px', color: '#64748B' }}>
                                  Du {frDate(l.start_date)} au {frDate(l.end_date)} ({l.days_count} j)
                                </div>
                              </div>

                              <span className={`status ${l.status === 'approuve' ? 'paid' : l.status === 'refuse' ? 'late' : 'wait'}`} style={{ fontSize: '12px' }}>
                                {l.status === 'approuve' ? 'Approuvé' : l.status === 'refuse' ? 'Refusé' : 'En attente'}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '20px 0', color: '#94A3B8' }}>
                          <p style={{ margin: '0 0 10px', fontSize: '13.5px' }}>Aucune demande de congé enregistrée.</p>
                          <button type="button" onClick={() => setActiveTab('conges')} className="button secondary small">
                            Déposer une demande
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================
                  VUE 2 : BULLETINS DE PAIE (TABLEAU MODERNE PAYFIT)
                 ======================================================== */}
              {activeTab === 'bulletins' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div>
                      <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#0F172A' }}>Mes Bulletins de paie</h2>
                      <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: '#64748B' }}>
                        Consultez et téléchargez vos fiches de paie dématérialisées ({payslips.length} disponible{payslips.length > 1 ? 's' : ''}).
                      </p>
                    </div>
                  </div>

                  {payslips.length ? (
                    <div className="scroll">
                      <table className="table-payfit">
                        <thead>
                          <tr>
                            <th>N° Bulletin</th>
                            <th>Période</th>
                            <th className="n">Salaire Brut</th>
                            <th className="n">Retenues (CNSS/IRPP)</th>
                            <th className="n">Net Payé</th>
                            <th>Statut</th>
                            <th className="n">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payslips.map((p) => (
                            <tr key={p.id}>
                              <td style={{ fontWeight: 700, color: '#0F172A' }}>{p.number}</td>
                              <td>{MONTHS[p.period_month - 1]} {p.period_year}</td>
                              <td className="n">{money(p.gross_salary, cur)}</td>
                              <td className="n muted">− {money(p.total_deductions, cur)}</td>
                              <td className="n" style={{ fontWeight: 800, color: 'var(--brand, #2B4C7E)', fontSize: '14.5px' }}>
                                {money(p.net_salary, cur)}
                              </td>
                              <td>
                                <span className={`status ${p.status === 'paye' ? 'paid' : 'wait'}`}>
                                  {p.status === 'paye' ? 'Payé' : 'Validé'}
                                </span>
                              </td>
                              <td className="n">
                                <Link
                                  href={`/fiches-de-paie/${p.id}`}
                                  target="_blank"
                                  className="button secondary small"
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                >
                                  <Icon name="download" size={13} /> Voir / Imprimer
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '48px 20px', background: '#F8FAFC', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#EFF6FF', color: '#2563EB', display: 'grid', placeItems: 'center', margin: '0 auto 12px' }}>
                        <Icon name="payslip" size={24} />
                      </div>
                      <h3 style={{ fontSize: '16px', margin: '0 0 6px', color: '#0F172A' }}>Aucun bulletin de paie disponible</h3>
                      <p style={{ margin: 0, fontSize: '13.5px', color: '#64748B' }}>
                        Vos bulletins apparaîtront ici dès qu'ils auront été édités et validés par votre service RH.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ========================================================
                  VUE 3 : CONGÉS & ABSENCES
                 ======================================================== */}
              {activeTab === 'conges' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '28px', alignItems: 'start' }}>
                  {/* Formulaire de demande de congé */}
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '28px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                    <div style={{ marginBottom: '20px' }}>
                      <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#0F172A' }}>Poser un congé ou une absence</h2>
                      <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748B' }}>
                        Votre demande sera transmise automatiquement à votre responsable pour validation.
                      </p>
                    </div>

                    <form action={portalLeaveRequestAction} className="form-stack">
                      <input type="hidden" name="portal_token" value={token} />

                      <div className="field">
                        <label htmlFor="p_type">Type d'absence</label>
                        <select id="p_type" name="type" defaultValue="conge_paye">
                          {Object.entries(LEAVE_TYPES).map(([k, label]) => (
                            <option key={k} value={k}>{label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="form-grid">
                        <div className="field">
                          <label htmlFor="p_start">Date de début</label>
                          <input id="p_start" name="start_date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} />
                        </div>
                        <div className="field">
                          <label htmlFor="p_end">Date de fin</label>
                          <input id="p_end" name="end_date" type="date" required defaultValue={new Date().toISOString().split('T')[0]} />
                        </div>
                      </div>

                      <div className="field">
                        <label htmlFor="p_days">Nombre de jours ouvrés</label>
                        <input id="p_days" name="days_count" type="number" step="0.5" min="0.5" defaultValue="1" required />
                      </div>

                      <div className="field">
                        <label htmlFor="p_reason">Motif / Commentaire</label>
                        <textarea id="p_reason" name="reason" rows={2} placeholder="Précisez votre demande..." />
                      </div>

                      <div className="field">
                        <label htmlFor="p_doc">Justificatif <span className="help">facultatif — certificat médical, attestation…</span></label>
                        <input id="p_doc" name="justificatif" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.txt" />
                      </div>

                      <button type="submit" className="button" style={{ marginTop: '8px' }}>
                        Soumettre ma demande de congé
                      </button>
                    </form>
                  </div>

                  {/* Solde & Historique des demandes */}
                  <div>
                    {/* Badge Solde de congés */}
                    <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '16px', padding: '20px 24px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <span style={{ fontSize: '13px', fontWeight: 650, color: '#065F46', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Solde de congés disponible
                        </span>
                        <div style={{ fontSize: '28px', fontWeight: 850, color: '#047857', marginTop: '2px' }}>
                          {employee?.leave_balance || 0} jours
                        </div>
                      </div>
                      <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#D1FAE5', color: '#059669', display: 'grid', placeItems: 'center' }}>
                        <Icon name="calendar" size={22} />
                      </div>
                    </div>

                    <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '24px' }}>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px', color: '#0F172A' }}>
                        Historique de mes absences ({leaves.length})
                      </h3>

                      {leaves.length ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {leaves.map((l) => (
                            <div key={l.id} style={{ padding: '14px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid #F1F5F9' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                                <strong style={{ fontSize: '14px', color: '#0F172A' }}>{LEAVE_TYPES[l.type] || l.type}</strong>
                                <span className={`status ${l.status === 'approuve' ? 'paid' : l.status === 'refuse' ? 'late' : 'wait'}`} style={{ fontSize: '11.5px' }}>
                                  {l.status === 'approuve' ? 'Approuvé' : l.status === 'refuse' ? 'Refusé' : 'En attente'}
                                </span>
                              </div>
                              <div style={{ fontSize: '13px', color: '#64748B' }}>
                                Du {frDate(l.start_date)} au {frDate(l.end_date)} ({l.days_count} j)
                              </div>
                              {l.reason && <div style={{ fontSize: '12.5px', color: '#334155', marginTop: '4px', fontStyle: 'italic' }}>« {l.reason} »</div>}
                              {l.document_url && (
                                <div style={{ marginTop: '8px' }}>
                                  <a href={`/portail/${token}/piece?type=conge&id=${l.id}`} target="_blank" rel="noreferrer" style={{ fontSize: '12.5px', color: 'var(--brand, #2B4C7E)', fontWeight: 600 }}>
                                    Voir la pièce justificative &rarr;
                                  </a>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ margin: 0, fontSize: '13.5px', color: '#94A3B8' }}>Aucune demande enregistrée.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================
                  VUE 4 : ACOMPTES SUR SALAIRE
                 ======================================================== */}
              {activeTab === 'acomptes' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '28px', alignItems: 'start' }}>
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '28px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                    <div style={{ marginBottom: '20px' }}>
                      <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#0F172A' }}>Demande d'acompte sur salaire</h2>
                      <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748B' }}>
                        L'acompte sera déduit de votre prochain bulletin de paie.
                      </p>
                    </div>

                    <form action={portalAdvanceRequestAction} className="form-stack">
                      <input type="hidden" name="portal_token" value={token} />
                      <div className="field">
                        <label htmlFor="adv_amt">Montant souhaité ({cur})</label>
                        <input id="adv_amt" name="amount" type="number" step="any" min="1000" placeholder="Ex: 50000" required />
                      </div>
                      <div className="field">
                        <label htmlFor="adv_method">Mode de versement préféré</label>
                        <select id="adv_method" name="payment_method" defaultValue={employee?.payment_method || 'tmoney'}>
                          {Object.entries(PAYMENT_METHODS).map(([k, label]) => (
                            <option key={k} value={k}>{label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label htmlFor="adv_reason">Motif de l'avance</label>
                        <input id="adv_reason" name="reason" type="text" placeholder="Dépense imprévue, urgence..." />
                      </div>
                      <button type="submit" className="button" style={{ marginTop: '8px' }}>
                        Envoyer ma demande d'acompte
                      </button>
                    </form>
                  </div>

                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '24px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px', color: '#0F172A' }}>
                      Historique des acomptes ({advances.length})
                    </h3>

                    {advances.length ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {advances.map((a) => (
                          <div key={a.id} style={{ padding: '14px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <strong style={{ fontSize: '15px', color: '#0F172A' }}>{money(a.amount, cur)}</strong>
                              <div style={{ fontSize: '12px', color: '#64748B' }}>
                                Mois de {MONTHS[a.period_month - 1]} {a.period_year}
                              </div>
                              {a.reason && <div style={{ fontSize: '12px', color: '#334155', marginTop: '2px' }}>« {a.reason} »</div>}
                            </div>
                            <span className={`status ${a.status === 'paye' ? 'paid' : a.status === 'refuse' ? 'late' : 'wait'}`} style={{ fontSize: '12px' }}>
                              {a.status === 'paye' ? 'Versé' : a.status === 'refuse' ? 'Refusé' : 'En attente'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ margin: 0, fontSize: '13.5px', color: '#94A3B8' }}>Aucune demande d'acompte enregistrée.</p>
                    )}
                  </div>
                </div>
              )}

              {/* ========================================================
                  VUE 5 : NOTES DE FRAIS
                 ======================================================== */}
              {activeTab === 'frais' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '28px', alignItems: 'start' }}>
                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '28px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                    <div style={{ marginBottom: '20px' }}>
                      <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#0F172A' }}>Déposer une note de frais</h2>
                      <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748B' }}>
                        Remboursement de frais engagés dans le cadre de votre activité.
                      </p>
                    </div>

                    <form action={portalExpenseReportAction} className="form-stack">
                      <input type="hidden" name="portal_token" value={token} />
                      <div className="field">
                        <label htmlFor="exp_title">Objet de la dépense</label>
                        <input id="exp_title" name="title" type="text" placeholder="Ex: Déplacement client, transport..." required />
                      </div>
                      <div className="form-grid">
                        <div className="field">
                          <label htmlFor="exp_amt">Montant ({cur})</label>
                          <input id="exp_amt" name="amount" type="number" min="100" placeholder="Ex: 10000" required />
                        </div>
                        <div className="field">
                          <label htmlFor="exp_cat">Catégorie</label>
                          <select id="exp_cat" name="category" defaultValue="transport">
                            {Object.entries(EXPENSE_CATEGORIES).map(([k, label]) => (
                              <option key={k} value={k}>{label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="field">
                        <label htmlFor="exp_date">Date de la dépense</label>
                        <input id="exp_date" name="expense_date" type="date" defaultValue={new Date().toISOString().split('T')[0]} />
                      </div>
                      <div className="field">
                        <label htmlFor="exp_doc">Reçu ou facture justificative <span className="help">Photo ou PDF</span></label>
                        <input id="exp_doc" name="recu" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.txt" />
                      </div>
                      <button type="submit" className="button" style={{ marginTop: '8px' }}>
                        Soumettre ma note de frais
                      </button>
                    </form>
                  </div>

                  <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '24px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px', color: '#0F172A' }}>
                      Historique des dépenses ({expenses.length})
                    </h3>

                    {expenses.length ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {expenses.map((e) => (
                          <div key={e.id} style={{ padding: '14px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <strong style={{ fontSize: '14.5px', color: '#0F172A' }}>{money(e.amount, cur)}</strong> · {e.title}
                              <div style={{ fontSize: '12px', color: '#64748B' }}>
                                {EXPENSE_CATEGORIES[e.category] || e.category} · {frDate(e.expense_date)}
                              </div>
                              {e.receipt_url && (
                                <a href={`/portail/${token}/piece?type=frais&id=${e.id}`} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: 'var(--brand, #2B4C7E)', fontWeight: 600 }}>
                                  Voir le reçu &rarr;
                                </a>
                              )}
                            </div>
                            <span className={`status ${e.status === 'rembourse' ? 'paid' : e.status === 'refuse' ? 'late' : 'wait'}`} style={{ fontSize: '12px' }}>
                              {e.status === 'rembourse' ? 'Remboursé' : e.status === 'refuse' ? 'Refusé' : 'En attente'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ margin: 0, fontSize: '13.5px', color: '#94A3B8' }}>Aucune note de frais déposée.</p>
                    )}
                  </div>
                </div>
              )}

              {/* ========================================================
                  VUE 6 : DOCUMENTS & ATTESTATION DE TRAVAIL
                 ======================================================== */}
              {activeTab === 'documents' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                      <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#0F172A' }}>Attestation de travail certifiée</h2>
                      <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: '#64748B' }}>
                        Document légal officiel délivré au nom de {employee?.company_name}.
                      </p>
                    </div>

                    <button type="button" className="button" onClick={() => window.print()}>
                      <Icon name="download" size={16} /> Imprimer mon attestation (PDF)
                    </button>
                  </div>

                  <div className="card payslip-paper" style={{ padding: '48px', background: '#FFFFFF', color: '#111827', lineHeight: 1.8, maxWidth: '800px', margin: '0 auto', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                    <div style={{ textAlign: 'center', marginBottom: '36px', borderBottom: '2px solid #111827', paddingBottom: '20px' }}>
                      <h2 style={{ fontSize: '22px', fontWeight: 900, margin: '0 0 6px', letterSpacing: '0.05em' }}>{cert.title}</h2>
                      <div style={{ fontSize: '14px', color: '#4B5563' }}>{employee?.company_name} · {employee?.company_address || 'Lomé, Togo'}</div>
                      {employee?.company_legal_ids && <div style={{ fontSize: '13px', fontWeight: 600 }}>{employee?.company_legal_ids}</div>}
                    </div>

                    <p style={{ fontSize: '15px', marginBottom: '24px' }}>
                      {cert.statement}
                    </p>

                    <p style={{ fontSize: '15px', marginBottom: '40px' }}>
                      {cert.closing}
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '60px' }}>
                      <div style={{ fontSize: '13px', color: '#6B7280' }}>
                        Document certifié généré sur le portail RH FactPay.
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '50px' }}>{cert.dateText}</div>
                        <div style={{ fontSize: '14px', fontWeight: 800 }}>La Direction Générale</div>
                        <div style={{ fontSize: '12px', color: '#6B7280' }}>[Signature & Cachet]</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================
                  VUE 7 : ÉQUIPE & ORGANIGRAMME
                 ======================================================== */}
              {activeTab === 'equipe' && (
                <div>
                  <div style={{ marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#0F172A' }}>Organigramme & Équipe</h2>
                    <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: '#64748B' }}>
                      Retrouvez vos collègues et la structure de l'entreprise chez {employee?.company_name}.
                    </p>
                  </div>
                  <OrgChartView orgChart={orgChart} isPortal portalToken={token} />
                </div>
              )}

              {/* ========================================================
                  VUE 8 : MON CONTRAT & PROFIL
                 ======================================================== */}
              {activeTab === 'profil' && (
                <div style={{ maxWidth: '800px' }}>
                  <div style={{ marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#0F172A' }}>Mon Profil & Contrat</h2>
                    <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: '#64748B' }}>
                      Informations administratives enregistrées auprès de votre employeur.
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
                    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '20px' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 14px', color: '#0F172A' }}>Identité & Coordonnées</h3>
                      <dl className="calc" style={{ margin: 0 }}>
                        <div><dt>Nom complet</dt><dd>{employee?.first_name} {employee?.last_name}</dd></div>
                        {employee?.email && <div><dt>E-mail</dt><dd>{employee?.email}</dd></div>}
                        {employee?.phone && <div><dt>Téléphone</dt><dd>{employee?.phone}</dd></div>}
                        {employee?.id_card_number && <div><dt>Pièce d'identité</dt><dd>{employee?.id_card_number}</dd></div>}
                      </dl>
                    </div>

                    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '20px' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 14px', color: '#0F172A' }}>Contrat & Rémunération</h3>
                      <dl className="calc" style={{ margin: 0 }}>
                        <div><dt>Type de contrat</dt><dd><strong>{employee?.contract_type}</strong></dd></div>
                        <div><dt>Poste</dt><dd>{employee?.job_title || 'Collaborateur'}</dd></div>
                        {employee?.department && <div><dt>Département</dt><dd>{employee?.department}</dd></div>}
                        {employee?.hire_date && <div><dt>Date d'embauche</dt><dd>{frDate(employee?.hire_date)}</dd></div>}
                        {employee?.cnss_number && <div><dt>N° CNSS</dt><dd>{employee?.cnss_number}</dd></div>}
                        <div><dt>Salaire de base</dt><dd><strong>{money(employee?.base_salary, cur)}</strong></dd></div>
                        <div><dt>Mode de règlement</dt><dd>{PAYMENT_METHODS[employee?.payment_method] || employee?.payment_method}</dd></div>
                      </dl>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* MODAL MODIFIER MON MOT DE PASSE */}
      {showPasswordModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '16px',
        }}>
          <div style={{
            background: '#FFFFFF',
            borderRadius: '20px',
            border: '1px solid #E2E8F0',
            padding: '28px 24px',
            maxWidth: '440px',
            width: '100%',
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="lock" size={18} /> Modifier mon mot de passe
              </h3>
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '4px' }}
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 20px', lineHeight: 1.5 }}>
              Mettez à jour votre mot de passe pour sécuriser l'accès à vos bulletins de paie et congés.
            </p>

            <form action={changePortalPasswordAction} className="stack" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input type="hidden" name="token" value={token} />

              {employee?.has_password && (
                <div>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Mot de passe actuel
                  </label>
                  <input
                    name="current_password"
                    type="password"
                    required
                    style={{
                      width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Nouveau mot de passe
                </label>
                <input
                  name="new_password"
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="8 car., 1 maj, 1 min, 1 chiffre, 1 symbole"
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Confirmer le nouveau mot de passe
                </label>
                <input
                  name="confirm"
                  type="password"
                  required
                  autoComplete="new-password"
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '14px', boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="button secondary"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="button"
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .payfit-portal-main {
          margin: 0 !important;
          max-width: 100% !important;
          width: 100% !important;
          box-sizing: border-box !important;
        }
        @media (max-width: 900px) {
          .payfit-portal-sidebar {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            bottom: 0 !important;
            height: 100vh !important;
            z-index: 1000 !important;
            transform: translateX(-100%) !important;
            box-shadow: none !important;
            transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
          }
          .payfit-portal-sidebar.is-open {
            transform: translateX(0) !important;
            box-shadow: 0 0 50px rgba(0,0,0,0.3) !important;
          }
          .mobile-close-btn {
            display: inline-flex !important;
          }
          .payfit-mobile-burger {
            display: inline-flex !important;
          }
          .payfit-portal-main {
            padding: 16px 12px 48px !important;
          }
          .payfit-portal-canvas {
            padding: 20px 14px !important;
            border-radius: 16px !important;
          }
        }
      `}} />
    </div>
  );
}
