import { create } from 'zustand';
import type { Token } from '../domain/text/types';

// Wort-Antippen (Plan §5.6): Anfrage eines angetippten Worts und der offene Zustand des
// Nachschlage-Fensters. Die Zeit, in der das Fenster offen ist, zählt nicht zur Antwortzeit.
// Mehrwort-Markierung (Emrahs Wunsch, 21.10.2026): mehrere Wörter desselben Satzes als Wortgruppe nachschlagen –
// am Handy über „Mehrere Wörter markieren“ und das letzte Wort antippen, am Laptop auch Ziehen mit der Maus oder Umschalt-Klick.

// Phase 5: 'companion' (Antwort im Begleiter), 'translate' (Übersetzer); 'teacher' (Lehrer-Feedback)
export type WordTapArea = 'trainer' | 'intro' | 'summary' | 'lookup' | 'lesson' | 'speak' | 'business' | 'companion' | 'translate' | 'teacher'
  // Phase 4: Lesen, Hören, Schreiben, Entdecken
  | 'read' | 'listen' | 'write' | 'discover';

type Span = readonly [number, number];

export type WordTapRequest = {
  surface: string;
  /** Der ganze Satz (ohne Lückenklammern). */
  text: string;
  start: number;
  end: number;
  tokens: readonly Token[];
  /** Token-Index des (ersten) Worts. */
  index: number;
  /** Token-Index des letzten Worts einer Wortgruppe (nur bei mehreren Wörtern, sonst fehlt es). */
  last?: number;
  /** Die Wortgruppe wurde auf höchstens {@link PHRASE_MAX_WORDS} Wörter bzw. {@link PHRASE_MAX_CHARS} Zeichen gekürzt. */
  capped?: boolean;
  /**
   * Stellen im Satz, die nicht antippbar sind (die Lücke, die Lösung während der Frage). Eine Wortgruppe reicht nie über sie
   * hinweg, sonst stünde die Lösung im Fenster.
   */
  gaps?: readonly Span[];
  area: WordTapArea;
  /** Quelle, z. B. `vocab/persuade` → `origin.ref` einer gespeicherten Karte. */
  source: string | null;
  /** Titel der Quelle (Wort der Karte). */
  title?: string | null;
  anchor: HTMLElement | null;
  /**
   * Was vor dem Antippen den Fokus hatte (z. B. die Lücke). Nach dem Schließen geht der Fokus
   * dorthin zurück, sonst auf das Wort – so kommt am iPhone auch die Tastatur wieder.
   */
  returnFocus?: HTMLElement | null;
};

/** Mausziehen über Wörter: Satz und Token-Indizes (Anfang, aktuelles Ende). */
export type WordDrag = { text: string; from: number; to: number };

type LookupState = {
  req: WordTapRequest | null;
  openedAt: number;
  openMsTotal: number;
  /** „Mehrere Wörter markieren“: das erste Wort steht fest, das nächste angetippte Wort im selben Satz schließt die Gruppe. */
  pick: WordTapRequest | null;
  drag: WordDrag | null;
};

export const useLookup = create<LookupState>(() => ({ req: null, openedAt: 0, openMsTotal: 0, pick: null, drag: null }));

export const PHRASE_MAX_WORDS = 6;
export const PHRASE_MAX_CHARS = 60;

/** Mehr als ein Wort? */
export const isPhrase = (req: Pick<WordTapRequest, 'index' | 'last'>): boolean => req.last !== undefined && req.last > req.index;

/** Wörter (antippbar) im Satz. */
export const wordCount = (tokens: readonly Token[]): number => tokens.filter((t) => t.kind === 'word').length;

const overlaps = (t: Token, gaps: readonly Span[] | undefined): boolean => !!gaps?.some(([a, b]) => t.start < b && t.end > a);

/**
 * Wortgruppe von `a` (fester Anfang) bis `b` (zuletzt angetipptes Wort) im selben Satz. Gezählt wird von `a` aus in Richtung `b`:
 * höchstens 6 Wörter und 60 Zeichen, nie über eine Lücke hinweg (dann endet die Gruppe davor). `null` = anderer Satz.
 * Ein einziges Wort ergibt die gewöhnliche Anfrage für `b`.
 */
export function rangeRequest(a: WordTapRequest, b: WordTapRequest): WordTapRequest | null {
  if (a.text !== b.text) return null;
  const tokens = b.tokens;
  const forward = b.index >= a.index;
  // Fester Anfang: bei einer schon markierten Gruppe das Ende, das b gegenüberliegt.
  const from = forward ? a.index : (a.last ?? a.index);
  const gaps = b.gaps ?? a.gaps;
  let first = from;
  let last = from;
  let words = 1;
  let capped = false;
  const step = forward ? 1 : -1;
  for (let i = from + step; forward ? i <= b.index : i >= b.index; i += step) {
    const tk = tokens[i];
    if (!tk) break;
    if (overlaps(tk, gaps)) {
      capped = true;
      break;
    }
    if (tk.kind !== 'word') continue;
    const lo = forward ? first : i;
    const hi = forward ? i : last;
    const len = (tokens[hi]?.end ?? 0) - (tokens[lo]?.start ?? 0);
    if (words + 1 > PHRASE_MAX_WORDS || len > PHRASE_MAX_CHARS) {
      capped = true;
      break;
    }
    words += 1;
    if (forward) last = i;
    else first = i;
  }
  const s = tokens[first];
  const e = tokens[last];
  if (!s || !e) return null;
  const anchor = b.anchor ?? a.anchor;
  const returnFocus = a.returnFocus ?? b.returnFocus ?? null;
  const base: WordTapRequest = { ...b, anchor, returnFocus, surface: s.text, start: s.start, end: s.end, index: first };
  delete base.last;
  delete base.capped;
  if (first === last) return capped ? { ...base, capped } : base;
  return { ...base, surface: b.text.slice(s.start, e.end), start: s.start, end: e.end, index: first, last, ...(capped ? { capped } : {}) };
}

