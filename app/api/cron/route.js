import { runScheduled } from '@/lib/invoices';
import { cleanupExpired } from '@/lib/cleanup';

export const maxDuration = 60;

// Appelé chaque matin par Vercel Cron (voir vercel.json) :
// envoie les factures programmées et récurrentes, réessaie les envois échoués, relance les factures
// en retard, et fait le ménage dans les sessions, liens et codes expirés.
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Non autorisé', { status: 401 });
  }
  await cleanupExpired();
  const { sent, recurring, reminders } = await runScheduled();
  const count = (list, ok) => list.filter((r) => r.ok === ok).length;
  return Response.json({
    sent: count(sent, true), failed: count(sent, false),
    recurring: count(recurring, true), recurringFailed: count(recurring, false),
    reminders: count(reminders, true), remindersFailed: count(reminders, false),
  });
}
