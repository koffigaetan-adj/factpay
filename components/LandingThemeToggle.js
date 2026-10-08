'use client';

import { useEffect, useState } from 'react';
import Icon from './Icon';

export default function LandingThemeToggle() {
  const [theme, setTheme] = useState(null);

  useEffect(() => {
    // Detect current theme: attribute on html or media preference
    const current = document.documentElement.getAttribute('data-theme');
    if (current === 'dark' || current === 'light') {
      setTheme(current);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
    }
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    // Cookie persists user choice across reloads and pages
    document.cookie = `theme=${next}; path=/; max-age=${365 * 86400}; SameSite=Lax`;
  };

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      className="lp-theme-btn"
      title={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      aria-label={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
    >
      <Icon name={isDark ? 'sun' : 'moon'} size={18} />
    </button>
  );
}
