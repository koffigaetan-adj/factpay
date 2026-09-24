import { currentUser } from '@/lib/auth';
import { one } from '@/lib/db';
import { listInvoices } from '@/lib/invoices';
import { statusOf } from '@/lib/status';

// Export des factures d'une année pour le comptable : CSV au format Excel français
// (séparateur « ; », virgule décimale, UTF-8 avec BOM pour les accents)
const cell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const amount = (n) => (n === null || n === undefined ? '' : String(Math.round(Number(n) * 100) / 100).replace('.', ','));
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export async function GET(req) {
  const user = await currentUser();
  const company = user && await one('SELECT * FROM companies WHERE owner_id = $1', [user.id]);
  if (!company) return new Response('Non autorisé.', { status: 401 });
  const year = Number(new URL(req.url).searchParams.get('annee')) || new Date().getUTCFullYear();

  const rows = (await listInvoices(company.id)).filter((i) => i.number && i.issue_date?.startsWith(String(year))).reverse();
  const head = ['Numéro', "Date d'émission", 'Échéance', 'Client', 'Objet', 'Devise', 'Total HT', 'TVA', 'Total TTC',
    'Retenue', 'Net à payer', 'Statut', 'Payée le', 'Moyen de paiement', 'Référence', 'Avoir', 'Annulée le'];
  const lines = rows.map((i) => [
    i.number, i.issue_date, i.due_date, i.client_name, i.title, i.currency, amount(i.subtotal), amount(i.vat_amount), amount(i.total),
    amount(i.withholding_amount), amount(i.amount_due), statusOf(i).label, day(i.confirmed_at), i.payment_method, i.payment_ref,
    i.credit_number || '', day(i.cancelled_at),
  ]);
  const csv = '\uFEFF' + [head, ...lines].map((r) => r.map(cell).join(';')).join('\r\n');
  return new Response(csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="factures-${year}.csv"` },
  });
}
