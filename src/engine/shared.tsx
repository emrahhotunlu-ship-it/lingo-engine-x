import { animate, useReducedMotion, type Transition } from 'framer-motion';
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { DURATION, EASE_OUT } from '../ui/motion';

// Übergänge mit gemeinsamen Elementen (Kap. 4.4), 150–300 ms, `prefers-reduced-motion` → keine
// Bewegung, nur die schlichte Überblendung der Bildschirme.
//
// 1. Innerhalb eines Bildschirms (Wortzeile → Titel des Wortblatts), beide Elemente gleichzeitig
//    eingehängt: framer-motion `layoutId` (Kennung mit Epoche je Einhängen des Bildschirms, fester
//    `layoutDependency` an der Quelle, damit gewöhnliche Neuzeichnungen nichts animieren).
// 2. Zwischen Bildschirmen (Heldenkarte → erste Übung, Kurszeile → Kopf der Lektion): Der alte
//    Bildschirm blendet erst aus (`AnimatePresence mode="wait"`), dann erscheint der neue. Mit
//    `layoutId` verlor framer dabei gelegentlich die Messung der Quelle (gemessen: etwa jeder
//    zehnte Wechsel ohne Flug). Deshalb misst sich die Quelle beim Tippen selbst (`armShared`), und
//    das Ziel fliegt beim Einhängen mit framer `animate` von dort an seinen Platz (FLIP, in
//    Dokument-Koordinaten, damit das Zurücksetzen des Bildlaufs nichts verschiebt). Einmal je
//    Tippen und nur kurz gültig – ein Ziel fliegt nie von einer alten Stelle heran.

export const SHARED_TRANSITION: Transition = { layout: { duration: DURATION.base + 0.03, ease: EASE_OUT } };
export const FLIGHT_S = DURATION.base + 0.03;
/** So lange (Wanduhr) wartet eine scharf geschaltete Quelle auf ihr Ziel. */
export const ARM_MS = 2000;

// ---------------------------------------------------------------- 1. layoutId (gleicher Bildschirm)

let epoch = 0;

/** Epoche eines Bildschirms (einmal je Einhängen): Kennungen alter Besuche passen nie. */
export function useSharedEpoch(): number {
  const [ep] = useState(() => ++epoch);
  return ep;
}

export const sharedId = (base: string, ep: number): string => `${base}@${ep}`;

/** Quelle: fester `layoutDependency` – nur der gemeinsame Flug animiert, keine Neuzeichnung. */
export const SOURCE_DEPENDENCY = 0;

// ---------------------------------------------------------------- 2. Flug zwischen Bildschirmen

export type SharedRect = { x: number; y: number; w: number; h: number };
type Armed = SharedRect & { id: string; at: number };

let armed: Armed | null = null;

const docRect = (el: Element): SharedRect => {
  const r = el.getBoundingClientRect();
  return { x: r.left + window.scrollX, y: r.top + window.scrollY, w: r.width, h: r.height };
};

/** Beim Tippen auf die Quelle: ihre Lage merken, damit das Ziel von dort heranfliegt. */
export function armShared(id: string, el: Element | null | undefined): void {
  if (!el || typeof window === 'undefined') return;
  const r = docRect(el);
  armed = r.w > 0 && r.h > 0 ? { ...r, id, at: Date.now() } : null;
}

/** Lage der Quelle für ein Ziel abholen (einmal, nur passend und frisch); sonst `null`. */
export function takeShared(id: string, now = Date.now()): SharedRect | null {
  const a = armed;
  if (!a || a.id !== id) return null;
  armed = null;
  return now - a.at <= ARM_MS ? { x: a.x, y: a.y, w: a.w, h: a.h } : null;
}

/** Transform, der das Ziel (`to`) genau auf die Quelle (`from`) legt – Ursprung oben links. Rein. */
export function flipFrom(from: SharedRect, to: SharedRect): { x: number; y: number; scaleX: number; scaleY: number } | null {
  if (!(to.w > 0 && to.h > 0 && from.w > 0 && from.h > 0)) return null;
  return { x: from.x - to.x, y: from.y - to.y, scaleX: from.w / to.w, scaleY: from.h / to.h };
}

/**
 * Ziel: `ref` an das Element hängen. Beim Einhängen fliegt es von der eben getippten Quelle an
 * seinen Platz (≈ 250 ms), sonst passiert nichts. `shared` bleibt für Tests und Diagnose stehen.
 */
export function useSharedTarget<T extends HTMLElement>(id: string): { ref: RefObject<T | null>; shared: boolean } {
  const reduce = useReducedMotion();
  const [from] = useState(() => (reduce ? null : takeShared(id)));
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!from || !el) return;
    const d = flipFrom(from, docRect(el));
    if (!d) return;
    el.style.transformOrigin = '0 0';
    const controls = animate(el, { x: [d.x, 0], y: [d.y, 0], scaleX: [d.scaleX, 1], scaleY: [d.scaleY, 1] }, { duration: FLIGHT_S, ease: EASE_OUT });
    return () => controls.stop();
  }, [from]);
  return { ref, shared: !!from };
}

/** Nur für Tests. */
export function resetShared(): void {
  armed = null;
}
