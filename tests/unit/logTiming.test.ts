import { describe, expect, it } from 'vitest';
import { logSchema } from '../../src/data/schemas';
import { drillLogEntry, grammarLogEntry, logEntry, LOG_DOC_MAX_BYTES, LOG_ENTRIES_MAX, mergeLogEntries, repairLogEntry, timingOf, type AnyLogEntry } from '../../src/domain/progress/logPatch';
import type { DrillAnswer, GrammarAnswer } from '../../src/domain/learn/types';
import type { AnswerEvent } from '../../src/domain/srs/types';

// S1-ZEIT (Relaunch Stufe 1 P4 Nr. 4): Log-Einträge bekommen `fk` und `in` und (Nacharbeit) `mx`/`sm`/`pl`/`n`/`bg`/`st`; `ms` bleibt roh mit
// gleicher Bedeutung, `sm` nur, wenn es abweicht; c1x behält `tm`. Ohne Messwerte genau die alte Form. 300 Einträge bleiben unter LOG_DOC_MAX_BYTES.

const T0 = Date.UTC(2026, 8, 20, 8, 0, 0);
const vocab = (over: Partial<AnswerEvent> = {}): AnswerEvent => ({ t: T0, day: '2026-09-20', kind: 'v', id: 'struggle', ex: 'type', grade: 3, given: 'struggle', ans: 'struggle', ms: 5234, lang: 'de', ctx: 'rev', ...over });
const task = { key: 'k', topic: 'passive', type: 'gap', prompt: 'The report ___ yesterday.', answer: 'was finished', accepted: [], options: null, hint: null, expl: { de: null, en: null }, src: 'seed', ref: null, errorT: null };
const grammar = (over: Partial<GrammarAnswer> = {}): GrammarAnswer => ({ kind: 'g', t: T0, day: '2026-09-20', lang: 'de', ctx: 'duty', task, given: 'was finished', dontKnow: false, verdict: 'correct', grade: 3, ms: 4321, help: { level: 0 }, judged: 'local', ...over }) as unknown as GrammarAnswer;

describe('Log: fk/in', () => {
  it('Vokabel: fk gerundet und in; ms unverändert', () => {
    const e = logEntry(vocab({ fk: 1843.6, in: 't' }));
    expect(e).toEqual({ t: T0, ok: true, lang: 'de', k: 'v', id: 'struggle', m: 'tr-type', given: 'struggle', ans: 'struggle', g: 3, ms: 5234, ctx: 'rev', fk: 1840, in: 't' });
  });

  it('ohne Messwerte genau die alte Form', () => {
    expect(logEntry(vocab())).toEqual({ t: T0, ok: true, lang: 'de', k: 'v', id: 'struggle', m: 'tr-type', given: 'struggle', ans: 'struggle', g: 3, ms: 5234, ctx: 'rev' });
    expect(logEntry(vocab({ fk: Number.NaN, in: 'q' as unknown as 't' }))).not.toHaveProperty('fk');
  });

  it('Wendung, Grammatik, Übung, Reparatur', () => {
    expect(logEntry(vocab({ kind: 'chunk', id: 'c1', q: 'take into account', fk: 2210, in: 'd' }))).toMatchObject({ type: 'chunk', fk: 2210, in: 'd' });
    expect(grammarLogEntry({ ...grammar(), fk: 990, in: 'c' })).toMatchObject({ k: 'g', ms: 4321, fk: 990, in: 'c' });
    const d = { t: T0, lang: 'de', type: 'order', q: 'q', given: 'g', ans: 'a', grade: 3, ms: 10, ctx: 'xtra', verdict: 'correct' } as unknown as DrillAnswer;
    expect(drillLogEntry({ ...d, fk: 1500, in: 'c' })).toMatchObject({ fk: 1500, in: 'c' });
    expect(drillLogEntry(d)).not.toHaveProperty('fk');
    expect(repairLogEntry({ t: T0, ok: true, lang: 'de', id: 'r1', q: 'He go home.', given: 'He goes home.', ans: 'He goes home.', g: 3, ms: 3000, ctx: 'rev', fk: 700_123, in: 't' })).toMatchObject({ type: 'repair', fk: 600_000, in: 't' });
    expect(repairLogEntry({ t: T0, ok: true, lang: 'de', id: 'r1', q: 'a', given: 'b', ans: 'c', g: 3, ms: 3000, ctx: 'rev' })).not.toHaveProperty('in');
  });

  it('c1x behält tm und bekommt fk/in dazu', () => {
    const e = grammarLogEntry({ ...grammar({ pts: [1, 1], free: true, c1k: 'ocl' }), fk: 1200, in: 't' });
    expect(e).toMatchObject({ tm: 4321, ms: 4321, fk: 1200, in: 't', free: true });
  });

  it('timingOf: nur gültige Werte', () => {
    expect(timingOf({})).toEqual({});
    expect(timingOf({ fk: 0, in: 'c' })).toEqual({ fk: 0, in: 'c' });
    expect(timingOf({ fk: -1 })).toEqual({});
  });

  it('das Lese-Schema liest Einträge mit und ohne Zeitfelder', () => {
    expect(logSchema.safeParse({ date: '2026-09-20', entries: [logEntry(vocab()), logEntry(vocab({ t: T0 + 1, fk: 1000, in: 'd' })), { t: 3, fk: 1840, in: 't', ms: 5230 }] }).success).toBe(true);
  });
});

