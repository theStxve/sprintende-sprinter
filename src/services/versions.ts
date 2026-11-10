/** Versionen vergleichen und Changelog lesen – ohne Abhängigkeiten, damit es testbar ist. */

export interface ChangelogEntry {
  version: string;
  date: string;
  /** Markdown ohne die Überschrift */
  body: string;
}

/** Abschnitte „## [1.2.0] - 2026-11-10“ aus einem Changelog. */
export function parseChangelog(md: string): ChangelogEntry[] {
  const out: ChangelogEntry[] = [];
  let cur: ChangelogEntry | null = null;
  for (const line of md.split(/\r?\n/)) {
    const h = /^## \[([^\]]+)\](?:\s*-\s*(\S+))?/.exec(line);
    if (h) {
      cur = { version: h[1], date: h[2] ?? '', body: '' };
      out.push(cur);
    } else if (/^\[[^\]]+\]:\s*http/.test(line)) {
      // Link-Definitionen am Ende gehören zu keinem Abschnitt
      cur = null;
    } else if (cur) {
      cur.body += line + '\n';
    }
  }
  return out.map((e) => ({ ...e, body: e.body.trim() }));
}

/** -1, 0, 1 für semantische Versionen ("v1.2.0" oder "1.2.0") */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const pb = b.replace(/^v/, '').split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0) ? 1 : -1;
  }
  return 0;
}

/** Changelog-Abschnitte, die nach `since` dazugekommen sind (bis einschließlich der laufenden Version). */
export function notesSince(since: string, entries: ChangelogEntry[], current: string): ChangelogEntry[] {
  return entries.filter((e) => compareVersions(e.version, since) > 0 && compareVersions(e.version, current) <= 0);
}

