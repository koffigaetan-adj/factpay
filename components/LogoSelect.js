'use client';

import { useEffect, useRef, useState } from 'react';
import BrandBadge from '@/components/BrandBadge';

// Liste déroulante avec logos (banques, opérateurs). « Autre… » laisse taper un nom libre.
// La valeur choisie part dans un champ caché « name ».
export default function LogoSelect({ name, options, value = '', onChange, placeholder = 'Choisir', otherLabel = 'Autre…', label, defaultOpen = false }) {
  const known = options.includes(value);
  const [choice, setChoice] = useState(value && !known ? '__other' : value);
  const [other, setOther] = useState(value && !known ? value : '');
  const [open, setOpen] = useState(defaultOpen);
  const box = useRef(null);
  const final = choice === '__other' ? other : choice;

  // Fermeture au clic à côté ou avec Échap
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (e.type === 'keydown' ? e.key === 'Escape' : !box.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);

  const pick = (v) => {
    setChoice(v);
    setOpen(false);
    if (v !== '__other') onChange?.(v);
  };

  return (
    <div className="logo-select" ref={box}>
      {name && <input type="hidden" name={name} value={final} />}
      <button type="button" className="ls-button" aria-haspopup="listbox" aria-expanded={open} aria-label={label}
        onClick={() => setOpen((o) => !o)}>
        {choice && choice !== '__other' ? <><BrandBadge name={choice} size={24} /><span>{choice}</span></>
          : choice === '__other' ? <><BrandBadge name={other || '?'} size={24} /><span>{other || otherLabel}</span></>
            : <span className="muted">{placeholder}</span>}
        <svg className="ls-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <ul className="ls-list" role="listbox" aria-label={label}>
          {options.map((o) => (
            <li key={o} role="option" aria-selected={choice === o}>
              <button type="button" onClick={() => pick(o)}><BrandBadge name={o} size={24} /><span>{o}</span></button>
            </li>
          ))}
          <li role="option" aria-selected={choice === '__other'}>
            <button type="button" onClick={() => pick('__other')}><span className="ls-other" aria-hidden="true">+</span><span>{otherLabel}</span></button>
          </li>
        </ul>
      )}
      {choice === '__other' && (
        <input className="ls-other-input" aria-label={`${label} (autre)`} placeholder="Nom" maxLength={60} value={other}
          onChange={(e) => { setOther(e.target.value); onChange?.(e.target.value); }} />
      )}
    </div>
  );
}
