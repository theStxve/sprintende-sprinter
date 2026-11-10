import { useCallback, useRef, useState } from 'react';

/**
 * Bewegung des Bedienfelds unten:
 *  - Höhe ändert sich (Auf-/Zuklappen, anderer Reiter, neuer Inhalt) → das Blatt gleitet weich
 *    an die neue Position statt zu springen (FLIP: alte Position vortäuschen, dann zurückgleiten).
 *  - Wischen auf dem Blatt → das Blatt folgt dem Finger; beim Loslassen klappt es je nach Weg und
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
  const gesture = useRef<{ x0: number; y0: number; scrollEl: HTMLElement | null; dragging: boolean } | null>(null);
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
    // Solange das Blatt gezogen wird, darf der Inhalt nicht nativ mitscrollen (React-Listener sind passiv)
    el.addEventListener(
      'touchmove',
      (e) => {
        if (gesture.current?.dragging && e.cancelable) e.preventDefault();
      },
      { passive: false }
    );
  }, []);

  /**
   * Geste auf dem ganzen Blatt. Erst nach ein paar Pixeln fällt die Entscheidung, ob gezogen wird:
   *  - seitlich → nichts (Schieberegler, Wischen in Listen)
   *  - zugeklappt → ziehen
   *  - aufgeklappt, außerhalb des Inhalts (Griff, Reiter) → ziehen
   *  - aufgeklappt im Inhalt → nur nach unten und nur, wenn der Inhalt ganz oben steht; sonst scrollt er
   */
  /** Nach einem Wisch den Tipp auf den Knopf darunter verschlucken */
  const swallowClick = useRef(false);

  /**
   * Der Wisch zum Aufklappen kann im Inhalt einen Scroll-Schwung auslösen, der nach dem Aufklappen
   * weiterläuft. Kurz nicht scrollbar machen stoppt ihn; danach steht der Inhalt oben.
   */
  const stopMomentum = (el: HTMLElement) => {
    const sc = el.querySelector<HTMLElement>('.sheet-scroll');
    if (!sc) return;
    sc.style.overflowY = 'hidden';
    sc.scrollTop = 0;
    window.setTimeout(() => {
      sc.scrollTop = 0;
      sc.style.overflowY = '';
    }, 450);
  };

  const startDrag = (el: HTMLElement, y: number) => {
    const off = currentOffset(el);
    drag.current = { y0: y - off, t0: performance.now(), dy: off };
    el.style.transition = 'none';
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    // Eingaben behalten ihre eigenen Gesten
    if (target.closest('input, textarea, select, [data-no-sheet-drag]')) {
      gesture.current = null;
      return;
    }
    const t = e.touches[0];
    gesture.current = { x0: t.clientX, y0: t.clientY, scrollEl: target.closest('.sheet-scroll'), dragging: false };
  };

  const onTouchMove = (e: React.TouchEvent) => {
    const el = elRef.current;
    const g = gesture.current;
    if (!el || !g) return;
    const t = e.touches[0];
    if (!g.dragging) {
      const dx = t.clientX - g.x0;
      const dy = t.clientY - g.y0;
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      const vertical = Math.abs(dy) > Math.abs(dx);
      const canDrag =
        vertical && (!expanded || !g.scrollEl || (dy > 0 && g.scrollEl.scrollTop <= 0));
      if (!canDrag) {
        gesture.current = null;
        return;
      }
      g.dragging = true;
      // Ab hier ohne Sprung: der Finger „greift“ das Blatt an der aktuellen Stelle
      startDrag(el, t.clientY);
    }
    const d = drag.current;
    if (!d) return;
    let dy = t.clientY - d.y0;
    // In die „falsche“ Richtung nur mit Widerstand
    if (expanded && dy < 0) dy = -Math.sqrt(-dy) * 3;
    if (!expanded && dy > 0) dy = Math.sqrt(dy) * 3;
    d.dy = dy;
    el.style.transform = `translateY(${dy}px)`;
  };

  const onTouchEnd = () => {
    const el = elRef.current;
    const d = drag.current;
    const wasDragging = gesture.current?.dragging ?? false;
    gesture.current = null;
    drag.current = null;
    if (!el || !d || !wasDragging) return;
    swallowClick.current = true;
    window.setTimeout(() => (swallowClick.current = false), 400);
    const velocity = d.dy / Math.max(1, performance.now() - d.t0); // px/ms
    const collapse = expanded && (d.dy > 70 || (d.dy > 12 && velocity > 0.45));
    const expand = !expanded && (d.dy < -40 || (d.dy < -8 && velocity < -0.35));
    if (collapse || expand) {
      if (expand) stopMomentum(el);
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

  const onClickCapture = (e: React.MouseEvent) => {
    if (!swallowClick.current) return;
    swallowClick.current = false;
    e.stopPropagation();
    e.preventDefault();
  };
  /** Auf das ganze Blatt legen; der scrollbare Inhalt bekommt die Klasse `sheet-scroll` */
  return { ref, height, gestureHandlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd, onClickCapture } };
}
