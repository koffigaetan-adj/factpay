import { verifyFlash } from '@/lib/flash';

// Message affiché après une action (?ok=… ou ?erreur=… dans l'adresse). Un message est signé par
// notre propre code (voir back() dans app/actions.js) : un lien fabriqué à la main, avec un autre
// message dans l'adresse, n'est pas affiché.
export default async function Flash({ searchParams }) {
  const sp = (await searchParams) || {};
  const sig = typeof sp.s === 'string' ? sp.s : '';
  if (sp.erreur && verifyFlash('erreur', sp.erreur, sig)) return <p className="flash err" role="alert">{sp.erreur}</p>;
  if (sp.ok && verifyFlash('ok', sp.ok, sig)) return <p className="flash" role="status">{sp.ok}</p>;
  return null;
}
