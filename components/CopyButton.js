'use client';

import { useState } from 'react';

// Copie un texte (un lien) dans le presse-papiers
export default function CopyButton({ text, label = 'Copier le lien' }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch {
      window.prompt('Copie ce lien :', text);
    }
  };
  return <button type="button" className="secondary" onClick={copy} aria-live="polite">{done ? 'Lien copié' : label}</button>;
}
