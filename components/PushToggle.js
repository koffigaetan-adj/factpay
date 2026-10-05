'use client';

import { useEffect, useState } from 'react';
import { subscribePush, unsubscribePush } from '@/app/actions';

// « BG4R... » → Uint8Array, format attendu par pushManager.subscribe()
function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// Active ou désactive les notifications sur cet appareil précis : une facture payée, un devis
// accepté ou un paiement signalé arrivent alors même quand FactPay n'est pas ouvert.
export default function PushToggle({ vapidPublicKey }) {
  const [status, setStatus] = useState('loading'); // loading | unsupported | denied | off | on
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !vapidPublicKey) {
        setStatus('unsupported');
        return;
      }
      if (Notification.permission === 'denied') { setStatus('denied'); return; }
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        const sub = await reg.pushManager.getSubscription();
        setStatus(sub ? 'on' : 'off');
      } catch {
        setStatus('unsupported');
      }
    })();
  }, [vapidPublicKey]);

  const enable = async () => {
    setBusy(true);
    setError('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setStatus(permission === 'denied' ? 'denied' : 'off'); return; }
      const reg = await navigator.serviceWorker.register('/sw.js');
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) });
      const fd = new FormData();
      fd.set('subscription', JSON.stringify(sub));
      await subscribePush(fd);
      setStatus('on');
    } catch (err) {
      console.error(err);
      setError("Impossible d'activer les notifications sur cet appareil.");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setError('');
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const fd = new FormData();
        fd.set('endpoint', sub.endpoint);
        await unsubscribePush(fd);
        await sub.unsubscribe();
      }
      setStatus('off');
    } catch (err) {
      console.error(err);
      setError('Impossible de désactiver les notifications.');
    } finally {
      setBusy(false);
    }
  };

  if (status === 'loading') return null;
  if (status === 'unsupported') return <span className="help">Non disponible sur ce navigateur</span>;
  if (status === 'denied') return <span className="help">Bloquées dans les réglages du navigateur</span>;

  return (
    <div style={{ display: 'grid', justifyItems: 'end', gap: 4 }}>
      <button type="button" role="switch" aria-checked={status === 'on'} aria-label="Notifications sur cet appareil"
        className="switch" disabled={busy} onClick={() => (status === 'on' ? disable() : enable())}>
        <span className="switch-knob" />
      </button>
      {error && <span className="err" role="alert" style={{ fontSize: 13 }}>{error}</span>}
    </div>
  );
}
