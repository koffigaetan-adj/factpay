import Link from 'next/link';
import { money } from '@/lib/money';
import { frDate, frDateTime } from '@/lib/dates';
import { statusOf } from '@/lib/status';
import { pubId } from '@/lib/ids';

export default function InvoiceTable({ invoices, received = false }) {
  return (
    <div className="scroll">
      <table>
        <thead>
          <tr><th>Facture</th><th>{received ? 'Émetteur' : 'Client'}</th><th>Date</th><th className="n">Montant</th><th>Statut</th></tr>
        </thead>
        <tbody>
          {invoices.map((i) => {
            const st = statusOf(i);
            return (
              <tr key={i.id}>
                <td>
                  {received ? (
                    <a className="row-link" href={`/f/${i.token}`} target="_blank" rel="noopener">{i.number}</a>
                  ) : (
                    <Link className="row-link" href={`/factures/${pubId('facture', i.id)}`}>{i.number || 'Brouillon'}</Link>
                  )}
                  {i.title && <span className="sub">{i.title}</span>}
                </td>
                <td>{received ? i.issuer_name : i.client_name}</td>
                <td>
                  {i.issue_date ? frDate(i.issue_date) : i.send_on ? `Envoi le ${frDateTime(i.send_on, i.send_tz)}` : '—'}
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
