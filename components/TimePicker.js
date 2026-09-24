'use client';

import { useEffect, useRef, useState } from 'react';

const pad = (n) => String(n).padStart(2, '0');
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));

function ClockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  );
}

// Choix d'une heure (HH:MM) dans deux colonnes, heures puis minutes, aux couleurs de FactPay
export default function TimePicker({ value, onChange, minuteStep = 5, label = 'Choisir une heure' }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const trigger = useRef(null);
  const [h, m] = (value || '08:00').split(':');
  const minutes = Array.from({ length: 60 / minuteStep }, (_, i) => pad(i * minuteStep));

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (e.type === 'keydown' ? e.key === 'Escape' : !box.current?.contains(e.target)) {
        setOpen(false);
        if (e.type === 'keydown') trigger.current?.focus();
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    // L'heure choisie est visible dans chaque colonne dès l'ouverture
    // (défilement de la colonne seulement, jamais de la page)
    box.current?.querySelectorAll('.tp-col .sel').forEach((el) => { el.parentElement.scrollTop = el.offsetTop - el.parentElement.clientHeight / 2 + el.offsetHeight / 2; });
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);

  return (
    <div className={`dp tp${open ? ' is-open' : ''}`} ref={box}>
      <button type="button" ref={trigger} className="dp-field" aria-haspopup="dialog" aria-expanded={open} aria-label={label} onClick={() => setOpen((o) => !o)}>
        <span>{value || '—'}</span>
        <ClockIcon />
      </button>
      {open && (
        <div className="dp-pop tp-pop" role="dialog" aria-label={label}>
          <div className="tp-cols">
            <div className="tp-col" role="listbox" aria-label="Heure">
              {HOURS.map((x) => (
                <button type="button" key={x} className={x === h ? 'sel' : ''} aria-selected={x === h} onClick={() => onChange(`${x}:${m}`)}>{x}</button>
              ))}
            </div>
            <div className="tp-col" role="listbox" aria-label="Minutes">
              {minutes.map((x) => (
                <button type="button" key={x} className={x === m ? 'sel' : ''} aria-selected={x === m}
                  onClick={() => { onChange(`${h}:${x}`); setOpen(false); trigger.current?.focus(); }}>{x}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
