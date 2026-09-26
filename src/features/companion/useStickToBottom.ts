import { useCallback, useEffect, useRef, useState } from 'react';

// Kein Scroll-Springen im Chat (Phase 5 §8.1, Kap. 15 „Chat springt beim Lesen nach unten"):
// - Wer unten ist (≤ 48 px), bleibt beim Wachsen der Antwort unten – sofort, nicht weich.
// - Wer hochgescrollt hat, bleibt stehen; es erscheint die Pille „Neue Antwort ↓".
// - Eigenes Senden ist eine ausdrückliche Handlung und führt nach unten.
// Die Entscheidung trifft die reine Funktion `nextScroll` (unit-getestet).

export const AT_BOTTOM_PX = 48;

export type ScrollMetrics = { scrollTop: number; scrollHeight: number; clientHeight: number };
export type ScrollDecision = { scrollTop: number | null; atBottom: boolean; jump: boolean };

export function isAtBottom(m: ScrollMetrics): boolean {
  return m.scrollHeight - m.scrollTop - m.clientHeight <= AT_BOTTOM_PX;
}

/** Was beim Wachsen des Inhalts (`grow`) bzw. nach eigenem Senden (`send`) zu tun ist. */
export function nextScroll(prev: { atBottom: boolean }, m: ScrollMetrics, reason: 'grow' | 'send'): ScrollDecision {
  const bottom = Math.max(0, m.scrollHeight - m.clientHeight);
  if (reason === 'send' || prev.atBottom) return { scrollTop: bottom, atBottom: true, jump: false };
  return { scrollTop: null, atBottom: false, jump: !isAtBottom(m) };
}

/** Liefert die Refs für Scroll-Container und Inhalt sowie die Pille „Neue Antwort ↓". */
export function useStickToBottom() {
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const [jump, setJump] = useState(false);

  const apply = useCallback((reason: 'grow' | 'send') => {
    const el = scroller.current;
    if (!el) return;
    const d = nextScroll({ atBottom: atBottom.current }, el, reason);
    atBottom.current = d.atBottom;
    if (d.scrollTop !== null) el.scrollTop = d.scrollTop;
    setJump(d.jump);
  }, []);

  useEffect(() => {
    const el = scroller.current;
    const inner = content.current;
    if (!el || !inner) return;
    const onScroll = () => {
      atBottom.current = isAtBottom(el);
      if (atBottom.current) setJump(false);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    // Wächst der Inhalt ODER schrumpft der sichtbare Bereich (Vorschläge, Tastatur), gilt dieselbe Regel.
    const ro = new ResizeObserver(() => apply('grow'));
    ro.observe(inner);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  }, [apply]);

  return { scroller, content, jump, toBottom: () => apply('send') };
}
