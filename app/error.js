'use client';

import { useEffect } from 'react';
import Link from 'next/link';

// Erreur inattendue : un message clair, un bouton pour réessayer, et la référence de l'erreur pour le support
export default function Error({ error, reset }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="auth">
      <div className="card">
        <h1>Un problème est survenu</h1>
        <p className="hint">Rien n'a été perdu. Réessaie dans un instant ; si le problème revient, note la référence ci-dessous et écris-nous.</p>
        {error?.digest && <p className="help">Référence : <code>{error.digest}</code></p>}
        <div className="line-actions">
          <button onClick={() => reset()}>Réessayer</button>
          <Link className="button secondary" href="/tableau-de-bord">Tableau de bord</Link>
        </div>
      </div>
    </main>
  );
}
