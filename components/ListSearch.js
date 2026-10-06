import Icon from '@/components/Icon';

// Champ de recherche filtré côté serveur, en GET : on tape, on valide, la page se recharge.
// `keep` rejoue les autres paramètres d'URL (le filtre actif) pour ne pas le perdre.
export default function ListSearch({ action, query = '', placeholder, keep = {} }) {
  const id = `recherche-${action.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}`;
  return (
    <form className="doc-search" role="search" action={action} method="get">
      {Object.entries(keep).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <Icon name="search" size={16} className="doc-search-icon" />
      <label className="sr" htmlFor={id}>{placeholder}</label>
      <input id={id} name="q" type="search" defaultValue={query} placeholder={placeholder} />
      {query ? <a className="doc-search-clear" href={action} aria-label="Effacer la recherche">×</a> : null}
    </form>
  );
}
