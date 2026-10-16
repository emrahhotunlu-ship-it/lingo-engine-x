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

/** Abstand zwischen Oberkante des Fensters und der eigenen Frage nach dem Senden (Lesemodus). */
export const READ_MARGIN_PX = 8;

export type ScrollMode = 'follow' | 'read';

/**
 * Was beim Wachsen des Inhalts (`grow`) bzw. nach eigenem Senden (`send`) zu tun ist.
 * - `follow` (Standard, Rollenspiel): siehe oben.
 * - `read` (Begleiter-Chat): Nach dem Senden steht die eigene Frage oben im Fenster (`anchorTop` = ihre
 *   Oberkante im Scroll-Inhalt), danach wird beim Einlaufen NIE weiter gescrollt; nur die Pille zeigt,
 *   dass unten noch etwas ist.
 */
export function nextScroll(
  prev: { atBottom: boolean },
  m: ScrollMetrics,
  reason: 'grow' | 'send',
  opts: { mode?: ScrollMode; anchorTop?: number } = {},
): ScrollDecision {
  const bottom = Math.max(0, m.scrollHeight - m.clientHeight);
  if (opts.mode === 'read') {
    if (reason === 'send') {
      const top = opts.anchorTop === undefined ? bottom : Math.min(Math.max(0, Math.round(opts.anchorTop - READ_MARGIN_PX)), bottom);
      const at = isAtBottom({ ...m, scrollTop: top });
      return { scrollTop: top, atBottom: at, jump: !at };
    }
    const at = isAtBottom(m);
    return { scrollTop: null, atBottom: at, jump: !at };
  }
  if (reason === 'send' || prev.atBottom) return { scrollTop: bottom, atBottom: true, jump: false };
  return { scrollTop: null, atBottom: false, jump: !isAtBottom(m) };
}

/**
 * Leerer Platz unter dem Inhalt, damit die eigene Frage ganz nach oben rücken kann, obwohl die
 * Antwort noch kurz ist. Er schrumpft in dem Maß, wie die Antwort wächst (der Inhalt springt nicht).
 * `anchorTop` und `contentBottom` im Scroll-Inhalt, `clientHeight` = Höhe des sichtbaren Bereichs.
 */
