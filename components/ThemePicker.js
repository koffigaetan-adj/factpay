'use client';

import { setTheme } from '@/app/actions';

const CHOICES = [
  ['auto', 'Automatique', "Suit le réglage de l'appareil"],
  ['light', 'Clair', 'Toujours clair'],
  ['dark', 'Sombre', 'Toujours sombre'],
];

// Choix de l'apparence : enregistré dès qu'on clique (le bouton reste pour le clavier et sans JavaScript)
export default function ThemePicker({ current }) {
  return (
    <form action={setTheme} className="stack">
      <div className="theme-choices" role="radiogroup" aria-label="Apparence">
        {CHOICES.map(([value, label, help]) => (
          <label key={value}>
            <input type="radio" name="theme" value={value} defaultChecked={current === value}
              onChange={(e) => e.target.form.requestSubmit()} />
            <span className={`swatch ${value}`} aria-hidden="true"><span /><span /></span>
            {label}
            <span className="help">{help}</span>
          </label>
        ))}
      </div>
      <noscript><div><button>Enregistrer</button></div></noscript>
    </form>
  );
}
