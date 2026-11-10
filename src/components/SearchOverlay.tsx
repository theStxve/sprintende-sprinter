import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, Crosshair, Loader2, MapPin, X } from 'lucide-react';
import type { LatLng } from '../types/route';
import { searchPlaces, type SearchResult } from '../services/routing.ts';

interface SearchOverlayProps {
  near: LatLng | null;
  onPick: (coord: LatLng, name: string) => void;
  onPickCurrentLocation?: () => void;
  onClose: () => void;
}

/** Vollbild-Suche: Eingabe oben, Ergebnisse darunter – nichts wird von der Tastatur verdeckt. */
export function SearchOverlay({ near, onPick, onPickCurrentLocation, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
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
          setResults(await searchPlaces(q, nearRef.current, ctrl.signal));
          setError(null);
        } catch {
          if (!ctrl.signal.aborted) setError('Suche gerade nicht erreichbar. Prüfe die Internetverbindung.');
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
    <div className="absolute inset-0 z-40 flex flex-col bg-white" style={{ paddingTop: 'var(--safe-top)' }}>
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
          placeholder="Ort, Adresse oder Sehenswürdigkeit"
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
        {onPickCurrentLocation && (
        <li>
          <button type="button" onClick={onPickCurrentLocation} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-canvas">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-gps-soft text-gps">
              <Crosshair className="h-4 w-4" />
            </span>
            <span className="text-sm font-medium text-ink">Aktueller Standort</span>
          </button>
        </li>
        )}
        {error && <li className="px-4 py-3 text-sm text-behind">{error}</li>}
        {!error && query.trim().length >= 2 && !loading && results.length === 0 && (
          <li className="px-4 py-3 text-sm text-muted">Nichts gefunden.</li>
        )}
        {results.map((r) => (
          <li key={r.id} className="border-t border-line">
            <button
              type="button"
              onClick={() => onPick({ lat: r.lat, lng: r.lng }, r.name)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-canvas"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-canvas text-ink-2">
                <MapPin className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink">{r.name}</span>
                {r.detail && <span className="block truncate text-xs text-muted">{r.detail}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
