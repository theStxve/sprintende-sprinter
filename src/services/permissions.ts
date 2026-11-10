import { Capacitor, registerPlugin } from '@capacitor/core';

interface RunPermissionsPlugin {
  requestNotifications(): Promise<{ granted: boolean }>;
}

const RunPermissions = registerPlugin<RunPermissionsPlugin>('RunPermissions');

/** Benachrichtigungen erlauben (Android 13+), damit GPS bei Bildschirm aus weiterläuft. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    return (await RunPermissions.requestNotifications()).granted;
  } catch {
    return true;
  }
}
