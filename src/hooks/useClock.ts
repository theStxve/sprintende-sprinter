import { useCallback, useEffect, useRef, useState } from 'react';
import type { RunWindow } from '../types/route';

/** Aktuelle Zeit, aktualisiert im angegebenen Intervall. */
export function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

export const SIM_SPEEDS = [1, 5, 20, 60] as const;

/**
 * Vorschau: spielt den Pacer im Zeitraffer über ein fest eingefrorenes Zeitfenster ab.
 */
export function useSimulation() {
  const [window_, setWindow] = useState<RunWindow | null>(null);
  const [simNow, setSimNow] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(20);
  const lastRef = useRef(0);

  useEffect(() => {
    if (!window_ || !playing) return;
    lastRef.current = performance.now();
    const id = window.setInterval(() => {
      const t = performance.now();
      const dt = t - lastRef.current;
      lastRef.current = t;
      setSimNow((prev) => {
        const next = prev + dt * speed;
        if (next >= window_.targetMs) {
          setPlaying(false);
          return window_.targetMs;
        }
        return next;
      });
    }, 100);
    return () => window.clearInterval(id);
  }, [window_, playing, speed]);

  const open = useCallback((w: RunWindow) => {
    setWindow(w);
    setSimNow(w.startMs);
    setPlaying(true);
  }, []);

  const close = useCallback(() => {
    setWindow(null);
    setPlaying(false);
  }, []);

  const scrub = useCallback(
    (fraction: number) => {
      if (!window_) return;
      const f = Math.max(0, Math.min(1, fraction));
      setSimNow(window_.startMs + f * (window_.targetMs - window_.startMs));
    },
    [window_]
  );

  const togglePlay = useCallback(() => {
    if (!window_) return;
    setPlaying((p) => {
      if (!p && simNow >= window_.targetMs) setSimNow(window_.startMs);
      return !p;
    });
  }, [window_, simNow]);

  return { active: window_ != null, window: window_, now: simNow, playing, speed, setSpeed, open, close, scrub, togglePlay };
}
