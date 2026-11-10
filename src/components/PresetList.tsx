import { useState } from 'react';
import { Bell, Loader2, Pencil, Play, Plus, TrainFront } from 'lucide-react';
import type { LatLng, Preset } from '../types/route';
import { estimate, upcomingDepartures, type Departure } from '../services/presets.ts';
import { formatClock, formatDistance } from '../services/geoMath.ts';
import type { LiveDeparture } from '../services/transit.ts';

interface PresetListProps {
  presets: Preset[];
  now: number;
  here: LatLng | null;
  walkSpeedKmh: number;
  busyId: string | null;
  /** Live-Abfahrten je Weg (nur bei Zug-Verknüpfung) */
  live: Record<string, LiveDeparture[] | undefined>;
  onStart: (p: Preset, d: Departure) => void;
  onEdit: (p: Preset) => void;
  onCreate: () => void;
}

function inMinutes(ms: number, now: number) {
  const min = Math.round((ms - now) / 60_000);
  if (min < 60) return `in ${min} min`;
  const h = Math.floor(min / 60);
  return `in ${h} h ${min % 60} min`;
}

export function PresetList({ presets, now, here, walkSpeedKmh, busyId, live, onStart, onEdit, onCreate }: PresetListProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Deine Wege</h3>
        {presets.length > 0 && (
          <button type="button" onClick={onCreate} className="-my-1 flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-ink active:bg-canvas">
            <Plus className="h-3.5 w-3.5" /> Neuer Weg
          </button>
        )}
      </div>

      {presets.length === 0 ? (
        <button
          type="button"
          onClick={onCreate}
          className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-line px-4 py-4 text-left active:bg-canvas"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-canvas">
            <Plus className="h-5 w-5 text-ink" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-ink">Weg anlegen</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted">
              Zum Beispiel „Zum Bahnhof, 13:04 am Gleis“. Ein Tipp startet den Pacer von deinem Standort aus.
            </span>
          </span>
        </button>
      ) : (
        <div className="space-y-2">
          {presets.map((p) => (
            <PresetCard
              key={p.id}
              preset={p}
              now={now}
              here={here}
              walkSpeedKmh={walkSpeedKmh}
              live={live[p.id]}
              busy={busyId === p.id}
              disabled={busyId != null}
              onStart={(d) => onStart(p, d)}
              onEdit={() => onEdit(p)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PresetCard({
  preset,
  now,
  here,
  walkSpeedKmh,
  live,
  busy,
  disabled,
  onStart,
  onEdit,
}: {
  preset: Preset;
  now: number;
  here: LatLng | null;
  walkSpeedKmh: number;
  live: LiveDeparture[] | undefined;
  busy: boolean;
  disabled: boolean;
  onStart: (d: Departure) => void;
  onEdit: () => void;
}) {
  const departures = upcomingDepartures(preset, now, 4, live);
  const [picked, setPicked] = useState<number | null>(null);
  const selected =
    departures.find((d) => d.scheduledMs === picked) ?? departures.find((d) => !d.live?.cancelled) ?? departures[0];
  const waitingForLive = !!preset.transit && preset.times.length === 0 && live === undefined;
  const est = selected && here ? estimate(here, preset, selected.arriveMs, now, walkSpeedKmh) : null;

  let hint: React.ReactNode = null;
  if (selected?.live?.cancelled) {
    hint = <span className="font-semibold text-behind">Fällt aus. Wähle eine andere Abfahrt.</span>;
  } else if (est && selected) {
    if (est.distanceMeters < 80) {
      hint = <span className="text-ahead">Du bist schon da.</span>;
    } else if (est.latestLeaveMs > now) {
      const soon = est.latestLeaveMs - now < 3 * 60_000;
      hint = (
        <span className={soon ? 'font-semibold text-pacer' : 'text-ink-2'}>
          Spätestens {formatClock(est.latestLeaveMs)} los, ca. {formatDistance(est.distanceMeters)}
        </span>
      );
    } else {
      hint = (
        <span className="font-semibold text-behind">
          Knapp: jetzt los mit {est.requiredKmh.toFixed(1).replace('.', ',')} km/h, ca. {formatDistance(est.distanceMeters)}
        </span>
      );
    }
  } else if (selected) {
    hint = <span className="text-muted">Standort unbekannt, Schätzung folgt mit GPS.</span>;
  }

  return (
    <div className="rounded-2xl border border-line p-3.5">
      <div className="flex items-start gap-3">
        <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left" aria-label={`${preset.name} bearbeiten`}>
          <div className="flex items-center gap-1.5">
            <span className="truncate text-base font-semibold text-ink">{preset.name}</span>
            <Pencil className="h-3 w-3 shrink-0 text-muted" />
            {preset.remind?.enabled && <Bell className="h-3 w-3 shrink-0 text-muted" aria-label="Erinnerung aktiv" />}
          </div>
          <div className="mt-0.5 truncate text-xs text-muted">{preset.transit ? preset.transit.stopName : preset.dest.name}</div>
        </button>
        {selected ? (
          <button
            type="button"
            disabled={disabled || !!selected.live?.cancelled}
            onClick={() => onStart(selected)}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white active:bg-ink-2 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" fill="currentColor" />}
            Los
          </button>
        ) : waitingForLive ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted" />
        ) : (
          <span className="shrink-0 text-xs text-muted">Keine Abfahrt</span>
        )}
      </div>

      {selected && (
        <>
          <div className="num mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-ink">
              {selected.tomorrow && <span className="mr-1.5 text-base font-semibold text-muted">morgen</span>}
              {selected.time}
            </span>
            <span className="text-xs text-muted">
              {inMinutes(selected.arriveMs + preset.bufferMin * 60_000, now)}
              {preset.bufferMin > 0 ? `, ${preset.bufferMin} min früher da` : ''}
            </span>
          </div>
          {selected.live && (
            <div className="num mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
              <span className="flex items-center gap-1 font-semibold text-ink">
                <TrainFront className="h-3.5 w-3.5" /> {selected.live.line}
              </span>
              <span className="min-w-0 truncate text-ink-2">{selected.live.headsign}</span>
              {selected.live.track && (
                <span className={selected.live.trackChanged ? 'font-semibold text-behind' : 'text-ink-2'}>
                  Gleis {selected.live.track}
                  {selected.live.trackChanged ? ' (geändert)' : ''}
                </span>
              )}
              {!selected.live.cancelled &&
                (selected.live.delayMin >= 1 ? (
                  <span className="font-semibold text-behind">+{selected.live.delayMin} min</span>
                ) : (
                  <span className="font-medium text-ahead">pünktlich</span>
                ))}
            </div>
          )}
          <div className="mt-1 text-xs">{hint}</div>
          {departures.length > 1 && (
            <div className="mt-2.5 flex gap-1.5">
              {departures.map((d) => (
                <button
                  key={d.scheduledMs}
                  type="button"
                  onClick={() => setPicked(d.scheduledMs)}
                  className={`num rounded-lg px-2.5 py-1 text-xs font-semibold ${
                    d.scheduledMs === selected.scheduledMs ? 'bg-ink text-white' : 'bg-canvas text-ink-2'
                  } ${d.live?.cancelled ? 'line-through opacity-60' : ''}`}
                >
                  {d.tomorrow ? 'morgen ' : ''}
                  {d.time}
                  {d.live && !d.live.cancelled && d.live.delayMin >= 1 ? ` +${d.live.delayMin}` : ''}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
