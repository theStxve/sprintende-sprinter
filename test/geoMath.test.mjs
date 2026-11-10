// Testet den echten App-Code (Node >= 22.18 entfernt TypeScript-Typen selbst).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDistance,
  calculateRouteDistances,
  formatPace,
  interpolateRoutePosition,
  locateOnRoute,
  sliceRoute,
} from '../src/services/geoMath.ts';
import { computeWindow, pacerAt, resolveStart, resolveTarget } from '../src/services/pacer.ts';

const route = (coords) => {
  const { totalDistance, cumulativeDistances } = calculateRouteDistances(coords);
  return { coordinates: coords, cumulative: cumulativeDistances, distanceMeters: totalDistance, lineMode: 'direct', fallback: false };
};

test('Haversine: Brandenburger Tor bis Siegessäule ca. 1,87 km', () => {
  const d = calculateDistance({ lat: 52.51627, lng: 13.3777 }, { lat: 52.5145, lng: 13.3501 });
  assert.ok(d > 1850 && d < 1900, `war ${d}`);
});

test('Interpolation in der Mitte eines Segments', () => {
  const coords = [[52.5, 13.4], [52.51, 13.4]];
  const { totalDistance } = calculateRouteDistances(coords);
  const { position } = interpolateRoutePosition(coords, totalDistance / 2);
  assert.ok(Math.abs(position.lat - 52.505) < 1e-6);
});

test('formatPace erzeugt nie ":60"', () => {
  assert.equal(formatPace(5.999), '6:00');
  assert.equal(formatPace(5.5), '5:30');
  assert.equal(formatPace(4 + 59.6 / 60), '5:00');
  assert.equal(formatPace(0), '–:––');
});

test('Rundkurs: Start und Ziel am selben Ort werden über den Hinweis unterschieden', () => {
  // Quadrat ca. 1,1 km × 0,7 km, endet am Startpunkt
  const coords = [[52.5, 13.4], [52.51, 13.4], [52.51, 13.41], [52.5, 13.41], [52.5, 13.4]];
  const r = route(coords);
  const atStart = { lat: 52.50001, lng: 13.40001 };

  const early = locateOnRoute(r.coordinates, r.cumulative, atStart, 0);
  assert.ok(early.alongMeters < 20, `am Anfang erwartet, war ${early.alongMeters}`);

  const late = locateOnRoute(r.coordinates, r.cumulative, atStart, r.distanceMeters - 40);
  assert.ok(late.alongMeters > r.distanceMeters - 20, `am Ende erwartet, war ${late.alongMeters}`);
});

test('Hin und zurück: Rückweg wird nicht mit dem Hinweg verwechselt', () => {
  const coords = [[52.5, 13.4], [52.51, 13.4], [52.5, 13.4]];
  const r = route(coords);
  const mid = { lat: 52.505, lng: 13.40002 };
  const out = locateOnRoute(r.coordinates, r.cumulative, mid, 500);
  const back = locateOnRoute(r.coordinates, r.cumulative, mid, 1600);
  assert.ok(out.alongMeters < r.distanceMeters / 2);
  assert.ok(back.alongMeters > r.distanceMeters / 2);
});

test('Abstand zur Strecke wird gemeldet', () => {
  const r = route([[52.5, 13.4], [52.51, 13.4]]);
  const far = locateOnRoute(r.coordinates, r.cumulative, { lat: 52.505, lng: 13.41 });
  assert.ok(far.offRouteMeters > 600 && far.offRouteMeters < 750, `war ${far.offRouteMeters}`);
});

test('sliceRoute endet exakt an der Pacer-Position', () => {
  const r = route([[52.5, 13.4], [52.51, 13.4], [52.51, 13.41]]);
  const part = sliceRoute(r.coordinates, r.cumulative, 500);
  assert.equal(part.length, 2);
  assert.ok(Math.abs(calculateRouteDistances(part).totalDistance - 500) < 0.5);
});

