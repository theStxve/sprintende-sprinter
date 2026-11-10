import { Capacitor, registerPlugin } from '@capacitor/core';

interface AppLauncherPlugin {
  openObtainium(options: { repo: string }): Promise<{ opened: boolean }>;
}

const AppLauncher = registerPlugin<AppLauncherPlugin>('AppLauncher');

/** Obtainium öffnen. false, wenn es nicht installiert ist (oder im Browser). */
export async function openObtainium(repo: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    return (await AppLauncher.openObtainium({ repo })).opened;
  } catch {
    return false;
  }
}
