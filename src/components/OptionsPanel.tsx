import { Volume2 } from 'lucide-react';
import type { Settings } from '../types/route';
import { speak, spokenGap } from '../services/feedback.ts';
import { Button, Segmented, SectionLabel, Toggle } from './ui.tsx';

interface OptionsPanelProps {
  settings: Settings;
  onChange: (s: Settings) => void;
}

export function OptionsPanel({ settings, onChange }: OptionsPanelProps) {
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });

  return (
    <div>
      <SectionLabel>Go-Modus</SectionLabel>
      <Toggle
        label="Go-Modus"
        hint="Für Eile: Ziel antippen, verschieben, Ankunft setzen, Los. Statt Wege, Zeit und Strecke gibt es nur diese eine Ansicht."
        checked={settings.goMode}
        onChange={(v) => set({ goMode: v })}
      />

      <SectionLabel>Ansagen</SectionLabel>
      <div className="divide-y divide-line">
        <Toggle
          label="Sprachansagen"
          hint="Abstand zum Pacer wird angesagt, auch bei ausgeschaltetem Bildschirm."
          checked={settings.voice}
          onChange={(v) => set({ voice: v })}
        />
        <div className={`py-3 ${settings.voice ? '' : 'opacity-50'}`}>
          <div className="mb-2 text-sm font-medium text-ink">Regelmäßig ansagen</div>
          <Segmented
            size="sm"
            disabled={!settings.voice}
            value={settings.announceInterval}
            onChange={(v) => set({ announceInterval: v })}
            options={[
              { value: 0, label: 'Nie' },
              { value: 30, label: '30 s' },
              { value: 60, label: '1 min' },
              { value: 120, label: '2 min' },
              { value: 300, label: '5 min' },
            ]}
          />
        </div>
        <Toggle
          label="Bei Wechsel ansagen"
          hint="Wenn du hinter den Pacer fällst, ihn überholst oder die Strecke verlässt."
          checked={settings.announceChanges}
          disabled={!settings.voice}
          onChange={(v) => set({ announceChanges: v })}
        />
        <Toggle
          label="Vibration"
          hint="Langes Muster: zurückgefallen. Kurz: wieder vorne."
          checked={settings.haptics}
          onChange={(v) => set({ haptics: v })}
        />
      </div>
      <Button className="mt-2 w-full" onClick={() => speak(spokenGap(-12))}>
        <Volume2 className="h-4 w-4" /> Ansage testen
      </Button>

      <SectionLabel>Wege</SectionLabel>
      <div className="mb-2 text-sm font-medium text-ink">Dein normales Tempo</div>
      <Segmented
        size="sm"
        value={settings.walkSpeedKmh}
        onChange={(v) => set({ walkSpeedKmh: v })}
        options={[
          { value: 4, label: '4 km/h' },
          { value: 5, label: '5 km/h' },
          { value: 6, label: '6 km/h' },
          { value: 8, label: '8 km/h' },
          { value: 10, label: '10 km/h' },
        ]}
      />
      <p className="mt-2 text-xs text-muted">Damit wird bei gespeicherten Wegen berechnet, wann du spätestens losgehen musst.</p>

      <SectionLabel>Anzeige</SectionLabel>
      <Toggle
        label="Bildschirm anlassen"
        hint="Während des Laufs. Braucht mehr Akku; GPS und Ansagen laufen auch ohne."
        checked={settings.keepAwake}
        onChange={(v) => set({ keepAwake: v })}
      />

      <SectionLabel>Datenquellen</SectionLabel>
      <p className="text-xs leading-relaxed text-muted">
        Alle Dienste sind kostenlos und brauchen keinen API-Schlüssel. Karte: OpenFreeMap, Kartendaten © OpenStreetMap-Mitwirkende.
        Wegführung: FOSSGIS-OSRM. Ortssuche: Photon von komoot.
      </p>
    </div>
  );
}
