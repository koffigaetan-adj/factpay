'use client';

import { useEffect, useRef } from 'react';

// Déconnexion automatique après 1 heure (3600 secondes) sans activité
const INACTIVITY_LIMIT_MS = 60 * 60 * 1000; // 1 heure = 3 600 000 ms
const PING_INTERVAL_MS = 2 * 60 * 1000;     // 2 minutes
const ACTIVITY_STORAGE_KEY = 'factpay_last_active';

export default function SessionTimeoutWatcher() {
  const lastActiveRef = useRef(Date.now());
  const lastPingRef = useRef(Date.now());
  const isLoggingOutRef = useRef(false);

  useEffect(() => {
    const getStoredActivity = () => {
      try {
        const val = localStorage.getItem(ACTIVITY_STORAGE_KEY);
        return val ? parseInt(val, 10) : 0;
      } catch {
        return 0;
      }
    };

    const saveActivity = (timestamp) => {
      try {
        localStorage.setItem(ACTIVITY_STORAGE_KEY, String(timestamp));
      } catch {}
    };

    const now = Date.now();
    // Synchroniser avec l'activité récente d'un autre onglet si disponible
    const stored = getStoredActivity();
    lastActiveRef.current = (stored && (now - stored < INACTIVITY_LIMIT_MS)) ? Math.max(stored, now) : now;
    saveActivity(lastActiveRef.current);
    lastPingRef.current = now;

    let lastSave = 0;
    const recordActivity = () => {
      const cur = Date.now();
      lastActiveRef.current = cur;
      // Met à jour localStorage au plus une fois toutes les 3 secondes pour préserver les performances
      if (cur - lastSave >= 3000) {
        lastSave = cur;
        saveActivity(cur);
      }
    };

    const triggerLogout = () => {
      if (isLoggingOutRef.current) return;
      isLoggingOutRef.current = true;
      try {
        localStorage.removeItem(ACTIVITY_STORAGE_KEY);
      } catch {}
      fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
        window.location.href = '/connexion?expire=1';
      });
    };

    const checkInactivity = () => {
      if (isLoggingOutRef.current) return;
      const cur = Date.now();
      // Prendre le timestamp le plus récent entre la mémoire locale et les autres onglets
      const effectiveLastActive = Math.max(lastActiveRef.current, getStoredActivity());
      const inactive = cur - effectiveLastActive;

      if (inactive >= INACTIVITY_LIMIT_MS) {
        triggerLogout();
        return;
      }

      // Si l'utilisateur a été actif et qu'au moins 2 minutes se sont écoulées, on rafraîchit la session serveur
      const wasActiveSinceLastPing = effectiveLastActive > lastPingRef.current;
      if (wasActiveSinceLastPing && (cur - lastPingRef.current >= PING_INTERVAL_MS)) {
        lastPingRef.current = cur;
        fetch('/api/auth/touch', { method: 'POST' })
          .then((res) => {
            if (res.status === 401) {
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

    // Écoute aussi les changements d'activité venant des autres onglets ouverts
    const onStorage = (e) => {
      if (e.key === ACTIVITY_STORAGE_KEY && e.newValue) {
        const ts = parseInt(e.newValue, 10);
        if (ts > lastActiveRef.current) {
          lastActiveRef.current = ts;
        }
      }
    };
    window.addEventListener('storage', onStorage);

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
      window.removeEventListener('storage', onStorage);
      if (moveTimer) clearTimeout(moveTimer);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return null;
}
