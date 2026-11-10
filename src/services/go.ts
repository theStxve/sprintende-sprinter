import type { GoTarget, LatLng, Preset, SavedRoute, TravelMode } from '../types/route';
import { calculateDistance } from './geoMath.ts';

/** Ziele, die näher beieinander liegen, gelten als derselbe Ort */
const SAME_PLACE_M = 40;
const MAX_HISTORY = 30;

export interface GoCandidate {
  key: string;
  name: string;
  lat: number;
  lng: number;
  travelMode: TravelMode;
  /** z. B. "5× genutzt", "Weg", "Strecke" */
  source: string;
  /** Meter Luftlinie von hier, wenn bekannt */
  distance: number | null;
}

/** Häufigkeit mit Alterung: oft und kürzlich genutzte Ziele zuerst */
function score(t: GoTarget, nowMs: number) {
  const days = Math.max(0, (nowMs - t.lastUsed) / 86_400_000);
  return t.uses / (1 + days / 14);
}

/**
 * Vorschläge für den Go-Modus: zuerst eigener Verlauf (häufig/kürzlich),
 * dann Ziele gespeicherter Wege, dann Endpunkte gespeicherter Strecken.
 */
export function goCandidates(
  history: GoTarget[],
  presets: Preset[],
  saved: SavedRoute[],
  here: LatLng | null,
  nowMs: number,
  limit = 8
): GoCandidate[] {
  const out: GoCandidate[] = [];
  const push = (c: Omit<GoCandidate, 'distance'>) => {
    // Ort, an dem man gerade steht, ist kein sinnvolles Ziel
    const distance = here ? calculateDistance(here, c) : null;
    if (distance != null && distance < 60) return;
    if (out.some((o) => calculateDistance(o, c) < SAME_PLACE_M)) return;
    out.push({ ...c, distance });
  };

  [...history]
    .sort((a, b) => score(b, nowMs) - score(a, nowMs))
    .forEach((t) =>
      push({ key: 'h-' + t.id, name: t.name, lat: t.lat, lng: t.lng, travelMode: t.travelMode, source: t.uses > 1 ? `${t.uses}× genutzt` : 'Zuletzt' })
    );
  presets
    .filter((p) => p.dest.name)
    .forEach((p) => push({ key: 'p-' + p.id, name: p.name || p.dest.name, lat: p.dest.lat, lng: p.dest.lng, travelMode: p.travelMode, source: 'Weg' }));
  saved.forEach((r) => {
    const end = r.waypoints[r.waypoints.length - 1];
    if (end) push({ key: 's-' + r.id, name: r.name, lat: end.lat, lng: end.lng, travelMode: r.travelMode, source: 'Strecke' });
  });
  return out.slice(0, limit);
}

/** Ziel im Verlauf vermerken (gleicher Ort → Zähler hoch). */
export function recordGo(history: GoTarget[], dest: { name: string; lat: number; lng: number; travelMode: TravelMode }, nowMs: number): GoTarget[] {
  const idx = history.findIndex((t) => calculateDistance(t, dest) < SAME_PLACE_M);
  if (idx >= 0) {
    const next = history.slice();
    const t = next[idx];
    next[idx] = { ...t, name: dest.name || t.name, lat: dest.lat, lng: dest.lng, travelMode: dest.travelMode, uses: t.uses + 1, lastUsed: nowMs };
    return next;
  }
  const entry: GoTarget = {
    id: `go-${nowMs.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name: dest.name,
    lat: dest.lat,
    lng: dest.lng,
    travelMode: dest.travelMode,
    uses: 1,
    lastUsed: nowMs,
  };
  return [...history, entry].sort((a, b) => score(b, nowMs) - score(a, nowMs)).slice(0, MAX_HISTORY);
}

/** Typisches Tempo je Fortbewegung in km/h (Gehen: aus den Einstellungen) */
export function typicalKmh(mode: TravelMode, walkSpeedKmh: number) {
  return mode === 'cycling' ? 15 : mode === 'driving' ? 30 : walkSpeedKmh;
}

/** Vorschlag für die Ankunft: jetzt + Weg bei normalem Tempo + 1 min Luft, auf volle Minute aufgerundet. */
export function suggestArrival(nowMs: number, distanceMeters: number, kmh: number) {
  const travelMs = (distanceMeters / (kmh / 3.6)) * 1000;
  return Math.ceil((nowMs + travelMs + 60_000) / 60_000) * 60_000;
}
