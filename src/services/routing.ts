/**
 * Kostenlose Dienste ohne API-Key:
 *  - Routing: FOSSGIS-OSRM (routing.openstreetmap.de) mit echten Profilen für Fuß, Rad, Auto
 *  - Routing mit gesperrten Straßen: FOSSGIS-Valhalla (valhalla1.openstreetmap.de)
 *  - Suche/Ortsnamen: Photon (photon.komoot.io)
 */
import type { Block, LatLng, TravelMode, Waypoint } from '../types/route';

export interface SearchResult {
  id: string;
  name: string;
  detail: string;
  lat: number;
  lng: number;
}

const ROUTER_PROFILE: Record<TravelMode, string> = {
  walking: 'routed-foot',
  cycling: 'routed-bike',
  driving: 'routed-car',
};

export class RoutingError extends Error {}

/** Liefert die Linie als [lat, lng]-Paare. Wirft bei Fehler – der Aufrufer entscheidet über Fallback.
 *  Mit gesperrten Straßen in der Nähe wird Valhalla genutzt, weil OSRM keine einzelnen Straßen meiden kann. */
export async function fetchRoute(
  waypoints: Waypoint[],
  mode: TravelMode,
  signal?: AbortSignal,
  blocks: Block[] = []
): Promise<[number, number][]> {
  if (waypoints.length < 2) throw new RoutingError('Mindestens zwei Punkte nötig.');
  const nearby = blocksNear(blocks, waypoints);
  if (nearby.length > 0) return fetchValhallaRoute(waypoints, mode, nearby, signal);
  const coords = waypoints.map((w) => `${w.lng.toFixed(6)},${w.lat.toFixed(6)}`).join(';');
  const url = `https://routing.openstreetmap.de/${ROUTER_PROFILE[mode]}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new RoutingError(`Routing-Server antwortet mit ${res.status}`);
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.length) throw new RoutingError('Keine Route gefunden.');

  return (data.routes[0].geometry.coordinates as [number, number][]).map(([lng, lat]) => [lat, lng]);
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id?: number;
    osm_type?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    district?: string;
    locality?: string;
    state?: string;
    country?: string;
  };
}

function describe(f: PhotonFeature): { name: string; detail: string } {
  const p = f.properties;
  const street = [p.street, p.housenumber].filter(Boolean).join(' ');
  const place = p.city || p.locality || p.district || p.state || '';
  const name = p.name || street || place || 'Unbenannter Ort';
  const detail = [p.name ? street : '', [p.postcode, place].filter(Boolean).join(' '), p.country]
    .filter((s) => s && s !== name)
    .join(', ');
  return { name, detail };
}

export async function searchPlaces(query: string, near?: LatLng | null, signal?: AbortSignal): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  let url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=de`;
  if (near) url += `&lat=${near.lat.toFixed(4)}&lon=${near.lng.toFixed(4)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Suche fehlgeschlagen (${res.status})`);
  const data: { features: PhotonFeature[] } = await res.json();
  const seen = new Set<string>();
  return data.features.map((f, i) => {
    const { name, detail } = describe(f);
    return {
      id: `${f.properties.osm_type ?? ''}${f.properties.osm_id ?? i}`,
      name,
      detail,
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
    };
  }).filter((r) => {
    const key = `${r.name}|${r.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function coordLabel(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=de`);
    if (!res.ok) return coordLabel(lat, lng);
    const data: { features: PhotonFeature[] } = await res.json();
    const f = data.features[0];
    if (!f) return coordLabel(lat, lng);
    const { name, detail } = describe(f);
    return detail ? `${name}, ${detail.split(',')[0]}` : name;
  } catch {
    return coordLabel(lat, lng);
  }
}

/* ---------- Gesperrte Straßen (Valhalla) ---------- */

const VALHALLA = 'https://valhalla1.openstreetmap.de';
const VALHALLA_COSTING: Record<TravelMode, string> = { walking: 'pedestrian', cycling: 'bicycle', driving: 'auto' };
/** Valhalla nimmt höchstens 50 Sperrpunkte an */
const MAX_BLOCKS = 50;

