import { useEffect, useState } from 'react';
import { ArrowLeft, Bell, Crosshair, Loader2, MapPin, Plus, Search, TrainFront, Trash2, X } from 'lucide-react';
import type { Preset } from '../types/route';
import { departuresFor, type LiveDeparture } from '../services/transit.ts';
import { formatClock } from '../services/geoMath.ts';
import { Segmented, Toggle } from './ui.tsx';

export type PlaceTarget = 'dest' | 'origin';

interface PresetEditorProps {
  draft: Preset;
  isNew: boolean;
  hidden: boolean;
  onChange: (p: Preset) => void;
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
  onPickOnMap: (t: PlaceTarget) => void;
  onSearch: (t: PlaceTarget) => void;
  onUseHere: (t: PlaceTarget) => void;
  onPickStop: () => void;
  onEnableReminder: () => Promise<boolean>;
  exactAlarms: boolean;
  onFixExactAlarms: () => void;
}

const label = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.08em] text-muted';
const field = 'w-full rounded-xl border border-line bg-white px-3 py-2.5 text-base text-ink outline-none focus:border-ink';
const WEEKDAYS = [
  { d: 1, l: 'Mo' },
  { d: 2, l: 'Di' },
  { d: 3, l: 'Mi' },
  { d: 4, l: 'Do' },
  { d: 5, l: 'Fr' },
  { d: 6, l: 'Sa' },
  { d: 0, l: 'So' },
];

