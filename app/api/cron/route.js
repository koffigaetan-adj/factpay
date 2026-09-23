import { runScheduled } from '@/lib/invoices';

export const maxDuration = 60;

// Appelé chaque matin par Vercel Cron (voir vercel.json) :
// envoie les factures programmées et réessaie les envois échoués.
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Non autorisé', { status: 401 });
  }
  const results = await runScheduled();
  return Response.json({ sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length });
}
