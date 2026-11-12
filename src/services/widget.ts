/**
 * Homescreen-Widget „Nächster Weg“: Die App rechnet die nächsten Abfahrten aus und gibt sie
 * an das native Widget. Das Widget zeigt immer den nächsten Eintrag, der noch nicht vorbei ist,
 * und schaltet von selbst weiter – auch wenn die App zu ist.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import type { Preset } from '../types/route';
import type { LiveDeparture } from './transit.ts';
import { calculateDistance } from './geoMath.ts';
import { DETOUR_FACTOR, upcomingDepartures } from './presets.ts';

/** Deep Link aus dem Widget: sprintende://start?preset=…&scheduled=… */
export const WIDGET_SCHEME = 'sprintende';

export interface WidgetEntry {
  presetId: string;
  scheduledMs: number;
  /** Name des Wegs */
  title: string;
  /** z. B. „RB10 13:04 · +3 min · Gleis 5“ */
  detail: string;
  /** spätestens da sein */
  arriveMs: number;
  /** spätestens los (0 = ohne Startpunkt unbekannt) */
  leaveMs: number;
  warn: boolean;
}

interface WidgetPlugin {
  update(options: { entries: string }): Promise<void>;
}
const Widget = registerPlugin<WidgetPlugin>('Widget');

export function widgetEntries(
  presets: Preset[],
  live: Record<string, LiveDeparture[] | undefined>,
  nowMs: number,
  walkSpeedKmh: number
): WidgetEntry[] {
  const out: WidgetEntry[] = [];
  for (const p of presets) {
    const dist = p.origin ? (p.originDistance ?? calculateDistance(p.origin, p.dest) * DETOUR_FACTOR) : null;
    const walkMs = dist != null ? (dist / (walkSpeedKmh / 3.6)) * 1000 : 0;
    for (const d of upcomingDepartures(p, nowMs, 6, live[p.id])) {
      const parts = [`${d.live?.line || p.transit?.line?.trim() || ''} ${d.time}`.trim() + (d.tomorrow ? ' (morgen)' : '')];
      if (d.live?.cancelled) parts.push('fällt aus');
      else if (d.live && d.live.delayMin > 0) parts.push(`+${d.live.delayMin} min`);
      if (d.live?.track) parts.push(`Gleis ${d.live.track}`);
      out.push({
        presetId: p.id,
        scheduledMs: d.scheduledMs,
        title: p.name || 'Weg',
        detail: parts.join(' · '),
        arriveMs: d.arriveMs,
        leaveMs: dist != null ? Math.floor((d.arriveMs - walkMs) / 60_000) * 60_000 : 0,
        warn: !!(d.live?.cancelled || d.live?.trackChanged || (d.live && d.live.delayMin >= 5)),
      });
    }
  }
  return out.sort((a, b) => (a.leaveMs || a.arriveMs) - (b.leaveMs || b.arriveMs)).slice(0, 20);
}

let lastSent = '';
export async function syncWidget(entries: WidgetEntry[]) {
  if (!Capacitor.isNativePlatform()) return;
  const json = JSON.stringify(entries);
  if (json === lastSent) return;
  try {
    await Widget.update({ entries: json });
    lastSent = json;
  } catch (e) {
    console.warn('Widget nicht aktualisiert', e);
  }
}
