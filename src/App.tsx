import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Geolocation } from '@capacitor/geolocation';
import { Check, ChevronDown, ChevronUp, Maximize2, Navigation, Undo2 } from 'lucide-react';
import type {
  GoTarget,
  LatLng,
  LineMode,
  Preset,
  RouteData,
  SavedRoute,
  Settings,
  Standing,
  TimeConfig,
  TravelMode,
  Waypoint,
} from './types/route';
import { calculateDistance, calculateRouteDistances, formatClock, formatDistance, locateOnRoute } from './services/geoMath.ts';
import { coordLabel, fetchRoute, reverseGeocode } from './services/routing.ts';
import { computeWindow, pacerAt, resolveStart } from './services/pacer.ts';
import { usePersistentState } from './services/storage.ts';
import { setKeepAwake, speak, spokenPace, spokenSeconds, VIBRATION, vibrate } from './services/feedback.ts';
import { ensureNotificationPermission } from './services/permissions.ts';
import { useNow, useSimulation } from './hooks/useClock.ts';
import { useTracking } from './hooks/useTracking.ts';
import { useFeedback } from './hooks/useFeedback.ts';
import { MapView } from './components/MapView.tsx';
import { RunPanel, type Phase } from './components/RunPanel.tsx';
import { TimePanel } from './components/TimePanel.tsx';
import { RoutePanel } from './components/RoutePanel.tsx';
import { OptionsPanel } from './components/OptionsPanel.tsx';
import { SearchOverlay } from './components/SearchOverlay.tsx';
import { useConfirm, useToast } from './components/Overlays.tsx';
import { PresetList } from './components/PresetList.tsx';
import { PresetEditor, type PlaceTarget } from './components/PresetEditor.tsx';
import { StopSearch } from './components/StopSearch.tsx';
import { DETOUR_FACTOR, upcomingDepartures, type Departure } from './services/presets.ts';
import { departuresFor, type LiveDeparture } from './services/transit.ts';
import { ensureReminderPermission, exactAlarmsAllowed, openExactAlarmSettings, syncReminders } from './services/reminders.ts';
import { LocalNotifications } from '@capacitor/local-notifications';
import { SectionLabel } from './components/ui.tsx';
import { GoPanel, type GoDest } from './components/GoPanel.tsx';
import { goCandidates, recordGo, suggestArrival, typicalKmh, type GoCandidate } from './services/go.ts';

const DEFAULT_SETTINGS: Settings = {
  voice: true,
  announceInterval: 60,
  announceChanges: true,
  haptics: true,
  keepAwake: false,
  walkSpeedKmh: 5,
  goMode: false,
};

const GO_START_ID = 'go-start';
const GO_DEST_ID = 'go-dest';

const emptyPreset = (): Preset => ({
  id: newId(),
  name: '',
  dest: { lat: 0, lng: 0, name: '' },
  times: ['07:30'],
  bufferMin: 1,
  travelMode: 'walking',
});

function defaultTime(): TimeConfig {
  const now = Date.now();
  return {
    startMode: 'tap',
    fixedStart: formatClock(now, true),
    targetMode: 'duration',
    targetClock: formatClock(now + 31 * 60 * 1000),
    targetDuration: 30 * 60,
  };
}

/** Demo-Strecke aus der ersten Version – wird bei bestehenden Installationen entfernt */
function isOldDemoRoute(ws: Waypoint[]) {
  return ws.length === 3 && ws[0].id === 'wp-1' && ws[0].name === 'Brandenburger Tor' && ws[2].id === 'wp-3';
}

interface Session {
  startMs: number;
  /** z. B. "Zum Bahnhof · 13:04" bei gespeicherten Wegen */
  label?: string;
  result: { deltaSeconds: number; finishedAt: number } | null;
}

type Tab = 'run' | 'time' | 'route' | 'options';
const TABS: { id: Tab; label: string }[] = [
  { id: 'run', label: 'Lauf' },
  { id: 'time', label: 'Zeit' },
  { id: 'route', label: 'Strecke' },
  { id: 'options', label: 'Optionen' },
];
const GO_TABS: { id: Tab; label: string }[] = [
  { id: 'run', label: 'Go' },
  { id: 'options', label: 'Optionen' },
];

const FINISH_RADIUS_M = 15;

/** Schlüssel einer Streckenanfrage: Punkte + Fortbewegung + Linienart */
const routeKeyOf = (ws: { lat: number; lng: number }[], tm: TravelMode, lm: LineMode) =>
  ws.map((w) => `${w.lat.toFixed(6)},${w.lng.toFixed(6)}`).join(';') + `|${tm}|${lm}`;

