'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CONTRACT_TYPES, PAYMENT_METHODS } from '@/lib/rh-constants';
import { saveEmployeeAction } from '@/app/actions';
import Icon from '@/components/Icon';

export default function EmployeeForm({ employee = null, companyCurrency = 'XOF', returnTo = null }) {
  const isEdit = Boolean(employee?.id);
  const [email, setEmail] = useState(employee?.email || '');
  const [activatePortal, setActivatePortal] = useState(Boolean(employee?.portal_token));
  const hasEmail = Boolean(email.trim());

  return (
    <form action={saveEmployeeAction} className="form-stack">
      {isEdit && <input type="hidden" name="id" value={employee.id} />}
      {returnTo && <input type="hidden" name="return_to" value={returnTo} />}

      {/* 1. Identité & Coordonnées */}
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--ink)' }}>
          <Icon name="user" size={16} /> Identité & Coordonnées
        </h3>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="first_name">Prénom <span className="req">*</span></label>
            <input
              id="first_name"
              name="first_name"
              type="text"
              required
              defaultValue={employee?.first_name || ''}
              placeholder="Ex: Koffi"
            />
          </div>

          <div className="field">
            <label htmlFor="last_name">Nom de famille <span className="req">*</span></label>
            <input
              id="last_name"
              name="last_name"
              type="text"
              required
              defaultValue={employee?.last_name || ''}
              placeholder="Ex: Mensah"
            />
          </div>
        </div>

        <div className="form-grid" style={{ marginTop: '12px' }}>
          <div className="field">
            <label htmlFor="email">
              Adresse e-mail
              <span className="sub" style={{ display: 'inline', marginLeft: '6px' }}>
                (indispensable pour l'espace en ligne)
              </span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => {
                const val = e.target.value;
                setEmail(val);
                if (!val.trim()) {
                  setActivatePortal(false);
                }
              }}
              placeholder="koffi.mensah@exemple.com"
            />
          </div>

          <div className="field">
            <label htmlFor="phone">Numéro de téléphone</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={employee?.phone || ''}
              placeholder="Ex: +228 90 00 00 00"
            />
          </div>
        </div>
      </div>

      <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '16px 0' }} />

      {/* 2. Poste & Contrat */}
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--ink)' }}>
          <Icon name="briefcase" size={16} /> Poste & Contrat
        </h3>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="job_title">Intitulé du poste / Fonction</label>
            <input
              id="job_title"
              name="job_title"
              type="text"
              defaultValue={employee?.job_title || ''}
              placeholder="Ex: Développeur, Comptable..."
            />
          </div>

          <div className="field">
            <label htmlFor="department">Département / Service</label>
            <input
              id="department"
              name="department"
              type="text"
              defaultValue={employee?.department || ''}
              placeholder="Ex: Technique, Commercial, Admin..."
            />
          </div>
        </div>

        <div className="form-grid" style={{ marginTop: '12px' }}>
          <div className="field">
            <label htmlFor="contract_type">Type de contrat</label>
            <select id="contract_type" name="contract_type" defaultValue={employee?.contract_type || 'CDI'}>
              {Object.entries(CONTRACT_TYPES).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="category">Catégorie / Échelon</label>
            <input
              id="category"
              name="category"
              type="text"
              defaultValue={employee?.category || ''}
              placeholder="Ex: Catégorie 5, Échelon B"
            />
          </div>
        </div>

        <div className="form-grid" style={{ marginTop: '12px' }}>
          <div className="field">
            <label htmlFor="cnss_number">N° CNSS (Sécurité Sociale)</label>
            <input
              id="cnss_number"
              name="cnss_number"
              type="text"
              defaultValue={employee?.cnss_number || ''}
              placeholder="Ex: 123456789"
            />
          </div>

          <div className="field">
            <label htmlFor="id_card_number">N° CNI / Passeport</label>
            <input
              id="id_card_number"
              name="id_card_number"
              type="text"
              defaultValue={employee?.id_card_number || ''}
              placeholder="Ex: CNI N° 012345678"
            />
          </div>
        </div>

        <div className="form-grid" style={{ marginTop: '12px' }}>
          <div className="field">
            <label htmlFor="hire_date">Date d'embauche</label>
            <input
              id="hire_date"
              name="hire_date"
              type="date"
              defaultValue={employee?.hire_date || ''}
            />
          </div>

          <div className="field">
            <label htmlFor="end_date">Date de fin (si CDD / Stage)</label>
            <input
              id="end_date"
              name="end_date"
              type="date"
              defaultValue={employee?.end_date || ''}
            />
          </div>
        </div>
      </div>

      <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '16px 0' }} />

      {/* 3. Rémunération & Règlement */}
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--ink)' }}>
          <Icon name="cash" size={16} /> Rémunération & Mode de règlement
        </h3>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="base_salary">Salaire de base mensuel ({companyCurrency}) <span className="req">*</span></label>
            <input
              id="base_salary"
              name="base_salary"
              type="number"
              min="0"
              step="any"
              required
              defaultValue={employee?.base_salary ?? 0}
              placeholder="Ex: 150000"
            />
          </div>

          <div className="field">
            <label htmlFor="status">Statut du salarié</label>
            <select id="status" name="status" defaultValue={employee?.status || 'actif'}>
              <option value="actif">Actif (en poste)</option>
              <option value="conge">En congé</option>
              <option value="inactif">Inactif / Suspendu</option>
              <option value="archive">Archivé / Parti</option>
            </select>
          </div>
        </div>

        <div className="form-grid" style={{ marginTop: '12px' }}>
          <div className="field">
            <label htmlFor="payment_method">Mode de règlement du salaire <span className="req">*</span></label>
            <select
              id="payment_method"
              name="payment_method"
              defaultValue={employee?.payment_method || 'bank'}
            >
              {Object.entries(PAYMENT_METHODS).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="payment_details">Coordonnées bancaires (RIB / IBAN) ou N° Mobile Money</label>
            <input
              id="payment_details"
              name="payment_details"
              type="text"
              defaultValue={employee?.payment_details || ''}
              placeholder="Ex: TG000... ou +228 90 00 00 00"
            />
          </div>
        </div>

        <div className="form-grid" style={{ marginTop: '12px' }}>
          <div className="field">
            <label htmlFor="leave_balance">
              Solde de congés acquis (jours)
              <span className="help" style={{ marginLeft: '6px' }}>
                (Selon convention ex: 2,5 j / mois. Mettre 0 pour un nouvel embauché)
              </span>
            </label>
            <input
              id="leave_balance"
              name="leave_balance"
              type="number"
              min="0"
              step="0.5"
              defaultValue={employee?.leave_balance !== undefined ? employee.leave_balance : 0}
              placeholder="Ex: 0 ou 2.5"
            />
          </div>
        </div>
      </div>

      <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '16px 0' }} />

      {/* 4. Espace Collaborateur en ligne (Portail Salarié) */}
      <div style={{
        background: 'linear-gradient(180deg, color-mix(in srgb, var(--brand) 5%, var(--paper)) 0%, var(--paper) 100%)',
        border: '1px solid color-mix(in srgb, var(--brand) 22%, var(--line))',
        borderRadius: '14px',
        padding: '20px',
        marginBottom: '24px',
        boxShadow: '0 2px 12px rgba(43, 76, 126, 0.04)',
      }}>
        {/* En-tête avec badge d'icône & statut dynamique */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'color-mix(in srgb, var(--brand) 12%, transparent)',
              color: 'var(--brand)',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}>
              <Icon name="link" size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '15.5px', fontWeight: '700', margin: 0, color: 'var(--ink)' }}>
                  Espace salarié en ligne (Portail)
                </h3>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  padding: '2px 7px',
                  borderRadius: '6px',
                  background: 'color-mix(in srgb, var(--brand) 10%, transparent)',
                  color: 'var(--brand)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}>
                  Self-service RH
                </span>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'var(--muted)', lineHeight: 1.4 }}>
                Permet au salarié de consulter ses bulletins de paie, poser ses congés, demander des acomptes et télécharger ses attestations.
              </p>
            </div>
          </div>

          {employee?.portal_token && (
            <span className={`status ${employee.portal_last_seen_at ? 'paid' : 'wait'}`} style={{ fontSize: '12.5px', padding: '4px 10px', alignSelf: 'flex-start' }}>
              {employee.portal_last_seen_at ? 'Espace actif' : 'En attente'}
            </span>
          )}
        </div>

        {/* Pilules des fonctionnalités incluses */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          margin: '12px 0 16px',
          padding: '10px 12px',
          borderRadius: '8px',
          background: 'color-mix(in srgb, var(--paper) 70%, var(--bg))',
          border: '1px solid var(--line)',
        }}>
          {[
            { icon: 'report', label: 'Bulletins de paie' },
            { icon: 'calendar', label: 'Congés & Absences' },
            { icon: 'card', label: 'Demandes d\'acomptes' },
            { icon: 'file', label: 'Attestations RH' },
          ].map((pill, i) => (
            <span key={i} style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: '550',
              color: 'var(--ink)',
              padding: '3px 8px',
              borderRadius: '6px',
              background: 'var(--paper)',
              border: '1px solid color-mix(in srgb, var(--line) 80%, transparent)',
            }}>
              <Icon name={pill.icon} size={13} style={{ color: 'var(--brand)' }} />
              {pill.label}
            </span>
          ))}
        </div>

        {/* Carte interactive Toggle Switch */}
        <div style={{
          background: activatePortal && hasEmail ? 'color-mix(in srgb, var(--brand) 6%, var(--paper))' : 'var(--paper)',
          border: `1.5px solid ${activatePortal && hasEmail ? 'var(--brand)' : 'var(--line)'}`,
          borderRadius: '12px',
          padding: '14px 16px',
          transition: 'all 0.2s ease',
          boxShadow: activatePortal && hasEmail ? '0 2px 8px color-mix(in srgb, var(--brand) 15%, transparent)' : 'none',
        }}>
          <label
            htmlFor="activate_portal"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              cursor: hasEmail ? 'pointer' : 'not-allowed',
              margin: 0,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{
                fontWeight: '650',
                fontSize: '14px',
                color: hasEmail ? 'var(--ink)' : 'var(--muted)',
                marginBottom: '4px',
              }}>
                Activer l'accès à l'espace en ligne pour ce salarié
              </div>

              {!hasEmail ? (
                <div style={{ fontSize: '12.5px', color: 'var(--late)', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>⚠️</span>
                  <span>Renseignez une adresse e-mail ci-dessus pour pouvoir inviter ce salarié.</span>
                </div>
              ) : activatePortal ? (
                <div style={{ fontSize: '12.5px', color: 'var(--brand-text)', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>✉️</span>
                  <span>Un e-mail d'invitation avec un lien d'accès sécurisé et personnel sera envoyé à <strong>{email}</strong>.</span>
                </div>
              ) : (
                <div style={{ fontSize: '12.5px', color: 'var(--muted)' }}>
                  Un lien d'accès sécurisé et personnel sera généré pour le salarié.
                </div>
              )}
            </div>

            {/* Switch Toggle interactif */}
            <div style={{ position: 'relative', width: '48px', height: '26px', flexShrink: 0 }}>
              <input
                id="activate_portal"
                name="activate_portal"
                type="checkbox"
                value="1"
                disabled={!hasEmail}
                checked={hasEmail && activatePortal}
                onChange={(e) => setActivatePortal(e.target.checked)}
                style={{
                  opacity: 0,
                  width: 0,
                  height: 0,
                  position: 'absolute',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  cursor: hasEmail ? 'pointer' : 'not-allowed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: (hasEmail && activatePortal) ? 'var(--brand)' : 'var(--field)',
                  transition: 'background-color 0.25s ease',
                  borderRadius: '26px',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    content: '""',
                    height: '20px',
                    width: '20px',
                    left: (hasEmail && activatePortal) ? '25px' : '3px',
                    bottom: '3px',
                    backgroundColor: 'white',
                    transition: 'left 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                    borderRadius: '50%',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  }}
                />
              </span>
            </div>
          </label>
        </div>

        {/* Lien direct et statut d'accès si déjà créé */}
        {employee?.portal_token && (
          <div style={{
            marginTop: '14px',
            paddingTop: '12px',
            borderTop: '1px dashed color-mix(in srgb, var(--brand) 20%, var(--line))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
          }}>
            <span style={{ fontSize: '12.5px', color: 'var(--sub)' }}>
              {employee.portal_last_seen_at
                ? `Connecté pour la dernière fois : ${new Date(employee.portal_last_seen_at).toLocaleDateString('fr-FR')}`
                : 'Invitation générée · En attente de première connexion par le salarié'}
            </span>
            <Link
              href={`/portail/${employee.portal_token}`}
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: '13px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                color: 'var(--brand)',
                fontWeight: '650',
                textDecoration: 'none',
              }}
            >
              <Icon name="external" size={14} />
              Ouvrir le portail du salarié
            </Link>
          </div>
        )}
      </div>

      <div className="actions" style={{ marginTop: '20px' }}>
        <button type="submit" className="button">
          <Icon name="save" size={16} />
          {isEdit ? 'Mettre à jour le salarié' : 'Enregistrer le salarié'}
        </button>
      </div>
    </form>
  );
}
