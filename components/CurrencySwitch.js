'use client';

import { useState } from 'react';

// Bascule l'affichage de tous les montants de la page entre les deux devises.
// Chaque montant est rendu deux fois (.m-main et .m-alt), le CSS montre l'un ou l'autre.
export default function CurrencySwitch({ main, alt }) {
  const [showAlt, setShowAlt] = useState(false);
  const pick = (value) => {
    setShowAlt(value);
    document.body.classList.toggle('show-alt', value);
  };
  return (
    <div className="cur" role="group" aria-label="Devise d'affichage">
      <button type="button" aria-pressed={!showAlt} onClick={() => pick(false)}>{main}</button>
      <button type="button" aria-pressed={showAlt} onClick={() => pick(true)}>{alt}</button>
    </div>
  );
}
