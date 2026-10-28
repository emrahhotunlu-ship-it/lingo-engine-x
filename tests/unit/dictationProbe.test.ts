import { describe, expect, it } from 'vitest';
import { DICTATION_TARGET, evaluateProbe, isEnglishText, isTypingKey, wordMatch, words } from '../../src/domain/dictation/probe';
import { DK_MAX_BYTES, dkBytes, dkOk, dkStep, osOf, readDk, sigOf, type Dk } from '../../src/domain/dictation/dk';
import { createInputRecorder, type InputTally } from '../../src/engine/inputKind';
import { dkSchema, profileSchema } from '../../src/data/schemas';
import seed from '../fixtures/s1-seed.json';

// Relaunch Stufe 1 P7 S1-DIKTAT: Laptop-Diktat-Probe (docs/relaunch/stufe1-plan.md §7).

const NONE: InputTally = { keyChars: 0, freeChars: 0, pasteChars: 0, delAfterFree: false, keyPresses: 0 };

/** Diktat wie am Mac: ein ganzer Satz per `insertText` ohne Taste davor. */
function dictated(text: string): InputTally {
  const rec = createInputRecorder();
  rec.key('Fn', 0);
  rec.beforeInput('insertText', text, 1000);
  return rec.tally();
}

/** Getippt: jede Taste kurz vor ihrem Zeichen. */
function typed(text: string): InputTally {
  const rec = createInputRecorder();
  let at = 0;
  for (const ch of text) {
    rec.key(ch, at);
    rec.beforeInput('insertText', ch, at + 5);
    at += 200;
  }
  return rec.tally();
}

describe('Wortübereinstimmung', () => {
  it('löst Kurzformen auf und ignoriert Groß-/Kleinschreibung und Satzzeichen', () => {
    expect(words("I'll send you the revised quote by Friday.")).toEqual(['i', 'will', 'send', 'you', 'the', 'revised', 'quote', 'by', 'friday']);
    expect(wordMatch('i will send you the revised quote by friday')).toBe(1);
    expect(wordMatch('I’ll send you the revised quote by Friday')).toBe(1);
  });

  it('70 % als Schwelle: zwei fehlende Wörter von neun reichen noch, vier nicht', () => {
    expect(wordMatch("I'll send you the quote Friday")).toBeCloseTo(7 / 9);
    expect(wordMatch('I send the quote Friday')).toBeLessThan(0.7);
  });

  it('Wiederholungen zählen nur so oft, wie sie im Ziel stehen; Mehrlänge senkt den Wert', () => {
    expect(wordMatch('the the the the the the the the the')).toBeCloseTo(1 / 9);
    expect(wordMatch(`${DICTATION_TARGET} and some more words here today`)).toBeLessThan(0.7);
    expect(wordMatch('')).toBe(0);
  });
});

describe('Sprache', () => {
  it('Zielsatz und eine leichte Abwandlung gelten als Englisch', () => {
    expect(isEnglishText(DICTATION_TARGET)).toBe(true);
    expect(isEnglishText('I will send you the revised quote by Friday')).toBe(true);
  });

  it('Deutsch (mit und ohne Umlaut) und Kauderwelsch gelten nicht als Englisch', () => {
    expect(isEnglishText('Ich schicke dir das überarbeitete Angebot bis Freitag.')).toBe(false);
    expect(isEnglishText('Ich schicke dir das Angebot bis Freitag')).toBe(false);
    expect(isEnglishText('blorf zim quanx vlet prusk')).toBe(false);
    expect(isEnglishText('')).toBe(false);
  });
});

describe('Bewertung', () => {
  it('Erfolg: diktiert, Englisch, mindestens 70 %', () => {
    const r = evaluateProbe({ text: DICTATION_TARGET, tally: dictated(DICTATION_TARGET), typedKeys: 0 });
    expect(r).toEqual({ ok: true, reason: null, match: 1 });
  });

  it('ohne Taste: getippter Text scheitert mit „keys“, auch wenn er stimmt', () => {
    expect(evaluateProbe({ text: DICTATION_TARGET, tally: typed(DICTATION_TARGET), typedKeys: DICTATION_TARGET.length }).reason).toBe('keys');
    // Eine einzige getippte Taste genügt.
    expect(evaluateProbe({ text: DICTATION_TARGET, tally: dictated(DICTATION_TARGET), typedKeys: 1 }).reason).toBe('keys');
  });

  it('Einfügen und Wort-für-Wort ohne Taste sind kein Diktat', () => {
    const rec = createInputRecorder();
    rec.beforeInput('insertFromPaste', DICTATION_TARGET, 0);
    expect(evaluateProbe({ text: DICTATION_TARGET, tally: rec.tally(), typedKeys: 0 }).reason).toBe('paste');
    const solo = createInputRecorder();
    DICTATION_TARGET.split(' ').forEach((w, i) => solo.beforeInput('insertText', i ? ` ${w}` : w, i * 500));
    expect(evaluateProbe({ text: DICTATION_TARGET, tally: solo.tally(), typedKeys: 0 }).reason).toBe('notDictation');
  });

  it('Gründe für Sprache, Abweichung und leeren Text', () => {
    const de = 'Ich schicke dir das Angebot bis Freitag';
    expect(evaluateProbe({ text: de, tally: dictated(de), typedKeys: 0 }).reason).toBe('notEnglish');
    const off = 'We will call you back next week';
    expect(evaluateProbe({ text: off, tally: dictated(off), typedKeys: 0 }).reason).toBe('mismatch');
    expect(evaluateProbe({ text: '  ', tally: NONE, typedKeys: 0 }).reason).toBe('empty');
  });

  it('Diktier-Taste, Win + H und Löschen zählen nicht als Tippen', () => {
    expect(isTypingKey('Fn', {})).toBe(false);
    expect(isTypingKey('h', { meta: true })).toBe(false);
    expect(isTypingKey('Backspace', {})).toBe(false);
    expect(isTypingKey('a', {})).toBe(true);
  });
});

