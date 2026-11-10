import { useEffect, useLayoutEffect, useRef } from 'react';
import { LngLatBounds, Map as MlMap, Marker, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl';
// MapLibre 6 sucht seinen Worker neben der eigenen Datei – im Vite-Bundle muss er explizit mitgegeben werden
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

setWorkerUrl(maplibreWorkerUrl);
import type { Fix, LatLng, RouteData, Waypoint } from '../types/route';
import { sliceRoute } from '../services/geoMath.ts';

/** Kostenlos, ohne API-Key: https://openfreemap.org */
const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
/** Ohne Strecke und Standort: Deutschland-Übersicht */
const DEFAULT_CENTER: [number, number] = [10.45, 51.16];
const DEFAULT_ZOOM = 5;

interface MapViewProps {
  route: RouteData | null;
  waypoints: Waypoint[];
  editable: boolean;
  /** Wenn gesetzt, ist nur dieser Wegpunkt verschiebbar */
  dragOnlyId?: string;
  onAddWaypoint: (coord: LatLng) => void;
  onMoveWaypoint: (id: string, coord: LatLng) => void;
  pacer: { position: LatLng | null; bearing: number; alongMeters: number; visible: boolean };
  user: Fix | null;
  follow: boolean;
  onFollowChange: (follow: boolean) => void;
  /** Bei jeder Änderung wird die Karte auf die Strecke eingepasst (mit eigener Position, falls nah) */
  fitSignal: number;
  /** Platz, den das Bedienfeld unten verdeckt (px) */
  bottomInset: number;
}

const line = (coords: [number, number][]) => ({
  type: 'Feature' as const,
  properties: {},
  geometry: { type: 'LineString' as const, coordinates: coords.map(([lat, lng]) => [lng, lat]) },
});

function arrowSvg() {
  return `<svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M12 2 5 20l7-4 7 4z"/></svg>`;
}

export function MapView(props: MapViewProps) {
  const { route, waypoints, editable, dragOnlyId, pacer, user, follow, fitSignal, bottomInset } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const loadedRef = useRef(false);
  const wpMarkersRef = useRef<Marker[]>([]);
  const pacerMarkerRef = useRef<Marker | null>(null);
  const userMarkerRef = useRef<Marker | null>(null);

  // Aktuelle Props für Event-Handler, ohne Listener neu zu registrieren
  const propsRef = useRef(props);
  useLayoutEffect(() => {
    propsRef.current = props;
  });

  /* ---------- Karte anlegen ---------- */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const first = propsRef.current.waypoints[0];
    const map = new MlMap({
      container: containerRef.current,
      style: STYLE_URL,
      center: first ? [first.lng, first.lat] : DEFAULT_CENTER,
      zoom: first ? 14 : DEFAULT_ZOOM,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    // Einzelne fehlende Symbole des Kartenstils still durch leere Bilder ersetzen
    map.on('styleimagemissing', (e) => {
      if (!map.hasImage(e.id)) map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
    });
    mapRef.current = map;

    map.on('load', () => {
      localizeLabels(map);
      map.addSource('route', { type: 'geojson', data: line([]) });
      map.addSource('route-done', { type: 'geojson', data: line([]) });
      map.addLayer({
        id: 'route-casing',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 9 },
      });
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#16181B', 'line-width': 4.5 },
      });
      map.addLayer({
        id: 'route-direct',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'butt', 'line-join': 'round', visibility: 'none' },
        paint: { 'line-color': '#16181B', 'line-width': 3.5, 'line-dasharray': [2, 1.5] },
      });
      map.addLayer({
        id: 'route-done',
        type: 'line',
        source: 'route-done',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#EE4F17', 'line-width': 5 },
      });
      loadedRef.current = true;
      // Erste Daten setzen
      setRouteData(map, propsRef.current.route);
      setDoneData(map, propsRef.current.route, propsRef.current.pacer.alongMeters, propsRef.current.pacer.visible);
      fit(map, propsRef.current.route, propsRef.current.waypoints, null, propsRef.current.bottomInset, false);
    });

    map.on('click', (e) => {
      if (propsRef.current.editable) propsRef.current.onAddWaypoint({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });
    map.on('dragstart', () => {
      if (propsRef.current.follow) propsRef.current.onFollowChange(false);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
  }, []);

  /* ---------- Strecke ---------- */
  useEffect(() => {
    const map = mapRef.current;
    if (map && loadedRef.current) setRouteData(map, route);
  }, [route]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && loadedRef.current) setDoneData(map, route, pacer.alongMeters, pacer.visible);
  }, [route, pacer.alongMeters, pacer.visible]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && loadedRef.current) fit(map, propsRef.current.route, propsRef.current.waypoints, propsRef.current.user, propsRef.current.bottomInset, true);
  }, [fitSignal]);

  /* ---------- Wegpunkte ---------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    wpMarkersRef.current.forEach((m) => m.remove());
    wpMarkersRef.current = waypoints.map((wp, idx) => {
      const isStart = idx === 0;
      const isFinish = idx === waypoints.length - 1 && waypoints.length > 1;
      const draggable = editable && (dragOnlyId == null || wp.id === dragOnlyId);
      const el = document.createElement('div');
      el.className = `wp-marker${isStart ? ' is-start' : ''}${isFinish ? ' is-finish' : ''}${draggable ? ' is-draggable' : ''}`;
      el.textContent = isStart ? 'S' : isFinish ? 'Z' : String(idx);
      el.title = wp.name; // textContent/title – kein HTML aus fremden Daten
      el.addEventListener('click', (e) => e.stopPropagation());
      const marker = new Marker({ element: el, draggable }).setLngLat([wp.lng, wp.lat]).addTo(map);
      marker.on('dragend', () => {
        const p = marker.getLngLat();
        propsRef.current.onMoveWaypoint(wp.id, { lat: p.lat, lng: p.lng });
      });
      return marker;
    });
  }, [waypoints, editable, dragOnlyId]);

  /* ---------- Pacer ---------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!pacer.position || !pacer.visible) {
      pacerMarkerRef.current?.remove();
      pacerMarkerRef.current = null;
      return;
    }
    if (!pacerMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'pacer-marker';
      el.innerHTML = arrowSvg();
      pacerMarkerRef.current = new Marker({ element: el }).setLngLat([pacer.position.lng, pacer.position.lat]).addTo(map);
    } else {
      pacerMarkerRef.current.setLngLat([pacer.position.lng, pacer.position.lat]);
    }
    const svg = pacerMarkerRef.current.getElement().querySelector('svg');
    if (svg) svg.style.transform = `rotate(${pacer.bearing}deg)`;
  }, [pacer.position, pacer.bearing, pacer.visible]);

  /* ---------- Eigene Position ---------- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!user) {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      return;
    }
    if (!userMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'user-marker';
      userMarkerRef.current = new Marker({ element: el }).setLngLat([user.lng, user.lat]).addTo(map);
      // Erster Standort: ohne Strecke dorthin springen
      if (!propsRef.current.route || follow) {
        map.flyTo({ center: [user.lng, user.lat], zoom: Math.max(map.getZoom(), 15), duration: 900, offset: [0, -bottomInset / 2] });
        userMarkerRef.current.getElement().classList.toggle('is-weak', user.accuracy > 40);
        return;
      }
    } else {
      userMarkerRef.current.setLngLat([user.lng, user.lat]);
    }
    userMarkerRef.current.getElement().classList.toggle('is-weak', user.accuracy > 40);
    if (follow) {
      map.easeTo({
        center: [user.lng, user.lat],
        zoom: Math.max(map.getZoom(), 15),
        duration: 600,
        // offset statt padding: padding bliebe dauerhaft an der Kamera hängen und blockiert fitBounds
        offset: [0, -bottomInset / 2],
      });
    }
  }, [user, follow, bottomInset]);

  return <div ref={containerRef} className="absolute inset-0" />;
}

/** Ortsnamen auf Deutsch, sonst Originalname */
function localizeLabels(map: MlMap) {
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type !== 'symbol') continue;
    const field = map.getLayoutProperty(layer.id, 'text-field');
    if (field && JSON.stringify(field).includes('name_en')) {
      map.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name:de'], ['get', 'name'], ['get', 'name_en']]);
    }
  }
}

