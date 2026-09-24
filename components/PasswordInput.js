'use client';

import { useState } from 'react';

// Œil pour afficher ou masquer le mot de passe
export function Eye({ open }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {!open && <path d="M4 4l16 16" />}
    </svg>
  );
}

// Champ mot de passe simple (connexion, mot de passe actuel) avec son œil
export default function PasswordInput({ label = 'Mot de passe', name = 'password', autoComplete = 'current-password', ...rest }) {
  const [visible, setVisible] = useState(false);
  return (
    <label>{label}
      <span className="pw">
        <input name={name} type={visible ? 'text' : 'password'} required autoComplete={autoComplete} {...rest} />
        <button type="button" className="eye" onClick={() => setVisible((v) => !v)} aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
          <Eye open={visible} />
        </button>
      </span>
    </label>
  );
}
