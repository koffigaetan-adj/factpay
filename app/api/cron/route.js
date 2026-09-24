import { runScheduled } from '@/lib/invoices';

export const maxDuration = 60;

// Appelé chaque matin par Vercel Cron (voir vercel.json) :
// envoie les factures programmées, réessaie les envois échoués et relance les factures en retard.
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Non autorisé', { status: 401 });
  }
  const { sent, reminders } = await runScheduled();
  const count = (list, ok) => list.filter((r) => r.ok === ok).length;
  return Response.json({ sent: count(sent, true), failed: count(sent, false), reminders: count(reminders, true), remindersFailed: count(reminders, false) });
}
