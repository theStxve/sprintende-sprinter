/**
 * App-Version, Release Notes (aus CHANGELOG.md, beim Build eingebettet)
 * und Update-Prüfung über GitHub-Releases – für alle ohne Obtainium.
 */
import changelogMd from '../../CHANGELOG.md?raw';
import { compareVersions, notesSince as notesSinceIn, parseChangelog, type ChangelogEntry } from './versions.ts';

export type { ChangelogEntry };

export const APP_VERSION: string = __APP_VERSION__;

const LATEST_RELEASE_API = 'https://api.github.com/repos/theStxve/sprintende-sprinter/releases/latest';

export const CHANGELOG = parseChangelog(changelogMd);

/** Changelog-Abschnitte, die nach `since` dazugekommen sind (bis einschließlich der laufenden Version). */
export const notesSince = (since: string) => notesSinceIn(since, CHANGELOG, APP_VERSION);


export interface AvailableUpdate {
  version: string;
  notes: string;
  /** direkter APK-Link, sonst die Release-Seite */
  downloadUrl: string;
  pageUrl: string;
}

/** Neueste Version auf GitHub; null, wenn die App aktuell ist. */
export async function checkForUpdate(signal?: AbortSignal): Promise<AvailableUpdate | null> {
  const res = await fetch(LATEST_RELEASE_API, { signal, headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`GitHub antwortet mit ${res.status}`);
  const r: { tag_name: string; body?: string; html_url: string; assets?: { name: string; browser_download_url: string }[] } =
    await res.json();
  const version = r.tag_name.replace(/^v/, '');
  if (compareVersions(version, APP_VERSION) <= 0) return null;
  const apk = r.assets?.find((a) => a.name.endsWith('.apk'));
  return { version, notes: r.body ?? '', downloadUrl: apk?.browser_download_url ?? r.html_url, pageUrl: r.html_url };
}
