export interface LatLng {
  lat: number;
  lng: number;
}

export interface Waypoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export type TravelMode = 'walking' | 'cycling' | 'driving';

/** 'routed' = Wegführung über Straßen/Wege, 'direct' = Luftlinie */
export type LineMode = 'routed' | 'direct';

export interface RouteData {
  /** [lat, lng] */
  coordinates: [number, number][];
  cumulative: number[];
  distanceMeters: number;
  lineMode: LineMode;
  /** true, wenn Wegführung gewünscht war, aber nicht erreichbar → Luftlinie */
  fallback: boolean;
  /** Herkunft der Wegführung: live, aus dem Cache, Sperren per Alternative gemieden oder nicht berücksichtigt */
  source?: 'live' | 'cache' | 'avoided' | 'blocks-ignored';
}

export type StartMode = 'tap' | 'fixed';
export type TargetMode = 'clock' | 'duration';

export interface TimeConfig {
  startMode: StartMode;
  /** "HH:mm" oder "HH:mm:ss" */
  fixedStart: string;
  targetMode: TargetMode;
  /** "HH:mm" – Ziel wird zu Beginn dieser Minute (:00) erreicht */
  targetClock: string;
  /** Sekunden */
  targetDuration: number;
}

export interface RunWindow {
  startMs: number;
  targetMs: number;
}

export interface PacerState {
  progress: number;
  alongMeters: number;
  position: LatLng | null;
  bearing: number;
  speedMps: number;
  paceMinPerKm: number;
  remainingMeters: number;
  remainingSeconds: number;
  elapsedSeconds: number;
  hasStarted: boolean;
  isFinished: boolean;
}

export interface Fix {
  lat: number;
  lng: number;
  accuracy: number;
  /** m/s, geglättet; null wenn unbekannt */
  speed: number | null;
  time: number;
}

export type Standing = 'ahead' | 'behind' | 'onpace' | 'offroute';

export interface Settings {
  voice: boolean;
  /** Sekunden, 0 = aus */
  announceInterval: number;
  announceChanges: boolean;
  haptics: boolean;
  keepAwake: boolean;
  /** Normales Gehtempo in km/h – für „spätestens los um“ */
  walkSpeedKmh: number;
  /** Go-Modus: reduzierte Oberfläche – Ziel wählen, Ankunft setzen, los */
  goMode: boolean;
  /** Worüber Updates kommen: Hinweis mit Download in der App, nur Hinweis (Obtainium) oder gar nicht */
  updateSource: UpdateSource;
  /** @deprecated 1.1.0 – ersetzt durch updateSource */
  updateCheck?: boolean;
}

export type UpdateSource = 'app' | 'obtainium' | 'off';

/** Vom Nutzer gesperrtes Straßenstück, das die Wegführung meidet */
export interface Block {
  id: string;
  /** Angetippte Stelle; um sie herum wird gesperrt */
  lat: number;
  lng: number;
  name: string;
  /** Verlauf des gesperrten Stücks, [lat, lng] */
  shape: [number, number][];
}

/** Im Go-Modus angesteuertes Ziel (Verlauf für Vorschläge) */
export interface GoTarget {
  id: string;
  name: string;
  lat: number;
  lng: number;
  travelMode: TravelMode;
  uses: number;
  lastUsed: number;
}

/** Gespeicherter Weg: „von hier bis HH:MM an diesem Ort“ */
export interface Preset {
  id: string;
  name: string;
  dest: { lat: number; lng: number; name: string };
  /** Ankunftszeiten "HH:MM", z. B. Abfahrtszeiten des Zugs */
  times: string[];
  /** Minuten früher da sein als die Uhrzeit */
  bufferMin: number;
  travelMode: TravelMode;
  /** Optional: Verknüpfung mit Zug/Bus für Echtzeit */
  transit?: TransitLink;
  /** Optional: automatische Erinnerung zum Losgehen */
  remind?: Reminder;
  /** Startpunkt für Erinnerungen, z. B. Zuhause */
  origin?: { lat: number; lng: number; name: string };
  /** Länge des Wegs von origin zum Ziel (Meter), beim Speichern berechnet */
  originDistance?: number;
}

export interface TransitLink {
  stopId: string;
  stopName: string;
  lat: number;
  lng: number;
  /** z. B. "RE3", leer = alle Linien */
  line: string;
  /** Teil des Fahrtziels, z. B. "Stralsund", leer = alle */
  direction: string;
}

export interface Reminder {
  enabled: boolean;
  /** Wochentage 0 = Sonntag … 6 = Samstag */
  days: number[];
  /** Minuten vor „spätestens los“ */
  leadMin: number;
}

export interface SavedRoute {
  id: string;
  name: string;
  waypoints: Waypoint[];
  lineMode: LineMode;
  travelMode: TravelMode;
  distanceMeters: number;
  savedAt: number;
}
