/**
 * Fahrplan und Echtzeit über Transitous (https://transitous.org) – kostenlos, ohne API-Key,
 * deutschlandweit mit Verspätungen, Gleisen und Ausfällen.
 */
import type { LatLng, TransitLink } from '../types/route';

const BASE = 'https://api.transitous.org/api/v1';

export interface StopResult {
  id: string;
  name: string;
  place: string;
  lat: number;
  lng: number;
}

export interface LiveDeparture {
  scheduledMs: number;
  realMs: number;
  track: string | null;
  scheduledTrack: string | null;
  cancelled: boolean;
  realTime: boolean;
  line: string;
  headsign: string;
}

export async function searchStops(query: string, near?: LatLng | null, signal?: AbortSignal): Promise<StopResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  let url = `${BASE}/geocode?text=${encodeURIComponent(q)}&type=STOP`;
  if (near) url += `&place=${near.lat.toFixed(4)},${near.lng.toFixed(4)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Haltestellensuche fehlgeschlagen (${res.status})`);
  const data: { id: string; name: string; lat: number; lon: number; areas?: { name: string; default?: boolean }[] }[] = await res.json();
  return data.slice(0, 8).map((s) => ({
    id: s.id,
    name: s.name,
    place: s.areas?.find((a) => a.default)?.name ?? '',
    lat: s.lat,
    lng: s.lon,
  }));
}

interface RawStopTime {
  place: { scheduledDeparture?: string; departure?: string; track?: string; scheduledTrack?: string; cancelled?: boolean };
  realTime: boolean;
  routeShortName?: string;
  displayName?: string;
  headsign?: string;
  cancelled?: boolean;
  tripCancelled?: boolean;
}

async function fetchStopTimes(stopId: string, fromMs: number, n: number, signal?: AbortSignal): Promise<LiveDeparture[]> {
  const time = new Date(fromMs).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const res = await fetch(`${BASE}/stoptimes?stopId=${encodeURIComponent(stopId)}&n=${n}&time=${time}`, { signal });
  if (!res.ok) throw new Error(`Abfahrten nicht verfügbar (${res.status})`);
  const data: { stopTimes?: RawStopTime[] } = await res.json();
  return (data.stopTimes ?? [])
    .filter((s) => s.place.scheduledDeparture)
    .map((s) => ({
      scheduledMs: Date.parse(s.place.scheduledDeparture!),
      realMs: Date.parse(s.place.departure ?? s.place.scheduledDeparture!),
      track: s.place.track ?? null,
      scheduledTrack: s.place.scheduledTrack ?? null,
      cancelled: !!(s.cancelled || s.tripCancelled || s.place.cancelled),
      realTime: s.realTime,
      // "RB10 (62082)" → "RB10"
      line: (s.routeShortName ?? s.displayName ?? '').split(' (')[0],
      headsign: s.headsign ?? '',
    }));
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');

/** Passt eine Abfahrt zu Linie und Richtung des Wegs? Leere Filter passen immer. */
export function matchesLink(link: TransitLink, d: LiveDeparture): boolean {
  if (link.line.trim()) {
    const want = norm(link.line);
    const first = norm(d.line.split(' ')[0] ?? '');
    if (first !== want && !norm(d.line).startsWith(want)) return false;
  }
  if (link.direction.trim() && !norm(d.headsign).includes(norm(link.direction))) return false;
  return true;
}

/**
 * Abfahrten einer Haltestelle für einen Weg.
 * Die Haltestellen-ID kann sich bei Datenupdates ändern – dann wird per Name neu gesucht.
 */
export async function departuresFor(link: TransitLink, fromMs: number, signal?: AbortSignal): Promise<{ deps: LiveDeparture[]; newStopId?: string }> {
  try {
    const deps = await fetchStopTimes(link.stopId, fromMs, 100, signal);
    if (deps.length > 0) return { deps: deps.filter((d) => matchesLink(link, d)) };
  } catch (e) {
    if (signal?.aborted) throw e;
  }
  const candidates = await searchStops(link.stopName, { lat: link.lat, lng: link.lng }, signal);
  const again = candidates[0];
  if (!again || again.id === link.stopId) return { deps: [] };
  const deps = await fetchStopTimes(again.id, fromMs, 100, signal);
  return { deps: deps.filter((d) => matchesLink(link, d)), newStopId: again.id };
}
