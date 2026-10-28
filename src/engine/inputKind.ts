import type { AttemptInput, AttemptMeta } from '../domain/srs/types';

// S1-ZEIT (Relaunch Stufe 1 P4, docs/relaunch/stufe1-plan.md §3.3 P4 Nr. 2, §4.2): Eingabeart, erster Kontakt und weitere Messwerte je Versuch.
// Nur gesammelt, nie ausgewertet (Stufe 1). Der Kern ist rein (keine DOM-Typen nötig); `bindInputKind` hängt ihn an Ereignisse.
//
//   t  getippt: Zeichen kamen per Taste – oder ein einzelnes Wort ohne Taste (Wortvorschlag, Wischtippen)
//   d  diktiert: `insertFromDictation` oder EINE Einfügung/Komposition ohne Taste mit mindestens zwei Wörtern –
//      und das für MINDESTENS die Hälfte des Antworttexts
//   c  gewählt: Antippen, Bausteine, Mehrfachwahl (entscheidet die Übungsform)
//
// Schutz gegen falsches `d` (Risiko R2):
//   - „Taste davor“ gilt nur für druckbare Tasten (ein Zeichen, ohne Strg/Cmd/Alt) und nur, wenn die Einfügung höchstens ARM_MS danach kommt.
//     `Unidentified`/`Process` (Android, IME) sind Kontakt, zählen aber nicht als Taste davor; Löschen auch nicht.
//   - Ein einzelnes Wort ohne Taste (QuickType-Vorschlag, Wischtippen) ist `t`.
//   - Einfügen aus der Zwischenablage oder per Ziehen zählt nie als `d` (aber als gemischt, `mx`).
//   - `insertCompositionText` zählt nicht (sonst doppelt mit `compositionend`).

/** Höchstens so viele ms zwischen `keydown` und Einfügung, damit die Taste als „Taste davor“ gilt. */
export const ARM_MS = 100;

export type InputTally = {
  /** Zeichen, die per Taste kamen (inkl. einzelner Wörter ohne Taste: Vorschlag, Wischtippen). */
  keyChars: number;
  /** Zeichen, die diktiert kamen (Diktat, Einfügung ohne Taste mit mindestens zwei Wörtern). */
  freeChars: number;
  /** Eingefügt (Zwischenablage, Ziehen): weder getippt noch diktiert. */
  pasteChars: number;
  /** Gelöscht nach einer Einfügung ohne Taste (Diktat korrigiert). */
  delAfterFree: boolean;
};

export type KeyMods = { ctrl?: boolean; meta?: boolean; alt?: boolean };

export type InputRecorder = {
  /** `keydown`; `true`, wenn die Taste ein Kontakt ist (Zeichen, Löschen, Handy-Taste), nicht bei Umschalt, Pfeilen, Enter, Tab, Esc. */
  key(key: string, at: number, mods?: KeyMods): boolean;
  /** `beforeinput`; `true`, wenn das Ereignis Text einsetzt (Kontakt). */
  beforeInput(inputType: string, data: string | null, at: number): boolean;
  compositionStart(at: number): void;
  compositionEnd(data: string | null, at: number): void;
  tally(): InputTally;
  reset(): void;
};

