import type { AttemptInput } from '../domain/srs/types';

// S1-ZEIT (Relaunch Stufe 1 P4, docs/relaunch/stufe1-plan.md §3.3 P4 Nr. 2, §4.2): Eingabeart und erster Kontakt je Versuch.
// Nur gesammelt, nie ausgewertet (Stufe 1). Der Kern ist rein (keine DOM-Typen nötig); `bindInputKind` hängt ihn an Ereignisse.
//
//   t  getippt: Zeichen kamen per Taste (keydown vor dem Text)
//   d  diktiert/eingesetzt: Text kam ohne Taste (`insertText`/`insertReplacementText` mit mehreren Zeichen, `insertFromDictation`,
//      `compositionend` ohne Taste während der Komposition) – und das für MINDESTENS die Hälfte des Antworttexts
//   c  gewählt: Antippen, Bausteine, Mehrfachwahl (entscheidet die Übungsform)
//
// Schutz gegen falsches `d` (Risiko R2):
//   - iOS-/Android-Wortvorschläge: eine Mehrzeichen-Einfügung, die ein schon angetipptes Wort vervollständigt, zählt als getippt;
//     eine Vorhersage ohne angetipptes Wort zählt als „ohne Taste“, reicht aber allein nur, wenn sie die Hälfte der Antwort ausmacht.
//   - Einfügen aus der Zwischenablage oder per Ziehen zählt nie als `d`.
//   - `insertCompositionText` zählt nicht (sonst doppelt mit `compositionend`).

export type InputTally = {
  /** Zeichen, die per Taste kamen (inkl. Vervollständigung eines angetippten Worts). */
  keyChars: number;
  /** Zeichen, die ohne Taste kamen (Diktat, Vorhersage ohne angetipptes Wort). */
  freeChars: number;
  /** Eingefügt (Zwischenablage, Ziehen): weder getippt noch diktiert. */
  pasteChars: number;
};

export type InputRecorder = {
  /** `keydown`; `true`, wenn die Taste ein Kontakt ist (Zeichen, Löschen, Handy-Taste), nicht bei Umschalt, Pfeilen, Enter, Tab, Esc. */
  key(key: string): boolean;
  /** `beforeinput`; `true`, wenn das Ereignis Text einsetzt (Kontakt). */
  beforeInput(inputType: string, data: string | null): boolean;
  compositionStart(): void;
  compositionEnd(data: string | null): void;
  tally(): InputTally;
  reset(): void;
};

