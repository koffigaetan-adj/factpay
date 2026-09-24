import { cookies } from 'next/headers';
import { Public_Sans } from 'next/font/google';
import './globals.css';

const sans = Public_Sans({ subsets: ['latin'], variable: '--font-sans' });

export const metadata = {
  title: { default: 'FactPay', template: '%s · FactPay' },
  description: 'Factures et fiches de paie en ligne, en euros ou en francs CFA.',
};

// Apparence choisie dans Paramètres (cookie « theme ») : clair ou sombre forcé, sinon celle de l'appareil
export default async function RootLayout({ children }) {
  const theme = (await cookies()).get('theme')?.value;
  return (
    <html lang="fr" className={sans.variable} data-theme={['light', 'dark'].includes(theme) ? theme : undefined}>
      <body>{children}</body>
    </html>
  );
}
