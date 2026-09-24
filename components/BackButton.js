import Link from 'next/link';

// Bouton de retour, en haut des pages de détail : « ‹ Factures », « ‹ Clients »…
export default function BackButton({ href, children }) {
  return (
    <Link href={href} className="back-btn">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M15 6l-6 6 6 6" />
      </svg>
      {children}
    </Link>
  );
}