/** Tasten, die nichts schreiben (kein Kontakt, keine Taste vor einem Text). */
const SILENT_KEYS = new Set(['Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'CapsLock', 'Tab', 'Escape', 'Enter', 'Fn', 'FnLock', 'Hyper', 'Super', 'NumLock', 'ScrollLock', 'ContextMenu', 'Home', 'End', 'PageUp', 'PageDown', 'Insert']);
const PASTE_TYPES = new Set(['insertFromPaste', 'insertFromPasteAsQuotation', 'insertFromDrop', 'insertFromYank']);

const charLen = (s: string | null | undefined): number => (s ? [...s].length : 0);
const endsWithSpace = (s: string): boolean => /\s$/u.test(s);

export function createInputRecorder(): InputRecorder {
  let keyChars = 0;
  let freeChars = 0;
  let pasteChars = 0;
  /** Eine Taste kam seit der letzten Einfügung. */
  let armed = false;
  /** Per Taste geschriebene Zeichen im aktuellen Wort (Leerzeichen setzt zurück). */
  let wordKeyed = 0;
  let inComp = false;
  let compKeyed = false;

  const addKeyed = (data: string) => {
    keyChars += charLen(data);
    wordKeyed = endsWithSpace(data) ? 0 : wordKeyed + charLen(data);
  };
  const addFree = (data: string) => {
    freeChars += charLen(data);
    wordKeyed = 0;
  };

  return {
    key(key) {
      if (!key || SILENT_KEYS.has(key) || key.startsWith('Arrow') || /^F\d{1,2}$/.test(key)) return false;
      armed = true;
      if (inComp) compKeyed = true;
      return true;
    },
    beforeInput(inputType, data) {
      if (inputType.startsWith('delete')) {
        armed = false;
        return false;
      }
      if (!inputType.startsWith('insert')) return false;
      if (inputType === 'insertCompositionText') return true;
      const text = data ?? '';
      if (PASTE_TYPES.has(inputType)) {
        pasteChars += charLen(text);
        wordKeyed = 0;
      } else if (inputType.includes('Dictation')) {
        addFree(text);
      } else if (inputType === 'insertText' || inputType === 'insertReplacementText') {
        // Taste davor, nur ein Zeichen oder Vervollständigung eines angetippten Worts: getippt.
        if (armed || charLen(text) <= 1 || wordKeyed > 0) addKeyed(text);
        else addFree(text);
      }
      armed = false;
      return true;
    },
    compositionStart() {
      inComp = true;
      compKeyed = armed;
    },
    compositionEnd(data) {
      const text = data ?? '';
      if (compKeyed || armed || wordKeyed > 0) addKeyed(text);
      else addFree(text);
      inComp = false;
      compKeyed = false;
      armed = false;
    },
    tally: () => ({ keyChars, freeChars, pasteChars }),
    reset() {
      keyChars = 0;
      freeChars = 0;
      pasteChars = 0;
      armed = false;
      wordKeyed = 0;
      inComp = false;
      compKeyed = false;
    },
  };
}

/**
 * Eingabeart eines Versuchs. `base` ist die Übungsform: `'c'` (Auswahl, Bausteine, Antippen) bleibt immer `c`;
 * bei einer Texteingabe (`'t'`) gilt `d` nur, wenn mindestens die Hälfte des Antworttexts ohne Taste kam.
 */
export function inputKindOf(tally: InputTally, answer: string, base: 't' | 'c'): AttemptInput {
  if (base === 'c') return 'c';
  const n = charLen(answer.trim());
  return n > 0 && tally.freeChars > 0 && tally.freeChars * 2 >= n ? 'd' : 't';
}

/** ms vom Zeigen (bzw. Tonende) bis zum ersten Kontakt, ohne die bis dahin offenen Pausen; ohne Kontakt `undefined`. */
export function firstContactMs(contactAt: number | null, start: number, pausedAtContact: number): number | undefined {
  if (contactAt === null || !Number.isFinite(contactAt)) return undefined;
  return Math.max(0, Math.round(contactAt - start - Math.max(0, pausedAtContact)));
}

/**
 * Ein Versuch: Eingabeart (Rekorder) und erster Kontakt (Zeitpunkt und die bis dahin seit dem Zeigen aufgelaufene Pause für
 * Nachschlagen und Begleiter – dieselbe Regel wie die Antwortzeit).
 */
export type AttemptTracker = {
  rec: InputRecorder;
  /** Erster Kontakt (Taste, Einfügen, Antippen) mit der bis dahin offenen Pause; spätere Aufrufe ändern nichts. */
  contact(now: number, pausedAtContact: number): void;
  /** Neue Uhr (z. B. „Fehler finden“ nach dem Fund der Stelle): Kontakt und Rekorder von vorn. */
  reset(): void;
  fk(start: number): number | undefined;
  kind(answer: string, base: 't' | 'c'): AttemptInput;
};

export function createAttemptTracker(): AttemptTracker {
  const rec = createInputRecorder();
  let at: number | null = null;
  let paused = 0;
  return {
    rec,
    contact(now, pausedAtContact) {
      if (at !== null) return;
      at = now;
      paused = pausedAtContact;
    },
    reset() {
      at = null;
      paused = 0;
      rec.reset();
    },
    fk: (start) => firstContactMs(at, start, paused),
    kind: (answer, base) => inputKindOf(rec.tally(), answer, base),
  };
}

/**
 * Hängt einen Versuch an Ereignisse (Erfassungsphase, damit auch die eine versteckte Eingabe außerhalb der Übung zählt).
 * `accept` filtert das Ziel (versteckte Eingabe oder Feld der Übung). `now` ist die Uhr der Übung, `paused` die seit dem Zeigen
 * aufgelaufene Pause. Gibt das Abmelden zurück.
 */
export function bindInputKind(target: EventTarget, accept: (el: EventTarget | null) => boolean, tracker: AttemptTracker, now: () => number, paused: () => number): () => void {
  const touch = () => tracker.contact(now(), paused());
  const onKey = (e: Event) => {
    if (!accept(e.target)) return;
    const key = (e as { key?: unknown }).key;
    if (tracker.rec.key(typeof key === 'string' ? key : '')) touch();
  };
  const onBefore = (e: Event) => {
    if (!accept(e.target)) return;
    const ev = e as { inputType?: unknown; data?: unknown };
    if (tracker.rec.beforeInput(typeof ev.inputType === 'string' ? ev.inputType : '', typeof ev.data === 'string' ? ev.data : null)) touch();
  };
  const onCompStart = (e: Event) => {
    if (!accept(e.target)) return;
    tracker.rec.compositionStart();
    touch();
  };
  const onCompEnd = (e: Event) => {
    if (!accept(e.target)) return;
    const data = (e as { data?: unknown }).data;
    tracker.rec.compositionEnd(typeof data === 'string' ? data : null);
  };
  const opts = { capture: true };
  target.addEventListener('keydown', onKey, opts);
  target.addEventListener('beforeinput', onBefore, opts);
  target.addEventListener('compositionstart', onCompStart, opts);
  target.addEventListener('compositionend', onCompEnd, opts);
  return () => {
    target.removeEventListener('keydown', onKey, opts);
    target.removeEventListener('beforeinput', onBefore, opts);
    target.removeEventListener('compositionstart', onCompStart, opts);
    target.removeEventListener('compositionend', onCompEnd, opts);
  };
}
