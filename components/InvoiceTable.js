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
          <tr>
            <th>Facture</th>
            <th>{received ? 'Émetteur' : 'Client'}</th>
            <th>Date</th>
            <th className="n">Montant</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((i) => {
            const st = statusOf(i);
            const partyName = (received ? i.issuer_name : i.client_name) || 'Client';
            const initial = partyName.charAt(0).toUpperCase();
            const isLate = ['emise', 'envoyee'].includes(i.status) && i.due_date && i.due_date < new Date().toISOString().slice(0, 10);

            return (
              <tr key={i.id}>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {received ? (
                      <a className="row-link" href={`/f/${i.token}`} target="_blank" rel="noopener" style={{ fontWeight: 650 }}>
                        {i.number}
                      </a>
                    ) : (
                      <Link className="row-link" href={`/factures/${i.pub_id || pubId('facture', i.id)}`} style={{ fontWeight: 650 }}>
                        {i.number || 'Brouillon'}
                      </Link>
                    )}
                    {i.title && <span className="sub">{i.title}</span>}
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '50%',
                        background: '#f1f5f9',
                        color: '#475569',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '12px',
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {initial}
                    </div>
                    <span style={{ fontWeight: 550, color: 'var(--ink)' }}>{partyName}</span>
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span>{i.issue_date ? frDate(i.issue_date) : i.send_on ? `Envoi le ${frDateTime(i.send_on, i.send_tz)}` : '—'}</span>
                    {i.due_date && !['payee'].includes(i.status) && (
                      <span className="sub" style={isLate ? { color: '#dc2626', fontWeight: 600 } : {}}>
                        échéance {frDate(i.due_date)}
                      </span>
                    )}
                  </div>
                </td>
                <td className="n" style={{ fontWeight: 750, fontSize: '14.5px' }}>
                  {money(i.amount_due, i.currency)}
                </td>
                <td>
                  <span className={`status ${st.cls}`}>{st.label}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
