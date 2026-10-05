'use client';

import { useState } from 'react';

const CONTRACT_TYPES = ['CDI', 'CDD', 'Intérim', 'Stage', 'Apprentissage', 'Freelance', 'Autre'];

// Fonctionnalités affichées dans la carte portail
const PORTAL_FEATURES = [
  { icon: '📄', label: 'Bulletins de paie', desc: 'Accès à tous les bulletins de salaire' },
  { icon: '🏖️', label: 'Congés & Absences', desc: 'Pose des congés, suit le solde' },
  { icon: '💳', label: 'Demandes d\'acomptes', desc: 'Demande un acompte sur salaire' },
  { icon: '📋', label: 'Attestations RH', desc: 'Télécharge attestations & documents' },
];

export default function EmployeeFields({ e = {}, mode = 'create' }) {
  const [portalEnabled, setPortalEnabled] = useState(e.portal_enabled ?? false);

  return (
    <>
      {/* ── Identité ── */}
      <fieldset className="card" style={{ padding: '24px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Identité</h3>
        <div className="row">
          <label>Prénom <input name="first_name" required maxLength={60} defaultValue={e.first_name} autoComplete="given-name" /></label>
          <label>Nom <input name="last_name" required maxLength={60} defaultValue={e.last_name} autoComplete="family-name" /></label>
        </div>
        <label>E-mail <span className="help">indispensable pour le portail salarié</span>
          <input name="email" type="email" maxLength={200} defaultValue={e.email} autoComplete="email" />
        </label>
        <div className="row">
          <label>Téléphone <span className="help">facultatif</span>
            <input name="phone" maxLength={30} defaultValue={e.phone} autoComplete="tel" />
          </label>
        </div>
        <label>Adresse <span className="help">facultatif</span>
          <textarea name="address" rows={2} defaultValue={e.address} />
        </label>
      </fieldset>

      {/* ── Poste ── */}
      <fieldset className="card" style={{ padding: '24px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Poste & contrat</h3>
        <div className="row">
          <label>Intitulé du poste
            <input name="job_title" maxLength={120} defaultValue={e.job_title} placeholder="Ex. Développeur web" />
          </label>
          <label>Département / service
            <input name="department" maxLength={80} defaultValue={e.department} placeholder="Ex. Informatique" />
          </label>
        </div>
        <div className="row">
          <label>Type de contrat
            <select name="contract_type" defaultValue={e.contract_type || 'CDI'}>
              {CONTRACT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label>Date d'embauche
            <input name="hired_on" type="date" defaultValue={e.hired_on || ''} />
          </label>
        </div>
      </fieldset>

      {/* ── Rémunération ── */}
      <fieldset className="card" style={{ padding: '24px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Rémunération & congés</h3>
        <div className="row">
          <label>Salaire brut mensuel (F CFA)
            <input name="gross_salary" type="number" min={0} step={1000} defaultValue={e.gross_salary || ''} placeholder="Ex. 350000" />
          </label>
          <label>Jours de congés / an
            <input name="leave_days_per_year" type="number" min={0} max={365} defaultValue={e.leave_days_per_year ?? 26} />
          </label>
        </div>
      </fieldset>

      {/* ── Notes ── */}
      <fieldset className="card" style={{ padding: '24px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Notes internes</h3>
        <label><span className="help">Non visibles par le salarié</span>
          <textarea name="notes" rows={3} defaultValue={e.notes} placeholder="Informations utiles, remarques RH…" />
        </label>
      </fieldset>

      {/* ── Portail Self-Service RH ── */}
      <div className="emp-portal-card">
        {/* En-tête avec badge */}
        <div className="emp-portal-header">
          <div className="emp-portal-title-row">
            <div className="emp-portal-icon-wrap">
              <span style={{ fontSize: 22 }}>🏢</span>
            </div>
            <div>
              <h3 className="emp-portal-title">Espace salarié en ligne</h3>
              <span className="emp-portal-badge">Self-service RH</span>
            </div>
          </div>
          <p className="emp-portal-desc">
            Permet au salarié de consulter ses bulletins de paie, poser ses congés,
            demander des acomptes et télécharger ses attestations — sans solliciter les RH.
          </p>
        </div>

        {/* Grille des fonctionnalités */}
        <div className="emp-portal-features">
          {PORTAL_FEATURES.map((f) => (
            <div key={f.label} className="emp-portal-feature">
              <span className="emp-portal-feature-icon">{f.icon}</span>
              <div>
                <strong className="emp-portal-feature-label">{f.label}</strong>
                <span className="emp-portal-feature-desc">{f.desc}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Toggle d'activation */}
        <div className="emp-portal-toggle-section">
          <label className="switch-row" style={{ margin: 0, borderRadius: '10px' }}>
            <span>
              <strong>Activer l'accès à l'espace en ligne pour ce salarié</strong>
              {portalEnabled && e.portal_invite_sent_at && (
                <span className="sub" style={{ marginTop: 4, display: 'block', color: 'var(--paid)', fontSize: 13 }}>
                  ✅ Invitation déjà envoyée
                </span>
              )}
              {!portalEnabled && (
                <span className="sub" style={{ marginTop: 4, display: 'block', fontSize: 13 }}>
                  Accès désactivé — le salarié ne peut pas se connecter
                </span>
              )}
            </span>
            <input
              type="checkbox"
              name="portal_enabled"
              checked={portalEnabled}
              onChange={(e) => setPortalEnabled(e.target.checked)}
            />
          </label>
        </div>

        {/* Notice e-mail d'invitation */}
        {portalEnabled && (
          <div className="emp-portal-invite-notice">
            <div className="emp-portal-invite-icon">✉️</div>
            <div className="emp-portal-invite-text">
              <strong>Invitation par e-mail</strong>
              <p>
                Un e-mail d'invitation avec un lien d'accès sécurisé et personnel sera envoyé
                {e.email ? (
                  <> à <strong style={{ color: 'var(--brand-text)' }}>{e.email}</strong></>
                ) : (
                  <> à l'adresse e-mail renseignée dans la fiche</>
                )}
                {' '}dès que tu enregistres et cliques sur « Envoyer l'invitation ».
              </p>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--muted)' }}>
                Le lien est unique, personnel et expirera après 7 jours. Un nouveau lien peut être envoyé à tout moment.
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
