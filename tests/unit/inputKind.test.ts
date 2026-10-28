import { describe, expect, it } from 'vitest';
import { ARM_MS, bindInputKind, createAttemptTracker, createInputRecorder, firstContactMs, inputKindOf, mixedOf, pickAttempt, type InputRecorder, type InputTally } from '../../src/engine/inputKind';

// S1-ZEIT (Relaunch Stufe 1 P4 Nr. 2): Eingabeart je Versuch. `d` nur bei Diktat bzw. einer Einfügung ohne Taste mit mindestens zwei
// Wörtern – und nur, wenn mindestens die Hälfte des Antworttexts so kam (Risiko R2: iOS-Wortvorschläge, Wischtippen, Einfügen). Nur gesammelt.

/** Tippt Zeichen für Zeichen: keydown, 5 ms später beforeinput mit genau einem Zeichen. */
const type = (r: InputRecorder, text: string, at = { t: 1000 }) => {
  for (const ch of text) {
    r.key(ch, at.t);
    r.beforeInput('insertText', ch, at.t + 5);
    at.t += 120;
  }
};
const tally = (o: Partial<InputTally>): InputTally => ({ keyChars: 0, freeChars: 0, pasteChars: 0, delAfterFree: false, ...o });

describe('inputKindOf: getippt, diktiert, gewählt', () => {
  it('Tippen ist t', () => {
    const r = createInputRecorder();
    type(r, 'recommend');
    expect(r.tally()).toEqual(tally({ keyChars: 9 }));
    expect(inputKindOf(r.tally(), 'recommend', 't')).toBe('t');
    expect(mixedOf(r.tally())).toBe(false);
  });

  it('Einfügung ohne Taste mit mindestens zwei Wörtern ist d', () => {
    const r = createInputRecorder();
    r.beforeInput('insertText', 'I would recommend it', 1000);
    expect(r.tally().freeChars).toBe(20);
    expect(inputKindOf(r.tally(), 'I would recommend it', 't')).toBe('d');
  });

  it('ein einzelnes Wort ohne Taste (Vorschlag, Wischtippen) ist t', () => {
    const r = createInputRecorder();
    r.beforeInput('insertText', 'recommend', 1000);
    r.beforeInput('insertText', ' ', 1300);
    expect(r.tally()).toEqual(tally({ keyChars: 10 }));
    expect(inputKindOf(r.tally(), 'recommend', 't')).toBe('t');
  });

  it('insertFromDictation ist immer d, auch ein einzelnes Wort', () => {
    const a = createInputRecorder();
    a.beforeInput('insertFromDictation', 'account', 1000);
    expect(inputKindOf(a.tally(), 'account', 't')).toBe('d');
  });

  it('Komposition ohne Taste: zwei Wörter d, ein Wort t', () => {
    const b = createInputRecorder();
    b.compositionStart(1000);
    expect(b.beforeInput('insertCompositionText', 'take it', 1100)).toBe(true);
    b.compositionEnd('take it into account', 1500);
    expect(b.tally().freeChars).toBe(20);
    expect(inputKindOf(b.tally(), 'take it into account', 't')).toBe('d');
    const c = createInputRecorder();
    c.compositionStart(1000);
    c.compositionEnd('account', 1400);
    expect(c.tally()).toEqual(tally({ keyChars: 7 }));
  });

  it('Android (keydown „Unidentified“/„Process“, keyCode 229): Kontakt, aber keine Taste davor – je Wort komponiert bleibt es t', () => {
    const r = createInputRecorder();
    r.compositionStart(1000);
    for (const ch of 'account') {
      expect(r.key('Unidentified', 1000)).toBe(true);
      r.beforeInput('insertCompositionText', ch, 1005);
    }
    r.compositionEnd('account', 1010);
    expect(r.tally()).toEqual(tally({ keyChars: 7 }));
    expect(inputKindOf(r.tally(), 'account', 't')).toBe('t');
    // Gboard-Diktat sendet ebenfalls 229-Tasten: mehrere Wörter in einer Komposition sind d.
    const d = createInputRecorder();
    expect(d.key('Process', 2000)).toBe(true);
    d.compositionStart(2001);
    d.compositionEnd('take it into account', 2600);
    expect(inputKindOf(d.tally(), 'take it into account', 't')).toBe('d');
  });

  it('Taste davor gilt nur im Zeitfenster und nur für druckbare Tasten ohne Strg/Cmd/Alt', () => {
    // Rücktaste im leeren Feld, danach Diktat: bleibt d.
    const a = createInputRecorder();
    expect(a.key('Backspace', 1000)).toBe(true);
    a.beforeInput('insertText', 'take it into account', 1002);
    expect(inputKindOf(a.tally(), 'take it into account', 't')).toBe('d');
    // Druckbare Taste, Einfügung erst nach dem Fenster: ohne Taste.
    const b = createInputRecorder();
    b.key('a', 1000);
    b.beforeInput('insertText', 'take it into account', 1000 + ARM_MS + 1);
    expect(b.tally().freeChars).toBe(20);
    // Im Fenster: getippt (z. B. Textbaustein-Kürzel der Tastatur).
    const c = createInputRecorder();
    c.key('a', 1000);
    c.beforeInput('insertText', 'take it into account', 1000 + ARM_MS);
    expect(c.tally()).toEqual(tally({ keyChars: 20 }));
    // Cmd+V setzt keine Taste davor (Einfügen zählt ohnehin nie als d).
    const d = createInputRecorder();
    expect(d.key('v', 1000, { meta: true })).toBe(true);
    d.beforeInput('insertText', 'take it into account', 1001);
    expect(d.tally().freeChars).toBe(20);
    // Eine Taste gilt nur für EINE Einfügung.
    const e = createInputRecorder();
    e.key('x', 1000);
    e.beforeInput('insertText', 'x', 1001);
    e.beforeInput('insertText', 'take it into account', 1050);
    expect(e.tally()).toEqual(tally({ keyChars: 1, freeChars: 20 }));
  });

  it('iOS-Wortvorschlag nach angetipptem Wortanfang bleibt t', () => {
    const r = createInputRecorder();
    type(r, 'rec');
    // Antippen des Vorschlags: keine Taste, das ganze Wort ersetzt den Anfang.
    r.beforeInput('insertReplacementText', 'recommend', 5000);
    expect(r.tally().freeChars).toBe(0);
    expect(inputKindOf(r.tally(), 'recommend', 't')).toBe('t');
  });

  it('die Hälfte-Regel: genau die Hälfte diktiert ist d, knapp darunter t', () => {
    expect(inputKindOf(tally({ keyChars: 5, freeChars: 5 }), '0123456789', 't')).toBe('d');
    expect(inputKindOf(tally({ keyChars: 6, freeChars: 4 }), '0123456789', 't')).toBe('t');
  });

  it('Einfügen aus der Zwischenablage oder per Ziehen ist nie d, aber gemischt', () => {
    const r = createInputRecorder();
    r.key('v', 1000, { ctrl: true });
    r.beforeInput('insertFromPaste', 'take it into account', 1001);
    r.beforeInput('insertFromDrop', 'more', 2000);
    expect(r.tally()).toEqual(tally({ pasteChars: 24 }));
    expect(inputKindOf(r.tally(), 'take it into account', 't')).toBe('t');
    expect(mixedOf(r.tally())).toBe(true);
  });

  it('gemischt (mx): Tasten und Diktat, oder Löschen nach einer Einfügung ohne Taste; in bleibt', () => {
    const a = createInputRecorder();
    type(a, 'I ');
    a.beforeInput('insertText', 'would recommend it', 5000);
    expect(mixedOf(a.tally())).toBe(true);
    expect(inputKindOf(a.tally(), 'I would recommend it', 't')).toBe('d');
    const b = createInputRecorder();
    b.beforeInput('insertText', 'take it into account', 1000);
    expect(mixedOf(b.tally())).toBe(false);
    b.beforeInput('deleteContentBackward', null, 2000);
    expect(mixedOf(b.tally())).toBe(true);
    // Zähler bleiben beim Löschen stehen.
    expect(b.tally().freeChars).toBe(20);
    // Löschen nach reinem Tippen ist nicht gemischt.
    const c = createInputRecorder();
    type(c, 'acount');
    c.beforeInput('deleteContentBackward', null, 9000);
    expect(mixedOf(c.tally())).toBe(false);
  });

  it('Auswahl, Bausteine und Antippen sind c – auch mit Tastenkürzel', () => {
    const r = createInputRecorder();
    r.key('2', 1000);
    expect(inputKindOf(r.tally(), 'option b', 'c')).toBe('c');
    expect(inputKindOf(tally({ freeChars: 99 }), 'x', 'c')).toBe('c');
  });

  it('leere Antwort ist nie d; Umschalt, Pfeile und Enter sind kein Kontakt', () => {
    expect(inputKindOf(tally({ freeChars: 12 }), '   ', 't')).toBe('t');
    const r = createInputRecorder();
    for (const k of ['Shift', 'ArrowLeft', 'Enter', 'Tab', 'Escape', 'F5']) expect(r.key(k, 1000)).toBe(false);
    expect(r.key('Backspace', 1000)).toBe(true);
    expect(r.beforeInput('deleteContentBackward', null, 1001)).toBe(false);
  });

  it('reset beginnt von vorn', () => {
    const r = createInputRecorder();
    r.beforeInput('insertText', 'dictated words', 1000);
    r.beforeInput('deleteContentBackward', null, 1100);
    r.reset();
    expect(r.tally()).toEqual(tally({}));
  });
});

