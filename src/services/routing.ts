/**
 * Kostenlose Dienste ohne API-Key:
 *  - Routing: FOSSGIS-OSRM (routing.openstreetmap.de) mit echten Profilen für Fuß, Rad, Auto
 *  - Suche/Ortsnamen: Photon (photon.komoot.io)
 */
import type { LatLng, TravelMode, Waypoint } from '../types/route';

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

/** Liefert die Linie als [lat, lng]-Paare. Wirft bei Fehler – der Aufrufer entscheidet über Fallback. */
export async function fetchRoute(
  waypoints: Waypoint[],
  mode: TravelMode,
  signal?: AbortSignal
): Promise<[number, number][]> {
  if (waypoints.length < 2) throw new RoutingError('Mindestens zwei Punkte nötig.');
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