describe('Loggröße', () => {
  it('300 Einträge mit allen Feldern bleiben unter LOG_DOC_MAX_BYTES, nichts fällt heraus', () => {
    const added: AnyLogEntry[] = [];
    for (let i = 0; i < LOG_ENTRIES_MAX; i++) {
      const t = T0 + i * 1000;
      if (i % 3 === 0) added.push(logEntry(vocab({ t, id: `word-${i}`, given: 'a reasonably long typed answer', ans: 'a reasonably long typed answer', fk: 600_000, ms: 600_000, in: 'd', dev: 't' })));
      else if (i % 3 === 1) added.push(grammarLogEntry({ ...grammar({ t, pts: [2, 2], free: true, c1k: 'kwt' }), fk: 600_000, in: 't' }));
      else added.push(repairLogEntry({ t, ok: false, lang: 'de', id: `r${i}`, q: 'He go home every day after the meeting.', given: 'He go home every day.', ans: 'He goes home every day after the meeting.', g: 1, ms: 600_000, ctx: 'rev', fk: 600_000, in: 'c' }));
    }
    const out = mergeLogEntries([], added);
    expect(out).toHaveLength(LOG_ENTRIES_MAX);
    const bytes = new TextEncoder().encode(JSON.stringify({ date: '2026-09-20', entries: out })).length;
    expect(bytes).toBeLessThan(LOG_DOC_MAX_BYTES);
    // Zuwachs durch fk/in (schlimmster Fall) gegenüber denselben Einträgen ohne: unter 30 Byte je Eintrag.
    const plain = out.map((e) => ({ ...(e as Record<string, unknown>), fk: undefined, in: undefined }));
    const without = new TextEncoder().encode(JSON.stringify({ date: '2026-09-20', entries: plain })).length;
    expect((bytes - without) / LOG_ENTRIES_MAX).toBeLessThan(30);
  });
});

describe('Nacharbeit: weitere Messwerte im Log', () => {
  it('mx, pl, n, bg, st; ms bleibt roh, sm nur wenn abweichend', () => {
    const e = logEntry(vocab({ ms: 9876, sm: 4321, fk: 1203, in: 'd', mx: 1, pl: 58, n: 2, bg: 1, st: 4 }));
    expect(e).toMatchObject({ ms: 9876, sm: 4321, fk: 1200, in: 'd', mx: 1, pl: 58, n: 2, bg: 1, st: 4 });
    expect(logEntry(vocab({ ms: 4321, sm: 4321 }))).not.toHaveProperty('sm');
    expect(grammarLogEntry({ ...grammar({ ms: 8000 }), sm: 3000, pl: 70, n: 2 })).toMatchObject({ ms: 8000, sm: 3000, pl: 70, n: 2 });
    expect(timingOf({ ms: 100, sm: 100.4 })).toEqual({});
    expect(timingOf({ mx: 2 as unknown as 1, st: 9, pl: Number.NaN })).toEqual({});
  });

  it('das Lese-Schema liest die neuen Felder', () => {
    expect(logSchema.safeParse({ date: '2026-09-20', entries: [logEntry(vocab({ sm: 10, mx: 1, pl: 3, n: 2, bg: 1, st: 0 }))] }).success).toBe(true);
  });

  it('schlimmster Fall: 300 Einträge mit allen Feldern und langen Texten bleiben unter LOG_DOC_MAX_BYTES, nichts fällt heraus', () => {
    const long = 'This is a deliberately long answer that keeps going well past the clip limit so that every text field is as large as it can get. '.repeat(3);
    const worst = { fk: 600_000, in: 'd' as const, mx: 1 as const, sm: 599_990, pl: 9_999, n: 2 as const, bg: 1 as const, st: 5 };
    const added: AnyLogEntry[] = [];
    for (let i = 0; i < LOG_ENTRIES_MAX; i++) {
      const t = T0 + i * 1000;
      if (i % 3 === 0) added.push(logEntry(vocab({ t, id: `word-${i}`, given: long, ans: long, ms: 600_000, dev: 't', ...worst })));
      else if (i % 3 === 1) added.push(grammarLogEntry({ ...grammar({ t, given: long, ms: 600_000, pts: [2, 2], free: true, c1k: 'kwt' }), ...worst }));
      else added.push(repairLogEntry({ t, ok: false, lang: 'de', id: `r${i}`, q: long, given: long, ans: long, g: 1, ms: 600_000, ctx: 'rev', ...worst }));
    }
    const out = mergeLogEntries([], added);
    expect(out).toHaveLength(LOG_ENTRIES_MAX);
    const bytes = new TextEncoder().encode(JSON.stringify({ date: '2026-09-20', entries: out })).length;
    expect(bytes).toBeLessThan(LOG_DOC_MAX_BYTES);
    const keys = ['fk', 'in', 'mx', 'sm', 'pl', 'n', 'bg', 'st'];
    const plain = out.map((e) => Object.fromEntries(Object.entries(e as Record<string, unknown>).filter(([k]) => !keys.includes(k))));
    const without = new TextEncoder().encode(JSON.stringify({ date: '2026-09-20', entries: plain })).length;
    expect((bytes - without) / LOG_ENTRIES_MAX).toBeLessThan(80);
  });
});
