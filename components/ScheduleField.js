'use client';

import { useEffect, useState } from 'react';
import DatePicker from '@/components/DatePicker';
import TimePicker from '@/components/TimePicker';

const pad = (n) => String(n).padStart(2, '0');
const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localTime = (d) => `${pad(d.getHours())}:${pad(Math.floor(d.getMinutes() / 5) * 5)}`;
// « Europe/Paris » → « Paris », « Africa/Lome » → « Lome »
const tzCity = (tz) => tz.split('/').pop().replace(/_/g, ' ');

// Date puis heure de l'envoi automatique, choisies dans le fuseau de l'appareil (la France si tu y es,
// le Togo sinon). Le serveur reçoit l'instant exact en temps universel, plus le nom du fuseau
// pour réafficher l'heure telle que tu l'as choisie.
export default function ScheduleField({ initial }) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('08:00');
  const [today, setToday] = useState('');
  const [tz, setTz] = useState('');

  // Calculé dans le navigateur seulement : le serveur ne connaît pas le fuseau de l'appareil
  useEffect(() => {
    setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || '');
    const now = new Date();
    setToday(localDate(now));
    let start;
    if (initial && initial.length > 10) start = new Date(initial);
    else if (initial) start = new Date(`${initial}T08:00`); // ancienne programmation (date seule) : 8 h
    else { start = new Date(now); start.setDate(start.getDate() + 1); start.setHours(8, 0, 0, 0); }
    setDate(localDate(start));
    setTime(localTime(start));
  }, [initial]);

  const at = date && time ? new Date(`${date}T${time}`) : null;
  const valid = at && !Number.isNaN(at.getTime());
  const past = valid && at.getTime() < Date.now();
  const summary = valid
    ? new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(at)
    : '';

  return (
    <div className="schedule-field">
      <div className="schedule-inputs">
        <div className="field">
          <span className="field-title">Date d'envoi</span>
          <DatePicker value={date} onChange={setDate} min={today || undefined} required label="Date d'envoi" />
        </div>
        <div className="field">
          <span className="field-title">Heure</span>
          <TimePicker value={time} onChange={setTime} label="Heure d'envoi" />
        </div>
      </div>
      <input type="hidden" name="send_on" value={valid ? at.toISOString() : ''} />
      <input type="hidden" name="send_tz" value={tz} />
      {past
        ? <p className="err" role="alert" style={{ margin: 0 }}>Cette heure est déjà passée : choisis une heure à venir.</p>
        : summary && <p className="help" style={{ margin: 0 }}>Partira le <strong>{summary}</strong>{tz ? `, heure de ${tzCity(tz)}` : ''}.</p>}
    </div>
  );
}
