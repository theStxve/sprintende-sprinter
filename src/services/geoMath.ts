import type { LatLng } from '../types/route';

const EARTH_RADIUS_METERS = 6371000;

const toRadians = (deg: number) => (deg * Math.PI) / 180;
const toDegrees = (rad: number) => (rad * 180) / Math.PI;

/** Haversine-Distanz in Metern. */
export function calculateDistance(p1: LatLng, p2: LatLng): number {
  const dLat = toRadians(p2.lat - p1.lat);
  const dLng = toRadians(p2.lng - p1.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(toRadians(p1.lat)) * Math.cos(toRadians(p2.lat));
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const pt = (c: [number, number]): LatLng => ({ lat: c[0], lng: c[1] });

/** Gesamtlänge und kumulierte Distanzen einer Linie ([lat, lng]-Paare). */
export function calculateRouteDistances(coordinates: [number, number][]): {
  totalDistance: number;
  cumulativeDistances: number[];
} {
  const cumulativeDistances: number[] = [0];
  let total = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    total += calculateDistance(pt(coordinates[i]), pt(coordinates[i + 1]));
    cumulativeDistances.push(total);
  }
  return { totalDistance: total, cumulativeDistances };
}

/** Anfangskurs (0–360°) von p1 nach p2. */
export function calculateBearing(p1: LatLng, p2: LatLng): number {
  const lat1 = toRadians(p1.lat);
  const lat2 = toRadians(p2.lat);
  const dLng = toRadians(p2.lng - p1.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

/** Index des Segments, auf dem die Distanz `d` liegt (binäre Suche). */
function segmentIndexAt(cum: number[], d: number): number {
  let low = 0;
  let high = cum.length - 1;
  while (low < high - 1) {
    const mid = (low + high) >> 1;
    if (cum[mid] <= d) low = mid;
    else high = mid;
  }
  return low;
}

/** Position und Richtung bei `distance` Metern entlang der Linie. */
export function interpolateRoutePosition(
  coordinates: [number, number][],
  distance: number,
  cumulativeDistances?: number[]
): { position: LatLng; bearing: number } {
  if (coordinates.length === 0) return { position: { lat: 0, lng: 0 }, bearing: 0 };
  if (coordinates.length === 1) return { position: pt(coordinates[0]), bearing: 0 };

  const cum = cumulativeDistances ?? calculateRouteDistances(coordinates).cumulativeDistances;
  const total = cum[cum.length - 1];
  const n = coordinates.length;

  if (distance <= 0) {
    return { position: pt(coordinates[0]), bearing: calculateBearing(pt(coordinates[0]), pt(coordinates[1])) };
  }
  if (distance >= total) {
    return { position: pt(coordinates[n - 1]), bearing: calculateBearing(pt(coordinates[n - 2]), pt(coordinates[n - 1])) };
  }

  const i = segmentIndexAt(cum, distance);
  const a = pt(coordinates[i]);
  const b = pt(coordinates[i + 1]);
  const segLength = cum[i + 1] - cum[i];
  if (segLength === 0) return { position: a, bearing: 0 };

  const f = (distance - cum[i]) / segLength;
  return {
    position: { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f },
    bearing: calculateBearing(a, b),
  };
}

/** Teil der Linie von 0 bis `distance` Meter. */
export function sliceRoute(
  coordinates: [number, number][],
  cum: number[],
  distance: number
): [number, number][] {
  if (coordinates.length < 2 || distance <= 0) return [];
  const total = cum[cum.length - 1];
  if (distance >= total) return coordinates.slice();
  const i = segmentIndexAt(cum, distance);
  const { position } = interpolateRoutePosition(coordinates, distance, cum);
  return [...coordinates.slice(0, i + 1), [position.lat, position.lng]];
}

/** Lotfußpunkt auf Segment [a, b] in lokaler planarer Näherung. */
function projectOnSegment(p: LatLng, a: LatLng, b: LatLng): { point: LatLng; fraction: number } {
  const k = Math.cos(toRadians((a.lat + b.lat) / 2));
  const dx = (b.lng - a.lng) * k;
  const dy = b.lat - a.lat;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { point: a, fraction: 0 };
  const t = Math.max(0, Math.min(1, (((p.lng - a.lng) * k) * dx + (p.lat - a.lat) * dy) / lenSq));
  return { point: { lat: a.lat + t * (b.lat - a.lat), lng: a.lng + t * (b.lng - a.lng) }, fraction: t };
}

export interface RouteLocation {
  alongMeters: number;
  offRouteMeters: number;
  closestPoint: LatLng;
}

/**
 * Ordnet einen Punkt der Strecke zu.
 *
 * Bei Rundkursen oder Hin-und-zurück-Strecken liegen mehrere Streckenteile
 * gleich nah am Punkt. Dann wird das Teilstück gewählt, das am nächsten an
 * `hintMeters` liegt (z. B. letzte bekannte Position des Läufers).
 */
export function locateOnRoute(
  coordinates: [number, number][],
  cum: number[],
  point: LatLng,
  hintMeters?: number | null,
  ambiguityToleranceMeters = 25
): RouteLocation {
  if (coordinates.length < 2) {
    const single = coordinates.length === 1 ? pt(coordinates[0]) : point;
    return { alongMeters: 0, offRouteMeters: calculateDistance(point, single), closestPoint: single };
  }

  const candidates: RouteLocation[] = [];
  let minDist = Infinity;
  for (let i = 0; i < coordinates.length - 1; i++) {
    const { point: p, fraction } = projectOnSegment(point, pt(coordinates[i]), pt(coordinates[i + 1]));
    const d = calculateDistance(point, p);
    candidates.push({ alongMeters: cum[i] + fraction * (cum[i + 1] - cum[i]), offRouteMeters: d, closestPoint: p });
    if (d < minDist) minDist = d;
  }

  const near = candidates.filter((c) => c.offRouteMeters <= minDist + ambiguityToleranceMeters);
  if (hintMeters == null) {
    return near.reduce((best, c) => (c.offRouteMeters < best.offRouteMeters ? c : best));
  }
  return near.reduce((best, c) =>
    Math.abs(c.alongMeters - hintMeters) < Math.abs(best.alongMeters - hintMeters) ? c : best
  );
}

/* ---------- Formatierung ---------- */

/** min/km als "m:ss" – rundet auf ganze Sekunden, ohne "5:60". */
export function formatPace(paceMinPerKm: number): string {
  if (!isFinite(paceMinPerKm) || paceMinPerKm <= 0 || paceMinPerKm > 99) return '–:––';
  const total = Math.round(paceMinPerKm * 60);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatDuration(totalSeconds: number): string {
  if (!isFinite(totalSeconds)) return '––:––';
  const sec = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = m.toString().padStart(2, '0');
  const ss = s.toString().padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatDistance(meters: number): string {
  if (!isFinite(meters)) return '–';
  if (meters >= 1000) return `${(meters / 1000).toFixed(2).replace('.', ',')} km`;
  return `${Math.round(meters)} m`;
}

export function formatClock(ms: number, withSeconds = false): string {
  const d = new Date(ms);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  if (!withSeconds) return `${hh}:${mm}`;
  return `${hh}:${mm}:${d.getSeconds().toString().padStart(2, '0')}`;
}
