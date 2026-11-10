import { Loader2, MapPin, Play, Plus, Search, X } from 'lucide-react';
import { formatClock, formatDistance } from '../services/geoMath.ts';
import type { GoCandidate } from '../services/go.ts';

export interface GoDest {
  name: string;
  lat: number;
  lng: number;
  travelMode: GoCandidate['travelMode'];
}

interface GoPanelProps {
  candidates: GoCandidate[];
  dest: GoDest | null;
  now: number;
  /** Weglänge (geroutet, sonst geschätzt) – null, solange der Standort fehlt */
  distanceMeters: number | null;
  distanceLoading: boolean;
  arriveMs: number;
  /** true = Vorschlag aus normalem Tempo, noch nicht angepasst */
  arriveAuto: boolean;
  normalKmh: number;
  busy: boolean;
  onPick: (c: GoCandidate) => void;
  onSearch: () => void;
  onClear: () => void;
  onArriveChange: (ms: number) => void;
  onGo: () => void;
  /** Zwischenstopps in Reihenfolge */
  vias: { id: string; name: string }[];
  /** Nächster Tipp auf die Karte setzt einen Zwischenstopp */
  addingVia: boolean;
  onAddVia: () => void;
  onCancelVia: () => void;
  onRemoveVia: (id: string) => void;
}

export const MAX_VIAS = 3;

const MIN_LEAD_MS = 60_000;

function inMinutes(ms: number, now: number) {
  const min = Math.round((ms - now) / 60_000);
  if (min < 60) return `in ${min} min`;
  return `in ${Math.floor(min / 60)} h ${min % 60} min`;
}

