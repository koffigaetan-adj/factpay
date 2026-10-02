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
      </div>

      <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '16px 0' }} />

      {/* 4. Espace Collaborateur en ligne (Portail Salarié) */}
      <div style={{
        background: 'color-mix(in srgb, var(--brand) 4%, var(--paper))',
        border: '1px solid color-mix(in srgb, var(--brand) 20%, var(--line))',
        borderRadius: 'var(--radius)',
        padding: '16px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--ink)' }}>
            <Icon name="link" size={16} /> Espace salarié en ligne (Portail)
          </h3>
          {employee?.portal_token && (
            <span className="status paid" style={{ fontSize: '12px', padding: '3px 8px' }}>
              Accès actif
            </span>
          )}
        </div>
        <p className="hint" style={{ margin: '0 0 12px', fontSize: '13px' }}>
          Permet au salarié de consulter ses bulletins de paie, poser ses congés, demander des acomptes et télécharger ses attestations.
        </p>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <input
            id="activate_portal"
            name="activate_portal"
            type="checkbox"
            value="1"
            disabled={!hasEmail}
            checked={hasEmail && activatePortal}
            onChange={(e) => setActivatePortal(e.target.checked)}
            style={{ marginTop: '3px', cursor: hasEmail ? 'pointer' : 'not-allowed' }}
          />
          <div>
            <label
              htmlFor="activate_portal"
              style={{
                cursor: hasEmail ? 'pointer' : 'not-allowed',
                fontWeight: '600',
                color: hasEmail ? 'var(--ink)' : 'var(--muted)',
                display: 'block'
              }}
            >
              Activer l'accès à l'espace en ligne pour ce salarié
            </label>
            {!hasEmail ? (
              <span style={{ fontSize: '12px', color: 'var(--late)', fontWeight: '500', display: 'block', marginTop: '2px' }}>
                ⚠️ Une adresse e-mail est obligatoire ci-dessus pour pouvoir activer l'espace en ligne.
              </span>
            ) : (
              <span className="hint" style={{ fontSize: '12px', display: 'block', marginTop: '2px' }}>
                Un lien d'accès sécurisé et personnel sera généré pour le salarié.
              </span>
            )}
          </div>
        </div>

        {employee?.portal_token && (
          <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed color-mix(in srgb, var(--brand) 20%, var(--line))' }}>
            <Link
              href={`/portail/${employee.portal_token}`}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--brand)', fontWeight: '600' }}
            >
              <Icon name="external" size={13} />
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
