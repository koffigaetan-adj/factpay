import { NextResponse } from 'next/server';

// En-têtes de sécurité posés sur chaque page (le fichier s'appelle « proxy », pas « middleware » :
// Next.js 16 a renommé la convention). Content-Security-Policy interdit d'afficher le site dans le
// cadre d'un autre (protège les pages publiques /f/… contre le détournement de clics), et n'autorise
// que le code JavaScript du site lui-même : un script injecté par une faille ailleurs ne s'exécute
// pas. Chaque page reçoit un nonce à usage unique que Next attache tout seul à ses propres scripts.
// Le CSS de l'application utilise beaucoup de style="" en ligne, que la CSP ne peut pas cibler avec
// un nonce (seules les balises <script> et <style> le permettent) : style-src garde 'unsafe-inline'.
export function proxy(request) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV === 'development';
  const csp = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''};
    worker-src 'self';
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data:;
    font-src 'self';
    connect-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, ' ').trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  if (!isDev) response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
