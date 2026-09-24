'use client';

import { useEffect, useRef, useState } from 'react';

const pad = (n) => String(n).padStart(2, '0');
const WEEKDAYS = ['lu', 'ma', 'me', 'je', 've', 'sa', 'di'];
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const parse = (v) => { const [y, m, d] = String(v).split('-').map(Number); return { y, m: (m || 1) - 1, d: d || 1 }; };
const toIso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const shiftDay = (v, n) => { const { y, m, d } = parse(v); const x = new Date(Date.UTC(y, m, d + n)); return toIso(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()); };
const fmt = (v, mode) => {
  if (!v) return '';
  const { y, m, d } = parse(v);
  const date = new Date(Date.UTC(y, m, mode === 'month' ? 1 : d, 12));
  return new Intl.DateTimeFormat('fr-FR', mode === 'month'
    ? { month: 'long', year: 'numeric', timeZone: 'UTC' }
    : { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
};

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

// Choix d'une date (ou d'un mois avec mode="month") dans un calendrier aux couleurs de FactPay,
// à la place du calendrier du navigateur. Valeur au format AAAA-MM-JJ (ou AAAA-MM).
// Utilisable dans un formulaire (name) ou piloté (value + onChange).
export default function DatePicker({
  name, value, defaultValue = '', onChange, min, max, required = false, mode = 'day',
  placeholder, label = 'Choisir une date',
}) {
  const controlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue);
  const current = controlled ? value : inner;
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const [view, setView] = useState(() => parse(current || todayIso()));
  const [focus, setFocus] = useState(current || todayIso());
  const box = useRef(null);
  const trigger = useRef(null);
  const grid = useRef(null);

  const pick = (v) => {
    if (!controlled) setInner(v);
    onChange?.(v);
    setOpen(false);
    trigger.current?.focus();
  };

  const outOfRange = (v) => (min && v < min) || (max && v > max);

  const toggle = () => {
    if (!open) {
      const start = current || (min && todayIso() < min ? min : todayIso());
      setView(parse(start));
      setFocus(mode === 'month' ? start.slice(0, 7) : start);
      const r = trigger.current.getBoundingClientRect();
      setAlignRight(r.left + 312 > window.innerWidth);
    }
    setOpen((o) => !o);
  };

  // Fermeture au clic à côté ou avec Échap
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
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);

  // Le jour « actif » reçoit le focus pour naviguer au clavier (flèches, Entrée)
  useEffect(() => {
    if (open) grid.current?.querySelector('[data-focus="true"]')?.focus();
  }, [open, focus, view]);

  const onGridKey = (e) => {
    const step = mode === 'month'
      ? { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }[e.key]
      : { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!step) return;
    e.preventDefault();
    if (mode === 'month') {
      const [y, m] = focus.split('-').map(Number);
      const d = new Date(Date.UTC(y, m - 1 + step, 1));
      const next = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
      setFocus(next);
      setView({ y: d.getUTCFullYear(), m: d.getUTCMonth(), d: 1 });
    } else {
      const next = shiftDay(focus, step);
      setFocus(next);
      setView(parse(next));
    }
  };

  const monthTitle = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(view.y, view.m, 1, 12)));
  const move = (n) => {
    if (mode === 'month') setView((v) => ({ ...v, y: v.y + n }));
    else { const d = new Date(Date.UTC(view.y, view.m + n, 1)); setView({ y: d.getUTCFullYear(), m: d.getUTCMonth(), d: 1 }); }
  };

  const today = todayIso();
  let cells = [];
  if (mode !== 'month') {
    const lead = (new Date(Date.UTC(view.y, view.m, 1)).getUTCDay() + 6) % 7;
    const count = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
    cells = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => toIso(view.y, view.m, i + 1))];
  }

  return (
    <div className={`dp${open ? ' is-open' : ''}`} ref={box}>
      <button type="button" ref={trigger} className="dp-field" aria-haspopup="dialog" aria-expanded={open} aria-label={label} onClick={toggle}>
        <span className={current ? '' : 'muted'}>{current ? fmt(current, mode) : (placeholder || (mode === 'month' ? 'Choisir un mois' : 'Choisir une date'))}</span>
        <CalendarIcon />
      </button>
      {/* Valeur envoyée avec le formulaire ; invisible, mais vérifiée par le navigateur si obligatoire */}
      <input className="dp-value" tabIndex={-1} aria-hidden="true" name={name} required={required} value={current || ''} onChange={() => {}}
        onFocus={() => trigger.current?.focus()} />

      {open && (
        <div className={`dp-pop${alignRight ? ' right' : ''}`} role="dialog" aria-label={label}>
          <div className="dp-head">
            <button type="button" className="dp-nav" onClick={() => move(-1)} aria-label={mode === 'month' ? 'Année précédente' : 'Mois précédent'}>‹</button>
            <strong>{mode === 'month' ? view.y : monthTitle}</strong>
            <button type="button" className="dp-nav" onClick={() => move(1)} aria-label={mode === 'month' ? 'Année suivante' : 'Mois suivant'}>›</button>
          </div>

          {mode === 'month' ? (
            <div className="dp-months" ref={grid} onKeyDown={onGridKey}>
              {MONTHS.map((label2, i) => {
                const v = `${view.y}-${pad(i + 1)}`;
                const off = (min && v < min.slice(0, 7)) || (max && v > max.slice(0, 7));
                return (
                  <button type="button" key={v} disabled={off} data-focus={v === focus} tabIndex={v === focus ? 0 : -1}
                    className={`${v === current ? 'sel' : ''}${v === today.slice(0, 7) ? ' now' : ''}`} onClick={() => pick(v)}>{label2}</button>
                );
              })}
            </div>
          ) : (
            <>
              <div className="dp-week" aria-hidden="true">{WEEKDAYS.map((w) => <span key={w}>{w}</span>)}</div>
              <div className="dp-days" ref={grid} onKeyDown={onGridKey} role="grid">
                {cells.map((v, i) => (v === null ? <span key={`e${i}`} /> : (
                  <button type="button" key={v} disabled={outOfRange(v)} data-focus={v === focus} tabIndex={v === focus ? 0 : -1}
                    aria-label={fmt(v, 'day')} aria-pressed={v === current}
                    className={`${v === current ? 'sel' : ''}${v === today ? ' now' : ''}`} onClick={() => pick(v)}>
                    {Number(v.slice(8))}
                  </button>
                )))}
              </div>
            </>
          )}

          <div className="dp-foot">
            {!outOfRange(mode === 'month' ? today.slice(0, 7) : today) && (
              <button type="button" className="link" onClick={() => pick(mode === 'month' ? today.slice(0, 7) : today)}>
                {mode === 'month' ? 'Ce mois-ci' : "Aujourd'hui"}
              </button>
            )}
            {!required && current && <button type="button" className="link" onClick={() => pick('')}>Effacer</button>}
          </div>
        </div>
      )}
    </div>
  );
}
