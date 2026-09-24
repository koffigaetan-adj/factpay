// Application installable sur téléphone et ordinateur (icône sur l'écran d'accueil, ouverture en plein écran)
export default function manifest() {
  return {
    name: 'FactPay',
    short_name: 'FactPay',
    description: 'Factures, devis et paiements pour les freelances d\'Afrique de l\'Ouest.',
    lang: 'fr',
    start_url: '/tableau-de-bord',
    scope: '/',
    display: 'standalone',
    background_color: '#E9EDF1',
    theme_color: '#1A2433',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Nouvelle facture', url: '/factures/nouvelle' },
      { name: 'Factures', url: '/factures' },
    ],
  };
}
