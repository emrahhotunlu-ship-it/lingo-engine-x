import { describe, expect, it } from 'vitest';
import { bindInputKind, createAttemptTracker, createInputRecorder, firstContactMs, inputKindOf, type InputRecorder } from '../../src/engine/inputKind';

// S1-ZEIT (Relaunch Stufe 1 P4 Nr. 2): Eingabeart je Versuch. `d` nur, wenn mindestens die Hälfte des Antworttexts ohne Taste kam
// (Risiko R2: iOS-Wortvorschläge, Einfügen). Nur gesammelt, nie ausgewertet.

/** Tippt Zeichen für Zeichen: keydown, dann beforeinput mit genau einem Zeichen. */
const type = (r: InputRecorder, text: string) => {
  for (const ch of text) {
    r.key(ch);
    r.beforeInput('insertText', ch);
  }
};

describe('inputKindOf: getippt, diktiert, gewählt', () => {
  it('Tippen ist t', () => {
    const r = createInputRecorder();
    type(r, 'recommend');
    expect(r.tally()).toEqual({ keyChars: 9, freeChars: 0, pasteChars: 0 });
    expect(inputKindOf(r.tally(), 'recommend', 't')).toBe('t');
  });

  it('Diktat (Mehrzeichen-Einfügung ohne Taste) ist d', () => {
    const r = createInputRecorder();
    r.beforeInput('insertText', 'I would recommend it');
    expect(inputKindOf(r.tally(), 'I would recommend it', 't')).toBe('d');
  });

  it('insertFromDictation und compositionend ohne Taste sind d', () => {
    const a = createInputRecorder();
    a.beforeInput('insertFromDictation', 'take it into account');
    expect(inputKindOf(a.tally(), 'take it into account', 't')).toBe('d');
    const b = createInputRecorder();
    b.compositionStart();
    b.beforeInput('insertCompositionText', 'take it');
    b.compositionEnd('take it into account');
    expect(b.tally().freeChars).toBe(20);
    expect(inputKindOf(b.tally(), 'take it into account', 't')).toBe('d');
  });

  it('Komposition mit Tasten (Android-Tastatur, keydown „Unidentified“) ist t', () => {
    const r = createInputRecorder();
    r.compositionStart();
    for (const ch of 'account') {
      expect(r.key('Unidentified')).toBe(true);
      r.beforeInput('insertCompositionText', ch);
    }
    r.compositionEnd('account');
    expect(r.tally()).toEqual({ keyChars: 7, freeChars: 0, pasteChars: 0 });
    expect(inputKindOf(r.tally(), 'account', 't')).toBe('t');
  });

  it('iOS-Wortvorschlag nach angetipptem Wortanfang bleibt t', () => {
    const r = createInputRecorder();
    type(r, 'rec');
    // Antippen des Vorschlags: keine Taste, das ganze Wort ersetzt den Anfang.
    r.beforeInput('insertReplacementText', 'recommend');
    expect(r.tally().freeChars).toBe(0);
    expect(inputKindOf(r.tally(), 'recommend', 't')).toBe('t');
  });

  it('eine einzelne Vorhersage (ohne Wortanfang) in einem längeren Satz ist kein Diktat', () => {
    const r = createInputRecorder();
    type(r, 'We should ');
    r.beforeInput('insertText', 'reconsider');
    type(r, ' the deadline.');
    // 10 von 34 Zeichen ohne Taste: weniger als die Hälfte.
    expect(r.tally().freeChars).toBe(10);
    expect(inputKindOf(r.tally(), 'We should reconsider the deadline.', 't')).toBe('t');
  });

  it('die Hälfte-Regel: genau die Hälfte ohne Taste ist d, knapp darunter t', () => {
    expect(inputKindOf({ keyChars: 5, freeChars: 5, pasteChars: 0 }, '0123456789', 't')).toBe('d');
    expect(inputKindOf({ keyChars: 6, freeChars: 4, pasteChars: 0 }, '0123456789', 't')).toBe('t');
  });

  it('Einfügen aus der Zwischenablage oder per Ziehen ist nie d', () => {
    const r = createInputRecorder();
    r.key('v');
    r.beforeInput('insertFromPaste', 'take it into account');
    r.beforeInput('insertFromDrop', 'more');
    expect(r.tally()).toEqual({ keyChars: 0, freeChars: 0, pasteChars: 24 });
    expect(inputKindOf(r.tally(), 'take it into account', 't')).toBe('t');
  });

  it('Auswahl, Bausteine und Antippen sind c – auch mit Tastenkürzel', () => {
    const r = createInputRecorder();
    r.key('2');
    expect(inputKindOf(r.tally(), 'option b', 'c')).toBe('c');
    expect(inputKindOf({ keyChars: 0, freeChars: 99, pasteChars: 0 }, 'x', 'c')).toBe('c');
  });

  it('leere Antwort ist nie d; Umschalt, Pfeile und Enter sind kein Kontakt', () => {
    expect(inputKindOf({ keyChars: 0, freeChars: 12, pasteChars: 0 }, '   ', 't')).toBe('t');
    const r = createInputRecorder();
    for (const k of ['Shift', 'ArrowLeft', 'Enter', 'Tab', 'Escape', 'F5']) expect(r.key(k)).toBe(false);
    expect(r.key('Backspace')).toBe(true);
    expect(r.beforeInput('deleteContentBackward', null)).toBe(false);
  });

  it('reset beginnt von vorn', () => {
    const r = createInputRecorder();
    r.beforeInput('insertText', 'dictated words');
    r.reset();
    expect(r.tally()).toEqual({ keyChars: 0, freeChars: 0, pasteChars: 0 });
  });
});

