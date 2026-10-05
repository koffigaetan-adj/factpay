import { runScheduled } from '@/lib/invoices';
import { cleanupExpired } from '@/lib/cleanup';
import { mailTestMode } from '@/lib/mail';

// Jamais mis en cache : cette route est appelée par l'horloge de Vercel, pas par un navigateur.
export const dynamic = 'force-dynamic';
// 60 s : le plafond de l'offre gratuite. Le lot est envoyé en parallèle et plafonné pour tenir
// dedans ; ce qui déborde reste réservé et repart au prochain passage.
export const maxDuration = 60;

// Appelé chaque matin par Vercel Cron (voir vercel.json) :
// envoie les factures programmées et récurrentes, réessaie les envois échoués, relance les factures
// en retard, et fait le ménage dans les sessions, liens et codes expirés.
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  // Variable absente du projet : erreur de configuration, pas un problème d'accès. La distinction
  // est volontaire — elle se voit dans le corps de la réponse, sans rien divulguer du secret.
  if (!secret) {
    console.error('Tâche quotidienne : CRON_SECRET n\'est pas défini dans les variables du projet. Aucun envoi programmé ne peut partir.');
    return Response.json({ erreur: 'CRON_SECRET absent des variables du projet Vercel' }, { status: 500 });
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    // Sans cet en-tête (ouverture dans un navigateur), la réponse est 401 même si tout va bien :
    // c'est Vercel qui l'envoie seul, lors de la tâche quotidienne.
    return new Response('Non autorisé', { status: 401 });
  }
  // Sans identifiants SMTP, les envois sont simulés : la tâche doit le dire bruyamment,
  // sinon elle déclare les factures envoyées alors qu'aucun e-mail n'est parti.
  const testMode = mailTestMode();
  if (testMode) console.error('Tâche quotidienne : SMTP_USER / SMTP_PASS absents, aucun e-mail ne part.');

  await cleanupExpired();
  const { sent, recurring, reminders } = await runScheduled();
  const count = (list, ok) => list.filter((r) => r.ok === ok).length;
  return Response.json({
    sent: count(sent, true), failed: count(sent, false),
    recurring: count(recurring, true), recurringFailed: count(recurring, false),
    reminders: count(reminders, true), remindersFailed: count(reminders, false),
    ...(testMode ? { avertissement: 'mode test : SMTP_USER / SMTP_PASS absents, aucun e-mail n\'est parti' } : {}),
  });
}