/** Nur Sperren im Umkreis der Strecke schicken (Rechteck um die Punkte plus ca. 5 km) */
export function blocksNear(blocks: Block[], waypoints: LatLng[]): Block[] {
  if (blocks.length === 0 || waypoints.length === 0) return [];
  const lats = waypoints.map((w) => w.lat);
  const lngs = waypoints.map((w) => w.lng);
  const m = 0.05;
  const [s, n, w, e] = [Math.min(...lats) - m, Math.max(...lats) + m, Math.min(...lngs) - m * 1.6, Math.max(...lngs) + m * 1.6];
  return blocks.filter((b) => b.lat >= s && b.lat <= n && b.lng >= w && b.lng <= e).slice(0, MAX_BLOCKS);
}

/** Google-Polyline mit 6 Nachkommastellen (Valhalla) → [lat, lng] */
export function decodePolyline6(str: string): [number, number][] {
  const out: [number, number][] = [];
  let i = 0;
  let lat = 0;
  let lng = 0;
  while (i < str.length) {
    for (let k = 0; k < 2; k++) {
      let shift = 0;
      let result = 0;
      let b: number;
      do {
        b = str.charCodeAt(i++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20 && i < str.length);
      const d = result & 1 ? ~(result >> 1) : result >> 1;
      if (k === 0) lat += d;
      else lng += d;
    }
    out.push([lat / 1e6, lng / 1e6]);
  }
  return out;
}

async function valhalla<T>(endpoint: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${VALHALLA}/${endpoint}?json=${encodeURIComponent(JSON.stringify(body))}`, { signal });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new RoutingError((data && (data.error as string)) || `Valhalla antwortet mit ${res.status}`);
  return data as T;
}

async function fetchValhallaRoute(waypoints: Waypoint[], mode: TravelMode, blocks: Block[], signal?: AbortSignal) {
  const data = await valhalla<{ trip?: { legs: { shape: string }[] } }>(
    'route',
    {
      locations: waypoints.map((w) => ({ lat: w.lat, lon: w.lng })),
      costing: VALHALLA_COSTING[mode],
      directions_type: 'none',
      // Polygone statt Punkte: sperren auch separat kartierte Gehwege neben der Fahrbahn
      exclude_polygons: blocks.map(blockPolygon),
    },
    signal
  );
  if (!data.trip?.legs.length) throw new RoutingError('Keine Route um die gesperrten Straßen gefunden.');
  const coords: [number, number][] = [];
  for (const leg of data.trip.legs) {
    const pts = decodePolyline6(leg.shape);
    coords.push(...(coords.length ? pts.slice(1) : pts));
  }
  return coords;
}

/** Halbe Kantenlänge des Sperrfelds: deckt Fahrbahn und beide Gehwege auch breiter Straßen ab */
const BLOCK_HALF_M = 20;

/**
 * Sperrfeld als Ring [lon, lat]: Quadrat ±20 m um die angetippte Stelle. Valhalla meidet alle Wege,
 * die es schneidet – also auch separat kartierte Gehwege. (Ein Punkt-Ausschluss würde nur die
 * Fahrbahn sperren, und die Route liefe auf dem Gehweg daneben weiter.)
 */
export function blockPolygon(b: Pick<Block, 'lat' | 'lng'>): [number, number][] {
  const dy = BLOCK_HALF_M / 111_320;
  const dx = BLOCK_HALF_M / (Math.cos((b.lat * Math.PI) / 180) * 111_320);
  return [
    [b.lng - dx, b.lat - dy],
    [b.lng + dx, b.lat - dy],
    [b.lng + dx, b.lat + dy],
    [b.lng - dx, b.lat + dy],
    [b.lng - dx, b.lat - dy],
  ];
}

/** Straßenstück an einem angetippten Punkt finden (zum Sperren). Die Sperre sitzt an der angetippten Stelle,
 *  die Geometrie des Stücks dient nur der Anzeige. */
export async function locateStreet(coord: LatLng, mode: TravelMode, signal?: AbortSignal): Promise<Omit<Block, 'id'>> {
  type Edge = { correlated_lat: number; correlated_lon: number; distance?: number; edge_info?: { names?: string[]; shape?: string } };
  const data = await valhalla<{ edges?: Edge[] | null }[]>(
    'locate',
    { locations: [{ lat: coord.lat, lon: coord.lng, radius: 25 }], costing: VALHALLA_COSTING[mode], verbose: true },
    signal
  );
  const edge = data[0]?.edges?.[0];
  if (!edge) throw new RoutingError('Hier ist keine Straße.');
  const shape = edge.edge_info?.shape ? decodePolyline6(edge.edge_info.shape) : [];
  return {
    lat: coord.lat,
    lng: coord.lng,
    name: edge.edge_info?.names?.[0] ?? '',
    shape,
  };
}
