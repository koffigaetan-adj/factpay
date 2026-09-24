'use client';

import { useState } from 'react';
import { PASSWORD_RULES } from '@/lib/password';

// Œil pour afficher ou masquer le mot de passe
function Eye({ open }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <path d="M4 4l16 16" />}
    </svg>
  );
}

function Field({ label, name, value, onChange, visible, onToggle, autoFocus, invalid, describedBy }) {
  return (
    <label>{label}
      <span className="pw">
        <input name={name} type={visible ? 'text' : 'password'} required autoComplete="new-password" autoFocus={autoFocus}
          value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid || undefined} aria-describedby={describedBy} />
        <button type="button" className="eye" onClick={onToggle} aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
          <Eye open={visible} />
        </button>
      </span>
    </label>
  );
}

// Nouveau mot de passe + confirmation, avec les règles cochées au fur et à mesure
export default function PasswordFields({ label = 'Mot de passe', autoFocus = false }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [visible, setVisible] = useState(false);
  const toggle = () => setVisible((v) => !v);
  const same = confirm.length > 0 && confirm === password;

  return (
    <>
      <Field label={label} name="password" value={password} onChange={setPassword} visible={visible} onToggle={toggle}
        autoFocus={autoFocus} describedBy="pw-rules" />
      <ul id="pw-rules" className="pw-rules">
        {PASSWORD_RULES.map((r) => {
          const ok = r.test(password);
          return <li key={r.label} className={ok ? 'ok' : ''}><span className="tick" aria-hidden="true" />{r.label}<span className="sr">{ok ? ' : fait' : ' : manquant'}</span></li>;
        })}
      </ul>
      <Field label="Confirme le mot de passe" name="confirm" value={confirm} onChange={setConfirm} visible={visible} onToggle={toggle}
        invalid={confirm.length > 0 && !same} describedBy="pw-same" />
      <p id="pw-same" className={`pw-same ${same ? 'ok' : confirm ? 'err' : ''}`} aria-live="polite">
        {confirm ? (same ? 'Les deux mots de passe sont identiques.' : 'Les deux mots de passe ne sont pas identiques.') : ' '}
      </p>
    </>
  );
}