const newId = () => `wp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function buildRoute(coordinates: [number, number][], lineMode: LineMode, fallback: boolean): RouteData {
  const { totalDistance, cumulativeDistances } = calculateRouteDistances(coordinates);
  return { coordinates, cumulative: cumulativeDistances, distanceMeters: totalDistance, lineMode, fallback };
}

export default function App() {
  /* ---------- Gespeicherter Zustand ---------- */
  const [waypoints, setWaypoints] = usePersistentState<Waypoint[]>('waypoints', []);
  const [travelMode, setTravelMode] = usePersistentState<TravelMode>('travelMode', 'walking');
  const [lineMode, setLineMode] = usePersistentState<LineMode>('lineMode', 'routed');
  const [time, setTime] = usePersistentState<TimeConfig>('time', defaultTime);
  const [settings, setSettings] = usePersistentState<Settings>('settings', DEFAULT_SETTINGS);
  const [saved, setSaved] = usePersistentState<SavedRoute[]>('savedRoutes', []);
  const [session, setSession] = usePersistentState<Session | null>('session', null);
  const [presets, setPresets] = usePersistentState<Preset[]>('presets', []);
  const [goHistory, setGoHistory] = usePersistentState<GoTarget[]>('goHistory', []);
  const [goDest, setGoDest] = usePersistentState<GoDest | null>('goDest', null);

  /* ---------- Oberfläche ---------- */
  const [tab, setTab] = useState<Tab>('run');
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  /** Wofür die Suche läuft: Punkt zur Strecke oder Ziel eines Wegs */
  const [searchFor, setSearchFor] = useState<'route' | 'preset' | 'go'>('route');
  /** Im Go-Modus gewählte Ankunft; null = Vorschlag aus normalem Tempo */
  const [goArriveMs, setGoArriveMs] = useState<number | null>(null);
  const [draft, setDraft] = useState<{ preset: Preset; isNew: boolean } | null>(null);
  const [pickingDest, setPickingDest] = useState(false);
  const [placeTarget, setPlaceTarget] = useState<PlaceTarget>('dest');
  const [stopSearchOpen, setStopSearchOpen] = useState(false);
  const [exactAlarms, setExactAlarms] = useState(true);
  const [live, setLive] = useState<Record<string, LiveDeparture[] | undefined>>({});
  const [presetBusy, setPresetBusy] = useState<string | null>(null);
  const [follow, setFollow] = useState(false);
  const [fitSignal, setFitSignal] = useState(0);
  const [sheetHeight, setSheetHeight] = useState(320);
  const sheetRef = useRef<HTMLDivElement>(null);
  const { confirm, dialog, isOpen: dialogOpen, cancel: cancelDialog } = useConfirm();
  const toast = useToast();
  const fitRoute = useCallback(() => setFitSignal((n) => n + 1), []);

  useLayoutEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSheetHeight(el.getBoundingClientRect().height));
    ro.observe(el);
    return () => ro.disconnect();
  }, [editing]);

  useEffect(() => {
    if (isOldDemoRoute(waypoints)) setWaypoints([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim Start
  }, []);

  /* ---------- Strecke berechnen ---------- */
  const [route, setRoute] = useState<RouteData | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  /** Für welche Anfrage `route` berechnet wurde – damit ein Start nie mit einer veralteten Strecke losläuft */
  const [routeKey, setRouteKey] = useState('');
  const pendingFitRef = useRef(true);
  const coordsKey = waypoints.map((w) => `${w.lat.toFixed(6)},${w.lng.toFixed(6)}`).join(';');
  const reqKey = routeKeyOf(waypoints, travelMode, lineMode);

  useEffect(() => {
    const key = reqKey;
    if (waypoints.length < 2) {
      setRoute(null);
      setRouteKey(key);
      setRouteLoading(false);
      return;
    }
    const direct: [number, number][] = waypoints.map((w) => [w.lat, w.lng]);
    if (lineMode === 'direct') {
      setRoute(buildRoute(direct, 'direct', false));
      setRouteKey(key);
      setRouteLoading(false);
      return;
    }
    // Ältere Anfragen abbrechen, damit nie eine veraltete Antwort gewinnt
    const ctrl = new AbortController();
    setRouteLoading(true);
    const t = window.setTimeout(() => {
      fetchRoute(waypoints, travelMode, AbortSignal.any([ctrl.signal, AbortSignal.timeout(10_000)]))
        .then((coords) => {
          setRoute(buildRoute(coords, 'routed', false));
          setRouteKey(key);
        })
        .catch((err) => {
          if (ctrl.signal.aborted) return;
          console.warn('Wegführung fehlgeschlagen', err);
          setRoute(buildRoute(direct, 'direct', true));
          setRouteKey(key);
        })
        .finally(() => {
          if (!ctrl.signal.aborted) setRouteLoading(false);
        });
    }, 250);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur Koordinaten zählen, nicht Namen
  }, [coordsKey, travelMode, lineMode]);

  useEffect(() => {
    if (route && pendingFitRef.current) {
      pendingFitRef.current = false;
      fitRoute();
    }
  }, [route, fitRoute]);

  /* ---------- Zeit, Pacer, Vorschau ---------- */
  const now = useNow(500);
  const sim = useSimulation();
  const tracking = useTracking();
  const fix = tracking.fix;

  // Laufende Sitzung nach App-Neustart fortsetzen (oder verwerfen, wenn längst vorbei)
  useEffect(() => {
    if (session && !session.result && Date.now() - session.startMs > 12 * 60 * 60 * 1000) setSession(null);
    else if (session && !session.result) tracking.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim Start
  }, []);

  const liveWindow = useMemo(
    () => computeWindow(time, session ? session.startMs : resolveStart(time, now)),
    [time, session, now]
  );
  const window_ = sim.window ?? liveWindow;
  const evalNow = session ? Math.max(now, fix?.time ?? 0) : now;
  const pacerNow = sim.active ? sim.now : session ? evalNow : window_.startMs;
  const pacer = pacerAt(route, window_, pacerNow);

  const phase: Phase = sim.active
    ? 'preview'
    : !session
      ? 'idle'
      : session.result
        ? 'finished'
        : evalNow < window_.startMs
          ? 'waiting'
          : 'running';

  /* ---------- Eigene Position auf der Strecke ---------- */
  const hintRef = useRef<number | null>(null);
  const pacerAlongRef = useRef(0);
  useLayoutEffect(() => {
    pacerAlongRef.current = pacer.alongMeters;
  });

  useEffect(() => {
    hintRef.current = null;
  }, [route]);

  const userLoc = useMemo(() => {
    if (!fix || !route || route.coordinates.length < 2) return null;
    // eslint-disable-next-line react-hooks/refs -- Hinweis aus der letzten Position, bewusst ohne Neuberechnung
    const hint = hintRef.current ?? (session ? pacerAlongRef.current : 0);
    return locateOnRoute(route.coordinates, route.cumulative, fix, hint);
  }, [fix, route, session]);

  useEffect(() => {
    if (userLoc && userLoc.offRouteMeters < 60) hintRef.current = userLoc.alongMeters;
  }, [userLoc]);

  // Ungefährer Standort für die Wege-Schätzung, ohne GPS dauerhaft anzuschalten
  const [roughHere, setRoughHere] = useState<LatLng | null>(null);
  useEffect(() => {
    if ((presets.length === 0 && !settings.goMode) || session) return;
    let cancelled = false;
    const update = async () => {
      try {
        if (Capacitor.isNativePlatform() && (await Geolocation.checkPermissions()).location !== 'granted') return;
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }).catch(() =>
          Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 })
        );
        if (!cancelled) setRoughHere({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        /* kein Standort – Karten zeigen Hinweis */
      }
    };
    update();
    const id = window.setInterval(update, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [presets.length, settings.goMode, session]);
  const here: LatLng | null = fix ?? roughHere;

  const distanceToStart =
    fix && waypoints.length > 0 ? calculateDistance(fix, { lat: waypoints[0].lat, lng: waypoints[0].lng }) : null;

  let standing: Standing | null = null;
  let gapMeters: number | null = null;
  let gapSeconds: number | null = null;
  if ((phase === 'running' || phase === 'finished') && userLoc && fix) {
    const offLimit = Math.max(35, fix.accuracy * 1.5);
    if (userLoc.offRouteMeters > offLimit) {
      standing = 'offroute';
    } else {
      gapMeters = userLoc.alongMeters - pacer.alongMeters;
      gapSeconds = pacer.speedMps > 0 ? gapMeters / pacer.speedMps : 0;
      standing = Math.abs(gapSeconds) < 3 ? 'onpace' : gapMeters > 0 ? 'ahead' : 'behind';
    }
  }

  useFeedback({ active: phase === 'running', standing, gapSeconds, settings, evalTime: evalNow });

  // Ziel erreicht
  useEffect(() => {
    if (!session || session.result || !route || !userLoc || !fix) return;
    if (fix.time < window_.startMs || standing === 'offroute') return;
    if (userLoc.alongMeters >= route.distanceMeters - FINISH_RADIUS_M) {
      const deltaSeconds = (window_.targetMs - fix.time) / 1000;
      setSession({ ...session, result: { deltaSeconds, finishedAt: fix.time } });
      setExpanded(true);
      setTab('run');
      if (settings.haptics) vibrate(VIBRATION.finish);
      if (settings.voice) {
        speak(
          Math.abs(deltaSeconds) < 3
            ? 'Ziel erreicht, genau in der Zeit.'
            : `Ziel erreicht, ${spokenSeconds(deltaSeconds)} ${deltaSeconds > 0 ? 'vor' : 'nach'} der Zielzeit.`
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoc]);

  // Ansage, wenn ein geplanter Start erreicht wird
  const prevPhaseRef = useRef<Phase>(phase);
  useEffect(() => {
    if (prevPhaseRef.current === 'waiting' && phase === 'running') {
      if (settings.voice) speak('Los. Der Pacer läuft.');
      if (settings.haptics) vibrate(VIBRATION.ahead);
    }
    prevPhaseRef.current = phase;
  }, [phase, settings.voice, settings.haptics]);

  // Bildschirm anlassen
  const runActive = phase === 'running' || phase === 'waiting';
  useEffect(() => {
    setKeepAwake(settings.keepAwake && runActive);
  }, [settings.keepAwake, runActive]);

  /* ---------- Aktionen ---------- */
  const handleStart = async (label?: string) => {
    if (!route || route.distanceMeters === 0) return;
    sim.close();
    setEditing(false);
    await ensureNotificationPermission();
    const startMs = resolveStart(time, Date.now());
    setSession({ startMs, result: null, label });
    hintRef.current = null;
    tracking.start();
    setTab('run');
    setExpanded(false);
    // Bin ich weit weg vom Start, Strecke und Standort zeigen statt nur mir zu folgen
    if (distanceToStart != null && distanceToStart > 150) {
      setFollow(false);
      fitRoute();
    } else {
      setFollow(true);
    }
    if (settings.voice) {
      const w = computeWindow(time, startMs);
      const pace = spokenPace((w.targetMs - w.startMs) / 60000 / (route.distanceMeters / 1000));
      speak(startMs > Date.now() + 2000 ? `Pacer startet um ${formatClock(startMs)}. Soll-Pace ${pace}.` : `Lauf gestartet. Soll-Pace ${pace}.`);
    }
  };

  const handleStop = async () => {
    if (phase !== 'finished') {
      const ok = await confirm({
        title: 'Lauf beenden?',
        message: 'Pacer und GPS-Aufzeichnung werden gestoppt.',
        confirmLabel: 'Beenden',
        danger: true,
      });
      if (!ok) return;
    }
    setSession(null);
    tracking.stop();
    setFollow(false);
    setExpanded(true);
  };

  const toggleGps = () => {
    if (tracking.enabled) {
      tracking.stop();
      setFollow(false);
    } else {
      tracking.start();
      setFollow(true);
    }
  };

  const nameWaypoint = useCallback(
    (id: string, lat: number, lng: number) => {
      reverseGeocode(lat, lng).then((name) =>
        setWaypoints((ws) => ws.map((w) => (w.id === id && w.lat === lat && w.lng === lng ? { ...w, name } : w)))
      );
    },
    [setWaypoints]
  );

  const addWaypoint = useCallback(
    (coord: LatLng, name?: string) => {
      const id = newId();
      setWaypoints((ws) => [...ws, { id, name: name ?? coordLabel(coord.lat, coord.lng), lat: coord.lat, lng: coord.lng }]);
      if (!name) nameWaypoint(id, coord.lat, coord.lng);
    },
    [setWaypoints, nameWaypoint]
  );

  const moveWaypointTo = useCallback(
    (id: string, coord: LatLng) => {
      setWaypoints((ws) => ws.map((w) => (w.id === id ? { ...w, lat: coord.lat, lng: coord.lng, name: coordLabel(coord.lat, coord.lng) } : w)));
      nameWaypoint(id, coord.lat, coord.lng);
    },
    [setWaypoints, nameWaypoint]
  );

  const addCurrentLocation = async () => {
    setSearchOpen(false);
    try {
      let coord: LatLng;
      if (fix) {
        coord = { lat: fix.lat, lng: fix.lng };
      } else {
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
        coord = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      }
      pendingFitRef.current = true;
      addWaypoint(coord);
      toast.show('Standort als Punkt hinzugefügt');
    } catch {
      toast.show('Standort nicht verfügbar. Ist die Ortung erlaubt?');
    }
  };

  const reorder = (id: string, dir: -1 | 1) =>
    setWaypoints((ws) => {
      const i = ws.findIndex((w) => w.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= ws.length) return ws;
      const next = ws.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const loadSaved = (r: SavedRoute) => {
    pendingFitRef.current = true;
    setWaypoints(r.waypoints.map((w) => ({ ...w })));
    setLineMode(r.lineMode);
    setTravelMode(r.travelMode);
    setTab('run');
    toast.show(`„${r.name}“ geladen`);
  };

  const saveCurrent = (name: string) => {
    if (!route) return;
    setSaved((s) => [
      { id: newId(), name, waypoints, lineMode, travelMode, distanceMeters: route.distanceMeters, savedAt: Date.now() },
      ...s,
    ]);
    toast.show('Strecke gespeichert');
  };

  const startEditing = () => {
    setEditing(true);
    setSearchOpen(false);
    setFollow(false);
  };

  const finishEditing = () => {
    setEditing(false);
    setExpanded(true);
    if (waypoints.length >= 2) fitRoute();
  };

  const clearRoute = async () => {
    const ok = await confirm({ title: 'Alle Punkte löschen?', confirmLabel: 'Löschen', danger: true });
    if (ok) setWaypoints([]);
  };

  /* ---------- Gespeicherte Wege ---------- */
  const pendingStartRef = useRef<{ key: string; label: string } | null>(null);
  const [pendingTick, setPendingTick] = useState(0);
  const handleStartRef = useRef(handleStart);
  useLayoutEffect(() => {
    handleStartRef.current = handleStart;
  });

  const getHere = async (): Promise<LatLng> => {
    if (fix && Date.now() - fix.time < 20_000) return { lat: fix.lat, lng: fix.lng };
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  };

  const startPreset = async (p: Preset, dep: Departure) => {
    setPresetBusy(p.id);
    try {
      const pos = await getHere();
      const wps: Waypoint[] = [
        { id: newId(), name: 'Mein Standort', lat: pos.lat, lng: pos.lng },
        { id: newId(), name: p.dest.name, lat: p.dest.lat, lng: p.dest.lng },
      ];
      sim.close();
      pendingFitRef.current = true;
      setWaypoints(wps);
      setLineMode('routed');
      setTravelMode(p.travelMode);
      setTime((t) => ({ ...t, startMode: 'tap', targetMode: 'clock', targetClock: formatClock(dep.arriveMs) }));
      pendingStartRef.current = {
        key: routeKeyOf(wps, p.travelMode, 'routed'),
        label: p.name + ' · ' + (dep.live?.line ? dep.live.line + ' ' : '') + dep.time,
      };
      setPendingTick((n) => n + 1);
    } catch {
      setPresetBusy(null);
      toast.show('Standort nicht verfügbar. Ist die Ortung erlaubt?');
    }
  };

  // Sobald die Strecke von hier zum Ziel berechnet ist: Pacer starten
  const showToast = toast.show;
  useEffect(() => {
    const pending = pendingStartRef.current;
    if (!pending || !route || routeKey !== pending.key || reqKey !== pending.key) return;
    pendingStartRef.current = null;
    setPresetBusy(null);
    if (route.fallback) showToast('Wegführung nicht erreichbar, Luftlinie wird genutzt');
    handleStartRef.current(pending.label);
  }, [route, routeKey, reqKey, pendingTick, showToast]);

  const openEditor = (p?: Preset) =>
    setDraft(p ? { preset: { ...p, times: [...p.times] }, isNew: false } : { preset: emptyPreset(), isNew: true });

  const setDraftPlace = (target: PlaceTarget, coord: LatLng, name?: string) => {
    const place = { lat: coord.lat, lng: coord.lng, name: name ?? coordLabel(coord.lat, coord.lng) };
    setDraft((d) => (d ? { ...d, preset: { ...d.preset, [target]: place } } : d));
    if (!name) {
      reverseGeocode(coord.lat, coord.lng).then((n) =>
        setDraft((d) => {
          const cur = d?.preset[target];
          return d && cur && cur.lat === coord.lat && cur.lng === coord.lng ? { ...d, preset: { ...d.preset, [target]: { ...cur, name: n } } } : d;
        })
      );
    }
  };

  const saveDraft = () => {
    if (!draft) return;
    const p: Preset = { ...draft.preset, name: draft.preset.name.trim(), times: [...new Set(draft.preset.times.filter(Boolean))].sort() };
    const id = p.id;
    setPresets((list) => (draft.isNew ? [...list, p] : list.map((x) => (x.id === id ? p : x))));
    setDraft(null);
    toast.show(draft.isNew ? 'Weg angelegt' : 'Weg gespeichert');
    // Echte Weglänge vom üblichen Start fürs Erinnern berechnen (im Hintergrund)
    if (p.origin) {
      const o = p.origin;
      fetchRoute(
        [
          { id: 'o', name: '', lat: o.lat, lng: o.lng },
          { id: 'd', name: '', lat: p.dest.lat, lng: p.dest.lng },
        ],
        p.travelMode,
        AbortSignal.timeout(10_000)
      )
        .then((coords) => {
          const dist = calculateRouteDistances(coords).totalDistance;
          setPresets((list) => list.map((x) => (x.id === id ? { ...x, originDistance: dist } : x)));
        })
        .catch(() => {});
    }
  };

  const enableReminder = async () => {
    if (!Capacitor.isNativePlatform()) {
      toast.show('Erinnerungen gibt es nur in der Android-App');
      return false;
    }
    const ok = await ensureReminderPermission();
    if (!ok) toast.show('Benachrichtigungen sind nicht erlaubt');
    setExactAlarms(await exactAlarmsAllowed());
    return ok;
  };

  const deleteDraft = async () => {
    if (!draft) return;
    if (await confirm({ title: '„' + draft.preset.name + '“ löschen?', confirmLabel: 'Löschen', danger: true })) {
      setPresets((list) => list.filter((x) => x.id !== draft.preset.id));
      setDraft(null);
    }
  };

  const hereForDraft = async (target: PlaceTarget) => {
    setSearchOpen(false);
    try {
      setDraftPlace(target, await getHere());
    } catch {
      toast.show('Standort nicht verfügbar. Ist die Ortung erlaubt?');
    }
  };

  /* ---------- Go-Modus ---------- */
  const goIdle = settings.goMode && phase === 'idle';
  const goCands = useMemo(
    () => (goIdle ? goCandidates(goHistory, presets, saved, here, Date.now()) : []),
    // Ort nur grob berücksichtigen, damit die Liste nicht bei jedem GPS-Punkt springt
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [goIdle, goHistory, presets, saved, here ? `${here.lat.toFixed(3)},${here.lng.toFixed(3)}` : '']
  );

  /** Go-Ziel aus aktuellem Standort und Ziel als Strecke aufbauen */
  const goWaypoints = (origin: LatLng | null, dest: GoDest): Waypoint[] => [
    ...(origin ? [{ id: GO_START_ID, name: 'Mein Standort', lat: origin.lat, lng: origin.lng }] : []),
    { id: GO_DEST_ID, name: dest.name, lat: dest.lat, lng: dest.lng },
  ];

  const nameGoDest = (lat: number, lng: number) => {
    reverseGeocode(lat, lng).then((name) => {
      setGoDest((d) => (d && d.lat === lat && d.lng === lng ? { ...d, name } : d));
      setWaypoints((ws) => ws.map((w) => (w.id === GO_DEST_ID && w.lat === lat && w.lng === lng ? { ...w, name } : w)));
    });
  };

  const pickGoTarget = async (c: { lat: number; lng: number; name?: string; travelMode?: TravelMode }) => {
    const dest: GoDest = { lat: c.lat, lng: c.lng, name: c.name ?? coordLabel(c.lat, c.lng), travelMode: c.travelMode ?? 'walking' };
    if (!c.name) nameGoDest(c.lat, c.lng);
    setGoDest(dest);
    sim.close();
    setLineMode('routed');
    setTravelMode(dest.travelMode);
    setWaypoints(goWaypoints(null, dest));
    setFollow(false);
    fitRoute();
    try {
      const pos = await getHere();
      // Nur übernehmen, wenn das Ziel inzwischen nicht gewechselt wurde
      setWaypoints((ws) => {
        const d = ws.find((w) => w.id === GO_DEST_ID);
        return d ? goWaypoints(pos, { ...dest, lat: d.lat, lng: d.lng, name: d.name }) : ws;
      });
      pendingFitRef.current = true;
    } catch {
      toast.show('Standort nicht verfügbar. Ist die Ortung erlaubt?');
    }
  };

  const moveGoDest = (coord: LatLng) => {
    const name = coordLabel(coord.lat, coord.lng);
    setGoDest((d) => (d ? { ...d, lat: coord.lat, lng: coord.lng, name } : d));
    setWaypoints((ws) => ws.map((w) => (w.id === GO_DEST_ID ? { ...w, lat: coord.lat, lng: coord.lng, name } : w)));
    nameGoDest(coord.lat, coord.lng);
  };

  // Strecke zum Go-Ziel liegt vor, wenn die Punkte genau Start + Ziel sind
  const goRouteReady =
    !!goDest && waypoints.length === 2 && waypoints[0].id === GO_START_ID && waypoints[1].id === GO_DEST_ID && route != null && routeKey === reqKey;
  const goOrigin = waypoints[0]?.id === GO_START_ID ? waypoints[0] : here;
  const goDistance = goDest
    ? goRouteReady
      ? route!.distanceMeters
      : goOrigin
        ? calculateDistance(goOrigin, goDest) * DETOUR_FACTOR
        : null
    : null;
  const goKmh = typicalKmh(goDest?.travelMode ?? 'walking', settings.walkSpeedKmh);
  const goAutoArrive = suggestArrival(now, goDistance ?? 0, goKmh);
  const goArrive = goArriveMs ?? goAutoArrive;

  const startGo = async () => {
    if (!goDest) return;
    const arriveMs = goArrive;
    if (arriveMs - Date.now() < 60_000) {
      toast.show('Ankunft ist zu knapp');
      return;
    }
    setPresetBusy('go');
    try {
      const pos = await getHere();
      const cur = waypoints[0]?.id === GO_START_ID ? waypoints[0] : null;
      // Kaum bewegt: vorhandene Strecke weiterverwenden, dann startet es sofort
      const origin = cur && calculateDistance(cur, pos) < 25 ? cur : pos;
      const wps = goWaypoints(origin, goDest);
      sim.close();
      if (routeKeyOf(wps, goDest.travelMode, 'routed') !== reqKey) {
        pendingFitRef.current = true;
        setWaypoints(wps);
        setLineMode('routed');
        setTravelMode(goDest.travelMode);
      }
      setTime((t) => ({ ...t, startMode: 'tap', targetMode: 'clock', targetClock: formatClock(arriveMs) }));
      setGoHistory((h) => recordGo(h, goDest, Date.now()));
      pendingStartRef.current = { key: routeKeyOf(wps, goDest.travelMode, 'routed'), label: `${goDest.name} · ${formatClock(arriveMs)}` };
      setPendingTick((n) => n + 1);
      setGoArriveMs(null);
    } catch {
      setPresetBusy(null);
      toast.show('Standort nicht verfügbar. Ist die Ortung erlaubt?');
    }
  };

  // Gewählte Ankunft, die vorbei ist, verwerfen → wieder Vorschlag
  useEffect(() => {
    if (goArriveMs != null && goArriveMs < now - 5 * 60_000) setGoArriveMs(null);
  }, [goArriveMs, now]);

  const visibleTabs = settings.goMode ? GO_TABS : TABS;
  useEffect(() => {
    if (!visibleTabs.some((t) => t.id === tab)) setTab('run');
  }, [visibleTabs, tab]);
  /** Go-Ziel wird gerade gewählt/verschoben: Karte antippen setzt bzw. verschiebt das Ziel */
  const goSelecting = goIdle && tab === 'run' && !draft && !searchOpen && !editing;

  // Go-Modus eingeschaltet, Ziel gemerkt, aber Karte zeigt eine andere Strecke: Go-Strecke wiederherstellen
  useEffect(() => {
    if (!goSelecting || !goDest || waypoints.some((w) => w.id === GO_DEST_ID)) return;
    setWaypoints(goWaypoints(here, goDest));
    pendingFitRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim Wechsel in die Go-Ansicht
  }, [goSelecting, goDest]);

  /* ---------- Live-Abfahrten für verknüpfte Wege ---------- */
  const transitKey = presets
    .filter((p) => p.transit)
    .map((p) => p.id + p.transit!.stopId + p.transit!.line + p.transit!.direction)
    .join('|');
  useEffect(() => {
    const linked = presets.filter((p) => p.transit);
    if (linked.length === 0 || session) return;
    let cancelled = false;
    const load = async () => {
      for (const p of linked) {
        try {
          const { deps, newStopId } = await departuresFor(p.transit!, Date.now() - 2 * 60_000);
          if (cancelled) return;
          setLive((l) => ({ ...l, [p.id]: deps }));
          if (newStopId) {
            setPresets((list) => list.map((x) => (x.id === p.id && x.transit ? { ...x, transit: { ...x.transit, stopId: newStopId } } : x)));
          }
        } catch {
          if (!cancelled) setLive((l) => ({ ...l, [p.id]: l[p.id] ?? [] }));
        }
      }
    };
    load();
    const id = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur bei Änderung der Verknüpfungen
  }, [transitKey, session]);

  /* ---------- Erinnerungen planen ---------- */
  const remindKey = JSON.stringify(presets.map((p) => [p.id, p.name, p.times, p.bufferMin, p.remind, p.origin, p.originDistance, p.transit]));
  useEffect(() => {
    syncReminders(presets, settings.walkSpeedKmh);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remindKey fasst die relevanten Felder zusammen
  }, [remindKey, settings.walkSpeedKmh]);
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    // Beim Zurückkehren in die App das 7-Tage-Fenster nachplanen
    const h = CapApp.addListener('resume', () => syncReminders(presetsRef.current, settings.walkSpeedKmh));
    return () => {
      h.then((x) => x.remove());
    };
  }, [settings.walkSpeedKmh]);
  const presetsRef = useRef(presets);
  const liveRef = useRef(live);
  const startPresetRef = useRef(startPreset);
  useLayoutEffect(() => {
    presetsRef.current = presets;
    liveRef.current = live;
    startPresetRef.current = startPreset;
  });

  // Tipp auf „Los“ in einer Erinnerung startet den Weg direkt
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const h = LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
      const extra = e.notification.extra as { presetId?: string; scheduledMs?: number } | undefined;
      const p = presetsRef.current.find((x) => x.id === extra?.presetId);
      if (!p) return;
      setTab('run');
      setExpanded(true);
      if (e.actionId !== 'start') return;
      const deps = upcomingDepartures(p, Date.now(), 8, liveRef.current[p.id]);
      const dep = deps.find((d) => d.scheduledMs === extra?.scheduledMs) ?? deps[0];
      if (dep) startPresetRef.current(p, dep);
    });
    return () => {
      h.then((x) => x.remove());
    };
  }, []);

  const locked = session != null;

  /* ---------- Zurück-Taste (Android) ---------- */
  const backRef = useRef<() => void>(() => {});
  useLayoutEffect(() => {
    backRef.current = () => {
      if (dialogOpen) return cancelDialog();
      if (searchOpen) return setSearchOpen(false);
      if (stopSearchOpen) return setStopSearchOpen(false);
      if (pickingDest) return setPickingDest(false);
      if (draft) return setDraft(null);
      if (editing) return finishEditing();
      if (sim.active) return sim.close();
      if (goIdle && goDest && tab === 'run') return setGoDest(null);
      if (expanded && tab !== 'run') return setTab('run');
      if (expanded && session) return setExpanded(false);
      // Während eines Laufs nicht beenden, sondern in den Hintergrund
      if (session) return void CapApp.minimizeApp();
      void CapApp.exitApp();
    };
  });
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handle = CapApp.addListener('backButton', () => backRef.current());
    return () => {
      handle.then((h) => h.remove());
    };
  }, []);

  /* ---------- Wischen am Griff ---------- */
  const touchY = useRef<number | null>(null);
  const onHandleTouchStart = (e: React.TouchEvent) => {
    touchY.current = e.touches[0].clientY;
  };
  const onHandleTouchEnd = (e: React.TouchEvent) => {
    if (touchY.current == null) return;
    const dy = e.changedTouches[0].clientY - touchY.current;
    touchY.current = null;
    if (dy > 30) setExpanded(false);
    else if (dy < -30) setExpanded(true);
  };

  /* ---------- Darstellung ---------- */
  const statusText =
    phase === 'preview'
      ? 'Vorschau'
      : phase === 'running'
        ? (session?.label ?? 'Lauf aktiv')
        : phase === 'waiting'
          ? `Start ${formatClock(window_.startMs)}`
          : phase === 'finished'
            ? 'Im Ziel'
            : route
              ? `${formatDistance(route.distanceMeters)} Strecke`
              : 'Bereit';

  const toolbarMode = editing || pickingDest;
  const mapControlsBottom = (toolbarMode ? 96 : sheetHeight) + 12;

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-canvas font-sans text-ink">
      <MapView
        route={route}
        waypoints={waypoints}
        editable={(editing && !locked) || pickingDest || goSelecting}
        dragOnlyId={goSelecting && !pickingDest ? GO_DEST_ID : undefined}
        onAddWaypoint={(c) => {
          if (pickingDest) {
            setDraftPlace(placeTarget, c);
            setPickingDest(false);
          } else if (goSelecting) {
            if (goDest) moveGoDest(c);
            else void pickGoTarget(c);
          } else addWaypoint(c);
        }}
        onMoveWaypoint={(id, c) => (goSelecting && id === GO_DEST_ID ? moveGoDest(c) : moveWaypointTo(id, c))}
        pacer={{ position: pacer.position, bearing: pacer.bearing, alongMeters: pacer.alongMeters, visible: phase !== 'idle' }}
        user={fix}
        follow={follow}
        onFollowChange={setFollow}
        fitSignal={fitSignal}
        bottomInset={toolbarMode ? 96 : sheetHeight}
      />

      {/* Kopfzeile */}
      {!toolbarMode && (
        <header
          className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 px-4"
          style={{ paddingTop: 'calc(var(--safe-top) + 12px)' }}
        >
          <div className="pointer-events-auto flex items-center gap-2.5 rounded-2xl bg-white/95 py-2 pl-2.5 pr-3.5 shadow-float">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-ink">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
                <path d="M4 18h6l3-9 3 6h4" />
              </svg>
            </span>
            <div className="leading-tight">
              <div className="text-[13px] font-bold tracking-tight">Sprintende Sprinter</div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    phase === 'running' ? 'bg-pacer' : phase === 'finished' ? 'bg-ahead' : 'bg-muted/50'
                  }`}
                />
                {statusText}
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Bearbeiten: Hinweis oben, Werkzeugleiste unten */}
      {editing && (
        <>
          <div className="pointer-events-none absolute inset-x-0 z-10 flex justify-center px-4" style={{ top: 'calc(var(--safe-top) + 12px)' }}>
            <div className="rounded-2xl bg-ink px-4 py-2.5 text-center text-sm font-medium text-white shadow-float">
              {waypoints.length === 0
                ? 'Tippe auf die Karte, um den Start zu setzen'
                : waypoints.length === 1
                  ? 'Tippe für den nächsten Punkt'
                  : 'Weitere Punkte setzen oder Punkte verschieben'}
            </div>
          </div>
          <div
            className="absolute inset-x-0 bottom-0 z-20 mx-auto flex max-w-[520px] items-center gap-2 rounded-t-[22px] bg-white px-4 pt-3 shadow-sheet"
            style={{ paddingBottom: 'calc(var(--safe-bottom) + 12px)' }}
          >
            <button
              type="button"
              disabled={waypoints.length === 0}
              onClick={() => setWaypoints((ws) => ws.slice(0, -1))}
              className="flex h-12 items-center gap-2 rounded-xl bg-canvas px-4 text-sm font-semibold text-ink disabled:opacity-40"
            >
              <Undo2 className="h-4 w-4" /> Rückgängig
            </button>
            <div className="num min-w-0 flex-1 text-center leading-tight">
              <div className="text-base font-bold text-ink">{formatDistance(route?.distanceMeters ?? 0)}</div>
              <div className="text-[11px] text-muted">{waypoints.length === 1 ? '1 Punkt' : `${waypoints.length} Punkte`}</div>
            </div>
            <button
              type="button"
              onClick={finishEditing}
              className="flex h-12 items-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-white"
            >
              <Check className="h-4 w-4" /> Fertig
            </button>
          </div>
        </>
      )}

      {/* Kartensteuerung */}
      <div className="absolute right-4 z-10 flex flex-col gap-2" style={{ bottom: mapControlsBottom }}>
        {route && (
          <MapButton
            title="Strecke einpassen"
            onClick={() => {
              setFollow(false);
              fitRoute();
            }}
          >
            <Maximize2 className="h-[18px] w-[18px]" />
          </MapButton>
        )}
        <MapButton
          title={follow ? 'Karte nicht mehr mitführen' : 'Meinem Standort folgen'}
          active={follow}
          onClick={() => {
            if (!tracking.enabled) tracking.start();
            setFollow((f) => !f);
          }}
        >
          <Navigation className="h-[18px] w-[18px]" fill={follow ? 'currentColor' : 'none'} />
        </MapButton>
      </div>

      {/* Ziel eines Wegs auf der Karte wählen */}
      {pickingDest && (
        <>
          <div className="pointer-events-none absolute inset-x-0 z-10 flex justify-center px-4" style={{ top: 'calc(var(--safe-top) + 12px)' }}>
            <div className="rounded-2xl bg-ink px-4 py-2.5 text-center text-sm font-medium text-white shadow-float">
              {placeTarget === 'dest' ? 'Tippe auf dein Ziel, zum Beispiel das Gleis' : 'Tippe auf deinen üblichen Start, zum Beispiel dein Zuhause'}
            </div>
          </div>
          <div
            className="absolute inset-x-0 bottom-0 z-20 mx-auto flex max-w-[520px] rounded-t-[22px] bg-white px-4 pt-3 shadow-sheet"
            style={{ paddingBottom: 'calc(var(--safe-bottom) + 12px)' }}
          >
            <button type="button" onClick={() => setPickingDest(false)} className="h-12 flex-1 rounded-xl bg-canvas text-sm font-semibold text-ink">
              Abbrechen
            </button>
          </div>
        </>
      )}

      {/* Bedienfeld */}
      {!toolbarMode && (
        <div
          ref={sheetRef}
          className="absolute inset-x-0 bottom-0 z-20 mx-auto flex max-w-[520px] flex-col rounded-t-[22px] bg-white shadow-sheet"
          style={{ paddingBottom: 'calc(var(--safe-bottom) + 12px)', maxHeight: expanded ? '74%' : undefined }}
        >
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            onTouchStart={onHandleTouchStart}
            onTouchEnd={onHandleTouchEnd}
            className="flex w-full items-center justify-center pb-2 pt-3"
            aria-label={expanded ? 'Bedienfeld verkleinern' : 'Bedienfeld vergrößern'}
          >
            <span className="h-1 w-10 rounded-full bg-line" />
          </button>

          {expanded && (
            <nav className="flex gap-1 px-4 pb-3" onTouchStart={onHandleTouchStart} onTouchEnd={onHandleTouchEnd}>
              {visibleTabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`flex-1 rounded-lg py-2.5 text-[13px] font-semibold transition-colors ${
                    tab === t.id ? 'bg-ink text-white' : 'text-muted active:bg-canvas'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          )}

          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-1">
            {goIdle && (!expanded || tab === 'run') && (
              <GoPanel
                candidates={goCands}
                dest={goDest}
                now={now}
                distanceMeters={goDistance}
                distanceLoading={!goRouteReady}
                arriveMs={goArrive}
                arriveAuto={goArriveMs == null}
                normalKmh={goKmh}
                busy={presetBusy === 'go'}
                onPick={(c: GoCandidate) => void pickGoTarget(c)}
                onSearch={() => {
                  setSearchFor('go');
                  setSearchOpen(true);
                }}
                onClear={() => setGoDest(null)}
                onArriveChange={setGoArriveMs}
                onGo={startGo}
              />
            )}
            {!settings.goMode && expanded && tab === 'run' && phase === 'idle' && (
              <>
                <PresetList
                  presets={presets}
                  now={now}
                  here={here}
                  walkSpeedKmh={settings.walkSpeedKmh}
                  busyId={presetBusy}
                  live={live}
                  onStart={startPreset}
                  onEdit={openEditor}
                  onCreate={() => openEditor()}
                />
                <div className="mt-6">
                  <SectionLabel>Freie Strecke</SectionLabel>
                </div>
              </>
            )}
            {!goIdle && (!expanded || tab === 'run') && (
              <RunPanel
                phase={phase}
                compact={!expanded}
                route={route}
                pacer={pacer}
                window={window_}
                now={pacerNow}
                gps={{ enabled: tracking.enabled, fix, error: tracking.error }}
                onToggleGps={toggleGps}
                onOpenAppSettings={tracking.openSettings}
                user={userLoc}
                standing={standing}
                gapMeters={gapMeters}
                gapSeconds={gapSeconds}
                result={session?.result ?? null}
                onStart={() => handleStart()}
                onStop={handleStop}
                sim={sim}
                onOpenPreview={() => {
                  sim.open(computeWindow(time, resolveStart(time, Date.now())));
                  fitRoute();
                }}
                distanceToStart={distanceToStart}
                onStartEditing={startEditing}
                onOpenSearch={() => {
                  setSearchFor('route');
                  setSearchOpen(true);
                }}
                hasSaved={saved.length > 0}
                pointCount={waypoints.length}
                onOpenRouteTab={() => {
                  setExpanded(true);
                  setTab('route');
                }}
              />
            )}
            {expanded && tab === 'time' && (
              <TimePanel time={time} onChange={setTime} window={window_} route={route} paceMinPerKm={pacer.paceMinPerKm} running={locked} />
            )}
            {expanded && tab === 'route' && (
              <RoutePanel
                waypoints={waypoints}
                route={route}
                loading={routeLoading}
                locked={locked}
                travelMode={travelMode}
                onTravelModeChange={setTravelMode}
                lineMode={lineMode}
                onLineModeChange={setLineMode}
                onStartEditing={startEditing}
                onOpenSearch={() => {
                  setSearchFor('route');
                  setSearchOpen(true);
                }}
                onRemove={(id) => setWaypoints((ws) => ws.filter((w) => w.id !== id))}
                onMove={reorder}
                onReverse={() => setWaypoints((ws) => [...ws].reverse())}
                onCloseLoop={() => setWaypoints((ws) => (ws.length ? [...ws, { ...ws[0], id: newId() }] : ws))}
                onClear={clearRoute}
                saved={saved}
                onSave={saveCurrent}
                onLoad={loadSaved}
                onDeleteSaved={async (r) => {
                  if (await confirm({ title: `„${r.name}“ löschen?`, confirmLabel: 'Löschen', danger: true })) {
                    setSaved((s) => s.filter((x) => x.id !== r.id));
                  }
                }}
              />
            )}
            {expanded && tab === 'options' && <OptionsPanel settings={settings} onChange={setSettings} />}
          </div>

          {!expanded && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="mx-5 mt-2 flex items-center justify-center gap-1 py-1 text-xs font-medium text-muted"
            >
              <ChevronUp className="h-3.5 w-3.5" /> Mehr anzeigen
            </button>
          )}
          {expanded && tab === 'run' && route && phase !== 'preview' && !goIdle && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="mx-5 mt-2 flex items-center justify-center gap-1 py-1 text-xs font-medium text-muted"
            >
              <ChevronDown className="h-3.5 w-3.5" /> Weniger anzeigen
            </button>
          )}
        </div>
      )}

      {draft && (
        <PresetEditor
          draft={draft.preset}
          isNew={draft.isNew}
          hidden={pickingDest || searchOpen || stopSearchOpen}
          onChange={(p) => setDraft((d) => (d ? { ...d, preset: p } : d))}
          onSave={saveDraft}
          onDelete={deleteDraft}
          onClose={() => setDraft(null)}
          onPickOnMap={(t) => {
            setPlaceTarget(t);
            setPickingDest(true);
          }}
          onSearch={(t) => {
            setPlaceTarget(t);
            setSearchFor('preset');
            setSearchOpen(true);
          }}
          onUseHere={hereForDraft}
          onPickStop={() => setStopSearchOpen(true)}
          onEnableReminder={enableReminder}
          exactAlarms={exactAlarms}
          onFixExactAlarms={async () => {
            await openExactAlarmSettings();
            setExactAlarms(await exactAlarmsAllowed());
          }}
        />
      )}

      {stopSearchOpen && draft && (
        <StopSearch
          near={draft.preset.dest.name ? draft.preset.dest : here}
          onClose={() => setStopSearchOpen(false)}
          onPick={(stop) => {
            setStopSearchOpen(false);
            setDraft((d) => {
              if (!d) return d;
              const prev = d.preset.transit;
              const preset: Preset = {
                ...d.preset,
                transit: { stopId: stop.id, stopName: stop.name, lat: stop.lat, lng: stop.lng, line: prev?.line ?? '', direction: prev?.direction ?? '' },
              };
              // Ohne Ziel: Haltestelle als Ziel übernehmen
              if (!preset.dest.name) preset.dest = { lat: stop.lat, lng: stop.lng, name: stop.name };
              return { ...d, preset };
            });
          }}
        />
      )}

      {searchOpen && searchFor === 'preset' && (
        <SearchOverlay
          near={here}
          onClose={() => setSearchOpen(false)}
          onPickCurrentLocation={() => hereForDraft(placeTarget)}
          onPick={(coord, name) => {
            setSearchOpen(false);
            setDraftPlace(placeTarget, coord, name);
          }}
        />
      )}

      {searchOpen && searchFor === 'go' && (
        <SearchOverlay
          near={here}
          onClose={() => setSearchOpen(false)}
          onPick={(coord, name) => {
            setSearchOpen(false);
            void pickGoTarget({ ...coord, name });
          }}
        />
      )}

      {searchOpen && searchFor === 'route' && (
        <SearchOverlay
          near={fix ?? waypoints[waypoints.length - 1] ?? null}
          onClose={() => setSearchOpen(false)}
          onPickCurrentLocation={addCurrentLocation}
          onPick={(coord, name) => {
            setSearchOpen(false);
            pendingFitRef.current = true;
            addWaypoint(coord, name);
            toast.show(waypoints.length === 0 ? `Start: ${name}` : `${name} hinzugefügt`);
            if (waypoints.length === 0) fitRoute();
          }}
        />
      )}

      {toast.toast}
      {dialog}
    </div>
  );
}

function MapButton({
  children,
  onClick,
  title,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`grid h-11 w-11 place-items-center rounded-xl shadow-float transition-colors ${
        active ? 'bg-gps text-white' : 'bg-white text-ink'
      }`}
    >
      {children}
    </button>
  );
}
