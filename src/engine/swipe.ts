import { useEffect, useRef } from 'react';

// Wischgesten (Kap. 4.5 „wo sinnvoll“, sparsam): nur Finger (Touch), nie die Maus. Erkannt wird
// erst beim Loslassen – der Bildlauf (senkrecht) bleibt unberührt, es gibt kein preventDefault
// und kein `touch-action` auf dem Inhalt. Ausgenommen sind Gesten, die in der Lücke, in
// Bausteinen, in Eingabefeldern, in waagerecht scrollbaren Bereichen, in Dialogen oder am
// Bildschirmrand (Zurück-Geste von iOS) beginnen. Knopf und Tastatur bleiben der Hauptweg.

export type SwipePoint = { x: number; y: number; t: number };

/** Mindestweg in px, höchstens Dauer in ms; die Geste muss deutlich waagerecht sein. */
export const SWIPE_MIN_PX = 64;
export const SWIPE_MAX_MS = 700;
export const SWIPE_EDGE_PX = 24;

/** Richtung einer Wischgeste oder `null` (zu kurz, zu langsam, zu schräg). Rein. */
export function classifySwipe(a: SwipePoint, b: SwipePoint): 'left' | 'right' | 'down' | 'up' | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dt = b.t - a.t;
  if (dt < 0 || dt > SWIPE_MAX_MS) return null;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (Math.max(ax, ay) < SWIPE_MIN_PX) return null;
  if (ax >= ay * 1.8) return dx < 0 ? 'left' : 'right';
  if (ay >= ax * 1.8) return dy < 0 ? 'up' : 'down';
  return null;
}

const EXCLUDE = 'input, textarea, select, [contenteditable="true"], [data-no-swipe], .lx-gap, [data-testid="gap-input"], [role="dialog"], [data-tiles]';

/** Beginnt die Geste an einer Stelle, an der sie nicht gelten darf? */
export function swipeExcluded(target: EventTarget | null, x: number, width: number): boolean {
  if (x < SWIPE_EDGE_PX || x > width - SWIPE_EDGE_PX) return true;
  if (typeof Element === 'undefined' || !(target instanceof Element)) return false;
  if (target.closest(EXCLUDE)) return true;
  // Waagerecht scrollbarer Bereich (Chips, Tabellen): dort gehört die Geste dem Bildlauf.
  for (let el: Element | null = target; el && el !== document.body; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 1) {
      const ox = getComputedStyle(el).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
  }
  return false;
}

/**
 * Nach links wischen irgendwo auf der Seite (außer den Ausnahmen) ruft `onSwipe` auf, solange
 * `enabled` gilt und kein Dialog offen ist. Touch-Ereignisse statt Pointer-Ereignissen: Beginnt
 * der Browser zu scrollen, bricht er Pointer-Gesten ab (`pointercancel`), `touchend` kommt immer.
 */
export function useSwipeLeft(onSwipe: () => void, enabled: boolean): void {
  const cb = useRef(onSwipe);
  useEffect(() => {
    cb.current = onSwipe;
  });
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    let start: (SwipePoint & { id: number }) | null = null;
    const down = (e: TouchEvent) => {
      const p = e.touches.length === 1 ? e.touches[0] : undefined;
      if (!p || document.querySelector('[role="dialog"][aria-modal="true"]') || swipeExcluded(e.target, p.clientX, window.innerWidth)) {
        start = null;
        return;
      }
      start = { x: p.clientX, y: p.clientY, t: e.timeStamp, id: p.identifier };
    };
    const up = (e: TouchEvent) => {
      const s = start;
      start = null;
      if (!s) return;
      const p = Array.from(e.changedTouches).find((x) => x.identifier === s.id);
      if (p && classifySwipe(s, { x: p.clientX, y: p.clientY, t: e.timeStamp }) === 'left') cb.current();
    };
    const cancel = () => {
      start = null;
    };
    window.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('touchend', up, { passive: true });
    window.addEventListener('touchcancel', cancel, { passive: true });
    return () => {
      window.removeEventListener('touchstart', down);
      window.removeEventListener('touchend', up);
      window.removeEventListener('touchcancel', cancel);
    };
  }, [enabled]);
}