const baseTime = { startMode: 'tap', fixedStart: '07:00:00', targetMode: 'clock', targetClock: '07:30', targetDuration: 1200 };

test('Uhrzeit-Ziel liegt zu Beginn der Minute und nach dem Start', () => {
  const start = new Date(2026, 10, 9, 7, 5, 30).getTime();
  const target = resolveTarget(baseTime, start);
  assert.equal(target, new Date(2026, 10, 9, 7, 30, 0).getTime());
  const lateStart = new Date(2026, 10, 9, 8, 0, 0).getTime();
  assert.equal(resolveTarget(baseTime, lateStart), new Date(2026, 10, 10, 7, 30, 0).getTime());
});

test('Laufzeit-Ziel und feste Startzeit', () => {
  const now = new Date(2026, 10, 9, 6, 50, 0).getTime();
  const t = { ...baseTime, startMode: 'fixed', targetMode: 'duration', targetDuration: 1500 };
  const start = resolveStart(t, now);
  assert.equal(start, new Date(2026, 10, 9, 7, 0, 0).getTime());
  assert.equal(computeWindow(t, start).targetMs - start, 1500 * 1000);
});

test('Pacer läuft gleichmäßig und erreicht das Ziel pünktlich', () => {
  const r = route([[52.5, 13.4], [52.51, 13.4]]);
  const w = { startMs: 0, targetMs: 600_000 };
  const half = pacerAt(r, w, 300_000);
  assert.ok(Math.abs(half.alongMeters - r.distanceMeters / 2) < 1e-6);
  assert.ok(Math.abs(half.paceMinPerKm - 10 / (r.distanceMeters / 1000)) < 1e-9);
  const end = pacerAt(r, w, 700_000);
  assert.equal(end.progress, 1);
  assert.equal(end.isFinished, true);
  const before = pacerAt(r, w, -5000);
  assert.equal(before.hasStarted, false);
  assert.equal(before.alongMeters, 0);
});

import { upcomingDepartures, estimate } from '../src/services/presets.ts';

test('Wege: nächste Zeiten mit Puffer, danach morgen', () => {
  const preset = { id: 'p', name: 'Bahnhof', dest: { lat: 52.5, lng: 13.4, name: 'Gleis 3' }, times: ['13:34', '07:04', '13:04'], bufferMin: 2, travelMode: 'walking' };
  const now = new Date(2026, 10, 9, 13, 0, 0).getTime();
  const deps = upcomingDepartures(preset, now, 3);
  assert.deepEqual(deps.map((d) => d.time), ['13:04', '13:34', '07:04']);
  assert.equal(deps[0].arriveMs, new Date(2026, 10, 9, 13, 2, 0).getTime());
  assert.equal(deps[2].arriveMs, new Date(2026, 10, 10, 7, 2, 0).getTime());
});

test('Wege: spätestens-los-Schätzung', () => {
  const preset = { id: 'p', name: 'B', dest: { lat: 52.51, lng: 13.4, name: 'Z' }, times: ['13:00'], bufferMin: 0, travelMode: 'walking' };
  const arrive = 3_600_000;
  const e = estimate({ lat: 52.5, lng: 13.4 }, preset, arrive, 0, 5);
  // ~1,11 km Luftlinie × 1,3 ≈ 1,45 km bei 5 km/h ≈ 17,4 min
  assert.ok(e.distanceMeters > 1400 && e.distanceMeters < 1500);
  assert.ok(Math.abs((arrive - e.latestLeaveMs) / 60000 - 17.4) < 0.5);
});

import { planReminders } from '../src/services/presets.ts';

