import Logo from '@/components/Logo';

// Écran de chargement des pages publiques : logo FactPay (noir en mode clair, blanc en mode sombre), léger battement et barre qui avance
export default function LoadingScreen() {
  return (
    <div className="loading" role="status" aria-live="polite">
      <div className="loading-logo"><Logo height={56} priority /></div>
      <div className="loading-bar" aria-hidden="true"><span /></div>
      <span className="sr">Chargement…</span>
    </div>
  );
}
