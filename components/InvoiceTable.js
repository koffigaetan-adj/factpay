import Link from 'next/link';
import { money } from '@/lib/money';
import { frDate } from '@/lib/dates';
import { statusOf } from '@/lib/status';
import { pubId } from '@/lib/ids';

export default function InvoiceTable({ invoices }) {
  return (
    <div className="scroll">
      <table>
        <thead>
          <tr><th>Facture</th><th>Client</th><th>Date</th><th className="n">Montant</th><th>Statut</th></tr>
        </thead>
        <tbody>
          {invoices.map((i) => {
            const st = statusOf(i);
            return (
              <tr key={i.id}>
                <td>
                  <Link className="row-link" href={`/factures/${pubId('facture', i.id)}`}>{i.number || 'Brouillon'}</Link>
                  {i.title && <span className="sub">{i.title}</span>}
                </td>
                <td>{i.client_name}</td>
                <td>
                  {i.issue_date ? frDate(i.issue_date) : i.send_on ? `Envoi le ${frDate(i.send_on)}` : '—'}
                  {i.due_date && !['payee'].includes(i.status) && <span className="sub">échéance {frDate(i.due_date)}</span>}
                </td>
                <td className="n">{money(i.amount_due, i.currency)}</td>
                <td><span className={`status ${st.cls}`}>{st.label}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
