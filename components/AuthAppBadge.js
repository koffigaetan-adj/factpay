import { authApp } from '@/lib/authenticators';

// Logo de l'application d'authentification, ou pastille avec ses initiales
export default function AuthAppBadge({ app, size = 32 }) {
  const a = typeof app === 'string' ? authApp(app) : app;
  if (a.logo) return <img src={a.logo} alt="" width={size} height={size} className="brand-badge" style={{ width: size, height: size }} />;
  return (
    <span className="brand-badge initials" aria-hidden="true"
      style={{ width: size, height: size, background: a.color, color: a.ink, fontSize: Math.round(size * (a.short.length > 2 ? 0.3 : 0.4)) }}>
      {a.short}
    </span>
  );
}
