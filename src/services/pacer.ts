import type { PacerState, RouteData, RunWindow, TimeConfig } from '../types/route';
import { interpolateRoutePosition } from './geoMath.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

function parseClock(value: string): [number, number, number] | null {
  const parts = value.split(':').map((p) => parseInt(p, 10));
  if (parts.length < 2 || parts.some((p) => isNaN(p))) return null;
  return [parts[0], parts[1], parts[2] ?? 0];
}

/** Uhrzeit "HH:mm[:ss]" am Tag von `referenceMs`. */
function clockOnDay(value: string, referenceMs: number): number | null {
  const parsed = parseClock(value);
  if (!parsed) return null;
  const d = new Date(referenceMs);
  d.setHours(parsed[0], parsed[1], parsed[2], 0);
  return d.getTime();
}

/** Startzeitpunkt: bei „Start beim Tippen“ jetzt, sonst die feste Uhrzeit (nächstliegender Tag). */
export function resolveStart(time: TimeConfig, nowMs: number): number {
  if (time.startMode === 'tap') return nowMs;
  const t = clockOnDay(time.fixedStart, nowMs);
  if (t == null) return nowMs;
  if (t - nowMs > DAY_MS / 2) return t - DAY_MS;
  if (nowMs - t > DAY_MS / 2) return t + DAY_MS;
  return t;
}

/** Zielzeitpunkt zu einem gegebenen Start. Uhrzeit-Ziel = Beginn der Minute (:00). */
export function resolveTarget(time: TimeConfig, startMs: number): number {
  if (time.targetMode === 'duration') {
    return startMs + Math.max(1, time.targetDuration) * 1000;
  }
  const parsed = parseClock(time.targetClock);
  if (!parsed) return startMs + 30 * 60 * 1000;
  const d = new Date(startMs);
  d.setHours(parsed[0], parsed[1], 0, 0);
  let t = d.getTime();
  if (t <= startMs) t += DAY_MS;
  return t;
}

export function computeWindow(time: TimeConfig, startMs: number): RunWindow {
  return { startMs, targetMs: resolveTarget(time, startMs) };
}

/** Zustand des Pacers zum Zeitpunkt `nowMs`. */
export function pacerAt(route: RouteData | null, window: RunWindow, nowMs: number): PacerState {
  const total = route?.distanceMeters ?? 0;
  const durationS = Math.max(1, (window.targetMs - window.startMs) / 1000);
  const speedMps = total / durationS;
  const paceMinPerKm = total > 0 ? durationS / 60 / (total / 1000) : 0;

  const raw = (nowMs - window.startMs) / (window.targetMs - window.startMs);
  const progress = Math.max(0, Math.min(1, isFinite(raw) ? raw : 0));
  const alongMeters = progress * total;

  let position = null;
  let bearing = 0;
  if (route && route.coordinates.length >= 2 && total > 0) {
    const r = interpolateRoutePosition(route.coordinates, alongMeters, route.cumulative);
    position = r.position;
    bearing = r.bearing;
  }

  return {
    progress,
    alongMeters,
    position,
    bearing,
    speedMps,
    paceMinPerKm,
    remainingMeters: total - alongMeters,
    remainingSeconds: Math.max(0, (window.targetMs - nowMs) / 1000),
    elapsedSeconds: Math.max(0, (nowMs - window.startMs) / 1000),
    hasStarted: nowMs >= window.startMs,
    isFinished: nowMs >= window.targetMs,
  };
}