export function openLookup(req: WordTapRequest): void {
  const s = useLookup.getState();
  const now = performance.now();
  const add = s.req ? now - s.openedAt : 0;
  useLookup.setState({ req, openedAt: now, openMsTotal: s.openMsTotal + add, pick: null, drag: null });
}

/**
 * Ein Wort wurde angetippt. Läuft „Mehrere Wörter markieren“ im selben Satz, öffnet sich die Wortgruppe; Umschalt-Klick erweitert
 * das offene Fenster im selben Satz zur Gruppe; sonst das Wort allein.
 */
export function tapWord(req: WordTapRequest, extend = false): void {
  const s = useLookup.getState();
  if (s.pick) {
    const range = rangeRequest(s.pick, req);
    if (range) {
      openLookup(range);
      return;
    }
  }
  if (extend && s.req) {
    const range = rangeRequest(s.req, req);
    if (range) {
      openLookup(range);
      return;
    }
  }
  openLookup(req);
}

/** „Mehrere Wörter markieren“: Fenster zu, das Wort bleibt markiert und behält den Fokus. */
export function startPick(req: WordTapRequest): void {
  closeLookup({ restoreFocus: false });
  const one: WordTapRequest = { ...req, surface: req.tokens[req.index]?.text ?? req.surface, start: req.tokens[req.index]?.start ?? req.start, end: req.tokens[req.index]?.end ?? req.end };
  delete one.last;
  delete one.capped;
  useLookup.setState({ pick: one });
  if (req.anchor?.isConnected) req.anchor.focus({ preventScroll: true });
}

/** Markieren abbrechen (Abbrechen, Esc); der Fokus geht auf das erste Wort zurück. */
export function cancelPick(opts: { restoreFocus?: boolean } = {}): void {
  const pick = useLookup.getState().pick;
  if (!pick) return;
  useLookup.setState({ pick: null });
  if (opts.restoreFocus !== false && pick.anchor?.isConnected) pick.anchor.focus({ preventScroll: true });
}

// ------------------------------------------------------------------ Mausziehen (nur Maus: am Handy wischt der Finger die Seite)

let dragBase: WordTapRequest | null = null;

/** Maustaste auf einem Wort gedrückt: möglicher Anfang einer Wortgruppe. */
export function dragStart(req: WordTapRequest): void {
  dragBase = req;
  const end = () => {
    dragBase = null;
    if (useLookup.getState().drag) useLookup.setState({ drag: null });
  };
  // Nach den Knopf-Horchern (React hängt an der Wurzel, das Fenster kommt danach): räumt immer auf.
  window.addEventListener('pointerup', end, { once: true });
}

/** Mit gedrückter Taste über ein anderes Wort desselben Satzes: Gruppe sichtbar mitziehen. */
export function dragOver(text: string, index: number): void {
  if (!dragBase || dragBase.text !== text) return;
  const cur = useLookup.getState().drag;
  if (index === dragBase.index && !cur) return;
  if (cur && cur.text === text && cur.to === index) return;
  // Kein blauer Textauswahl-Balken neben der Markierung.
  window.getSelection()?.removeAllRanges();
  useLookup.setState({ drag: { text, from: dragBase.index, to: index } });
}

/** Taste über einem Wort losgelassen: anderes Wort als am Anfang → Wortgruppe öffnen (`true`). */
export function dragEnd(req: WordTapRequest): boolean {
  const base = dragBase;
  dragBase = null;
  if (!base || base.text !== req.text || base.index === req.index) return false;
  const range = rangeRequest(base, req);
  if (!range) return false;
  openLookup(range);
  return true;
}

/** Liegt das Wort (Token-Index) in der gerade gezogenen Gruppe? */
export const inDrag = (drag: WordDrag | null, text: string, index: number): boolean =>
  !!drag && drag.text === text && index >= Math.min(drag.from, drag.to) && index <= Math.max(drag.from, drag.to);

/** Wohin der Fokus nach dem Schließen geht: vorheriger Fokus, sonst das Wort. */
export function focusTargetOf(req: Pick<WordTapRequest, 'anchor' | 'returnFocus'>): HTMLElement | null {
  const back = req.returnFocus;
  if (back && back.isConnected && back !== document.body) return back;
  return req.anchor && req.anchor.isConnected ? req.anchor : null;
}

/**
 * Schließt das Fenster. Der Fokus geht SYNCHRON zurück (im selben Tippen/Klick), denn nur
 * dann öffnet iOS die Tastatur wieder (A7.4). Liegt der Fokus schon woanders außerhalb des
 * Fensters, bleibt er dort.
 */
export function closeLookup(opts: { restoreFocus?: boolean } = {}): void {
  const s = useLookup.getState();
  const req = s.req;
  if (!req) return;
  useLookup.setState({ req: null, openedAt: 0, openMsTotal: s.openMsTotal + (performance.now() - s.openedAt) });
  if (opts.restoreFocus === false) return;
  const active = document.activeElement;
  const inDialog = active instanceof Element && !!active.closest('[data-testid="lookup"]');
  if (active && active !== document.body && !inDialog) return;
  focusTargetOf(req)?.focus({ preventScroll: true });
}

/** Gesamtzeit mit offenem Nachschlage-Fenster (ms, steigt nur) – für die Antwortzeit. */
export function lookupOpenMs(): number {
  const s = useLookup.getState();
  return s.openMsTotal + (s.req ? performance.now() - s.openedAt : 0);
}
