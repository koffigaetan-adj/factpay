'use client';

import { useState } from 'react';
import { workedDays, offReason, isWeekend, describePeriod, periodHours } from '@/lib/period';
import { holidayName, COUNTRIES } from '@/lib/holidays';

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const monthLabel = (ym) => new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${ym}-01T12:00:00Z`));
const shiftMonth = (ym, n) => {
  const d = new Date(`${ym}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
};
const hoursLabel = (n) => String(Math.round(n * 100) / 100).replace('.', ',');

export const newPeriod = (month) => ({
  mode: 'mois', month, from: '', to: '', dates: [], hours_per_day: 8, exclude_weekends: true, exclude_holidays: true, country: 'FR',
});

// Choix des jours travaillés : un mois entier, une période, ou des jours un par un.
// Les week-ends et jours fériés (France) peuvent être exclus automatiquement.
export default function PeriodPicker({ value: p, onChange }) {
  const [view, setView] = useState(() => (p.mode === 'mois' ? p.month : (p.from || p.dates[0] || p.month || '').slice(0, 7)) || new Date().toISOString().slice(0, 7));
  const set = (patch) => onChange({ ...p, ...patch });
  const days = workedDays(p);
  const selected = new Set(days);

  // Cliquer un jour ajuste la sélection : on passe en « jours au choix » en gardant ce qui était coché
  const toggle = (d) => {
    const next = new Set(days);
    if (next.has(d)) next.delete(d); else next.add(d);
    set({ mode: 'jours', dates: [...next].sort() });
  };

  // Grille du mois affiché, en commençant le lundi
  const first = new Date(`${view}-01T12:00:00Z`);
  const lead = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => `${view}-${String(i + 1).padStart(2, '0')}`)];
  const hours = periodHours(p);

  return (
    <div className="period">
      <div className="seg" role="radiogroup" aria-label="Type de période">
        {[['mois', 'Un mois entier'], ['periode', 'Du … au …'], ['jours', 'Jours au choix']].map(([m, label]) => (
          <label key={m} className={p.mode === m ? 'on' : ''}>
            <input type="radio" name="period_mode" value={m} checked={p.mode === m}
              onChange={() => set(m === 'jours' ? { mode: m, dates: days } : { mode: m })} />
            {label}
          </label>
        ))}
      </div>

      <div className="period-fields">
        {p.mode === 'mois' && (
          <label>Mois
            <input type="month" value={p.month} onChange={(e) => { set({ month: e.target.value }); if (e.target.value) setView(e.target.value); }} />
          </label>
        )}
        {p.mode === 'periode' && (
          <>
            <label>Du<input type="date" value={p.from} onChange={(e) => { set({ from: e.target.value }); if (e.target.value) setView(e.target.value.slice(0, 7)); }} /></label>
            <label>Au<input type="date" value={p.to} min={p.from || undefined} onChange={(e) => set({ to: e.target.value })} /></label>
          </>
        )}
        <label className="hpd">Heures par jour
          <input inputMode="decimal" value={p.hours_per_day} onChange={(e) => set({ hours_per_day: e.target.value })} />
        </label>
      </div>

      <div className="period-opts">
        <label className="check"><input type="checkbox" checked={p.exclude_weekends} onChange={(e) => set({ exclude_weekends: e.target.checked })} />
          <span>Exclure les week-ends</span></label>
        <span className="check holi">
          <input id="excl-hol" type="checkbox" checked={p.exclude_holidays} onChange={(e) => set({ exclude_holidays: e.target.checked })} />
          <label htmlFor="excl-hol">Exclure les jours fériés</label>
          <select aria-label="Pays des jours fériés" value={p.country || 'FR'} onChange={(e) => set({ country: e.target.value })}>
            {Object.entries(COUNTRIES).map(([code, c]) => <option key={code} value={code}>{c.label}</option>)}
          </select>
        </span>
      </div>

      <div className="cal">
        <div className="cal-head">
          <button type="button" className="cal-nav" onClick={() => setView(shiftMonth(view, -1))} aria-label="Mois précédent">‹</button>
          <strong>{monthLabel(view)}</strong>
          <button type="button" className="cal-nav" onClick={() => setView(shiftMonth(view, 1))} aria-label="Mois suivant">›</button>
        </div>
        <div className="cal-grid">
          {WEEKDAYS.map((w, i) => <span key={i} className="cal-wd" aria-hidden="true">{w}</span>)}
          {cells.map((d, i) => {
            if (!d) return <span key={`x${i}`} />;
            const off = offReason(d, p);
            const holiday = holidayName(d, p.country || 'FR');
            const cls = ['cal-day', selected.has(d) && 'on', off && 'off', holiday && 'hol', isWeekend(d) && 'we'].filter(Boolean).join(' ');
            const title = [holiday, off === 'week-end' && 'Week-end exclu'].filter(Boolean).join(' · ') || undefined;
            return (
              <button type="button" key={d} className={cls} disabled={!!off} title={title} aria-pressed={selected.has(d)}
                aria-label={`${Number(d.slice(8))} ${monthLabel(view)}${holiday ? `, ${holiday}` : ''}`} onClick={() => toggle(d)}>
                {Number(d.slice(8))}
              </button>
            );
          })}
        </div>
        <p className="cal-legend"><span className="k on" />travaillé <span className="k hol" />jour férié <span className="k off" />exclu</p>
      </div>

      <p className="period-sum" aria-live="polite">
        {days.length
          ? <><strong>{days.length} jour{days.length > 1 ? 's' : ''} × {hoursLabel(Number(String(p.hours_per_day).replace(',', '.')) || 0)} h = {hoursLabel(hours)} h</strong> · {describePeriod(p)}</>
          : 'Aucun jour travaillé sélectionné.'}
      </p>
    </div>
  );
}