test('Erinnerungen: nur an gewählten Tagen, Vorlauf und Gehzeit eingerechnet', () => {
  const preset = {
    id: 'p', name: 'Zum Bahnhof', dest: { lat: 52.51, lng: 13.4, name: 'Gleis' }, times: ['07:04'], bufferMin: 2, travelMode: 'walking',
    origin: { lat: 52.5, lng: 13.4, name: 'Zuhause' }, originDistance: 1250,
    remind: { enabled: true, days: [1, 2, 3, 4, 5], leadMin: 5 }, transit: { stopId: 'x', stopName: 'Bf', lat: 0, lng: 0, line: 'RE3', direction: '' },
  };
  // Sonntag 08.11.2026, 20:00 → nächste Erinnerung Montag
  const now = new Date(2026, 10, 8, 20, 0, 0).getTime();
  const r = planReminders([preset], now, 5);
  assert.equal(r.length, 5); // Mo–Fr
  // 07:04 − 2 min Puffer − 15 min Gehzeit (1250 m bei 5 km/h) − 5 min Vorlauf = 06:42
  assert.equal(r[0].at, new Date(2026, 10, 9, 6, 42, 0).getTime());
  assert.match(r[0].body, /RE3 um 07:04/);
});

test('Wege mit Live-Daten: Verspätung verschiebt die Zielzeit', () => {
  const preset = { id: 'p', name: 'B', dest: { lat: 0, lng: 0, name: 'Z' }, times: ['13:04'], bufferMin: 1, travelMode: 'walking' };
  const now = new Date(2026, 10, 9, 12, 30, 0).getTime();
  const sched = new Date(2026, 10, 9, 13, 4, 0).getTime();
  const live = [{ scheduledMs: sched, realMs: sched + 6 * 60_000, track: '7', scheduledTrack: '6', cancelled: false, realTime: true, line: 'RE3', headsign: 'Stralsund' }];
  const [d] = upcomingDepartures(preset, now, 1, live);
  assert.equal(d.arriveMs, sched + 5 * 60_000);
  assert.equal(d.live.delayMin, 6);
  assert.equal(d.live.trackChanged, true);
});

/* ---------- Go-Modus ---------- */
import { goCandidates, recordGo, suggestArrival } from '../src/services/go.ts';

test('Go: gleicher Ort zählt hoch, neuer Ort wird angelegt', () => {
  const now = Date.UTC(2026, 10, 10, 8);
  const bahnhof = { name: 'Bahnhof', lat: 52.5251, lng: 13.3694, travelMode: 'walking' };
  let h = recordGo([], bahnhof, now);
  h = recordGo(h, { ...bahnhof, lat: 52.52512 }, now + 1000);
  assert.equal(h.length, 1);
  assert.equal(h[0].uses, 2);
  h = recordGo(h, { name: 'Büro', lat: 52.5, lng: 13.4, travelMode: 'cycling' }, now + 2000);
  assert.equal(h.length, 2);
});

test('Go: Vorschläge – Verlauf vor Wegen, Dubletten und eigener Standort fallen weg', () => {
  const now = Date.UTC(2026, 10, 10, 8);
  const history = [{ id: 'a', name: 'Bahnhof', lat: 52.5251, lng: 13.3694, travelMode: 'walking', uses: 3, lastUsed: now }];
  const presets = [
    { id: 'p1', name: 'Zum Zug', dest: { lat: 52.52511, lng: 13.36941, name: 'Gleis 5' }, times: [], bufferMin: 0, travelMode: 'walking' },
    { id: 'p2', name: 'Arbeit', dest: { lat: 52.5, lng: 13.4, name: 'Büro' }, times: [], bufferMin: 0, travelMode: 'cycling' },
    { id: 'p3', name: 'Zuhause', dest: { lat: 52.51, lng: 13.38, name: 'Zuhause' }, times: [], bufferMin: 0, travelMode: 'walking' },
  ];
  const c = goCandidates(history, presets, [], { lat: 52.51, lng: 13.38 }, now);
  assert.deepEqual(c.map((x) => x.name), ['Bahnhof', 'Arbeit']);
  assert.equal(c[1].travelMode, 'cycling');
});