function setRouteData(map: MlMap, route: RouteData | null) {
  (map.getSource('route') as GeoJSONSource | undefined)?.setData(line(route?.coordinates ?? []));
  const direct = route?.lineMode === 'direct';
  map.setLayoutProperty('route-line', 'visibility', direct ? 'none' : 'visible');
  map.setLayoutProperty('route-direct', 'visibility', direct ? 'visible' : 'none');
}

function setDoneData(map: MlMap, route: RouteData | null, along: number, visible: boolean) {
  const coords = route && visible ? sliceRoute(route.coordinates, route.cumulative, along) : [];
  (map.getSource('route-done') as GeoJSONSource | undefined)?.setData(line(coords));
}

function fit(map: MlMap, route: RouteData | null, waypoints: Waypoint[], user: LatLng | null, bottomInset: number, animate: boolean) {
  const bounds = new LngLatBounds();
  route?.coordinates.forEach(([lat, lng]) => bounds.extend([lng, lat]));
  waypoints.forEach((w) => bounds.extend([w.lng, w.lat]));
  if (user) {
    // Eigene Position nur mit einbeziehen, wenn sie in der Nähe der Strecke ist
    const sw = bounds.isEmpty() ? null : bounds.getSouthWest();
    const ne = bounds.isEmpty() ? null : bounds.getNorthEast();
    const near =
      !sw || !ne ||
      (user.lat > sw.lat - 0.2 && user.lat < ne.lat + 0.2 && user.lng > sw.lng - 0.3 && user.lng < ne.lng + 0.3);
    if (near) bounds.extend([user.lng, user.lat]);
  }
  if (bounds.isEmpty()) return;
  if (!route || route.coordinates.length < 2) {
    map.easeTo({ center: bounds.getCenter(), zoom: Math.max(map.getZoom(), 15), duration: animate ? 700 : 0 });
    return;
  }
  const h = map.getContainer().clientHeight;
  const bottom = Math.min(bottomInset + 40, h * 0.65);
  map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
  map.fitBounds(bounds, {
    padding: { top: 110, bottom, left: 40, right: 64 },
    maxZoom: 17,
    duration: animate ? 700 : 0,
  });
}