export function readingSpacer(anchorTop: number, contentBottom: number, clientHeight: number): number {
  return Math.max(0, Math.round(clientHeight + (anchorTop - READ_MARGIN_PX) - contentBottom));
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

/**
 * Lesemodus für den Begleiter-Chat (Rückmeldung: „Ich will oben mitlesen“; Kap. 15 „Chat springt beim
 * Lesen nach unten“): Bis zum ersten eigenen Senden gilt die gewohnte Regel (Verlauf lädt, Ansicht
 * unten). `anchorSend()` rückt danach die eigene Frage (`anchorSelector`, letzte im Inhalt) an den
 * oberen Rand; beim Einlaufen der Antwort scrollt nichts mehr von selbst. Die Pille erscheint nur,
 * wenn echter Inhalt unter dem sichtbaren Bereich liegt (der leere Platz zählt nicht).
 */
export function useReadingScroll(anchorSelector: string) {
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const spacer = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const anchor = useRef<HTMLElement | null>(null);
  const atBottom = useRef(true);
  const pinned = useRef<number | null>(null);
  const [jump, setJump] = useState(false);

  /** Maße ohne den leeren Platz: so weit reicht der echte Inhalt. */
  const real = useCallback((): ScrollMetrics | null => {
    const el = scroller.current;
    const inner = content.current;
    if (!el || !inner) return null;
    const contentBottom = inner.getBoundingClientRect().bottom - el.getBoundingClientRect().top + el.scrollTop;
    return { scrollTop: el.scrollTop, clientHeight: el.clientHeight, scrollHeight: Math.round(contentBottom) };
  }, []);

  const anchorTop = useCallback((): number | null => {
    const el = scroller.current;
    const a = anchor.current;
    if (!el || !a || !a.isConnected) return null;
    return a.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
  }, []);

  const fit = useCallback(() => {
    const sp = spacer.current;
    const m = real();
    const top = anchorTop();
    if (!sp || !m) return;
    sp.style.height = top === null ? '0px' : `${readingSpacer(top, m.scrollHeight, m.clientHeight)}px`;
  }, [real, anchorTop]);

  const onGrow = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    if (following.current) {
      const d = nextScroll({ atBottom: atBottom.current }, el, 'grow');
      atBottom.current = d.atBottom;
      if (d.scrollTop !== null) {
        el.scrollTop = d.scrollTop;
        pinned.current = el.scrollTop;
      }
      setJump(d.jump);
      return;
    }
    fit();
    const m = real();
    if (m) setJump(!isAtBottom(m));
  }, [fit, real]);

  /** Eigene Frage nach oben rücken (einmal je Senden). */
  const anchorSend = useCallback(() => {
    const el = scroller.current;
    const inner = content.current;
    if (!el || !inner) return;
    const all = inner.querySelectorAll<HTMLElement>(anchorSelector);
    const last = all.item(all.length - 1) as HTMLElement | null;
    if (!last) return;
    following.current = false;
    anchor.current = last;
    fit();
    const top = anchorTop();
    const d = nextScroll({ atBottom: false }, el, 'send', top === null ? { mode: 'read' } : { mode: 'read', anchorTop: top });
    if (d.scrollTop !== null) el.scrollTop = d.scrollTop;
    const m = real();
    setJump(m ? !isAtBottom(m) : false);
  }, [anchorSelector, fit, anchorTop, real]);

  /** Pille: bewusst ans Ende des echten Inhalts. */
  const toBottom = useCallback(() => {
    const el = scroller.current;
    const m = real();
    if (!el || !m) return;
    el.scrollTop = Math.max(0, m.scrollHeight - m.clientHeight);
    atBottom.current = true;
    setJump(false);
  }, [real]);

  useEffect(() => {
    const el = scroller.current;
    const inner = content.current;
    if (!el || !inner) return;
    const onScroll = () => {
      if (following.current) {
        atBottom.current = afterScroll(atBottom.current, el, pinned.current);
        if (!atBottom.current) pinned.current = null;
        if (isAtBottom(el)) setJump(false);
        return;
      }
      const m = real();
      if (m) setJump(!isAtBottom(m));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    const ro = new ResizeObserver(onGrow);
    ro.observe(inner);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  }, [onGrow, real]);

  return { scroller, content, spacer, jump, toBottom, anchorSend };
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

/** Luft zwischen einem fest unten sitzenden Eingabebereich und dem Element, das per `focus()`/`scrollIntoView()` ins Bild kommt. */
export const SCROLL_GAP_PX = 16;

/** `scroll-padding-bottom` der Seite: Höhe des Eingabebereichs (sein Innenabstand enthält schon die safe-area) plus Tastatur plus Luft. Rein. */
export function scrollPaddingFor(boxHeight: number, keyboardInset: number): number {
  return Math.max(0, Math.round(boxHeight + keyboardInset + SCROLL_GAP_PX));
}

/**
 * Fest unten sitzender Eingabebereich über einem Gespräch auf der Seite (Rollenspiel am Handy): setzt `scroll-padding-bottom` der Seite, damit
 * `focus()` und `scrollIntoView()` (z. B. das Feld „Sag’s nochmal“) über dem Bereich landen statt darunter. Greift nur, solange der Bereich wirklich
 * `position: fixed` ist (Laptop: statisch, nichts zu tun). Wächst oder schrumpft der Bereich, zieht der Wert mit; `shape` (z. B. eingeklappt) misst
 * zusätzlich sofort im selben Durchgang neu, damit ein direkt folgendes `scrollIntoView()` schon den neuen Wert sieht.
 */
export function usePageScrollPadding(box: { readonly current: HTMLElement | null }, keyboardInset: number, shape?: unknown) {
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const root = document.documentElement;
    const update = () => {
      const fixed = getComputedStyle(el).position === 'fixed';
      root.style.scrollPaddingBottom = fixed ? `${scrollPaddingFor(el.getBoundingClientRect().height, keyboardInset)}px` : '';
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.scrollPaddingBottom = '';
    };
  }, [box, keyboardInset, shape]);
}