describe('erster Kontakt', () => {
  it('Zeit ab Zeigen ohne die bis dahin offene Pause; ohne Kontakt undefined', () => {
    expect(firstContactMs(null, 100, 0)).toBeUndefined();
    expect(firstContactMs(2600, 100, 500)).toBe(2000);
    // Kontakt vor dem Tonende (Hören): nie negativ.
    expect(firstContactMs(100, 900, 0)).toBe(0);
  });

  it('nur der erste Kontakt zählt; reset startet die Uhr neu', () => {
    const tr = createAttemptTracker();
    tr.contact(1500, 200);
    tr.contact(9000, 0);
    expect(tr.fk(0)).toBe(1300);
    tr.reset();
    expect(tr.fk(0)).toBeUndefined();
    tr.contact(4000, 0);
    expect(tr.fk(3000)).toBe(1000);
  });
});

describe('bindInputKind an Ereignissen', () => {
  const ev = (type: string, props: Record<string, unknown>, target: EventTarget): Event => {
    const e = new Event(type);
    Object.assign(e, props);
    target.dispatchEvent(e);
    return e;
  };

  it('zählt Tasten und Einfügungen nur am angenommenen Ziel und setzt den ersten Kontakt', () => {
    const doc = new EventTarget();
    const input = new EventTarget();
    const other = new EventTarget();
    // Erfassungsphase am Dokument: die Ereignisse kommen am Ziel an; hier hört das Ziel direkt (Node kennt keinen DOM-Baum).
    const tr = createAttemptTracker();
    let now = 1000;
    const offInput = bindInputKind(input, (el) => el === input, tr, () => now, () => 0);
    const offOther = bindInputKind(other, (el) => el === input, tr, () => now, () => 0);
    void doc;
    now = 1200;
    ev('keydown', { key: 'a' }, other);
    expect(tr.fk(1000)).toBeUndefined();
    now = 1800;
    ev('beforeinput', { inputType: 'insertText', data: 'take it into account' }, input);
    expect(tr.fk(1000)).toBe(800);
    now = 2500;
    ev('keydown', { key: 'x' }, input);
    ev('beforeinput', { inputType: 'insertText', data: 'x' }, input);
    expect(tr.rec.tally()).toEqual({ keyChars: 1, freeChars: 20, pasteChars: 0 });
    expect(tr.kind('take it into accountx', 't')).toBe('d');
    offInput();
    offOther();
    ev('beforeinput', { inputType: 'insertText', data: 'more words here' }, input);
    expect(tr.rec.tally().freeChars).toBe(20);
  });

  it('compositionstart ist ein Kontakt, compositionend zählt den Text', () => {
    const input = new EventTarget();
    const tr = createAttemptTracker();
    const off = bindInputKind(input, () => true, tr, () => 3000, () => 400);
    ev('compositionstart', {}, input);
    ev('compositionend', { data: 'in the long run' }, input);
    expect(tr.fk(1000)).toBe(1600);
    expect(tr.kind('in the long run', 't')).toBe('d');
    off();
  });
});