describe('app/profile.dk', () => {
  const full: Dk = {
    v: 1,
    mac: { ok: true, t: 1_793_150_000_000, sig: sigOf('mac', { platform: 'macOS', brands: [{ brand: 'Google Chrome' }] }, '') },
    win: { ok: false, t: 1_793_150_000_000, sig: sigOf('win', { platform: 'Windows', brands: [{ brand: 'Microsoft Edge' }] }, '') },
  };

  it('bleibt mit beiden Betriebssystemen unter 200 Byte', () => {
    expect(dkBytes(full)).toBeLessThan(DK_MAX_BYTES);
    expect(dkSchema.safeParse(full).success).toBe(true);
  });

  it('sig nennt nur Betriebssystem und Browser, nie Version oder Gerätekennung', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
    const sig = sigOf('mac', undefined, ua);
    expect(sig).toBe('macos-chrome');
    expect(sigOf('win', undefined, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0 Safari/537.36 Edg/141.0')).toBe('windows-edge');
    for (const s of [full.mac?.sig, full.win?.sig, sig]) expect(s).toMatch(/^[a-z-]{1,24}$/);
    expect(dkSchema.safeParse({ v: 1, mac: { ok: true, t: 1, sig: 'macos-chrome-141.0.0.0' } }).success).toBe(false);
  });

  it('erkennt Mac und Windows, sonst nichts', () => {
    expect(osOf({ platform: 'macOS' }, '')).toBe('mac');
    expect(osOf({ platform: 'Windows' }, '')).toBe('win');
    expect(osOf({ platform: 'Linux' }, 'Mozilla/5.0 (X11; Linux x86_64)')).toBeNull();
    expect(osOf(undefined, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBeNull();
    expect(osOf(undefined, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('win');
  });

  it('schreibt nur bei Änderung und nie ohne Profil', () => {
    const entry = { ok: true, t: 5, sig: 'macos-chrome' };
    expect(dkStep(undefined, 'mac', entry)).toBeNull();
    expect(dkStep({ dk: { v: 1, mac: { ok: true, t: 1, sig: 'macos-chrome' } } }, 'mac', entry)).toBeNull();
    expect(dkStep({ dk: { v: 1, mac: { ok: false, t: 1, sig: 'macos-chrome' } } }, 'mac', entry)).toEqual({ update: { dk: { v: 1, mac: entry } } });
    expect(dkStep({ name: 'x' }, 'win', { ...entry, sig: 'windows-edge' })).toEqual({ update: { dk: { v: 1, win: { ...entry, sig: 'windows-edge' } } } });
  });

  it('Erfolg bleibt Erfolg: ein gespeichertes ok mit gleicher Signatur wird nie durch einen Fehlversuch ersetzt', () => {
    const okMac = { v: 1, mac: { ok: true, t: 1, sig: 'macos-chrome' }, win: { ok: false, t: 1, sig: 'windows-edge' } };
    expect(dkStep({ dk: okMac }, 'mac', { ok: false, t: 9, sig: 'macos-chrome' })).toBeNull();
    // Anderer Browser = andere Signatur: dessen Ergebnis zählt (die Probe gilt je Betriebssystem und Browser).
    expect(dkStep({ dk: okMac }, 'mac', { ok: false, t: 9, sig: 'macos-safari' })).toEqual({ update: { dk: { v: 1, mac: { ok: false, t: 9, sig: 'macos-safari' } } } });
    // Fehlversuch nach Fehlversuch schreibt nichts; Erfolg nach Fehlversuch schon.
    expect(dkStep({ dk: okMac }, 'win', { ok: false, t: 9, sig: 'windows-edge' })).toBeNull();
    expect(dkStep({ dk: okMac }, 'win', { ok: true, t: 9, sig: 'windows-edge' })).toEqual({ update: { dk: { v: 1, win: { ok: true, t: 9, sig: 'windows-edge' } } } });
  });

  it('liest tolerant: ein kaputtes dk sperrt nie das Profil, fremde Felder je Eintrag stören nicht', () => {
    expect(readDk({ v: 1, mac: { ok: true, t: 1, sig: 'macos-chrome', x: 1 } })).toEqual({ v: 1, mac: { ok: true, t: 1, sig: 'macos-chrome' } });
    expect(profileSchema.safeParse({ dk: 'kaputt' }).success).toBe(true);
    expect(readDk('kaputt')).toBeNull();
    expect(dkOk({ v: 1, mac: { ok: true, t: 1, sig: 'macos-safari' } }, 'mac')).toBe(true);
    expect(dkOk({ v: 1, mac: { ok: true, t: 1, sig: 'macos-safari' } }, 'win')).toBe(false);
    expect(dkOk({ v: 1, mac: { ok: true, t: 1, sig: 'macos-safari' } }, null)).toBe(false);
  });

  it('Rückweg-Seed: dk ist gültig und klein', () => {
    const dk = (seed as { docs: { 'app/profile': { dk: unknown } } }).docs['app/profile'].dk;
    const parsed = readDk(dk);
    expect(parsed).not.toBeNull();
    expect(dkBytes(parsed as Dk)).toBeLessThan(DK_MAX_BYTES);
  });
});
