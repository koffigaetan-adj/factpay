import { currentUser } from '@/lib/auth';
import { liveRate } from '@/lib/rates';

// Taux du jour pour le formulaire de facture (réservé aux personnes connectées)
export async function GET(req) {
  if (!(await currentUser())) return Response.json({ error: 'Non autorisé' }, { status: 401 });
  const url = new URL(req.url);
  try {
    return Response.json(await liveRate(url.searchParams.get('de'), url.searchParams.get('vers')));
  } catch (err) {
    return Response.json({ error: err.message }, { status: 502 });
  }
}
