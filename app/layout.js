import { Public_Sans } from 'next/font/google';
import './globals.css';

const sans = Public_Sans({ subsets: ['latin'], variable: '--font-sans' });

export const metadata = {
  title: { default: 'Factures & Paie', template: '%s · Factures & Paie' },
  description: 'Factures et fiches de paie en ligne, en euros ou en francs CFA.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className={sans.variable}>
      <body>{children}</body>
    </html>
  );
}
