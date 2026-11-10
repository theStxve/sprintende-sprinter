import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/**
 * Hält Inhalt nach dem Ausblenden noch kurz sichtbar, damit er auslaufen kann statt zu verschwinden.
 * Einblenden: Animationsklasse greift beim Einhängen. Ausblenden: `data-leaving` schaltet auf die
 * Auslauf-Animation derselben Klasse (siehe index.css).
 *
 * Der Inhalt wird beim Ausblenden eingefroren, damit er nicht mit leeren Daten neu rendert.
 */
export function Presence({
  show,
  children,
  className = '',
  style,
  exitMs = 240,
}: {
  show: boolean;
  children: ReactNode;
  /** z. B. "absolute inset-0 z-40 anim-screen" */
  className?: string;
  style?: CSSProperties;
  exitMs?: number;
}) {
  const [mounted, setMounted] = useState(show);
  const [leaving, setLeaving] = useState(false);
  const lastChildren = useRef<ReactNode>(children);
  if (show) lastChildren.current = children;

  useEffect(() => {
    if (show) {
      setMounted(true);
      setLeaving(false);
      return;
    }
    if (!mounted) return;
    setLeaving(true);
    const t = window.setTimeout(() => {
      setMounted(false);
      setLeaving(false);
    }, exitMs);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur auf show reagieren
  }, [show]);

  if (!mounted && !show) return null;
  return (
    <div className={className} style={style} data-leaving={leaving || undefined}>
      {show ? children : lastChildren.current}
    </div>
  );
}
