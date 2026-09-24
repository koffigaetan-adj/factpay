'use client';

import { useEffect, useState } from 'react';

const pad = (n) => String(n).padStart(2, '0');
// Valeur d'un champ datetime-local (heure locale de l'appareil, sans fuseau)
const toLocalInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
// « Europe/Paris » → « Paris », « Africa/Lome » → « Lome »
const tzCity = (tz) => tz.split('/').pop().replace(/_/g, ' ');

// Date et heure de l'envoi automatique, choisies dans le fuseau de l'appareil (la France si tu y es,
// le Togo sinon). Le serveur reçoit l'instant exact en temps universel, plus le nom du fuseau
// pour réafficher l'heure telle que tu l'as choisie.
export default function ScheduleField({ initial }) {
  const [value, setValue] = useState('');
  const [min, setMin] = useState('');
  const [tz, setTz] = useState('');

  // Calculé dans le navigateur seulement : le serveur ne connaît pas le fuseau de l'appareil
  useEffect(() => {
    setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || '');
    const now = new Date();
    setMin(toLocalInput(now));
    let start;
    if (initial && initial.length > 10) start = new Date(initial);
    else if (initial) start = new Date(`${initial}T08:00`); // ancienne programmation (date seule) : 8 h
    else { start = new Date(now); start.setDate(start.getDate() + 1); start.setHours(8, 0, 0, 0); }
    setValue(toLocalInput(start));
  }, [initial]);

  const at = value ? new Date(value) : null;
  const iso = at && !Number.isNaN(at.getTime()) ? at.toISOString() : '';
  const summary = at && iso
    ? new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(at)
    : '';

  return (
    <div className="schedule-field">
      <label>Date et heure d'envoi
        <input type="datetime-local" value={value} min={min} step={900} onChange={(e) => setValue(e.target.value)} />
      </label>
      <input type="hidden" name="send_on" value={iso} />
      <input type="hidden" name="send_tz" value={tz} />
      {summary && <p className="help" style={{ margin: 0 }}>Partira le <strong>{summary}</strong>{tz ? `, heure de ${tzCity(tz)}` : ''}.</p>}
    </div>
  );
}
