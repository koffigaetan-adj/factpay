'use client';

import Link from 'next/link';
import Icon from '@/components/Icon';

export default function OrgChartView({ orgChart, isPortal = false, portalToken = '' }) {
  const { totalEmployees, departments } = orgChart;

  if (totalEmployees === 0) {
    return <p className="empty">Aucun collaborateur actif dans l'entreprise pour l'instant.</p>;
  }

  return (
    <div className="orgchart-container">
      {Object.entries(departments).map(([depName, members]) => (
        <div key={depName} className="card" style={{ padding: '24px', marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--line)', paddingBottom: '12px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="dash-card-icon" style={{ background: 'var(--brand)', color: '#fff' }}>
                <Icon name="briefcase" size={18} />
              </div>
              <div>
                <h2 style={{ fontSize: '17px', margin: 0 }}>{depName}</h2>
                <span className="sub">{members.length} collaborateur{members.length > 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
            {members.map((m) => (
              <div
                key={m.id}
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--line)',
                  borderRadius: '10px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      background: 'var(--brand)',
                      color: '#fff',
                      display: 'grid',
                      placeItems: 'center',
                      fontWeight: 700,
                      fontSize: '16px',
                      flex: 'none',
                    }}
                  >
                    {m.first_name[0]}{m.last_name[0]}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {!isPortal ? (
                        <Link href={`/employes/${m.id}`} className="row-link">
                          {m.first_name} {m.last_name}
                        </Link>
                      ) : (
                        <span>{m.first_name} {m.last_name}</span>
                      )}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.job_title || 'Collaborateur'}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--line)', paddingTop: '10px' }}>
                  <span className="badge-inline">{m.contract_type || 'CDI'}</span>
                  {m.status === 'conge' && <span className="status wait" style={{ fontSize: '11px' }}>En congé</span>}
                </div>

                {(m.phone || m.email) && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '4px' }}>
                    {m.phone && (
                      <a
                        href={`https://wa.me/${m.phone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="button secondary small"
                        style={{ flex: 1, padding: '4px 8px', fontSize: '12px' }}
                        title="Écrire sur WhatsApp"
                      >
                        <Icon name="whatsapp" size={14} /> WhatsApp
                      </a>
                    )}
                    {m.email && (
                      <a
                        href={`mailto:${m.email}`}
                        className="button secondary small icon-only"
                        title={m.email}
                      >
                        <Icon name="send" size={14} />
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
