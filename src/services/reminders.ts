import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { BackgroundRunner } from '@capacitor/background-runner';
import type { Preset } from '../types/route';
import { planReminders } from './presets.ts';

export const RUNNER_LABEL = 'de.sprintende.trains';
const ID_MIN = 100_000;
const ID_MAX = 199_999;
const CHANNEL = 'reminders';

const native = () => Capacitor.isNativePlatform();

let setupDone = false;
async function setup() {
  if (setupDone) return;
  setupDone = true;
  await LocalNotifications.createChannel({
    id: CHANNEL,
    name: 'Erinnerungen und Zugmeldungen',
    description: 'Wann du losgehen musst, Verspätungen und Gleiswechsel',
    importance: 5,
    visibility: 1,
    vibration: true,
  }).catch(() => {});
  await LocalNotifications.registerActionTypes({
    types: [{ id: 'LEAVE', actions: [{ id: 'start', title: 'Los' }] }],
  }).catch(() => {});
}

/** Benachrichtigungen erlauben; liefert true, wenn erlaubt. */
export async function ensureReminderPermission(): Promise<boolean> {
  if (!native()) return false;
  const p = await LocalNotifications.checkPermissions();
  if (p.display === 'granted') return true;
  return (await LocalNotifications.requestPermissions()).display === 'granted';
}

/** Ob Android exakte Zeitpunkte erlaubt (sonst können Erinnerungen ein paar Minuten zu spät kommen). */
export async function exactAlarmsAllowed(): Promise<boolean> {
  if (!native()) return true;
  try {
    return (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === 'granted';
  } catch {
    return true;
  }
}

export async function openExactAlarmSettings() {
  try {
    await LocalNotifications.changeExactNotificationSetting();
  } catch {
    /* ältere Android-Versionen */
  }
}

/**
 * Plant alle Erinnerungen neu und gibt die Wege an den Hintergrund-Check weiter,
 * der Verspätungen, Ausfälle und Gleiswechsel meldet.
 */
export async function syncReminders(presets: Preset[], walkSpeedKmh: number) {
  if (!native()) return;
  try {
    await setup();
    const pending = await LocalNotifications.getPending();
    const ours = pending.notifications.filter((n) => n.id >= ID_MIN && n.id <= ID_MAX);
    if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });

    const perm = await LocalNotifications.checkPermissions();
    const planned = planReminders(presets, Date.now(), walkSpeedKmh);
    if (perm.display === 'granted' && planned.length) {
      // Ohne Erlaubnis für exakte Wecker würde das Plugin bei jedem Planen die Einstellungen öffnen.
      // Dann lieber ungenau planen; der Hinweis im Wege-Formular führt zur Freigabe.
      const exact = await exactAlarmsAllowed();
      await LocalNotifications.schedule({
        notifications: planned.map((r, i) => ({
          isExactNotification: exact,
          id: ID_MIN + i,
          title: r.title,
          body: r.body,
          channelId: CHANNEL,
          smallIcon: 'ic_stat_sprinter',
          iconColor: '#EE4F17',
          actionTypeId: 'LEAVE',
          schedule: { at: new Date(r.at), allowWhileIdle: true },
          extra: { presetId: r.presetId, scheduledMs: r.scheduledMs },
        })),
      });
    }
  } catch (e) {
    console.warn('Erinnerungen konnten nicht geplant werden', e);
  }

  try {
    const watched = presets
      .filter((p) => p.remind?.enabled && p.transit && p.times.length > 0)
      .map((p) => ({ id: p.id, name: p.name, times: p.times, days: p.remind!.days, transit: p.transit }));
    await BackgroundRunner.dispatchEvent({ label: RUNNER_LABEL, event: 'sync', details: { presets: watched } });
  } catch (e) {
    console.warn('Hintergrund-Check nicht verfügbar', e);
  }
}
