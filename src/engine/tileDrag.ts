// Wann beginnt das Ziehen eines Bausteins? (Lernplattform 2.0 §4.4): erst nach 6 px waagrechter Bewegung ODER
// nach 150 ms Halten. Senkrechte Bewegung gehört dem Seitenscrollen („senkrecht gewinnt“, auch bei Gleichstand).
// Maus und Stift ziehen in jede Richtung ab 6 px (der Vorrat liegt unter der Zeile, also wird nach oben gezogen).

export const DRAG_DISTANCE_PX = 6;
export const DRAG_HOLD_MS = 150;
/** Toleranz für das Zittern des Fingers, wenn schon gehalten wird. */
export const HOLD_JITTER_PX = 2;

export type DragDecision = 'scroll' | 'drag' | 'pending';

export type DragInput = {
  dx: number;
  dy: number;
  heldMs: number;
  /** Standard `touch`. Maus und Stift ziehen in jede Richtung. */
  pointer?: 'touch' | 'mouse';
};

export function decideDrag({ dx, dy, heldMs, pointer = 'touch' }: DragInput): DragDecision {
  const dist = Math.hypot(dx, dy);
  if (pointer === 'mouse') return dist >= DRAG_DISTANCE_PX || (heldMs >= DRAG_HOLD_MS && dist >= HOLD_JITTER_PX) ? 'drag' : 'pending';
  // Wer lange hält und sich dann bewegt, zieht (auch senkrecht).
  if (heldMs >= DRAG_HOLD_MS) return dist >= HOLD_JITTER_PX ? 'drag' : 'pending';
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ay >= DRAG_DISTANCE_PX && ay >= ax) return 'scroll';
  if (ax >= DRAG_DISTANCE_PX) return 'drag';
  return 'pending';
}
