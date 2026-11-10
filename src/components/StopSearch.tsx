import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, Loader2, TrainFront, X } from 'lucide-react';
import type { LatLng } from '../types/route';
import { searchStops, type StopResult } from '../services/transit.ts';

/** Vollbild-Suche nach Bahnhöfen und Haltestellen (Transitous). */
export function StopSearch({ near, onPick, onClose }: { near: LatLng | null; onPick: (s: StopResult) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StopResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nearRef = useRef(near);
  useLayoutEffect(() => {
    nearRef.current = near;
  });

  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const q = query.trim();
    const ctrl = new AbortController();
    const t = window.setTimeout(
      async () => {
        if (q.length < 2) {
          setResults([]);
          setError(null);
          setLoading(false);
          return;
        }
        setLoading(true);
        try {
          setResults(await searchStops(q, nearRef.current, ctrl.signal));
          setError(null);
        } catch {
          if (!ctrl.signal.aborted) setError('Fahrplanauskunft gerade nicht erreichbar.');
        } finally {
          if (!ctrl.signal.aborted) setLoading(false);
        }
      },
      q.length < 2 ? 0 : 350
    );
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [query]);

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-white" style={{ paddingTop: 'var(--safe-top)' }}>
      <div className="flex items-center gap-1 border-b border-line px-2 py-2">
        <button type="button" onClick={onClose} aria-label="Zurück" className="rounded-xl p-2.5 text-ink active:bg-canvas">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <input
          ref={inputRef}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Bahnhof oder Haltestelle"
          className="min-w-0 flex-1 bg-transparent py-2 text-base text-ink outline-none placeholder:text-muted"
        />
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin text-muted" />}
        {query && !loading && (
          <button type="button" onClick={() => setQuery('')} aria-label="Eingabe löschen" className="rounded-xl p-2.5 text-muted">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {error && <li className="px-4 py-3 text-sm text-behind">{error}</li>}
        {!error && query.trim().length >= 2 && !loading && results.length === 0 && (
          <li className="px-4 py-3 text-sm text-muted">Keine Haltestelle gefunden.</li>
        )}
        {results.map((r) => (
          <li key={r.id} className="border-b border-line">
            <button type="button" onClick={() => onPick(r)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-canvas">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-canvas text-ink-2">
                <TrainFront className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink">{r.name}</span>
                {r.place && <span className="block truncate text-xs text-muted">{r.place}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
