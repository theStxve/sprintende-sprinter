import { Capacitor } from '@capacitor/core';
import { QueueStrategy, TextToSpeech } from '@capacitor-community/text-to-speech';
import { Haptics } from '@capacitor/haptics';
import { KeepAwake } from '@capacitor-community/keep-awake';

const native = Capacitor.isNativePlatform();

export async function speak(text: string) {
  try {
    if (native) {
      await TextToSpeech.speak({ text, lang: 'de-DE', rate: 1.0, volume: 1.0, queueStrategy: QueueStrategy.Add });
    } else if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'de-DE';
      window.speechSynthesis.speak(u);
    }
  } catch (err) {
    console.warn('Sprachausgabe nicht verfügbar', err);
  }
}

/** Muster: Liste von Vibrationsdauern in ms (mit Pausen dazwischen). */
export async function vibrate(pattern: number[]) {
  try {
    if (native) {
      for (let i = 0; i < pattern.length; i++) {
        await Haptics.vibrate({ duration: pattern[i] });
        if (i < pattern.length - 1) await new Promise((r) => setTimeout(r, pattern[i] + 120));
      }
    } else if ('vibrate' in navigator) {
      navigator.vibrate(pattern.flatMap((d, i) => (i < pattern.length - 1 ? [d, 120] : [d])));
    }
  } catch {
    /* ignorieren */
  }
}

export const VIBRATION = {
  behind: [400, 400],
  ahead: [120],
  offRoute: [600, 600, 600],
  finish: [200, 200, 200],
};

let wakeLock: { release(): Promise<void> } | null = null;

export async function setKeepAwake(on: boolean) {
  try {
    if (native) {
      if (on) await KeepAwake.keepAwake();
      else await KeepAwake.allowSleep();
      return;
    }
    const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } };
    if (on && nav.wakeLock && !wakeLock) wakeLock = await nav.wakeLock.request('screen');
    if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    /* ignorieren */
  }
}

/* ---------- Gesprochene Texte ---------- */

export function spokenSeconds(totalSeconds: number): string {
  const s = Math.round(Math.abs(totalSeconds));
  if (s < 60) return s === 1 ? 'eine Sekunde' : `${s} Sekunden`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  const min = m === 1 ? 'eine Minute' : `${m} Minuten`;
  return rest === 0 ? min : `${min} ${rest}`;
}

export function spokenPace(paceMinPerKm: number): string {
  if (!isFinite(paceMinPerKm) || paceMinPerKm <= 0) return '';
  const total = Math.round(paceMinPerKm * 60);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s === 0 ? `${m} Minuten pro Kilometer` : `${m} Minuten ${s} pro Kilometer`;
}

export function spokenGap(gapSeconds: number): string {
  if (Math.abs(gapSeconds) < 3) return 'Genau im Plan.';
  return gapSeconds > 0
    ? `${spokenSeconds(gapSeconds)} vor dem Pacer.`
    : `${spokenSeconds(gapSeconds)} hinter dem Pacer.`;
}
