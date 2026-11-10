import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';
import type { Fix } from '../types/route';
import { calculateDistance } from '../services/geoMath.ts';

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

/**
 * GPS-Tracking. Auf Android läuft es über einen Vordergrund-Dienst weiter,
 * auch wenn der Bildschirm aus ist (Benachrichtigung in der Statusleiste).
 */
export function useTracking() {
  const [enabled, setEnabled] = useState(false);
  const [fix, setFix] = useState<Fix | null>(null);
  const [error, setError] = useState<string | null>(null);

  const watcherRef = useRef<{ kind: 'native'; id: string } | { kind: 'web'; id: number } | null>(null);
  const lastRawRef = useRef<{ lat: number; lng: number; time: number } | null>(null);
  const speedRef = useRef<number | null>(null);

  const handlePosition = useCallback(
    (lat: number, lng: number, accuracy: number, rawSpeed: number | null | undefined, time: number) => {
      // Geschwindigkeit: GPS-Wert, sonst aus den letzten Punkten abgeleitet; leicht geglättet
      let speed = rawSpeed != null && isFinite(rawSpeed) && rawSpeed >= 0 ? rawSpeed : null;
      const prev = lastRawRef.current;
      if (speed == null && prev) {
        const dt = (time - prev.time) / 1000;
        if (dt >= 1) speed = calculateDistance(prev, { lat, lng }) / dt;
      }
      if (speed != null) {
        speedRef.current = speedRef.current == null ? speed : speedRef.current * 0.6 + speed * 0.4;
      }
      lastRawRef.current = { lat, lng, time };
      setError(null);
      setFix({ lat, lng, accuracy, speed: speedRef.current, time });
    },
    []
  );

  const stop = useCallback(() => {
    const w = watcherRef.current;
    watcherRef.current = null;
    if (w?.kind === 'native') BackgroundGeolocation.removeWatcher({ id: w.id }).catch(() => {});
    if (w?.kind === 'web') navigator.geolocation.clearWatch(w.id);
    lastRawRef.current = null;
    speedRef.current = null;
    setFix(null);
    setEnabled(false);
  }, []);

  const start = useCallback(async () => {
    if (watcherRef.current) return;
    setError(null);
    setEnabled(true);

    if (Capacitor.isNativePlatform()) {
      try {
        const id = await BackgroundGeolocation.addWatcher(
          {
            backgroundTitle: 'Sprintende Sprinter',
            backgroundMessage: 'Lauf aktiv. Standort wird für den Pacer-Vergleich genutzt.',
            requestPermissions: true,
            stale: false,
            distanceFilter: 2,
          },
          (location, err) => {
            if (err) {
              setError(
                err.code === 'NOT_AUTHORIZED'
                  ? 'Standortzugriff nicht erlaubt. Bitte in den Einstellungen freigeben.'
                  : err.message || 'GPS-Fehler'
              );
              return;
            }
            if (location) {
              handlePosition(location.latitude, location.longitude, location.accuracy, location.speed, location.time ?? Date.now());
            }
          }
        );
        watcherRef.current = { kind: 'native', id };
        return;
      } catch (e) {
        console.warn('Native Ortung fehlgeschlagen, nutze Browser-Ortung', e);
      }
    }

    if (!navigator.geolocation) {
      setError('Dieses Gerät unterstützt keine Ortung.');
      setEnabled(false);
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => handlePosition(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, pos.coords.speed, pos.timestamp),
      (err) => setError(err.code === err.PERMISSION_DENIED ? 'Standortzugriff nicht erlaubt.' : 'Kein GPS-Signal.'),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
    );
    watcherRef.current = { kind: 'web', id };
  }, [handlePosition]);

  const openSettings = useCallback(() => {
    if (Capacitor.isNativePlatform()) BackgroundGeolocation.openSettings().catch(() => {});
  }, []);

  useEffect(() => stop, [stop]);

  return { enabled, fix, error, start, stop, openSettings };
}
