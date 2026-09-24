import { one } from '@/lib/db';
import { readFile } from '@/lib/storage';

// Logo d'une entreprise : public, car il figure sur les factures et dans les e-mails
export async function GET(_req, { params }) {
  const { id } = await params;
  const c = await one('SELECT logo_key, logo_mime FROM companies WHERE id = $1', [Number(id) || 0]);
  if (!c?.logo_key) return new Response('Pas de logo.', { status: 404 });
  return new Response(await readFile(c.logo_key), {
    headers: {
      'Content-Type': c.logo_mime || 'image/png',
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
