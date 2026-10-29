'use client';

import { useEffect, useRef, useState } from 'react';
import { upsertLocation } from './actions';
import { haversine } from './game/geo';

export type LocationStatus = 'idle' | 'prompt' | 'active' | 'denied' | 'unavailable';

/**
 * Watches the device GPS and shares it with the game. Uploads at most every 8 s,
 * or immediately after moving 30 m — enough for live tracking without draining the battery.
 */
export function useLocationSharing(gameId: string | undefined, uid: string | null, enabled: boolean) {
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [status, setStatus] = useState<LocationStatus>('idle');
  const last = useRef<{ t: number; lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!enabled || !gameId || !uid) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('unavailable');
      return;
    }
    setStatus('prompt');
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setStatus('active');
        setPosition(pos);
        const now = Date.now();
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const moved = last.current ? haversine(last.current, p) : Infinity;
        if (!last.current || now - last.current.t > 8000 || moved > 30) {
          last.current = { t: now, ...p };
          upsertLocation(gameId, uid, pos).catch(() => {
            last.current = null; // retry on the next fix
          });
        }
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [gameId, uid, enabled]);

  return { position, status };
}

/** Keep the screen awake during a round so GPS keeps flowing (where supported). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const acquire = () => {
      navigator.wakeLock
        .request('screen')
        .then((l) => (lock = l))
        .catch(() => {});
    };
    acquire();
    const onVis = () => document.visibilityState === 'visible' && acquire();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      lock?.release().catch(() => {});
    };
  }, [active]);
}