/** Tasten, die nichts schreiben (kein Kontakt). */
const SILENT_KEYS = new Set(['Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'CapsLock', 'Tab', 'Escape', 'Enter', 'Fn', 'FnLock', 'Hyper', 'Super', 'NumLock', 'ScrollLock', 'ContextMenu', 'Home', 'End', 'PageUp', 'PageDown', 'Insert']);
const PASTE_TYPES = new Set(['insertFromPaste', 'insertFromPasteAsQuotation', 'insertFromDrop', 'insertFromYank']);

const charLen = (s: string | null | undefined): number => (s ? [...s].length : 0);
/** Mindestens zwei Wörter: Leerraum im Inneren des Texts. */
const multiWord = (s: string): boolean => /\S\s+\S/u.test(s);

export function createInputRecorder(): InputRecorder {
  let keyChars = 0;
  let freeChars = 0;
  let pasteChars = 0;
  let delAfterFree = false;
  /** Zeitpunkt der letzten druckbaren Taste ohne Strg/Cmd/Alt (`null` = keine offen). */
  let armedAt: number | null = null;
  /** Die letzte Einfügung kam ohne Taste (mehr als ein Zeichen). */
  let lastUnkeyed = false;
  let compKeyed = false;

  const armed = (at: number): boolean => armedAt !== null && at - armedAt >= 0 && at - armedAt <= ARM_MS;
  /** Eine Einfügung ohne Taste: mindestens zwei Wörter = diktiert, sonst (ein Wort, ein Zeichen) getippt. */
  const unkeyed = (text: string) => {
    if (multiWord(text)) freeChars += charLen(text);
    else keyChars += charLen(text);
    lastUnkeyed = charLen(text) > 1;
  };

  return {
    key(key, at, mods = {}) {
      if (!key || SILENT_KEYS.has(key) || key.startsWith('Arrow') || /^F\d{1,2}$/.test(key)) return false;
      if (charLen(key) === 1 && !mods.ctrl && !mods.meta && !mods.alt) {
        armedAt = at;
        compKeyed = true;
      }
      return true;
    },
    beforeInput(inputType, data, at) {
      if (inputType.startsWith('delete')) {
        if (lastUnkeyed) delAfterFree = true;
        return false;
      }
      if (!inputType.startsWith('insert')) return false;
      if (inputType === 'insertCompositionText') return true;
      const text = data ?? '';
      if (PASTE_TYPES.has(inputType)) {
        pasteChars += charLen(text);
        lastUnkeyed = false;
      } else if (inputType === 'insertFromDictation') {
        freeChars += charLen(text);
        lastUnkeyed = charLen(text) > 0;
      } else if (inputType === 'insertText' || inputType === 'insertReplacementText') {
        if (armed(at)) {
          keyChars += charLen(text);
          lastUnkeyed = false;
        } else unkeyed(text);
      }
      armedAt = null;
      return true;
    },
    compositionStart(at) {
      compKeyed = armed(at);
    },
    compositionEnd(data, at) {
      const text = data ?? '';
      if (compKeyed || armed(at)) {
        keyChars += charLen(text);
        lastUnkeyed = false;
      } else unkeyed(text);
      compKeyed = false;
      armedAt = null;
    },
    tally: () => ({ keyChars, freeChars, pasteChars, delAfterFree }),
    reset() {
      keyChars = 0;
      freeChars = 0;
      pasteChars = 0;
      delAfterFree = false;
      armedAt = null;
      lastUnkeyed = false;
      compKeyed = false;
    },
  };
}

/**
 * Eingabeart eines Versuchs. `base` ist die Übungsform: `'c'` (Auswahl, Bausteine, Antippen) bleibt immer `c`;
 * bei einer Texteingabe (`'t'`) gilt `d` nur, wenn mindestens die Hälfte des Antworttexts diktiert kam.
 */
export function inputKindOf(tally: InputTally, answer: string, base: 't' | 'c'): AttemptInput {
  if (base === 'c') return 'c';
  const n = charLen(answer.trim());
  return n > 0 && tally.freeChars > 0 && tally.freeChars * 2 >= n ? 'd' : 't';
}

/** Gemischt (`mx`): Tasten und Diktat, Einfügen aus Zwischenablage/Ziehen oder Löschen nach einer Einfügung ohne Taste. `in` bleibt davon unberührt. */
export function mixedOf(tally: InputTally): boolean {
  return (tally.keyChars > 0 && tally.freeChars > 0) || tally.pasteChars > 0 || tally.delAfterFree;
}

/** ms vom Zeigen (bzw. Tonende) bis zum ersten Kontakt, ohne die bis dahin offenen Pausen; ohne Kontakt `undefined`. */
export function firstContactMs(contactAt: number | null, start: number, pausedAtContact: number): number | undefined {
  if (contactAt === null || !Number.isFinite(contactAt)) return undefined;
  return Math.max(0, Math.round(contactAt - start - Math.max(0, pausedAtContact)));
}

/** Was eine Übung beim Werten mitgibt (`AttemptTracker.meta`). */
export type AttemptMetaInput = {
  /** Zeitpunkt des Zeigens (bzw. Tonende), dieselbe Uhr wie `contact`. */
  start: number;
  answer: string;
  base: 't' | 'c';
  /** Zweiter Versuch (nach Hinweis oder Vorprüfung); ein zweites Senden an Claude erkennt der Versuch selbst. */
  second?: boolean;
  /** Zeichen des sichtbaren Prompts (`promptChars`). */
  pl?: number | undefined;
};

/**
 * Ein Versuch: Eingabeart (Rekorder), erster Kontakt (Zeitpunkt und die bis dahin seit dem Zeigen aufgelaufene Pause für
 * Nachschlagen und Begleiter – dieselbe Regel wie die Antwortzeit), Senden vor der Wartezeit auf Claude und verborgene Seite.
 */
export type AttemptTracker = {
  rec: InputRecorder;
  /** Erster Kontakt (Taste, Einfügen, Antippen) mit der bis dahin offenen Pause; spätere Aufrufe ändern nichts. */
  contact(now: number, pausedAtContact: number): void;
  hasContact(): boolean;
  /** Die Seite war verborgen (zählt bis zum Senden). */
  hidden(): void;
  /** „Prüfen“ getippt, VOR dem Warten auf Claude: Antwortzeit `ms` zu diesem Zeitpunkt (das letzte Senden gilt). */
  send(ms: number): void;
  /** Senden verwerfen (neue Prüfung ohne Claude, Fehler beim Aufruf). */
  unsend(): void;
  /** Neue Uhr (z. B. „Fehler finden“ nach dem Fund der Stelle): alles von vorn. */
  reset(): void;
  fk(start: number): number | undefined;
  kind(answer: string, base: 't' | 'c'): AttemptInput;
  /** Alle Messwerte zum Zeitpunkt der Wertung; verbraucht das Senden. Ohne Kontakt fehlen `fk`, `in` und `mx`. */
  meta(o: AttemptMetaInput): AttemptMeta;
};

export function createAttemptTracker(): AttemptTracker {
  const rec = createInputRecorder();
  let at: number | null = null;
  let paused = 0;
  let bg = false;
  let sent: { ms: number; bg: boolean } | null = null;
  /** Wie oft „Prüfen“ an Claude ging (ein erneutes Senden nach einem Fehler ist ein zweites Senden). */
  let sends = 0;
  const tracker: AttemptTracker = {
    rec,
    contact(now, pausedAtContact) {
      if (at !== null) return;
      at = now;
      paused = pausedAtContact;
    },
    hasContact: () => at !== null,
    hidden() {
      bg = true;
    },
    send(ms) {
      sent = { ms: Math.max(0, Math.round(ms)), bg };
      sends += 1;
    },
    unsend() {
      sent = null;
    },
    reset() {
      at = null;
      paused = 0;
      bg = false;
      sent = null;
      sends = 0;
      rec.reset();
    },
    fk: (start) => firstContactMs(at, start, paused),
    kind: (answer, base) => inputKindOf(rec.tally(), answer, base),
    meta(o) {
      const out: AttemptMeta = {};
      const fk = tracker.fk(o.start);
      if (fk !== undefined) {
        out.fk = fk;
        out.in = tracker.kind(o.answer, o.base);
        if (mixedOf(rec.tally())) out.mx = 1;
      }
      if (sent) out.sm = sent.ms;
      if (typeof o.pl === 'number' && Number.isFinite(o.pl) && o.pl >= 0) out.pl = Math.round(o.pl);
      if (o.second || sends > 1) out.n = 2;
      if (sent ? sent.bg : bg) out.bg = 1;
      sent = null;
      return out;
    },
  };
  return tracker;
}

/** Nur die Messwerte (für die Übergabe von der Rückmeldung an die Antwort); fehlende Felder bleiben weg. */
export function pickAttempt(o: AttemptMeta): AttemptMeta {
  const out: AttemptMeta = {};
  if (o.fk !== undefined) out.fk = o.fk;
  if (o.in) out.in = o.in;
  if (o.mx) out.mx = o.mx;
  if (o.sm !== undefined) out.sm = o.sm;
  if (o.pl !== undefined) out.pl = o.pl;
  if (o.n) out.n = o.n;
  if (o.bg) out.bg = o.bg;
  if (o.st !== undefined) out.st = o.st;
  return out;
}

const PROMPT_SLOTS = '[data-slot="prompt"], [data-slot="aid"], [data-slot="hint"]:not([data-testid="ai-error"])';

/** Zeichen des sichtbaren Prompts (Satz bzw. Aufgabe, Suchhilfe, Hinweis) im Übungsgerüst; ohne Gerüst `undefined`. */
export function promptChars(root: ParentNode | null | undefined): number | undefined {
  if (!root) return undefined;
  const els = Array.from(root.querySelectorAll(PROMPT_SLOTS)).filter((el) => !el.parentElement?.closest(PROMPT_SLOTS));
  if (!els.length) return undefined;
  return els.reduce((n, el) => n + (el.textContent ?? '').replace(/\s+/g, ' ').trim().length, 0);
}

/** Text einer Einfügung; Safari liefert bei `insertReplacementText`/`insertFromPaste` `data === null` und den Text nur in `dataTransfer`. */
function insertedText(ev: { inputType?: unknown; data?: unknown; dataTransfer?: unknown }): string | null {
  if (typeof ev.data === 'string') return ev.data;
  if (ev.inputType !== 'insertReplacementText' && ev.inputType !== 'insertFromPaste') return null;
  const dt = ev.dataTransfer as { getData?: (f: string) => string } | null | undefined;
  return typeof dt?.getData === 'function' ? dt.getData('text/plain') : null;
}

export type BindInputKindOptions = {
  /** Ziel annehmen (versteckte Eingabe oder Feld der Übung). */
  accept: (el: EventTarget | null) => boolean;
  tracker: AttemptTracker;
  /** Uhr der Übung. */
  now: () => number;
  /** Seit dem Zeigen aufgelaufene Pause (Nachschlagen, Begleiter). */
  paused: () => number;
  /** Ist die Seite gerade verborgen? (Standard: `document.visibilityState`.) */
  isHidden?: () => boolean;
};

const docHidden = (): boolean => typeof document !== 'undefined' && document.visibilityState === 'hidden';

/**
 * Hängt einen Versuch an Ereignisse (Erfassungsphase, damit auch die eine versteckte Eingabe außerhalb der Übung zählt) und an
 * `visibilitychange` (verborgene Seite, `bg`). Gibt das Abmelden zurück.
 */
export function bindInputKind(target: EventTarget, o: BindInputKindOptions): () => void {
  const { accept, tracker, now, paused } = o;
  const isHidden = o.isHidden ?? docHidden;
  const touch = () => {
    if (tracker.hasContact()) return;
    tracker.contact(now(), paused());
  };
  const onKey = (e: Event) => {
    if (!accept(e.target)) return;
    const ev = e as { key?: unknown; ctrlKey?: unknown; metaKey?: unknown; altKey?: unknown };
    if (tracker.rec.key(typeof ev.key === 'string' ? ev.key : '', now(), { ctrl: ev.ctrlKey === true, meta: ev.metaKey === true, alt: ev.altKey === true })) touch();
  };
  const onBefore = (e: Event) => {
    if (!accept(e.target)) return;
    const ev = e as { inputType?: unknown; data?: unknown; dataTransfer?: unknown };
    if (tracker.rec.beforeInput(typeof ev.inputType === 'string' ? ev.inputType : '', insertedText(ev), now())) touch();
  };
  const onCompStart = (e: Event) => {
    if (!accept(e.target)) return;
    tracker.rec.compositionStart(now());
    touch();
  };
  const onCompEnd = (e: Event) => {
    if (!accept(e.target)) return;
    const data = (e as { data?: unknown }).data;
    tracker.rec.compositionEnd(typeof data === 'string' ? data : null, now());
  };
  const onVis = () => {
    if (isHidden()) tracker.hidden();
  };
  if (isHidden()) tracker.hidden();
  const opts = { capture: true };
  target.addEventListener('keydown', onKey, opts);
  target.addEventListener('beforeinput', onBefore, opts);
  target.addEventListener('compositionstart', onCompStart, opts);
  target.addEventListener('compositionend', onCompEnd, opts);
  target.addEventListener('visibilitychange', onVis);
  return () => {
    target.removeEventListener('keydown', onKey, opts);
    target.removeEventListener('beforeinput', onBefore, opts);
    target.removeEventListener('compositionstart', onCompStart, opts);
    target.removeEventListener('compositionend', onCompEnd, opts);
    target.removeEventListener('visibilitychange', onVis);
  };
}
