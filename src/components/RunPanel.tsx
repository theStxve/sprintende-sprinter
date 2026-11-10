import { Pause, Play, Square, LocateFixed, LocateOff, X, MousePointerClick, Search, Bookmark } from 'lucide-react';
import type { Fix, PacerState, RouteData, RunWindow, Standing } from '../types/route';
import { formatClock, formatDistance, formatDuration, formatPace } from '../services/geoMath.ts';
import { SIM_SPEEDS } from '../hooks/useClock.ts';
import { Button, Segmented, Stat } from './ui.tsx';

export type Phase = 'idle' | 'waiting' | 'running' | 'finished' | 'preview';

export interface RunPanelProps {
  phase: Phase;
  compact: boolean;
  route: RouteData | null;
  pacer: PacerState;
  window: RunWindow;
  now: number;
  gps: { enabled: boolean; fix: Fix | null; error: string | null };
  onToggleGps: () => void;
  onOpenAppSettings: () => void;
  user: { alongMeters: number; offRouteMeters: number } | null;
  standing: Standing | null;
  gapMeters: number | null;
  gapSeconds: number | null;
  result: { deltaSeconds: number; finishedAt: number } | null;
  onStart: () => void;
  onStop: () => void;
  sim: {
    playing: boolean;
    speed: number;
    setSpeed: (s: number) => void;
    togglePlay: () => void;
    scrub: (f: number) => void;
    close: () => void;
  };
  onOpenPreview: () => void;
  /** Entfernung von der eigenen Position zum Startpunkt */
  distanceToStart: number | null;
  onStartEditing: () => void;
  onOpenSearch: () => void;
  hasSaved: boolean;
  pointCount: number;
  onOpenRouteTab: () => void;
}

const toneText: Record<Standing, string> = {
  ahead: 'text-ahead',
  behind: 'text-behind',
  onpace: 'text-ink',
  offroute: 'text-behind',
};

function signedSeconds(s: number) {
  const r = Math.round(Math.abs(s));
  const body = r >= 3600 ? formatDuration(r) : r >= 60 ? `${Math.floor(r / 60)}:${(r % 60).toString().padStart(2, '0')}` : `${r} s`;
  return `${s >= 0 ? '+' : '−'}${body}`;
}

