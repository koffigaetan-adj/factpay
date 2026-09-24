import { brandOf } from '@/lib/providers';

// Logo d'une banque ou d'un opérateur, ou pastille de couleur avec ses initiales
export default function BrandBadge({ name, size = 28 }) {
  const b = brandOf(name);
  if (b.logo) return <img src={b.logo} alt="" width={size} height={size} className="brand-badge" style={{ width: size, height: size }} />;
  return (
    <span className="brand-badge initials" aria-hidden="true"
      style={{ width: size, height: size, background: b.color, color: b.ink, fontSize: Math.round(size * (b.short.length > 2 ? 0.3 : 0.38)) }}>
      {b.short}
    </span>
  );
}
