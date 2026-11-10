import { useState } from 'react';
import type { TimeConfig, RunWindow, RouteData } from '../types/route';
import { formatClock, formatDistance, formatDuration, formatPace } from '../services/geoMath.ts';
import { Notice, Segmented, SectionLabel } from './ui.tsx';

interface TimePanelProps {
  time: TimeConfig;
  onChange: (t: TimeConfig) => void;
  window: RunWindow;
  route: RouteData | null;
  paceMinPerKm: number;
  running: boolean;
}

const inputCls =
  'num w-full rounded-xl border border-line bg-white px-3 py-2.5 text-lg font-semibold text-ink outline-none focus:border-ink';

/** Zahlenfeld, in das man frei tippen kann: Text bleibt beim Tippen lokal, Wert wird sofort übernommen. */
function NumberField({ value, max, label, onCommit }: { value: number; max: number; label: string; onCommit: (v: number) => void }) {
  const [text, setText] = useState<string | null>(null);
  return (
    <label className="flex-1">
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={text ?? String(value)}
        onFocus={(e) => {
          setText(String(value));
          e.target.select();
        }}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 2);
          setText(digits);
          onCommit(Math.min(max, digits === '' ? 0 : parseInt(digits, 10)));
        }}
        onBlur={() => setText(null)}
        className={inputCls + ' text-center'}
      />
      <span className="mt-1 block text-center text-[11px] text-muted">{label}</span>
    </label>
  );
}

function DurationInput({ seconds, onChange }: { seconds: number; onChange: (s: number) => void }) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const set = (nh: number, nm: number, ns: number) => onChange(nh * 3600 + nm * 60 + ns);
  return (
    <div className="flex gap-2">
      <NumberField value={h} max={23} label="Std" onCommit={(v) => set(v, m, s)} />
      <NumberField value={m} max={59} label="Min" onCommit={(v) => set(h, v, s)} />
      <NumberField value={s} max={59} label="Sek" onCommit={(v) => set(h, m, v)} />
    </div>
  );
}

export function TimePanel({ time, onChange, window, route, paceMinPerKm, running }: TimePanelProps) {
  const update = (patch: Partial<TimeConfig>) => onChange({ ...time, ...patch });

  const quick = (mins: number) => {
    if (time.targetMode === 'duration') {
      update({ targetDuration: mins * 60 });
    } else {
      const t = new Date(Math.max(window.startMs, Date.now()) + mins * 60 * 1000 + 59_000);
      update({ targetClock: formatClock(t.getTime()) });
    }
  };

  return (
    <div>
      <SectionLabel>Ziel</SectionLabel>
      <Segmented
        value={time.targetMode}
        onChange={(v) => update({ targetMode: v })}
        options={[
          { value: 'clock', label: 'Ankunft um' },
          { value: 'duration', label: 'Laufzeit' },
        ]}
      />
      <div className="mt-3">
        {time.targetMode === 'clock' ? (
          <input type="time" value={time.targetClock} onChange={(e) => update({ targetClock: e.target.value })} className={inputCls} />
        ) : (
          <DurationInput seconds={time.targetDuration} onChange={(s) => update({ targetDuration: s })} />
        )}
      </div>
      <div className="mt-2 flex gap-1.5">
        {[10, 20, 30, 45, 60].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => quick(m)}
            className="num flex-1 rounded-lg border border-line py-1.5 text-xs font-medium text-ink-2 active:bg-canvas"
          >
            {time.targetMode === 'duration' ? `${m} min` : `+${m}`}
          </button>
        ))}
      </div>
      {time.targetMode === 'clock' && (
        <p className="mt-2 text-xs text-muted">Der Pacer erreicht das Ziel zu Beginn der Minute (:00).</p>
      )}

      <SectionLabel>Start</SectionLabel>
      <Segmented
        value={time.startMode}
        disabled={running}
        onChange={(v) => update({ startMode: v })}
        options={[
          { value: 'tap', label: 'Beim Tippen auf Start' },
          { value: 'fixed', label: 'Feste Uhrzeit' },
        ]}
      />
      {time.startMode === 'fixed' && (
        <div className="mt-3">
          <input
            type="time"
            step={1}
            disabled={running}
            value={time.fixedStart}
            onChange={(e) => update({ fixedStart: e.target.value })}
            className={inputCls}
          />
          <p className="mt-2 text-xs text-muted">
            Liegt die Uhrzeit in der Vergangenheit, startet der Pacer mit Vorsprung, zum Beispiel wenn du schon unterwegs bist.
          </p>
        </div>
      )}
      {running && <p className="mt-2 text-xs text-muted">Der Start ist während des Laufs festgelegt. Das Ziel kannst du noch ändern.</p>}

      <SectionLabel>Ergebnis</SectionLabel>
      {route && route.distanceMeters > 0 ? (
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-canvas p-3">
          <div>
            <div className="text-[11px] text-muted">Pace</div>
            <div className="num text-base font-semibold text-pacer">{formatPace(paceMinPerKm)}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted">Dauer</div>
            <div className="num text-base font-semibold">{formatDuration((window.targetMs - window.startMs) / 1000)}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted">Distanz</div>
            <div className="num text-base font-semibold">{formatDistance(route.distanceMeters)}</div>
          </div>
        </div>
      ) : (
        <Notice>Noch keine Strecke angelegt.</Notice>
      )}
    </div>
  );
}
