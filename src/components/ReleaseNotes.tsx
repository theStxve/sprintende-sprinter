import type { ReactNode } from 'react';
import { Download, X } from 'lucide-react';
import type { ChangelogEntry } from '../services/appInfo.ts';

/**
 * Kleines Markdown für Release Notes: Überschriften, Listen, **fett**, *kursiv*, `code`, [Links](url).
 * Baut React-Elemente statt HTML – Text aus GitHub wird nie als HTML eingefügt.
 */
export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: ReactNode[] = [];
  const flush = () => {
    if (list.length) blocks.push(<ul key={blocks.length} className="mb-3 list-disc space-y-1 pl-5">{list}</ul>);
    list = [];
  };
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*]\s+(.*)/.exec(line);
    if (bullet) {
      list.push(<li key={i}>{inline(bullet[1])}</li>);
      return;
    }
    flush();
    const h = /^(#{1,6})\s+(.*)/.exec(line);
    if (h) {
      blocks.push(
        <h4 key={i} className="mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted first:mt-0">
          {inline(h[2])}
        </h4>
      );
    } else if (line.trim()) {
      blocks.push(<p key={i} className="mb-3">{inline(line)}</p>);
    }
  });
  flush();
  return <div className="text-sm leading-relaxed text-ink-2">{blocks}</div>;
}

function inline(s: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:[^)\s]+)\)|\*([^*\s][^*]*)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    if (m[1]) out.push(<b key={m.index} className="font-semibold text-ink">{m[1]}</b>);
    else if (m[2]) out.push(<code key={m.index} className="rounded bg-canvas px-1 text-[0.92em]">{m[2]}</code>);
    else if (m[5]) out.push(<i key={m.index}>{m[5]}</i>);
    else out.push(<a key={m.index} href={m[4]} className="font-medium text-gps underline" target="_blank" rel="noreferrer">{m[3]}</a>);
    last = re.lastIndex;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}

interface ReleaseNotesProps {
  title: string;
  entries: ChangelogEntry[];
  onClose: () => void;
  /** Gesetzt, wenn ein Update bereitliegt */
  download?: { url: string; label: string };
}

/** Vollbild-Blatt mit Release Notes, optional mit Download-Knopf. */
export function ReleaseNotes({ title, entries, onClose, download }: ReleaseNotesProps) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-white" style={{ paddingTop: 'var(--safe-top)' }}>
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <h2 className="min-w-0 flex-1 truncate text-lg font-bold tracking-tight text-ink">{title}</h2>
        <button type="button" onClick={onClose} aria-label="Schließen" className="-mr-2 rounded-xl p-2.5 text-ink active:bg-canvas">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {entries.map((e) => (
          <section key={e.version} className="mb-6">
            {entries.length > 1 && (
              <div className="mb-2 flex items-baseline gap-2">
                <span className="text-base font-bold text-ink">Version {e.version}</span>
                {e.date && <span className="text-xs text-muted">{e.date}</span>}
              </div>
            )}
            <Markdown text={e.body} />
          </section>
        ))}
      </div>
      <div className="flex gap-2 border-t border-line px-4 pt-3" style={{ paddingBottom: 'calc(var(--safe-bottom) + 12px)' }}>
        {download ? (
          <>
            <button type="button" onClick={onClose} className="h-12 rounded-xl bg-canvas px-5 text-sm font-semibold text-ink">
              Später
            </button>
            <a
              href={download.url}
              target="_blank"
              rel="noreferrer"
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-pacer text-sm font-semibold text-white"
            >
              <Download className="h-4 w-4" /> {download.label}
            </a>
          </>
        ) : (
          <button type="button" onClick={onClose} className="h-12 flex-1 rounded-xl bg-ink text-sm font-semibold text-white">
            Alles klar
          </button>
        )}
      </div>
    </div>
  );
}
