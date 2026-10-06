import { animate, useMotionValue } from 'framer-motion';
import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { useMediaQuery } from '../platform/input';

// Blatt nach unten wischen zum Schließen (Kap. 4.5), nur am Handy. Gezogen wird ausschließlich
// am Griff bzw. an der Kopfzeile (`touch-action: none` nur dort) – der Inhalt behält seinen
// Bildlauf (ein `drag` am ganzen Blatt hatte beim Nachschlage-Blatt über `touch-action` das
// Scrollen gesperrt). Knopf, Esc und Tippen daneben bleiben.

/** Ab diesem Weg (px) oder dieser Geschwindigkeit (px/s) nach unten schließt das Blatt. Rein. */
export const DISMISS_PX = 90;
export const DISMISS_VELOCITY = 600;

export function shouldDismiss(offsetY: number, velocityY: number): boolean {
  return offsetY > DISMISS_PX || (offsetY > 24 && velocityY > DISMISS_VELOCITY);
}

export { useMediaQuery };

/**
 * Props für das Blatt (`panel`) und den Griff (`handle`). Außerhalb des Handys (≥ 768 px) ist
 * nichts aktiv: dort ist das Blatt ein Paneel rechts. Das Ziehen folgt dem Finger direkt über
 * einen Bewegungswert (`y`), den auch Öffnen/Schließen des Blatts animieren.
 */
export function useSheetDrag(onClose: () => void, force?: boolean) {
  const narrow = useMediaQuery('(max-width: 767.98px)');
  // `force`: der Aufrufer weiß selbst, dass er als Blatt von unten erscheint (Nachschlagen).
  const mobile = force ?? narrow;
  const y = useMotionValue(0);
  const start = useRef<{ id: number; y0: number; last: number; lt: number; v: number } | null>(null);
  const end = (e: ReactPointerEvent) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    start.current = null;
    const dy = e.clientY - s.y0;
    if (shouldDismiss(dy, s.v)) onClose();
    else void animate(y, 0, { type: 'spring', stiffness: 520, damping: 42 });
  };
  const panel = mobile ? { style: { y } } : {};
  const handle = mobile
    ? {
        onPointerDown: (e: ReactPointerEvent) => {
          // Knöpfe in der Kopfzeile (Schließen) bleiben normale Knöpfe.
          if (e.target instanceof Element && e.target.closest('button, a, input')) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          start.current = { id: e.pointerId, y0: e.clientY, last: e.clientY, lt: e.timeStamp, v: 0 };
        },
        onPointerMove: (e: ReactPointerEvent) => {
          const s = start.current;
          if (!s || s.id !== e.pointerId) return;
          const dt = e.timeStamp - s.lt;
          if (dt > 0) s.v = ((e.clientY - s.last) / dt) * 1000;
          s.last = e.clientY;
          s.lt = e.timeStamp;
          // Nur nach unten, leicht gedämpft; nach oben bleibt das Blatt stehen.
          y.set(Math.max(0, (e.clientY - s.y0) * 0.85));
        },
        onPointerUp: end,
        onPointerCancel: end,
        // Keine Textauswahl am Griff: eine markierte Überschrift würde beim nächsten Ziehen zum Ziehen von Text.
        style: { touchAction: 'none' as const, userSelect: 'none' as const, WebkitUserSelect: 'none' as const },
        'data-sheet-handle': '',
      }
    : {};
  return { mobile, panel, handle };
}

/** Sichtbarer Griff oben am Blatt (nur Handy). */
export function SheetGrip() {
  return <div aria-hidden="true" className="mx-auto mt-2 h-1.5 w-10 flex-none rounded-full bg-line md:hidden" data-testid="sheet-grip" />;
}
