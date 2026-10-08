import { useEffect, useRef, type RefObject } from 'react';
import { effectiveLevel } from './fx/level';
import { classifySwipe, swipeExcluded, type SwipePoint } from './swipe';

// Karte folgt dem Finger (Lernplattform 3.0 P54, Erlebnis-Engine B11): nach 10 px rastet die Achse ein. Waagerecht folgt die Karte (x, Drehung x/20°,
// höchstens 8°), ab 48 px färbt sich die Seite („Nochmal“ links, Vorschlag rechts); senkrecht bleibt sie stehen und die Seite scrollt (`touch-action: pan-y`
// nur auf der Karte). Entschieden wird wie bisher mit `classifySwipe` (64 px, 700 ms, deutlich waagerecht); wer der Karte folgt, entscheidet zusätzlich
// ab 96 px oder schneller als 0,5 px/ms. Ohne Entscheidung federt die Karte zurück. Stufe „Aus“: keine Bewegung, dieselbe Geste.

/** Ab so vielen px rastet die Achse ein. */
export const AXIS_LOCK_PX = 10;
/** Ab hier färbt sich die Seite. */
export const TINT_PX = 48;
/** Ab hier entscheidet das Loslassen, auch langsam. */
export const RELEASE_PX = 96;
/** px/ms: schneller entscheidet auch kürzer. */
export const RELEASE_V = 0.5;
export const MAX_ROTATE = 8;

export type Axis = 'x' | 'y' | null;

/** Achse nach dem bisherigen Weg (rein). */
export function lockAxis(dx: number, dy: number): Axis {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_LOCK_PX) return null;
  return Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
}

/** Lage der Karte beim Ziehen (rein): Verschiebung, Drehung, Seite der Färbung. */
export function followPose(dx: number): { x: number; rot: number; side: 'left' | 'right' | null } {
  const rot = Math.max(-MAX_ROTATE, Math.min(MAX_ROTATE, dx / 20));
  return { x: dx, rot, side: dx <= -TINT_PX ? 'left' : dx >= TINT_PX ? 'right' : null };
}

/** Entscheidung beim Loslassen (rein): erst die bekannte Geste, sonst beim Folgen Weg oder Tempo. */
export function releaseDecision(a: SwipePoint, b: SwipePoint, axis: Axis): 'left' | 'right' | null {
  const d = classifySwipe(a, b);
  if (d === 'left' || d === 'right') return d;
  if (axis !== 'x') return null;
  const dx = b.x - a.x;
  const v = Math.abs(dx) / Math.max(1, b.t - a.t);
  if (Math.abs(dx) >= RELEASE_PX || (v > RELEASE_V && Math.abs(dx) >= TINT_PX)) return dx < 0 ? 'left' : 'right';
  return null;
}

type Opts = { enabled: boolean; onLeft: () => void; onRight: () => void };

/**
 * Wischen auf der Seite wie bisher (Fenster-Ereignisse, Ausnahmen aus `swipeExcluded`); beginnt die Geste auf der Karte (`ref`), folgt sie dem Finger.
 * Beim Entscheiden steht `data-exit` an der Karte, damit der Kartenstapel sie in Wischrichtung hinausfliegen lässt.
 */
export function useCardSwipe(ref: RefObject<HTMLElement | null>, opts: Opts): void {
  const cb = useRef(opts);
  useEffect(() => {
    cb.current = opts;
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let start: (SwipePoint & { id: number; card: boolean }) | null = null;
    let axis: Axis = null;
    const el = (): HTMLElement | null => ref.current;
    const pose = (dx: number | null): void => {
      const card = el();
      if (!card) return;
      if (dx === null) {
        card.style.transition = 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)';
        card.style.transform = '';
        delete card.dataset.swipe;
        return;
      }
      const p = followPose(dx);
      card.style.transition = 'none';
      card.style.transform = `translateX(${p.x}px) rotate(${p.rot}deg)`;
      if (p.side) card.dataset.swipe = p.side;
      else delete card.dataset.swipe;
      card.style.setProperty('--lx-swipe-p', String(Math.min(1, Math.abs(dx) / RELEASE_PX)));
    };
    const down = (ev: TouchEvent): void => {
      const p = ev.touches.length === 1 ? ev.touches[0] : undefined;
      axis = null;
      if (!p || !cb.current.enabled || document.querySelector('[role="dialog"][aria-modal="true"]') || swipeExcluded(ev.target, p.clientX, window.innerWidth)) {
        start = null;
        return;
      }
      const card = el();
      start = { x: p.clientX, y: p.clientY, t: ev.timeStamp, id: p.identifier, card: !!card && ev.target instanceof Node && card.contains(ev.target) };
    };
    const move = (ev: TouchEvent): void => {
      const s = start;
      if (!s || !s.card || effectiveLevel() === 'off') return;
      const p = Array.from(ev.touches).find((x) => x.identifier === s.id);
      if (!p) return;
      const dx = p.clientX - s.x;
      const dy = p.clientY - s.y;
      if (axis === null) axis = lockAxis(dx, dy);
      if (axis === 'x') pose(dx);
    };
    const up = (ev: TouchEvent): void => {
      const s = start;
      const ax = axis;
      start = null;
      axis = null;
      if (!s) return;
      const p = Array.from(ev.changedTouches).find((x) => x.identifier === s.id);
      const dirn = p && cb.current.enabled ? releaseDecision(s, { x: p.clientX, y: p.clientY, t: ev.timeStamp }, s.card ? ax : null) : null;
      const card = el();
      if (!dirn) {
        if (s.card && ax === 'x') pose(null);
        return;
      }
      if (card && s.card && ax === 'x') card.dataset.exit = dirn;
      if (dirn === 'left') cb.current.onLeft();
      else cb.current.onRight();
      // Blieb die Karte stehen (z. B. Bewertung abgelehnt), federt sie zurück.
      if (card && s.card && ax === 'x')
        setTimeout(() => {
          if (!card.isConnected) return;
          delete card.dataset.exit;
          pose(null);
        }, 400);
    };
    const cancel = (): void => {
      if (start?.card && axis === 'x') pose(null);
      start = null;
      axis = null;
    };
    window.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', up, { passive: true });
    window.addEventListener('touchcancel', cancel, { passive: true });
    return () => {
      window.removeEventListener('touchstart', down);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
      window.removeEventListener('touchcancel', cancel);
    };
  }, [ref]);
}