export function RunPanel(p: RunPanelProps) {
  const total = p.route?.distanceMeters ?? 0;
  const hasRoute = total > 0;
  const tooShort = p.window.targetMs - p.window.startMs < 60_000;
  const fix = p.gps.fix;

  /* ---------- Hauptanzeige ---------- */
  let eyebrow = '';
  let hero: React.ReactNode = null;
  let sub: React.ReactNode = null;

  if (p.phase === 'preview') {
    eyebrow = 'Vorschau im Zeitraffer';
    hero = <span className="text-ink">{formatDuration(p.pacer.elapsedSeconds)}</span>;
    sub = `Pacer bei ${formatDistance(p.pacer.alongMeters)} von ${formatDistance(total)}, Uhrzeit ${formatClock(p.now)}`;
  } else if (p.phase === 'idle') {
    eyebrow = 'Soll-Pace';
    hero = (
      <span className="text-ink">
        {formatPace(p.pacer.paceMinPerKm)}
        <span className="ml-1.5 text-base font-medium text-muted">/km</span>
      </span>
    );
    sub = tooShort
      ? 'Die Zielzeit ist zu knapp. Lege sie im Tab Zeit fest.'
      : hasRoute
      ? `${formatDistance(total)} in ${formatDuration((p.window.targetMs - p.window.startMs) / 1000)}, Ankunft ${formatClock(p.window.targetMs)}`
      : 'Lege zuerst eine Strecke an.';
  } else if (p.phase === 'waiting') {
    eyebrow = 'Start in';
    hero = <span className="text-ink">{formatDuration((p.window.startMs - p.now) / 1000)}</span>;
    sub = `Pacer startet um ${formatClock(p.window.startMs, true)}`;
  } else if (p.phase === 'finished' && p.result) {
    const d = p.result.deltaSeconds;
    eyebrow = 'Ziel erreicht';
    hero = <span className={d >= 0 ? 'text-ahead' : 'text-behind'}>{signedSeconds(d)}</span>;
    sub = `${d >= 0 ? 'vor' : 'nach'} der Zielzeit, angekommen um ${formatClock(p.result.finishedAt, true)}`;
  } else {
    // running
    if (!p.gps.enabled) {
      eyebrow = 'Abstand zum Pacer';
      hero = <span className="text-muted">GPS aus</span>;
      sub = 'Schalte GPS ein, um dich mit dem Pacer zu vergleichen.';
    } else if (p.standing === 'offroute') {
      eyebrow = 'Abseits der Strecke';
      hero = <span className="text-behind">{formatDistance(p.user?.offRouteMeters ?? 0)}</span>;
      sub = 'bis zur nächsten Stelle der Strecke';
    } else if (!fix || !p.standing || p.gapSeconds == null || p.gapMeters == null) {
      eyebrow = 'Abstand zum Pacer';
      hero = <span className="text-muted">Suche GPS</span>;
      sub = p.gps.error ?? 'Warte auf das erste Signal.';
    } else {
      eyebrow = 'Abstand zum Pacer';
      hero = <span className={toneText[p.standing]}>{p.standing === 'onpace' ? 'Im Plan' : signedSeconds(p.gapSeconds)}</span>;
      sub =
        p.standing === 'onpace'
          ? `Weniger als 3 s Abstand`
          : `${formatDistance(Math.abs(p.gapMeters))} ${p.gapMeters > 0 ? 'vor' : 'hinter'} dem Pacer`;
    }
  }

  const userFraction = p.user && total > 0 ? Math.min(1, p.user.alongMeters / total) : null;
  const showUserOnBar =
    userFraction != null && p.standing != null && p.standing !== 'offroute' && (p.phase === 'running' || p.phase === 'finished');
  const farFromStart = p.distanceToStart != null && p.distanceToStart > 60 && (p.phase === 'idle' || p.phase === 'waiting');

  if (!hasRoute && p.phase === 'idle') {
    return (
      <div>
        <div className="text-xl font-bold tracking-tight text-ink">
          {p.pointCount === 0 ? 'Lege deine Strecke an' : 'Jetzt das Ziel setzen'}
        </div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">
          {p.pointCount === 0
            ? 'Setze Start, Zwischenpunkte und Ziel auf der Karte oder suche Orte. Danach legst du fest, wann du ankommen willst.'
            : 'Der Start ist gesetzt. Füge mindestens einen weiteren Punkt hinzu.'}
        </p>
        <div className="mt-4 grid gap-2">
          <Button variant="primary" onClick={p.onStartEditing} className="justify-start py-3.5">
            <MousePointerClick className="h-4 w-4" /> Punkte auf der Karte setzen
          </Button>
          <Button onClick={p.onOpenSearch} className="justify-start py-3.5">
            <Search className="h-4 w-4" /> Ort suchen
          </Button>
          {p.hasSaved && (
            <Button onClick={p.onOpenRouteTab} className="justify-start py-3.5">
              <Bookmark className="h-4 w-4" /> Gespeicherte Strecke laden
            </Button>
          )}
        </div>
      </div>
    );
  }
  const userPace = fix?.speed && fix.speed > 0.3 ? 1000 / fix.speed / 60 : null;

  return (
    <div>
      {/* Hauptanzeige */}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{eyebrow}</div>
          <div className="num mt-0.5 text-[44px] font-bold leading-none tracking-tight">{hero}</div>
          <div className="mt-1.5 text-[13px] text-ink-2">{sub}</div>
        </div>
        {p.phase !== 'preview' && (
          <button
            type="button"
            onClick={p.onToggleGps}
            className={`flex shrink-0 flex-col items-center gap-1 rounded-xl px-2.5 py-2 text-[11px] font-medium ${
              p.gps.enabled ? 'bg-gps-soft text-gps' : 'bg-canvas text-muted'
            }`}
          >
            {p.gps.enabled ? <LocateFixed className="h-5 w-5" /> : <LocateOff className="h-5 w-5" />}
            {p.gps.enabled ? (fix ? `±${Math.round(fix.accuracy)} m` : 'Suche') : 'GPS aus'}
          </button>
        )}
      </div>

      {farFromStart && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-gps-soft px-3 py-2 text-xs font-medium text-gps">
          <span className="h-2 w-2 rounded-full bg-gps" />
          Du bist {formatDistance(p.distanceToStart!)} vom Start entfernt.
        </div>
      )}

      {p.gps.error && p.gps.enabled && (
        <button type="button" onClick={p.onOpenAppSettings} className="mt-2 text-left text-xs text-behind underline">
          {p.gps.error}
        </button>
      )}

      {/* Fortschritt */}
      {hasRoute && p.phase !== 'preview' && (
        <div className="mt-4">
          <div className="relative h-1.5 rounded-full bg-line">
            <div className="absolute inset-y-0 left-0 rounded-full bg-pacer" style={{ width: `${p.pacer.progress * 100}%` }} />
            <div
              className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-pacer shadow"
              style={{ left: `${p.pacer.progress * 100}%` }}
            />
            {showUserOnBar && (
              <div
                className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-gps shadow"
                style={{ left: `${userFraction * 100}%` }}
              />
            )}
          </div>
          <div className="num mt-1.5 flex justify-between text-[11px] text-muted">
            <span>Start</span>
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-pacer" /> Pacer
              </span>
              {showUserOnBar && (
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-gps" /> Du
                </span>
              )}
            </span>
            <span>{formatDistance(total)}</span>
          </div>
        </div>
      )}

      {/* Vorschau-Steuerung */}
      {p.phase === 'preview' && (
        <div className="mt-4 space-y-3">
          <input
            type="range"
            className="track"
            min={0}
            max={1000}
            value={Math.round(p.pacer.progress * 1000)}
            onChange={(e) => p.sim.scrub(Number(e.target.value) / 1000)}
            aria-label="Vorschau-Position"
          />
          <div className="flex items-center gap-2">
            <Button variant="primary" onClick={p.sim.togglePlay} title={p.sim.playing ? 'Pause' : 'Abspielen'} className="w-12 px-0">
              {p.sim.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <div className="flex-1">
              <Segmented
                size="sm"
                value={p.sim.speed}
                onChange={p.sim.setSpeed}
                options={SIM_SPEEDS.map((s) => ({ value: s, label: `${s}x` }))}
              />
            </div>
            <Button variant="ghost" onClick={p.sim.close} title="Vorschau beenden" className="w-11 px-0">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}

      {/* Kennzahlen */}
      {!p.compact && p.phase !== 'preview' && (
        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-line pt-4">
          {p.phase === 'idle' ? (
            <>
              <Stat label="Distanz" value={formatDistance(total)} />
              <Stat label="Tempo" value={(p.pacer.speedMps * 3.6).toFixed(1).replace('.', ',')} unit="km/h" />
              <Stat label="Start" value={p.window.startMs > p.now + 1000 ? formatClock(p.window.startMs) : 'Beim Tippen'} />
              <Stat label="Ankunft" value={formatClock(p.window.targetMs)} />
            </>
          ) : (
            <>
              <Stat label="Soll-Pace" value={formatPace(p.pacer.paceMinPerKm)} unit="/km" tone="pacer" />
              <Stat label="Dein Tempo" value={userPace ? formatPace(userPace) : '–:––'} unit="/km" />
              <Stat
                label="Verbleibend"
                value={formatDistance(p.user && p.standing !== 'offroute' ? total - p.user.alongMeters : p.pacer.remainingMeters)}
              />
              <Stat label="Restzeit" value={formatDuration(p.pacer.remainingSeconds)} />
            </>
          )}
        </div>
      )}

      {/* Aktionen */}
      {p.phase !== 'preview' && (
        <div className="mt-4 flex gap-2">
          {p.phase === 'idle' ? (
            <>
              <Button variant="primary" onClick={p.onStart} disabled={!hasRoute || tooShort} className="flex-1 py-3.5 text-base">
                <Play className="h-4 w-4" fill="currentColor" />
                Lauf starten
              </Button>
              {!p.compact && (
                <Button onClick={p.onOpenPreview} disabled={!hasRoute} className="py-3.5">
                  Vorschau
                </Button>
              )}
            </>
          ) : (
            <Button variant={p.phase === 'finished' ? 'primary' : 'danger'} onClick={p.onStop} className="flex-1 py-3.5 text-base">
              <Square className="h-4 w-4" fill="currentColor" />
              {p.phase === 'finished' ? 'Fertig' : 'Lauf beenden'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