/** Vollbild-Formular für einen Weg. Bleibt beim Wählen auf der Karte gemountet (nur versteckt). */
export function PresetEditor(p: PresetEditorProps) {
  const d = p.draft;
  const set = (patch: Partial<Preset>) => p.onChange({ ...d, ...patch });
  const hasDest = d.dest.name !== '';
  const validTimes = d.times.filter((t) => /^\d{2}:\d{2}$/.test(t));
  const canSave = d.name.trim() !== '' && hasDest && (validTimes.length > 0 || !!d.transit);
  const remind = d.remind ?? { enabled: false, days: [1, 2, 3, 4, 5], leadMin: 5 };

  return (
    <div className={`absolute inset-0 z-40 flex flex-col bg-white ${p.hidden ? 'hidden' : ''}`} style={{ paddingTop: 'var(--safe-top)' }}>
      <div className="flex items-center gap-1 border-b border-line px-2 py-2">
        <button type="button" onClick={p.onClose} aria-label="Zurück" className="rounded-xl p-2.5 text-ink active:bg-canvas">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="flex-1 text-base font-semibold text-ink">{p.isNew ? 'Neuer Weg' : 'Weg bearbeiten'}</h2>
        {!p.isNew && (
          <button type="button" onClick={p.onDelete} aria-label="Weg löschen" className="rounded-xl p-2.5 text-behind active:bg-behind-soft">
            <Trash2 className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-5 py-5">
        <div>
          <label className={label} htmlFor="preset-name">Name</label>
          <input
            id="preset-name"
            value={d.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="z. B. Zum Bahnhof"
            enterKeyHint="done"
            className={field}
          />
        </div>

        <PlaceField
          title="Ziel"
          value={hasDest ? d.dest.name : null}
          hint="Setze das Ziel möglichst genau, zum Beispiel direkt auf das Gleis."
          onMap={() => p.onPickOnMap('dest')}
          onSearch={() => p.onSearch('dest')}
          onHere={() => p.onUseHere('dest')}
        />

        <TransitSection draft={d} set={set} onPickStop={p.onPickStop} />

        <div>
          <span className={label}>{d.transit ? 'Deine Züge (Abfahrt)' : 'Da sein um'}</span>
          <div className="space-y-2">
            {d.times.map((t, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="time"
                  value={t}
                  onChange={(e) => set({ times: d.times.map((x, j) => (j === i ? e.target.value : x)) })}
                  className={field + ' num font-semibold'}
                />
                <button
                  type="button"
                  onClick={() => set({ times: d.times.filter((_, j) => j !== i) })}
                  aria-label="Zeit entfernen"
                  className="rounded-xl px-3 text-muted active:bg-canvas"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => set({ times: [...d.times, addMinutes(d.times[d.times.length - 1] ?? '07:00', 30)] })}
            className="mt-2 flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm font-semibold text-ink"
          >
            <Plus className="h-4 w-4" /> Weitere Zeit
          </button>
          <p className="mt-1 text-xs text-muted">
            {d.transit
              ? d.times.length === 0
                ? 'Ohne feste Zeiten schlägt die App einfach die nächsten Abfahrten der Linie vor. Für Erinnerungen trage deine Züge ein.'
                : 'Verspätungen werden live eingerechnet. Die App schlägt immer die nächste Abfahrt vor.'
              : 'Mehrere Zeiten, zum Beispiel jeder Zug, den du nehmen könntest. Die App schlägt immer die nächste vor.'}
          </p>
        </div>

        <div>
          <span className={label}>Puffer</span>
          <Segmented
            size="sm"
            value={d.bufferMin}
            onChange={(v) => set({ bufferMin: v })}
            options={[0, 1, 2, 3, 5].map((m) => ({ value: m, label: m === 0 ? 'Keiner' : `${m} min` }))}
          />
          <p className="mt-2 text-xs text-muted">So viele Minuten vor der Abfahrt will der Pacer am Ziel sein.</p>
        </div>

        <div>
          <span className={label}>Unterwegs</span>
          <Segmented
            size="sm"
            value={d.travelMode}
            onChange={(v) => set({ travelMode: v })}
            options={[
              { value: 'walking', label: 'Zu Fuß' },
              { value: 'cycling', label: 'Fahrrad' },
            ]}
          />
        </div>

        {/* Erinnerung */}
        <div className="rounded-2xl border border-line p-4">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-ink" />
            <span className="text-sm font-semibold text-ink">Erinnerung</span>
          </div>
          <Toggle
            label="Rechtzeitig Bescheid geben"
            hint={
              d.transit
                ? 'Meldet, wann du los musst, und warnt bei Verspätung, Ausfall oder Gleiswechsel. Auch wenn die App zu ist.'
                : 'Meldet, wann du los musst. Auch wenn die App zu ist.'
            }
            checked={remind.enabled}
            onChange={async (v) => {
              if (v && !(await p.onEnableReminder())) return;
              set({ remind: { ...remind, enabled: v } });
            }}
          />
          {remind.enabled && (
            <div className="space-y-4 pt-1">
              <div>
                <span className={label}>Tage</span>
                <div className="flex gap-1">
                  {WEEKDAYS.map(({ d: day, l }) => {
                    const on = remind.days.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() =>
                          set({ remind: { ...remind, days: on ? remind.days.filter((x) => x !== day) : [...remind.days, day] } })
                        }
                        className={`h-9 flex-1 rounded-lg text-xs font-semibold ${on ? 'bg-ink text-white' : 'bg-canvas text-muted'}`}
                      >
                        {l}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <span className={label}>Vorlauf</span>
                <Segmented
                  size="sm"
                  value={remind.leadMin}
                  onChange={(v) => set({ remind: { ...remind, leadMin: v } })}
                  options={[0, 2, 5, 10, 15].map((m) => ({ value: m, label: m === 0 ? 'Genau' : `${m} min` }))}
                />
                <p className="mt-2 text-xs text-muted">So viele Minuten vor „spätestens los“ kommt die Erinnerung.</p>
              </div>
              <PlaceField
                title="Du startest meistens von"
                value={d.origin?.name ?? null}
                hint="Daraus wird berechnet, wann du los musst. Zum Beispiel dein Zuhause."
                onMap={() => p.onPickOnMap('origin')}
                onSearch={() => p.onSearch('origin')}
                onHere={() => p.onUseHere('origin')}
              />
              {validTimes.length === 0 && <p className="text-xs font-medium text-behind">Trage oben mindestens eine Zeit ein.</p>}
              {!d.origin && <p className="text-xs font-medium text-behind">Wähle, von wo du meistens startest.</p>}
              {!p.exactAlarms && (
                <button type="button" onClick={p.onFixExactAlarms} className="w-full rounded-xl bg-behind-soft px-3 py-2.5 text-left text-xs font-medium text-behind">
                  Android erlaubt keine minutengenauen Erinnerungen. Hier tippen und „Wecker und Erinnerungen“ erlauben.
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-line px-5 pt-3" style={{ paddingBottom: 'calc(var(--safe-bottom) + 12px)' }}>
        <button
          type="button"
          disabled={!canSave}
          onClick={p.onSave}
          className="w-full rounded-xl bg-ink py-3.5 text-base font-semibold text-white disabled:opacity-40"
        >
          Speichern
        </button>
        {!canSave && (
          <p className="mt-2 text-center text-xs text-muted">
            {!d.name.trim() ? 'Gib dem Weg einen Namen.' : !hasDest ? 'Wähle ein Ziel.' : 'Lege eine Uhrzeit fest oder verknüpfe einen Zug.'}
          </p>
        )}
      </div>
    </div>
  );
}

function PlaceField({
  title,
  value,
  hint,
  onMap,
  onSearch,
  onHere,
}: {
  title: string;
  value: string | null;
  hint: string;
  onMap: () => void;
  onSearch: () => void;
  onHere: () => void;
}) {
  return (
    <div>
      <span className={label}>{title}</span>
      {value && (
        <div className="mb-2 flex items-center gap-2.5 rounded-xl bg-canvas px-3 py-2.5">
          <MapPin className="h-4 w-4 shrink-0 text-ink" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{value}</span>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <SmallBtn onClick={onMap}>
          <MapPin className="h-4 w-4" /> Karte
        </SmallBtn>
        <SmallBtn onClick={onSearch}>
          <Search className="h-4 w-4" /> Suchen
        </SmallBtn>
        <SmallBtn onClick={onHere}>
          <Crosshair className="h-4 w-4" /> Hier
        </SmallBtn>
      </div>
      <p className="mt-2 text-xs text-muted">{hint}</p>
    </div>
  );
}

function TransitSection({ draft: d, set, onPickStop }: { draft: Preset; set: (p: Partial<Preset>) => void; onPickStop: () => void }) {
  const t = d.transit;
  const [preview, setPreview] = useState<LiveDeparture[] | null>(null);
  const [loading, setLoading] = useState(false);
  const key = t ? `${t.stopId}|${t.line}|${t.direction}` : '';

  useEffect(() => {
    if (!t) return;
    const ctrl = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const { deps } = await departuresFor(t, Date.now() - 60_000, ctrl.signal);
        setPreview(deps.slice(0, 4));
      } catch {
        if (!ctrl.signal.aborted) setPreview([]);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 500);
    return () => {
      ctrl.abort();
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur bei Änderung von Haltestelle/Filter
  }, [key]);

  return (
    <div>
      <span className={label}>Zug oder Bus (optional)</span>
      {!t ? (
        <>
          <button type="button" onClick={onPickStop} className="flex w-full items-center gap-2.5 rounded-xl bg-canvas px-3 py-3 text-left text-sm font-medium text-ink">
            <TrainFront className="h-4 w-4" /> Haltestelle verknüpfen
          </button>
          <p className="mt-2 text-xs text-muted">Dann siehst du live Verspätung, Gleis und Ausfälle, und die Zielzeit passt sich an.</p>
        </>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2.5 rounded-xl bg-canvas px-3 py-2.5">
            <TrainFront className="h-4 w-4 shrink-0 text-ink" />
            <button type="button" onClick={onPickStop} className="min-w-0 flex-1 truncate text-left text-sm font-medium text-ink">
              {t.stopName}
            </button>
            <button type="button" onClick={() => set({ transit: undefined })} aria-label="Verknüpfung entfernen" className="p-1 text-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-2">
            <input
              value={t.line}
              onChange={(e) => set({ transit: { ...t, line: e.target.value } })}
              placeholder="Linie, z. B. RE3"
              className={field + ' w-[42%]'}
            />
            <input
              value={t.direction}
              onChange={(e) => set({ transit: { ...t, direction: e.target.value } })}
              placeholder="Richtung (optional)"
              className={field}
            />
          </div>
          <div className="rounded-xl border border-line">
            {loading && !preview && (
              <div className="flex items-center gap-2 px-3 py-2.5 text-xs text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Lade Abfahrten
              </div>
            )}
            {preview && preview.length === 0 && <div className="px-3 py-2.5 text-xs text-muted">Keine passenden Abfahrten gefunden.</div>}
            {preview?.map((dep) => (
              <div key={dep.scheduledMs + dep.line + dep.headsign} className="num flex items-center gap-2 border-b border-line px-3 py-2 text-xs last:border-0">
                <span className="w-11 font-semibold text-ink">{formatClock(dep.scheduledMs)}</span>
                <span className="w-14 truncate font-semibold text-ink">{dep.line}</span>
                <span className="min-w-0 flex-1 truncate text-ink-2">{dep.headsign}</span>
                {dep.cancelled ? (
                  <span className="font-semibold text-behind">fällt aus</span>
                ) : dep.realMs - dep.scheduledMs >= 60_000 ? (
                  <span className="font-semibold text-behind">+{Math.round((dep.realMs - dep.scheduledMs) / 60_000)}</span>
                ) : null}
                {dep.track && <span className="text-muted">Gl. {dep.track}</span>}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted">Nächste Abfahrten mit diesem Filter. So prüfst du, ob Linie und Richtung stimmen.</p>
        </div>
      )}
    </div>
  );
}

function addMinutes(hhmm: string, mins: number) {
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10) || 0);
  const t = (h * 60 + m + mins) % (24 * 60);
  return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
}

function SmallBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center gap-1.5 rounded-xl bg-canvas py-2.5 text-sm font-medium text-ink active:bg-line"
    >
      {children}
    </button>
  );
}
