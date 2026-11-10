import { useState } from 'react';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Ban,
  Bookmark,
  Loader2,
  MousePointerClick,
  RefreshCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { LineMode, RouteData, SavedRoute, TravelMode, Waypoint } from '../types/route';
import { formatDistance } from '../services/geoMath.ts';
import { Button, Notice, Segmented, SectionLabel } from './ui.tsx';
import { routeNotice } from '../services/routeNotice.ts';

interface RoutePanelProps {
  waypoints: Waypoint[];
  route: RouteData | null;
  loading: boolean;
  locked: boolean;
  travelMode: TravelMode;
  onTravelModeChange: (m: TravelMode) => void;
  lineMode: LineMode;
  onLineModeChange: (m: LineMode) => void;
  onStartEditing: () => void;
  onOpenSearch: () => void;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onReverse: () => void;
  onCloseLoop: () => void;
  onClear: () => void;
  saved: SavedRoute[];
  onSave: (name: string) => void;
  onLoad: (r: SavedRoute) => void;
  onDeleteSaved: (r: SavedRoute) => void;
  blockCount: number;
  onStartBlocking: () => void;
}

function isLoop(waypoints: Waypoint[]) {
  const n = waypoints.length;
  return n > 2 && waypoints[0].lat === waypoints[n - 1].lat && waypoints[0].lng === waypoints[n - 1].lng;
}

