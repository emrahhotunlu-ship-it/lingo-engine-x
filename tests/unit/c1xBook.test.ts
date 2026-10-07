// Buchung der c1x-Antworten (Lernplattform 3.0 §3.4, P13): ok nur bei voller Punktzahl, BKT, `pats`-Hilfe-Bit, Claude-Aufgaben, Fehlersatz.
import { describe, expect, it } from 'vitest';
import examples from '../fixtures/c1x/examples.json';
import pilotKwt from '../../src/content/c1x/src/pilot/kwt.json';
import pilotErr from '../../src/content/c1x/src/pilot/err.json';
import { bookAnswer, c1Grade, type C1Run } from '../../src/domain/c1x/book';
import { c1Item } from '../../src/domain/c1x/schema';
import { scoreC1 } from '../../src/domain/c1x/score';
import { toTask, nOptionsOf } from '../../src/domain/c1x/runtime';
import type { C1Item, C1Response } from '../../src/domain/c1x/types';
import { displayP, p0Of } from '../../src/domain/grammar/bkt';
import { grammarWrite } from '../../src/domain/grammar/write';
import { answerRight } from '../../src/domain/learn/right';
import { grammarLogEntry } from '../../src/domain/progress/logPatch';
import { patsOf, patternState } from '../../src/domain/metrics/pattern';
import { applyUpdate } from '../../src/domain/srs/applyReview';
import { berlin } from './helpers';

const parse = (raw: unknown): C1Item => c1Item.parse(raw);
const fixtures = (examples.items as unknown[]).map(parse);
const pilot = [...pilotKwt.items, ...pilotErr.items].map(parse);
const byId = (id: string): C1Item => [...pilot, ...fixtures].find((i) => i.id === id) as C1Item;
const kwt1 = byId('kwt-9001'); // is said to be
const ocl = byId('ocl-0001');
const mcc = byId('mcc-0001');

const T0 = berlin('2026-10-05', 10);
const run = (over: Partial<C1Run> = {}): C1Run => ({ form: 'typed', inp: 'desk', timeMs: 6000, help: 0, day: '2026-10-05', t: T0, lang: 'de', ctx: 'xtra', ...over });
function book(item: C1Item, response: C1Response, over: Partial<C1Run> = {}, typed = true) {
  const task = toTask(item);
  const score = scoreC1(item, typed ? ({ ...response, typed: true } as C1Response) : response);
  return { task, score, a: bookAnswer(task, score, response, run(over)) };
}
const base = (topic: string) => ({ id: topic, p: 0.5, anchor: 0.5, anchorD: '2026-10-05', last: berlin('2026-10-04', 10), n: 0, c: 0, hist: [], errors: [], seen: [], seenText: [], recent: [] });
const upd = (cur: Record<string, unknown>, a: ReturnType<typeof bookAnswer>) => {
  const w = grammarWrite(cur, a);
  if (w.kind !== 'update') throw new Error(`erwartet update, war ${w.kind}`);
  return { doc: applyUpdate(cur, w.patch), patch: w.patch };
};