describe('erster Kontakt und Messwerte des Versuchs', () => {
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

  it('meta: ohne Kontakt nur pl/n/bg/sm; mit Kontakt fk, in und mx', () => {
    const tr = createAttemptTracker();
    expect(tr.meta({ start: 0, answer: '', base: 't', pl: 42 })).toEqual({ pl: 42 });
    tr.contact(1200, 0);
    tr.rec.key('I', 1200);
    tr.rec.beforeInput('insertText', 'I', 1201);
    tr.rec.beforeInput('insertText', ' would recommend it', 3000);
    expect(tr.meta({ start: 1000, answer: 'I would recommend it', base: 't', pl: 57.4, second: true })).toEqual({ fk: 200, in: 'd', mx: 1, pl: 57, n: 2 });
  });

  it('send: Antwortzeit vor dem Warten auf Claude, einmal verbraucht; unsend verwirft; zweites Senden ist n: 2', () => {
    const tr = createAttemptTracker();
    tr.send(4321.6);
    expect(tr.meta({ start: 0, answer: '', base: 't' })).toEqual({ sm: 4322 });
    expect(tr.meta({ start: 0, answer: '', base: 't' })).toEqual({});
    tr.send(100);
    tr.unsend();
    expect(tr.meta({ start: 0, answer: '', base: 't' })).toEqual({ n: 2 });
    tr.reset();
    tr.send(100);
    expect(tr.meta({ start: 0, answer: '', base: 't' })).toEqual({ sm: 100 });
  });

  it('bg: verborgene Seite vor dem Senden zählt, danach nicht mehr', () => {
    const a = createAttemptTracker();
    a.hidden();
    a.send(900);
    expect(a.meta({ start: 0, answer: '', base: 'c' })).toEqual({ sm: 900, bg: 1 });
    const b = createAttemptTracker();
    b.send(900);
    b.hidden();
    expect(b.meta({ start: 0, answer: '', base: 'c' })).toEqual({ sm: 900 });
    const c = createAttemptTracker();
    c.hidden();
    expect(c.meta({ start: 0, answer: '', base: 'c' })).toEqual({ bg: 1 });
  });

  it('pickAttempt übernimmt nur die Messwerte', () => {
    expect(pickAttempt({ fk: 0, in: 't', mx: 1, sm: 5, pl: 0, n: 2, bg: 1, st: 0, ...({ grade: 3, given: 'x' } as object) })).toEqual({ fk: 0, in: 't', mx: 1, sm: 5, pl: 0, n: 2, bg: 1, st: 0 });
    expect(pickAttempt({})).toEqual({});
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
    const input = new EventTarget();
    const other = new EventTarget();
    // Erfassungsphase am Dokument: die Ereignisse kommen am Ziel an; hier hört das Ziel direkt (Node kennt keinen DOM-Baum).
    const tr = createAttemptTracker();
    let now = 1000;
    const opts = { accept: (el: EventTarget | null) => el === input, tracker: tr, now: () => now, paused: () => 0, isHidden: () => false };
    const offInput = bindInputKind(input, opts);
    const offOther = bindInputKind(other, opts);
    now = 1200;
    ev('keydown', { key: 'a' }, other);
    expect(tr.fk(1000)).toBeUndefined();
    now = 1800;
    ev('beforeinput', { inputType: 'insertText', data: 'take it into account' }, input);
    expect(tr.fk(1000)).toBe(800);
    now = 2500;
    ev('keydown', { key: 'x' }, input);
    ev('beforeinput', { inputType: 'insertText', data: 'x' }, input);
    expect(tr.rec.tally()).toEqual(tally({ keyChars: 1, freeChars: 20 }));
    expect(tr.kind('take it into accountx', 't')).toBe('d');
    offInput();
    offOther();
    ev('beforeinput', { inputType: 'insertText', data: 'more words here' }, input);
    expect(tr.rec.tally().freeChars).toBe(20);
  });

  it('Strg/Cmd/Alt aus dem Ereignis: keine Taste davor', () => {
    const input = new EventTarget();
    const tr = createAttemptTracker();
    const off = bindInputKind(input, { accept: () => true, tracker: tr, now: () => 1000, paused: () => 0, isHidden: () => false });
    ev('keydown', { key: 'v', metaKey: true }, input);
    ev('beforeinput', { inputType: 'insertText', data: 'take it into account' }, input);
    expect(tr.rec.tally().freeChars).toBe(20);
    off();
  });

  it('Safari: insertReplacementText/insertFromPaste mit data null lesen den Text aus dataTransfer', () => {
    const input = new EventTarget();
    const tr = createAttemptTracker();
    const off = bindInputKind(input, { accept: () => true, tracker: tr, now: () => 1000, paused: () => 0, isHidden: () => false });
    const dt = (s: string) => ({ getData: (f: string) => (f === 'text/plain' ? s : '') });
    ev('beforeinput', { inputType: 'insertReplacementText', data: null, dataTransfer: dt('take it into account') }, input);
    ev('beforeinput', { inputType: 'insertFromPaste', data: null, dataTransfer: dt('abc') }, input);
    expect(tr.rec.tally()).toEqual(tally({ freeChars: 20, pasteChars: 3 }));
    off();
  });

  it('compositionstart ist ein Kontakt, compositionend zählt den Text', () => {
    const input = new EventTarget();
    const tr = createAttemptTracker();
    const off = bindInputKind(input, { accept: () => true, tracker: tr, now: () => 3000, paused: () => 400, isHidden: () => false });
    ev('compositionstart', {}, input);
    ev('compositionend', { data: 'in the long run' }, input);
    expect(tr.fk(1000)).toBe(1600);
    expect(tr.kind('in the long run', 't')).toBe('d');
    off();
  });

  it('visibilitychange: verborgen setzt bg; schon beim Anmelden verborgen auch', () => {
    const doc = new EventTarget();
    let hidden = false;
    const tr = createAttemptTracker();
    const off = bindInputKind(doc, { accept: () => true, tracker: tr, now: () => 0, paused: () => 0, isHidden: () => hidden });
    ev('visibilitychange', {}, doc);
    expect(tr.meta({ start: 0, answer: '', base: 'c' })).toEqual({});
    hidden = true;
    ev('visibilitychange', {}, doc);
    expect(tr.meta({ start: 0, answer: '', base: 'c' })).toEqual({ bg: 1 });
    off();
    const tr2 = createAttemptTracker();
    const off2 = bindInputKind(doc, { accept: () => true, tracker: tr2, now: () => 0, paused: () => 0, isHidden: () => true });
    expect(tr2.meta({ start: 0, answer: '', base: 'c' })).toEqual({ bg: 1 });
    off2();
  });
});
