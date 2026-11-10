import { useEffect, useRef } from 'react';
import type { Settings, Standing } from '../types/route';
import { speak, spokenGap, VIBRATION, vibrate } from '../services/feedback.ts';

interface Options {
  /** Lauf aktiv und Pacer gestartet */
  active: boolean;
  standing: Standing | null;
  gapSeconds: number | null;
  settings: Settings;
  /** Zeitstempel der Auswertung (Uhr-Tick oder GPS-Fix) */
  evalTime: number;
}

const CHANGE_CONFIRM_MS = 6000;

/** Sprachansagen und Vibration während des Laufs. */
export function useFeedback({ active, standing, gapSeconds, settings, evalTime }: Options) {
  const lastAnnounceRef = useRef(0);
  const confirmedRef = useRef<Standing | null>(null);
  const pendingRef = useRef<{ standing: Standing; since: number } | null>(null);

  useEffect(() => {
    if (!active) {
      confirmedRef.current = null;
      pendingRef.current = null;
      lastAnnounceRef.current = 0;
      return;
    }
    if (standing == null || gapSeconds == null) return;

    const now = evalTime;
    if (lastAnnounceRef.current === 0) lastAnnounceRef.current = now;

    // Wechsel vorne/hinten/abseits erst melden, wenn er einige Sekunden anhält
    if (standing !== confirmedRef.current) {
      const pending = pendingRef.current;
      if (!pending || pending.standing !== standing) {
        pendingRef.current = { standing, since: now };
      } else if (now - pending.since >= CHANGE_CONFIRM_MS || confirmedRef.current == null) {
        const previous = confirmedRef.current;
        confirmedRef.current = standing;
        pendingRef.current = null;

        if (previous != null) {
          if (settings.haptics) {
            if (standing === 'behind') vibrate(VIBRATION.behind);
            else if (standing === 'offroute') vibrate(VIBRATION.offRoute);
            else vibrate(VIBRATION.ahead);
          }
          if (settings.voice && settings.announceChanges) {
            speak(standing === 'offroute' ? 'Du hast die Strecke verlassen.' : spokenGap(gapSeconds));
            lastAnnounceRef.current = now;
          }
        }
      }
    } else {
      pendingRef.current = null;
    }

    // Regelmäßige Ansage
    if (
      settings.voice &&
      settings.announceInterval > 0 &&
      standing !== 'offroute' &&
      now - lastAnnounceRef.current >= settings.announceInterval * 1000
    ) {
      lastAnnounceRef.current = now;
      speak(spokenGap(gapSeconds));
    }
  }, [active, standing, gapSeconds, settings, evalTime]);
}
