import type { LatLng, Preset } from '../types/route';
import type { LiveDeparture } from './transit.ts';
import { calculateDistance } from './geoMath.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Umwegfaktor: Luftlinie → tatsächlicher Fußweg (grobe Schätzung ohne Routing) */
export const DETOUR_FACTOR = 1.3;

export interface LiveInfo {
  delayMin: number;
  track: string | null;
  trackChanged: boolean;
  cancelled: boolean;
  line: string;
  headsign: string;
}

export interface Departure {
  /** angezeigte (planmäßige) Uhrzeit, z. B. Abfahrt "13:04" */
  time: string;
  /** Zeitpunkt, zu dem man da sein muss (tatsächliche Abfahrt minus Puffer) */
  arriveMs: number;
  /** planmäßiger Zeitpunkt (ohne Puffer) */
  scheduledMs: number;
  /** liegt am nächsten Tag */
  tomorrow: boolean;
  live?: LiveInfo;
}

const hhmm = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

function startOfDay(ms: number) {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function liveInfo(l: LiveDeparture): LiveInfo {
  return {
    delayMin: Math.round((l.realMs - l.scheduledMs) / 60_000),
    track: l.track,
    trackChanged: !!(l.track && l.scheduledTrack && l.track !== l.scheduledTrack),
    cancelled: l.cancelled,
    line: l.line,
    headsign: l.headsign,
  };
}

/**
 * Die nächsten anstehenden Zeiten eines Wegs.
 * Mit Live-Daten: Verspätung verschiebt die Ankunftszeit, Ausfälle werden markiert.
 * Ohne feste Zeiten, aber mit Zug-Verknüpfung: die nächsten Abfahrten der Linie.
 */
export function upcomingDepartures(preset: Preset, nowMs: number, count = 3, live?: LiveDeparture[] | null): Departure[] {
  const buffer = preset.bufferMin * 60_000;
  const today = startOfDay(nowMs);

  if (preset.times.length === 0 && live) {
    return live
      .filter((l) => l.realMs - buffer > nowMs + 30_000)
      .sort((a, b) => a.realMs - b.realMs)
      .slice(0, count)
      .map((l) => ({
        time: hhmm(l.scheduledMs),
        scheduledMs: l.scheduledMs,
        arriveMs: l.realMs - buffer,
        tomorrow: startOfDay(l.scheduledMs) > today,
        live: liveInfo(l),
      }));
  }

  const out: Departure[] = [];
  for (const dayOffset of [0, 1]) {
    for (const time of [...preset.times].sort()) {
      const [h, m] = time.split(':').map((x) => parseInt(x, 10));
      if (isNaN(h) || isNaN(m)) continue;
      const d = new Date(nowMs + dayOffset * DAY_MS);
      d.setHours(h, m, 0, 0);
      const scheduledMs = d.getTime();
      const match = live?.find((l) => Math.abs(l.scheduledMs - scheduledMs) < 60_000);
      const realMs = match && !match.cancelled ? match.realMs : scheduledMs;
      const arriveMs = realMs - buffer;
      if (arriveMs > nowMs + 30_000) {
        out.push({ time, scheduledMs, arriveMs, tomorrow: dayOffset === 1, live: match ? liveInfo(match) : undefined });
      }
    }
  }
  return out.sort((a, b) => a.arriveMs - b.arriveMs).slice(0, count);
}

export interface PresetEstimate {
  distanceMeters: number;
  /** spätestens loslaufen bei normalem Tempo */
  latestLeaveMs: number;
  /** nötiges Tempo, wenn man jetzt losgeht (km/h) */
  requiredKmh: number;
}

export function estimate(here: LatLng, preset: Preset, arriveMs: number, nowMs: number, walkSpeedKmh: number): PresetEstimate {
  const distanceMeters = calculateDistance(here, preset.dest) * DETOUR_FACTOR;
  const walkSeconds = distanceMeters / (walkSpeedKmh / 3.6);
  const available = Math.max(1, (arriveMs - nowMs) / 1000);
  return {
    distanceMeters,
    latestLeaveMs: arriveMs - walkSeconds * 1000,
    requiredKmh: (distanceMeters / available) * 3.6,
  };
}

/* ---------- Erinnerungen ---------- */

export interface PlannedReminder {
  presetId: string;
  scheduledMs: number;
  at: number;
  title: string;
  body: string;
}

/** Erinnerungen der nächsten Tage („In 5 min los …“), ausgehend vom gespeicherten Startpunkt. */
export function planReminders(presets: Preset[], nowMs: number, walkSpeedKmh: number, days = 7): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  for (const p of presets) {
    const r = p.remind;
    if (!r?.enabled || !p.origin || p.times.length === 0) continue;
    const dist = p.originDistance ?? calculateDistance(p.origin, p.dest) * DETOUR_FACTOR;
    const walkMs = (dist / (walkSpeedKmh / 3.6)) * 1000;
    const line = p.transit?.line.trim();
    for (let day = 0; day < days; day++) {
      const base = new Date(nowMs + day * DAY_MS);
      if (!r.days.includes(base.getDay())) continue;
      for (const time of p.times) {
        const [h, m] = time.split(':').map((x) => parseInt(x, 10));
        if (isNaN(h) || isNaN(m)) continue;
        const d = new Date(base);
        d.setHours(h, m, 0, 0);
        const scheduledMs = d.getTime();
        // auf volle Minute abrunden – lieber etwas früher erinnern
        const at = Math.floor((scheduledMs - p.bufferMin * 60_000 - walkMs - r.leadMin * 60_000) / 60_000) * 60_000;
        if (at <= nowMs + 30_000) continue;
        const what = line ? `${line} um ${time}` : time;
        out.push({
          presetId: p.id,
          scheduledMs,
          at,
          title: p.name,
          body: r.leadMin > 0 ? `In ${r.leadMin} min los, damit du ${what} schaffst.` : `Jetzt los, damit du ${what} schaffst.`,
        });
      }
    }
  }
  return out.sort((a, b) => a.at - b.at).slice(0, 60);
}
