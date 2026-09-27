import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

// Gemeinsame Scroll-Regel aller Gespräche (Rollenspiel Phase 3, Begleiter Phase 5; Kap. 15
// „Chat springt beim Lesen nach unten" darf nicht wiederkommen):
// - Wer unten ist (≤ 48 px), bleibt beim Wachsen der Antwort unten – sofort, nicht weich.
// - Wer hochgescrollt hat, bleibt stehen; es erscheint die Pille „Neue Antwort ↓".
// - Eigenes Senden ist eine ausdrückliche Handlung und führt nach unten.
// Die Entscheidung trifft die reine Funktion `nextScroll` (unit-getestet). Zwei Hüllen: im
// eigenen Scroll-Bereich (Begleiter) und auf der Seite selbst (Rollenspiel).

export const AT_BOTTOM_PX = 48;

export type ScrollMetrics = { scrollTop: number; scrollHeight: number; clientHeight: number };
export type ScrollDecision = { scrollTop: number | null; atBottom: boolean; jump: boolean };

export function isAtBottom(m: ScrollMetrics): boolean {
  return m.scrollHeight - m.scrollTop - m.clientHeight <= AT_BOTTOM_PX;
}

/**
 * Bleibt man nach einem Scroll-Ereignis „unten"? Ein Ereignis kann verspätet eintreffen, nachdem
 * der Inhalt schon weiter gewachsen ist (eigenes Senden, neue Nachricht). Solange die Position
 * nicht über der zuletzt von der App gesetzten (`pinnedTop`) liegt, hat niemand hochgescrollt –
 * dann bleibt es beim bisherigen Zustand. Nur echtes Hochscrollen löst „unten" auf.
 */
export function afterScroll(prevAtBottom: boolean, m: ScrollMetrics, pinnedTop: number | null): boolean {
  if (isAtBottom(m)) return true;
  if (pinnedTop !== null && m.scrollTop >= pinnedTop - 1) return prevAtBottom;
  return false;
}

/** Was beim Wachsen des Inhalts (`grow`) bzw. nach eigenem Senden (`send`) zu tun ist. */
export function nextScroll(prev: { atBottom: boolean }, m: ScrollMetrics, reason: 'grow' | 'send'): ScrollDecision {
  const bottom = Math.max(0, m.scrollHeight - m.clientHeight);
  if (reason === 'send' || prev.atBottom) return { scrollTop: bottom, atBottom: true, jump: false };
  return { scrollTop: null, atBottom: false, jump: !isAtBottom(m) };
}

/** Eigener Scroll-Bereich: Refs für Bereich und Inhalt sowie die Pille „Neue Antwort ↓". */
export function useStickToBottom() {
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const pinned = useRef<number | null>(null);
  const [jump, setJump] = useState(false);

  const apply = useCallback((reason: 'grow' | 'send') => {
    const el = scroller.current;
    if (!el) return;
    const d = nextScroll({ atBottom: atBottom.current }, el, reason);
    atBottom.current = d.atBottom;
    if (d.scrollTop !== null) {
      el.scrollTop = d.scrollTop;
      pinned.current = el.scrollTop;
    }
    setJump(d.jump);
  }, []);

  useEffect(() => {
    const el = scroller.current;
    const inner = content.current;
    if (!el || !inner) return;
    const onScroll = () => {
      atBottom.current = afterScroll(atBottom.current, el, pinned.current);
      if (!atBottom.current) pinned.current = null;
      if (isAtBottom(el)) setJump(false);
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

  const toBottom = useCallback(() => apply('send'), [apply]);
  return { scroller, content, jump, toBottom };
}

const pageMetrics = (): ScrollMetrics => ({ scrollTop: window.scrollY, scrollHeight: document.documentElement.scrollHeight, clientHeight: window.innerHeight });

/**
 * Gespräch auf der Seite selbst (Rollenspiel): `growKey` ändert sich mit jedem neuen Zug bzw.
 * einlaufendem Text. Liefert die Pille und „nach unten" (eigenes Senden, Klick auf die Pille).
 */
export function usePageStickToBottom(growKey: unknown) {
  const atBottom = useRef(true);
  const [jump, setJump] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      atBottom.current = isAtBottom(pageMetrics());
      if (atBottom.current) setJump(false);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useLayoutEffect(() => {
    const d = nextScroll({ atBottom: atBottom.current }, pageMetrics(), 'grow');
    atBottom.current = d.atBottom;
    if (d.scrollTop !== null) window.scrollTo({ top: d.scrollTop });
    setJump(d.jump);
  }, [growKey]);

  const toBottom = useCallback(() => {
    atBottom.current = true;
    setJump(false);
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  }, []);

  return { jump, toBottom };
}