describe('ok nur bei voller Punktzahl', () => {
  it('„1 von 2“ ist Fast: Note 2, kein Treffer, hebt BKT nie, wird ein Fehlersatz mit cid und pts', () => {
    const half = book(kwt1, { kind: 'kwt', text: 'is said that it is' });
    expect(half.a).toMatchObject({ verdict: 'near', pts: [1, 2], grade: 2, c1k: 'kwt' });
    expect(answerRight(half.a)).toBe(false);
    const full = book(kwt1, { kind: 'kwt', text: 'is said to be' });
    expect(answerRight(full.a)).toBe(true);
    const cur = base('passive-plus');
    const h = upd(cur, half.a);
    const f = upd(cur, full.a);
    expect(h.patch.c).toBe(0);
    expect(f.patch.c).toBe(1);
    expect(h.patch.recent).toEqual([0]);
    expect(f.patch.p as number).toBeGreaterThan(h.patch.p as number);
    expect(h.patch.p as number).toBeLessThan(0.5);
    expect(h.patch.errors).toEqual([expect.objectContaining({ pat: 'pp.personal', cid: 'kwt-9001', pts: [1, 2], src: 'seed' })]);
    expect(f.patch.errors).toBeUndefined();
  });

  it('„Weiß ich nicht“: ein Fehlersatz mit leerem given, 0 Punkte', () => {
    const d = book(kwt1, { kind: 'kwt', text: '' }, { dontKnow: true });
    expect(d.a).toMatchObject({ dontKnow: true, verdict: 'wrong', pts: [0, 2], grade: 1 });
    const r = upd(base('passive-plus'), d.a);
    expect(r.patch.errors).toEqual([expect.objectContaining({ given: '', cid: 'kwt-9001', pts: [0, 2] })]);
  });

  it('Einspruch „Ich lag richtig“ zählt als volle Punktzahl, Note höchstens nach Zeit', () => {
    const o = book(kwt1, { kind: 'kwt', text: 'is going to be' }, { override: true });
    expect(o.a).toMatchObject({ verdict: 'correct', pts: [2, 2], override: true });
    expect(answerRight(o.a)).toBe(true);
  });

  it('ein zweiter Fehler auf dasselbe Muster aktualisiert cid und pts des einen Eintrags (Box 0, morgen fällig)', () => {
    const k2 = byId('kwt-9002');
    const first = upd(base('passive-plus'), book(kwt1, { kind: 'kwt', text: 'is said that it is' }).a);
    // anderes Muster im selben Thema: zweiter Eintrag; dasselbe Muster: derselbe Eintrag
    const same = parse({ ...kwt1, id: 'kwt-9099', lead: 'People say the firm is planning to relocate its headquarters soon.', before: 'The firm', after: 'planning to relocate its headquarters.' });
    const second = upd(first.doc, book(same, { kind: 'kwt', text: 'is said to' }, { t: T0 + 10 }, true).a);
    const errors = second.patch.errors as Array<Record<string, unknown>>;
    expect(errors.filter((e) => e.pat === 'pp.personal')).toHaveLength(1);
    expect(errors.find((e) => e.pat === 'pp.personal')).toMatchObject({ cid: 'kwt-9099', box: 0 });
    expect(k2.kind).toBe('kwt');
  });

  it('ein fehlerfreier err-Satz erzeugt auch bei Fehlalarm keinen Fehlersatz (nichts zu korrigieren)', () => {
    const free = byId('err-9003');
    expect(free.kind === 'err' && free.bad).toBeNull();
    const a = book(free, { kind: 'err', tap: 1 });
    expect(a.a).toMatchObject({ verdict: 'wrong', pts: [0, 2] });
    const r = upd(base('cond-alt'), a.a);
    expect(r.patch.errors).toBeUndefined();
    expect(r.patch.c).toBe(0);
  });
});