/** Reduzierte Oberfläche: Ziel antippen, Ankunft setzen, los. */
export function GoPanel(p: GoPanelProps) {
  if (!p.dest) return <PickTarget {...p} />;

  const { dest, now, distanceMeters, arriveMs } = p;
  const left = arriveMs - now;
  const tooSoon = left < MIN_LEAD_MS;
  const kmh = distanceMeters != null && !tooSoon ? (distanceMeters / (left / 1000)) * 3.6 : null;
  const hard = kmh != null && kmh > p.normalKmh * 1.25;
  const tomorrow = new Date(arriveMs).getDate() !== new Date(now).getDate();

  const shift = (min: number) => {
    const base = Math.max(arriveMs, Math.ceil((now + MIN_LEAD_MS) / 60_000) * 60_000);
    p.onArriveChange(min < 0 ? Math.max(base + min * 60_000, Math.ceil((now + MIN_LEAD_MS) / 60_000) * 60_000) : base + min * 60_000);
  };

  const onTimeInput = (value: string) => {
    const [h, m] = value.split(':').map((x) => parseInt(x, 10));
    if (isNaN(h) || isNaN(m)) return;
    const d = new Date(now);
    d.setHours(h, m, 0, 0);
    let t = d.getTime();
    // Uhrzeit, die heute schon vorbei ist, meint morgen (wie beim Ziel „Ankunft um“)
    if (t <= now) t += 86_400_000;
    p.onArriveChange(t);
  };

  return (
    <div>
      <div className="flex items-center gap-3 rounded-2xl bg-canvas px-3.5 py-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink text-white">
          <MapPin className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold text-ink">{dest.name}</div>
          <div className="num text-xs text-muted">
            {distanceMeters == null ? 'Standort wird gesucht …' : `${p.distanceLoading ? 'ca. ' : ''}${formatDistance(distanceMeters)}`}
            {' · '}Ziel ziehen oder Karte antippen zum Verschieben
          </div>
        </div>
        <button type="button" onClick={p.onClear} aria-label="Anderes Ziel" className="-mr-1 rounded-xl p-2 text-muted active:bg-line">
          <X className="h-5 w-5" />
        </button>
      </div>

      {p.vias.length > 0 && (
        <ol className="mt-2 space-y-1.5">
          {p.vias.map((v, i) => (
            <li key={v.id} className="flex items-center gap-2.5 rounded-xl border border-line py-1 pl-3 pr-1">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-bold text-white">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{v.name}</span>
              <button type="button" onClick={() => p.onRemoveVia(v.id)} aria-label="Zwischenstopp entfernen" className="rounded-lg p-2 text-muted active:bg-canvas">
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ol>
      )}
      {p.addingVia ? (
        <div className="mt-2 flex items-center gap-2 rounded-xl bg-ink px-3.5 py-2.5 text-sm font-medium text-white">
          <span className="min-w-0 flex-1">Tippe auf die Karte für den Zwischenstopp</span>
          <button type="button" onClick={p.onCancelVia} className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-white/80 active:bg-white/10">
            Abbrechen
          </button>
        </div>
      ) : (
        p.vias.length < MAX_VIAS && (
          <button
            type="button"
            onClick={p.onAddVia}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line py-2.5 text-sm font-semibold text-ink-2 active:bg-canvas"
          >
            <Plus className="h-4 w-4" /> Zwischenstopp
          </button>
        )
      )}

      <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Ankunft</div>
      <div className="mt-2 flex items-center gap-1.5">
        <ShiftButton label="−5" onClick={() => shift(-5)} />
        <ShiftButton label="−1" onClick={() => shift(-1)} />
        <label className="relative min-w-0 flex-1">
          <input
            type="time"
            value={formatClock(arriveMs)}
            onChange={(e) => onTimeInput(e.target.value)}
            aria-label="Ankunftszeit"
            className={`num h-14 w-full rounded-xl border bg-white text-center text-3xl font-bold tracking-tight outline-none focus:border-ink ${
              tooSoon ? 'border-behind text-behind' : 'border-line text-ink'
            }`}
          />
        </label>
        <ShiftButton label="+1" onClick={() => shift(1)} />
        <ShiftButton label="+5" onClick={() => shift(5)} />
      </div>
      <div className="num mt-1.5 min-h-[18px] text-center text-xs">
        {tooSoon ? (
          <span className="font-semibold text-behind">Zu knapp. Spätere Ankunft wählen.</span>
        ) : (
          <>
            <span className="text-ink-2">
              {tomorrow ? 'morgen, ' : ''}
              {inMinutes(arriveMs, now)}
            </span>
            {kmh != null && (
              <span className={hard ? 'font-semibold text-pacer' : 'text-ink-2'}>
                {' · '}
                {kmh.toFixed(1).replace('.', ',')} km/h nötig
              </span>
            )}
            {p.arriveAuto && <span className="text-muted"> · bei normalem Tempo</span>}
          </>
        )}
      </div>

      <button
        type="button"
        disabled={tooSoon || p.busy}
        onClick={p.onGo}
        className="mt-4 flex h-16 w-full items-center justify-center gap-2.5 rounded-2xl bg-pacer text-xl font-bold text-white active:brightness-95 disabled:opacity-50"
      >
        {p.busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Play className="h-6 w-6" fill="currentColor" />}
        Los
      </button>
    </div>
  );
}

function PickTarget({ candidates, onPick, onSearch }: GoPanelProps) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Wohin?</div>
      {candidates.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {candidates.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => onPick(c)}
              className="min-w-0 rounded-2xl border border-line px-3 py-3 text-left active:bg-canvas"
            >
              <span className="block truncate text-sm font-semibold text-ink">{c.name}</span>
              <span className="num mt-0.5 block truncate text-[11px] text-muted">
                {c.distance != null ? formatDistance(c.distance) + ' · ' : ''}
                {c.source}
              </span>
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={onSearch}
        className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-sm font-semibold text-white active:bg-ink-2"
      >
        <Search className="h-4 w-4" /> Ziel suchen
      </button>
      <p className="mt-2 text-center text-xs text-muted">
        {candidates.length === 0 ? 'Oder tippe auf die Karte. Genutzte Ziele erscheinen hier.' : 'Oder tippe auf die Karte.'}
      </p>
    </div>
  );
}

function ShiftButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="num h-14 w-11 shrink-0 rounded-xl bg-canvas text-sm font-semibold text-ink active:bg-line"
    >
      {label}
    </button>
  );
}
