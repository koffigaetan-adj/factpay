'use client';

import { useEffect, useRef } from 'react';

// Déconnexion automatique après 1 heure (3600 secondes) sans activité
const INACTIVITY_LIMIT_MS = 60 * 60 * 1000; // 1 heure = 3 600 000 ms
const PING_INTERVAL_MS = 2 * 60 * 1000;     // 2 minutes

export default function SessionTimeoutWatcher() {
  const lastActiveRef = useRef(Date.now());
  const lastPingRef = useRef(Date.now());
  const isLoggingOutRef = useRef(false);

  useEffect(() => {
    lastActiveRef.current = Date.now();
    lastPingRef.current = Date.now();

    const recordActivity = () => {
      lastActiveRef.current = Date.now();
    };

    const triggerLogout = () => {
      if (isLoggingOutRef.current) return;
      isLoggingOutRef.current = true;
      fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
        window.location.href = '/connexion?expire=1';
      });
    };

    const checkInactivity = () => {
      if (isLoggingOutRef.current) return;
      const now = Date.now();
      const inactive = now - lastActiveRef.current;

      if (inactive >= INACTIVITY_LIMIT_MS) {
        triggerLogout();
        return;
      }

      // Si l'utilisateur est actif et qu'au moins 2 minutes se sont écoulées, on rafraîchit la session serveur
      if (now - lastPingRef.current >= PING_INTERVAL_MS) {
        lastPingRef.current = now;
        fetch('/api/auth/touch', { method: 'POST' })
          .then((res) => {
            if (!res.ok) {
              triggerLogout();
            }
          })
          .catch(() => {});
      }
    };

    // Événements marquant une activité utilisateur
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((ev) => window.addEventListener(ev, recordActivity, { passive: true }));

    // Throttle pour mousemove (évite de réagir à chaque micro-pixel)
    let moveTimer = null;
    const onMouseMove = () => {
      if (!moveTimer) {
        recordActivity();
        moveTimer = setTimeout(() => { moveTimer = null; }, 1000);
      }
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });

    // Vérifie l'inactivité toutes les 15 secondes
    const interval = setInterval(checkInactivity, 15000);

    // Vérifie aussi dès que l'onglet redevient visible (ex: réveil d'ordinateur ou retour sur l'onglet)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkInactivity();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, recordActivity));
      window.removeEventListener('mousemove', onMouseMove);
      if (moveTimer) clearTimeout(moveTimer);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return null;
}
