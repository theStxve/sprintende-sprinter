import { useCallback, useRef, useState } from 'react';

/**
 * Bewegung des Bedienfelds unten:
 *  - Höhe ändert sich (Auf-/Zuklappen, anderer Reiter, neuer Inhalt) → das Blatt gleitet weich
 *    an die neue Position statt zu springen (FLIP: alte Position vortäuschen, dann zurückgleiten).
 *  - Wischen am Griff → das Blatt folgt dem Finger; beim Loslassen klappt es je nach Weg und
 *    Tempo auf/zu oder federt zurück.
 *
 * Das Blatt ist unten verankert, eine Höhenänderung verschiebt also nur die Oberkante.
 * Damit beim Hochschieben unten nichts durchblitzt, hat es per CSS (.sheet::after) eine weiße Verlängerung.
 */
export function useSheetMotion(expanded: boolean, setExpanded: (v: boolean) => void) {
  const [height, setHeight] = useState(320);
  const elRef = useRef<HTMLDivElement | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const prevH = useRef<number | null>(null);
  const drag = useRef<{ y0: number; t0: number; dy: number } | null>(null);
  /** Nach dem Loslassen: wartet auf die neue Höhe, der Finger-Versatz bleibt bis dahin stehen */
  const awaiting = useRef(false);

  const currentOffset = (el: HTMLElement) => {
    const t = getComputedStyle(el).transform;
    return t && t !== 'none' ? new DOMMatrixReadOnly(t).m42 : 0;
  };

  const glideFrom = (el: HTMLElement, offset: number) => {
    el.style.transition = 'none';
    el.style.transform = `translateY(${offset}px)`;
    void el.offsetHeight; // Startposition festschreiben
    el.style.transition = 'transform var(--dur-slow) var(--ease-out)';
    el.style.transform = '';
  };

  const ref = useCallback((el: HTMLDivElement | null) => {
    roRef.current?.disconnect();
    elRef.current = el;
    prevH.current = null;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const h = el.getBoundingClientRect().height;
      setHeight(h);
      const prev = prevH.current;
      prevH.current = h;
      if (prev == null || drag.current) return;
      // Sichtbare Oberkante beibehalten: bisheriger Versatz (laufende Animation oder Finger) + Höhenunterschied
      awaiting.current = false;
      const offset = currentOffset(el) + (h - prev);
      if (Math.abs(offset) > 1) glideFrom(el, offset);
    });
    ro.observe(el);
    roRef.current = ro;
  }, []);

  const onTouchStart = (e: React.TouchEvent) => {
    const el = elRef.current;
    if (!el) return;
    drag.current = { y0: e.touches[0].clientY - currentOffset(el), t0: performance.now(), dy: currentOffset(el) };
    el.style.transition = 'none';
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const el = elRef.current;
    const d = drag.current;
    if (!el || !d) return;
    let dy = e.touches[0].clientY - d.y0;
    // In die „falsche“ Richtung nur mit Widerstand
    if (expanded && dy < 0) dy = -Math.sqrt(-dy) * 3;
    if (!expanded && dy > 0) dy = Math.sqrt(dy) * 3;
    d.dy = dy;
    el.style.transform = `translateY(${dy}px)`;
  };

  const onTouchEnd = () => {
    const el = elRef.current;
    const d = drag.current;
    drag.current = null;
    if (!el || !d) return;
    const velocity = d.dy / Math.max(1, performance.now() - d.t0); // px/ms
    const collapse = expanded && (d.dy > 70 || (d.dy > 12 && velocity > 0.45));
    const expand = !expanded && (d.dy < -40 || (d.dy < -8 && velocity < -0.35));
    if (collapse || expand) {
      // Versatz stehen lassen: die Höhenänderung gleitet von genau hier aus weiter
      awaiting.current = true;
      setExpanded(!expanded);
      // Falls sich die Höhe doch nicht ändert: trotzdem zurückgleiten
      window.setTimeout(() => {
        const cur = elRef.current;
        if (awaiting.current && cur) {
          awaiting.current = false;
          glideFrom(cur, currentOffset(cur));
        }
      }, 120);
    } else if (Math.abs(d.dy) > 0.5) {
      glideFrom(el, d.dy);
    }
  };

  return { ref, height, dragHandlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd } };
}