export function RoutePanel(p: RoutePanelProps) {
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);
  const loop = isLoop(p.waypoints);
  const disabled = p.locked;
  const hasRoute = !!p.route && p.route.distanceMeters > 0;
  const notice = routeNotice(p.route);

  return (
    <div>
      {p.locked && (
        <div className="mb-4">
          <Notice>Während eines Laufs ist die Strecke gesperrt. Beende den Lauf, um sie zu ändern.</Notice>
        </div>
      )}

      {/* Übersicht */}
      <div className="flex items-baseline justify-between">
        <div className="num text-[28px] font-bold leading-none tracking-tight text-ink">
          {formatDistance(p.route?.distanceMeters ?? 0)}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted">
          {p.loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {p.waypoints.length === 1 ? '1 Punkt' : `${p.waypoints.length} Punkte`}
          {loop ? ', Rundkurs' : ''}
        </div>
      </div>
      {notice && (
        <div className="mt-3">
          <Notice tone={notice.tone}>{notice.text}</Notice>
        </div>
      )}

      {/* Punkte hinzufügen */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button onClick={p.onStartEditing} disabled={disabled} className="py-3">
          <MousePointerClick className="h-4 w-4" /> Auf Karte setzen
        </Button>
        <Button onClick={p.onOpenSearch} disabled={disabled} className="py-3">
          <Search className="h-4 w-4" /> Ort suchen
        </Button>
      </div>

      <Button onClick={p.onStartBlocking} disabled={disabled} className="mt-2 w-full py-3">
        <Ban className="h-4 w-4" /> Straßen sperren{p.blockCount > 0 ? ` (${p.blockCount} gesperrt)` : ''}
      </Button>

      {p.waypoints.length > 0 ? (
        <ol className="mt-3 divide-y divide-line rounded-xl border border-line">
          {p.waypoints.map((wp, i) => {
            const isStart = i === 0;
            const isFinish = i === p.waypoints.length - 1 && p.waypoints.length > 1;
            return (
              <li key={wp.id} className="flex items-center gap-2.5 py-1.5 pl-3 pr-1">
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white ${
                    isStart ? 'bg-ahead' : 'bg-ink'
                  }`}
                >
                  {isStart ? 'S' : isFinish ? 'Z' : i}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink">{wp.name}</span>
                <span className="flex shrink-0">
                  <IconBtn title="Nach oben" disabled={disabled || i === 0} onClick={() => p.onMove(wp.id, -1)}>
                    <ArrowUp className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn title="Nach unten" disabled={disabled || i === p.waypoints.length - 1} onClick={() => p.onMove(wp.id, 1)}>
                    <ArrowDown className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn title="Entfernen" disabled={disabled} onClick={() => p.onRemove(wp.id)}>
                    <X className="h-4 w-4" />
                  </IconBtn>
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-muted">Noch keine Punkte. Der erste Punkt ist der Start, der letzte das Ziel.</p>
      )}

      {p.waypoints.length > 0 && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Button onClick={p.onReverse} disabled={disabled || p.waypoints.length < 2} className="px-2 text-xs">
            <ArrowLeftRight className="h-4 w-4" /> Umkehren
          </Button>
          <Button onClick={p.onCloseLoop} disabled={disabled || p.waypoints.length < 2 || loop} className="px-2 text-xs">
            <RefreshCcw className="h-4 w-4" /> Rundkurs
          </Button>
          <Button onClick={p.onClear} disabled={disabled} className="px-2 text-xs">
            <Trash2 className="h-4 w-4" /> Leeren
          </Button>
        </div>
      )}

      <SectionLabel>Wegführung</SectionLabel>
      <Segmented
        value={p.lineMode}
        onChange={p.onLineModeChange}
        disabled={disabled}
        options={[
          { value: 'routed', label: 'Wegen folgen' },
          { value: 'direct', label: 'Luftlinie' },
        ]}
      />
      {p.lineMode === 'routed' && (
        <div className="mt-2">
          <Segmented
            size="sm"
            value={p.travelMode}
            onChange={p.onTravelModeChange}
            disabled={disabled}
            options={[
              { value: 'walking', label: 'Zu Fuß' },
              { value: 'cycling', label: 'Fahrrad' },
              { value: 'driving', label: 'Auto' },
            ]}
          />
        </div>
      )}

      <SectionLabel
        right={
          !saving && (
            <button
              type="button"
              disabled={!hasRoute}
              onClick={() => setSaving(true)}
              className="-my-1 rounded-lg px-2 py-1 text-xs font-semibold text-ink active:bg-canvas disabled:opacity-40"
            >
              Aktuelle speichern
            </button>
          )
        }
      >
        Gespeicherte Strecken
      </SectionLabel>
      {saving && (
        <form
          className="mb-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            p.onSave(saveName.trim() || `Strecke ${p.saved.length + 1}`);
            setSaveName('');
            setSaving(false);
          }}
        >
          <input
            autoFocus
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            enterKeyHint="done"
            placeholder="Name, z. B. Hausrunde"
            className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-base outline-none focus:border-ink"
          />
          <button type="submit" className="rounded-xl bg-ink px-3.5 text-sm font-semibold text-white">
            Speichern
          </button>
          <button type="button" className="rounded-xl px-2 text-ink" onClick={() => setSaving(false)} aria-label="Abbrechen">
            <X className="h-4 w-4" />
          </button>
        </form>
      )}
      {p.saved.length === 0 ? (
        <p className="text-xs text-muted">Noch keine Strecken gespeichert.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {p.saved.map((r) => (
            <li key={r.id} className="flex items-center gap-2 pl-3 pr-1">
              <button
                type="button"
                disabled={disabled}
                onClick={() => p.onLoad(r)}
                className="flex min-w-0 flex-1 items-center gap-2.5 py-3 text-left disabled:opacity-50"
              >
                <Bookmark className="h-4 w-4 shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{r.name}</span>
                <span className="num shrink-0 text-xs text-muted">{formatDistance(r.distanceMeters)}</span>
              </button>
              <IconBtn title="Löschen" onClick={() => p.onDeleteSaved(r)}>
                <Trash2 className="h-4 w-4" />
              </IconBtn>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function IconBtn({
  children,
  title,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg p-2.5 text-ink-2 active:bg-canvas disabled:opacity-25"
    >
      {children}
    </button>
  );
}
