import Link from 'next/link';
import { redirect } from 'next/navigation';
import Logo from '@/components/Logo';
import { normalizeCode } from '@/lib/verify';

export const metadata = { title: 'Vérifier un document' };

// Saisie à la main du code imprimé en bas du document (quand on ne peut pas scanner le QR code)
export default async function Page({ searchParams }) {
  const code = normalizeCode((await searchParams)?.code);
  if (code) redirect(`/v/${code}`);
  return (
    <main className="auth verify">
      <Link href="/" className="logo"><Logo height={44} /></Link>
      <div className="card">
        <h1>Vérifier un document</h1>
        <p className="hint">Tapez le code imprimé en bas de la facture, du devis ou de l'avoir (12 caractères, par exemple ABCD-EFGH-JKLM). Vous pouvez aussi simplement scanner le QR code.</p>
        <form action="/verifier" className="stack">
          <label>Code de vérification<input name="code" required autoFocus autoComplete="off" autoCapitalize="characters" className="otp" placeholder="XXXX-XXXX-XXXX" maxLength={20} /></label>
          <button>Vérifier</button>
        </form>
      </div>
    </main>
  );
}
