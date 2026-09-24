import { currentUser } from '@/lib/auth';
import { one } from '@/lib/db';
import { readFile } from '@/lib/storage';

// Photo de profil de la personne connectée
export async function GET() {
  const user = await currentUser();
  const row = user && await one('SELECT avatar_key, avatar_mime FROM users WHERE id = $1', [user.id]);
  if (!row?.avatar_key) return new Response('Pas de photo.', { status: 404 });
  return new Response(await readFile(row.avatar_key), {
    headers: { 'Content-Type': row.avatar_mime || 'image/jpeg', 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' },
  });
}