describe('Hilfe-Bit der Muster: Fest nur über getippte Treffer', () => {
  const run3 = (item: C1Item, response: C1Response, typed: boolean, days: string[]) => {
    const topic = item.topic as string;
    let doc: Record<string, unknown> = base(topic);
    for (const [i, day] of days.entries()) {
      const t = berlin(day, 10) + i;
      const task = toTask(item);
      const score = scoreC1(item, typed ? ({ ...response, typed: true } as C1Response) : response);
      const a = bookAnswer(task, score, response, run({ day, t, form: typed ? 'typed' : 'tiles' }));
      doc = upd(doc, a).doc;
    }
    return patsOf(doc)[item.pat];
  };
  const days = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08'];

  it('Auswahl und Bausteine setzen das Hilfe-Bit: nie „Sicher“, nie „Fest“', () => {
    const e = run3(mcc, { kind: 'mcc', pick: 2 }, false, days);
    expect(e).toMatchObject({ n: 4, c: 4, h: 4, r: 0 });
    expect(e?.dd).toEqual([]);
    expect(patternState(e, '2026-12-01')).toBe('learning');
    const tiles = run3(kwt1, { kind: 'kwt', text: 'is said to be' }, false, days);
    expect(tiles).toMatchObject({ h: 4, r: 0 });
    expect(patternState(tiles, '2026-12-01')).toBe('learning');
  });

  it('getippte Treffer an zwei Tagen ergeben „Sicher“', () => {
    const e = run3(ocl, { kind: 'ocl', text: 'had' }, true, days);
    expect(e).toMatchObject({ n: 4, c: 4, h: 0 });
    expect(e?.dd?.length).toBe(2);
    expect(patternState(e, '2026-10-08')).toBe('safe');
  });

  it('zweite Sicht: richtig hebt p nie und setzt das Bit „ohne Hilfe“ nicht', () => {
    const cur = base('c1-emphasis');
    const once = book(ocl, { kind: 'ocl', text: 'had' });
    const twice = bookAnswer(once.task, once.score, { kind: 'ocl', text: 'had' }, run({ again: true }));
    expect(twice.again).toBe(true);
    const a = upd(cur, once.a);
    const b = upd(cur, twice);
    expect(a.patch.p as number).toBeGreaterThan(0.5);
    expect(b.patch.p as number).toBeLessThanOrEqual(0.5);
    expect(patsOf(b.doc)[ocl.pat]).toMatchObject({ n: 1, h: 1, r: 0 });
    expect(patsOf(a.doc)[ocl.pat]).toMatchObject({ n: 1, h: 0, r: 1 });
  });

  it('Hilfe-Deckel wie in LP2: mit Tipp bewegt sich p nur halb so weit', () => {
    const cur = base('c1-emphasis');
    const plain = upd(cur, book(ocl, { kind: 'ocl', text: 'had' }).a);
    const hint = upd(cur, book(ocl, { kind: 'ocl', text: 'had' }, { help: 1 }).a);
    const pNow = displayP(0.5, p0Of('c1-emphasis'), cur.last, T0);
    expect((hint.patch.p as number) - pNow).toBeCloseTo(((plain.patch.p as number) - pNow) / 2, 5);
    expect(patsOf(hint.doc)[ocl.pat]?.h).toBe(1);
  });
});

describe('Claude-Aufgaben buchen nie BKT und nie pats', () => {
  const ai = (over: Record<string, unknown> = {}): C1Item => parse({ ...ocl, id: 'ocl-ai-1a2b3c4d', src: 'ai', ...over });

  it('richtig: nur seen', () => {
    const item = ai();
    const a = book(item, { kind: 'ocl', text: 'had' }).a;
    const cur = base('c1-emphasis');
    const r = upd(cur, a);
    expect(Object.keys(r.patch).sort()).toEqual(['seen']);
    expect(r.patch.seen).toEqual(['c1:ocl-ai-1a2b3c4d']);
    expect(r.doc.p).toBe(0.5);
    expect(patsOf(r.doc)).toEqual({});
  });

  it('falsch: seen und ein Fehlersatz mit src ai, cid und pts; p, n, c, pats unberührt', () => {
    const a = book(ai(), { kind: 'ocl', text: 'did' }).a;
    const r = upd(base('c1-emphasis'), a);
    expect(Object.keys(r.patch).sort()).toEqual(['errors', 'seen']);
    expect(r.patch.errors).toEqual([expect.objectContaining({ src: 'ai', cid: 'ocl-ai-1a2b3c4d', pts: [0, 1], pat: 'em.neg-inversion' })]);
  });
});