test('Go: Ankunftsvorschlag auf volle Minute, mit 1 min Luft', () => {
  const now = Date.UTC(2026, 10, 10, 8, 0, 20);
  // 1 km bei 5 km/h = 12 min → 8:13:20 → 8:14
  assert.equal(suggestArrival(now, 1000, 5), Date.UTC(2026, 10, 10, 8, 14));
});

/* ---------- Versionen und Changelog ---------- */
import { compareVersions, notesSince, parseChangelog } from '../src/services/versions.ts';
import { readFileSync } from 'node:fs';

test('Versionen vergleichen', () => {
  assert.equal(compareVersions('1.1.0', '1.0.9'), 1);
  assert.equal(compareVersions('v1.0.0', '1.0.0'), 0);
  assert.equal(compareVersions('1.0.10', '1.0.9'), 1);
  assert.equal(compareVersions('0.9.0', '1.0.0'), -1);
});

test('Changelog: Abschnitte und „neu seit“', () => {
  const md = '# Changelog\n\nIntro\n\n## [1.1.0] - 2026-11-11\n\n### Neu\n\n- B\n\n## [1.0.0] - 2026-11-10\n\n- A\n\n[1.1.0]: https://x\n[1.0.0]: https://y\n';
  const e = parseChangelog(md);
  assert.deepEqual(e.map((x) => x.version), ['1.1.0', '1.0.0']);
  assert.equal(e[0].date, '2026-11-11');
  assert.equal(e[1].body, '- A');
  assert.deepEqual(notesSince('1.0.0', e, '1.1.0').map((x) => x.version), ['1.1.0']);
  assert.deepEqual(notesSince('1.1.0', e, '1.1.0'), []);
});

test('Changelog: Version aus package.json hat einen Abschnitt', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const e = parseChangelog(readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8'));
  assert.ok(e.some((x) => x.version === pkg.version), `CHANGELOG.md braucht einen Abschnitt ## [${pkg.version}]`);
});

/* ---------- Gesperrte Straßen ---------- */
import { blockPolygon, blocksNear, decodePolyline6 } from '../src/services/routing.ts';

test('Polyline6 dekodieren', () => {
  const pts = decodePolyline6('srbecBweqoXi@}S');
  assert.equal(pts.length, 2);
  // Straßenstück, auf das Valhalla den Punkt 52.5290/13.3790 einordnet (endet bei 52.528975/13.379003)
  assert.deepEqual(pts, [[52.528954, 13.378668], [52.528975, 13.379003]]);
});

test('Sperrfeld: Quadrat ±20 m um die angetippte Stelle, geschlossen', () => {
  const ring = blockPolygon({ lat: 52.5, lng: 13.4 });
  assert.equal(ring.length, 5);
  assert.deepEqual(ring[0], ring[4]);
  const lats = ring.map(([, la]) => la);
  const lngs = ring.map(([ln]) => ln);
  const h = (Math.max(...lats) - Math.min(...lats)) * 111320;
  const w = (Math.max(...lngs) - Math.min(...lngs)) * Math.cos((52.5 * Math.PI) / 180) * 111320;
  assert.ok(Math.abs(h - 40) < 0.1 && Math.abs(w - 40) < 0.1, `${w} x ${h}`);
  assert.ok(Math.abs((Math.max(...lats) + Math.min(...lats)) / 2 - 52.5) < 1e-9);
});

test('Sperren: nur die in der Nähe der Strecke zählen', () => {
  const near = { id: 'n', lat: 52.52, lng: 13.38, name: '', shape: [] };
  const far = { id: 'f', lat: 48.13, lng: 11.57, name: '', shape: [] };
  const ws = [{ lat: 52.53, lng: 13.38 }, { lat: 52.52, lng: 13.37 }];
  assert.deepEqual(blocksNear([near, far], ws).map((b) => b.id), ['n']);
});
