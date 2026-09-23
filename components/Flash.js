// Message affiché après une action (?ok=… ou ?erreur=… dans l'adresse)
export default async function Flash({ searchParams }) {
  const sp = (await searchParams) || {};
  if (sp.erreur) return <p className="flash err" role="alert">{sp.erreur}</p>;
  if (sp.ok) return <p className="flash" role="status">{sp.ok}</p>;
  return null;
}