describe('Note und Ratewahrscheinlichkeit', () => {
  it('Auswahl und Bausteine geben nie „Leicht“, getipptes schnell schon', () => {
    const fast = { timeMs: 500, firstKeyMs: 500 };
    expect(book(mcc, { kind: 'mcc', pick: 2 }, { form: 'default', ...fast }).a.grade).toBeLessThanOrEqual(3);
    expect(book(kwt1, { kind: 'kwt', text: 'is said to be' }, { form: 'tiles', ...fast, units: 3 }).a.grade).toBeLessThanOrEqual(3);
    expect(book(ocl, { kind: 'ocl', text: 'had' }, { form: 'default', ...fast }).a.grade).toBe(4);
  });

  it('nOptions je Art (mcc 4, pair 6, cnet 4, err = Wortzahl, getippt keine)', () => {
    expect(nOptionsOf(mcc)).toBe(4);
    expect(nOptionsOf(byId('pair-0001'))).toBe(6);
    expect(nOptionsOf(byId('cnet-0001'))).toBe(4);
    expect(nOptionsOf(byId('err-9001'))).toBe(8);
    expect(nOptionsOf(ocl)).toBeUndefined();
    expect(book(mcc, { kind: 'mcc', pick: 2 }, { form: 'default' }, false).a.nOpt).toBe(4);
  });

  it('getippter err-Treffer rät nicht: BKT mit Tipp-Rate, Auswahl mit Rate 1/(Wörter+1)', () => {
    const e = byId('err-9001');
    const typedA = book(e, { kind: 'err', tap: 5, fix: 'hearing' }, { form: 'typed' }).a;
    const chipA = book(e, { kind: 'err', tap: 5, fix: 'hearing' }, { form: 'tap' }, false).a;
    expect(typedA.free).toBe(true);
    expect(chipA.free).toBe(false);
    const cur = base('gerund-inf');
    const typed = upd(cur, typedA).patch.p as number;
    const chip = upd(cur, chipA).patch.p as number;
    expect(typed).toBeGreaterThan(chip);
  });

  it('c1Grade: falsch = 1, fast = 2, „Weiß ich nicht“ = 1', () => {
    const wrong = scoreC1(kwt1, { kind: 'kwt', text: 'is going to' });
    expect(c1Grade(kwt1, wrong, run())).toBe(1);
    const near = scoreC1(kwt1, { kind: 'kwt', text: 'is said that it is' });
    expect(c1Grade(kwt1, near, run())).toBe(2);
    expect(c1Grade(kwt1, near, run({ dontKnow: true }))).toBe(1);
  });
});

describe('Protokoll', () => {
  it('der Eintrag trägt pts, c1k, cid, pat, ai, free; ok = volle Punktzahl', () => {
    const a = book(kwt1, { kind: 'kwt', text: 'is said that it is' }).a;
    const e = grammarLogEntry(a);
    expect(e).toMatchObject({ ok: false, pts: [1, 2], c1k: 'kwt', cid: 'kwt-9001', pat: 'pp.personal', free: true, dev: 'k' });
    expect(e.ai).toBeUndefined();
    const ai = book(parse({ ...ocl, id: 'ocl-ai-1a2b3c4d', src: 'ai' }), { kind: 'ocl', text: 'had' }).a;
    expect(grammarLogEntry(ai)).toMatchObject({ ok: true, ai: true, cid: 'ocl-ai-1a2b3c4d' });
  });

  it('LP2-Antworten bleiben unverändert (keine neuen Felder, near zählt als richtig)', () => {
    expect(answerRight({ dontKnow: false, verdict: 'near' })).toBe(true);
    expect(answerRight({ dontKnow: true, verdict: 'correct' })).toBe(false);
    expect(answerRight({ dontKnow: false, verdict: 'wrong' })).toBe(false);
    expect(answerRight({ dontKnow: false, verdict: 'correct', pts: [1, 2] })).toBe(false);
    expect(answerRight({ dontKnow: false, verdict: 'near', pts: [2, 2] })).toBe(false);
  });
});
