'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { timeAgo } from '@/lib/dates';
import { listMyNotifications, markNotificationsRead } from '@/app/actions';

// La petite cloche : un badge avec le nombre de notifications non lues, un panneau qui liste les
// dernières au clic (chargées à ce moment-là seulement), tout marqué lu dès l'ouverture.
export default function NotificationBell({ initialUnread = 0 }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState(null); // null = pas encore chargées
  const box = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (e.type === 'keydown' ? e.key === 'Escape' : !box.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);

  const toggle = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (unread > 0) { setUnread(0); markNotificationsRead().catch(() => {}); }
    try {
      setItems(await listMyNotifications());
    } catch {
      setItems([]);
    }
  };

  return (
    <div className="bell" ref={box}>
      <button type="button" className="sb-icon-btn bell-btn" onClick={toggle} aria-label="Notifications" aria-expanded={open} aria-haspopup="true">
        <Icon name="bell" size={20} />
        {unread > 0 && <span className="bell-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="bell-pop" role="menu" aria-label="Notifications">
          <div className="bell-head">Notifications</div>
          {items === null ? (
            <p className="help" style={{ padding: '16px' }}>Chargement...</p>
          ) : items.length === 0 ? (
            <p className="help" style={{ padding: '16px' }}>Rien pour l'instant.</p>
          ) : (
            <ul className="bell-list">
              {items.map((n) => (
                <li key={n.id}>
                  <Link href={n.url} onClick={() => setOpen(false)}>
                    <strong>{n.title}</strong>
                    {n.body && <span>{n.body}</span>}
                    <time>{timeAgo(n.created_at)}</time>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
