import { describe, expect, it } from 'vitest';
import { addDays } from '../../src/domain/date';
import {
  FOCUS_MAX_DAYS,
  focusDay,
  focusDoc,
  focusOpen,
  focusPartner,
  focusPick,
  focusResting,
  focusStep,
  groupOf,
  groupsLeft,
  readFocus,
  stageForms,
  type FocusFact,
  type FocusState,
} from '../../src/domain/grammar/focus';
import { focusOfDay } from '../../src/domain/grammar/focusOfDay';
import { focusShape, refocus, selectFocusRound, warmTopics, type FocusRoundIn } from '../../src/domain/grammar/focusRound';
import { freezeGrammarDay } from '../../src/domain/grammar/path';
import { patternsOf } from '../../src/domain/grammar/patterns';
import { addError } from '../../src/domain/grammar/errors';
import { wholeSentence } from '../../src/domain/grammar/tasks';
import { grammarWrite } from '../../src/domain/grammar/write';
import type { GrammarAnswer, GrammarTask } from '../../src/domain/learn/types';
import { berlin } from './helpers';

// Fokus-Thema (Politur P3, Emrahs Entscheidung E1 „A“ 13.11.2026): eine Runde = ein Thema über mehrere Tage, Stufen Verstehen → Bilden →
// Umformen → Mischen, vorn 1–2 Aufwärm-Aufgaben. Die Daten ähneln Emrahs Stand (leichte Themen sitzen, C1-Themen stehen seit Wochen).

type Doc = Record<string, unknown>;
const TODAY = '2026-11-13';
const NOW = berlin(TODAY, 10);
const DAY = 86_400_000;

const allPats = (topic: string, i = '2026-09-01'): Record<string, unknown> => Object.fromEntries((patternsOf(topic)?.patterns ?? []).map((p) => [p.id, { n: 6, c: 3, last: NOW - 5 * DAY, h: 0, r: 5, k: 5, dd: [], i }]));
const begun = (topic: string, p: number, extra: Doc = {}): Doc => ({ p, n: 30, c: 18, last: NOW - 2 * DAY, due: NOW - DAY, hist: [{ d: '2026-09-01', p: 0.5 }], recent: [1, 1, 1, 1, 1, 1], seen: [], errors: [], pats: allPats(topic), ...extra });

/** Emrahs Stand vom 13.11.: zwei Zeiten-Themen sitzen, die C1-Themen sind schwach. */
function emrah(over: Record<string, Doc> = {}): Map<string, Doc> {
  return new Map<string, Doc>([
    ['pres-perf-cont', begun('pres-perf-cont', 0.96)],
    ['past-simple-perfect', begun('past-simple-perfect', 0.96)],
    ['conditionals', begun('conditionals', 0.55, { recent: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0] })],
    ['c1-participle', begun('c1-participle', 0.46, { recent: [1, 0, 1, 0, 1, 0] })],
    ['modals-deduction', begun('modals-deduction', 0.55)],
    ['passive', begun('passive', 0.62)],
    ['future-perf-cont', begun('future-perf-cont', 0.64)],
    ...Object.entries(over),
  ]);
}

const fact = (over: Partial<FocusFact> = {}): FocusFact => ({ day: TODAY, clean: true, wrong: false, pat: 'cn.second', p: 0.6, stage: 1, ...over });
const run = (cur: FocusState | null, facts: Array<Partial<FocusFact>>): FocusState => facts.reduce<FocusState | null>((st, f) => focusStep(st, fact({ ...(st ? { stage: st.s } : {}), ...f })).next, cur) as FocusState;

describe('Lauf eines Fokus-Themas (focusStep)', () => {
  it('beginnt bei Stufe 1 und steigt nach 3 sauberen Antworten in Folge auf', () => {
    const a = run(null, [{}, {}]);
    expect(a).toMatchObject({ s: 1, k: 2, d0: TODAY, d: TODAY, n: 1 });
    const r = focusStep(a, fact());
    expect(r.move).toBe('up');
    expect(r.next).toMatchObject({ s: 2, k: 0, u: TODAY });
  });

  it('ein Fehler oder eine Antwort mit Hilfe unterbricht die Serie; richtig mit Hilfe zählt nicht als sauber', () => {
    const a = run(null, [{}, {}, { clean: false, wrong: true }]);
    expect(a).toMatchObject({ s: 1, k: 0 });
    const b = run(null, [{}, {}, { clean: false, wrong: false }]);
    expect(b).toMatchObject({ s: 1, k: 2 });
  });

  it('höchstens ein Aufstieg je Lerntag; die Serie trägt über Tage', () => {
    const d1 = run(null, [{}, {}, {}, {}, {}, {}]);
    expect(d1).toMatchObject({ s: 2, k: 3, u: TODAY });
    const d2 = focusStep(d1, fact({ day: addDays(TODAY, 1), stage: 2 }));
    expect(d2.move).toBe('up');
    expect(d2.next).toMatchObject({ s: 3, k: 0, n: 2, d: addDays(TODAY, 1) });
  });

  it('zwei Fehler am selben Muster am selben Tag: eine Stufe leichter (nie unter 1)', () => {
    const s2 = run(null, [{}, {}, {}]);
    const next = addDays(TODAY, 1);
    const one = focusStep(s2, fact({ day: next, stage: 2, clean: false, wrong: true, pat: 'cn.third' }));
    expect(one.move).toBe('none');
    expect(one.next.w).toEqual({ p: 'cn.third', n: 1, d: next });
    const other = focusStep(one.next, fact({ day: next, stage: 2, clean: false, wrong: true, pat: 'cn.first' }));
    expect(other.next.s).toBe(2);
    const two = focusStep(one.next, fact({ day: next, stage: 2, clean: false, wrong: true, pat: 'cn.third' }));
    expect(two.move).toBe('down');
    expect(two.next).toMatchObject({ s: 1, k: 0 });
    const floor = run(null, [{ clean: false, wrong: true }, { clean: false, wrong: true }]);
    expect(floor.s).toBe(1);
  });

  it('„sitzt“ erst mit bestandener Stufe Mischen UND Beherrschung ≥ 0,8', () => {
    let st: FocusState = { v: 1, s: 4, k: 0, d0: addDays(TODAY, -3), d: TODAY, n: 4 };
    st = run(st, [{ p: 0.7 }, { p: 0.74 }]);
    const low = focusStep(st, fact({ stage: 4, p: 0.78 }));
    expect(low.move).toBe('none');
    expect(low.next).toMatchObject({ s: 4, m: 1 });
    expect(low.next.ok).toBeUndefined();
    const done = focusStep(low.next, fact({ stage: 4, p: 0.82 }));
    expect(done.move).toBe('sits');
    expect(done.next.ok).toBe(TODAY);
    // Nach „sitzt“ beginnt ein neuer Lauf wieder bei 1.
    expect(focusStep(done.next, fact({ day: addDays(TODAY, 30) })).next).toMatchObject({ s: 1, k: 1, n: 1 });
  });

  it('Thema mit mehreren Einführungsschritten: „Verstehen“ bleibt, bis jeder Schritt saß', () => {
    const a = run(null, [{ more: true }, { more: true }]);
    const r = focusStep(a, fact({ more: true }));
    expect(r.move).toBe('none');
    expect(r.next).toMatchObject({ s: 1, k: 0, gp: TODAY });
    const d2 = run(r.next, [{ day: addDays(TODAY, 1) }, { day: addDays(TODAY, 1) }]);
    expect(d2.gp).toBeUndefined();
    expect(focusStep(d2, fact({ day: addDays(TODAY, 1) })).move).toBe('up');
  });

  it('Speicherform: fester Schlüsselsatz, Unbelegtes steht als null (update kann keine Schlüssel entfernen); tolerant gelesen', () => {
    const st = run(null, [{}, { clean: false, wrong: true }]);
    const doc = focusDoc(st);
    expect(Object.keys(doc).sort()).toEqual(['d', 'd0', 'gp', 'k', 'm', 'n', 'ok', 's', 'u', 'v', 'w']);
    expect(doc.ok).toBeNull();
    expect(readFocus({ fo: doc })).toEqual(st);
    expect(readFocus({ fo: 'kaputt' })).toBeNull();
    expect(readFocus({ fo: { s: 9, d0: TODAY, d: TODAY } })).toBeNull();
    expect(readFocus({})).toBeNull();
    expect(readFocus({ fo: { ...doc, zusatz: 1, k: 'x' } })).toMatchObject({ s: 1, k: 0 });
  });

  it('Sicherheitsventil: nach vielen Lerntagen ohne „sitzt“ ruht das Thema eine Woche', () => {
    const st: FocusState = { v: 1, s: 2, k: 0, d0: addDays(TODAY, -20), d: addDays(TODAY, -1), n: FOCUS_MAX_DAYS };
    expect(focusResting(st, TODAY)).toBe(true);
    expect(focusResting(st, addDays(TODAY, 7))).toBe(false);
    expect(focusResting({ ...st, n: 3 }, TODAY)).toBe(false);
    expect(focusStep(st, fact({ day: addDays(TODAY, 8), stage: 2 })).next).toMatchObject({ n: 1, s: 2 });
  });
});

describe('Wahl des Fokus-Themas (focusPick)', () => {
  it('nimmt das begonnene Thema mit dem größten Bedarf (Stillstand wiegt schwer), nicht das Kapitel-Thema', () => {
    const p = focusPick({ docs: emrah(), today: TODAY, nowMs: NOW, chapterTopic: 'past-perfect' });
    expect(p).toMatchObject({ topic: 'conditionals', stage: 1, rule: true, fresh: false, reason: 'weak' });
  });

  it('ein laufender Lauf bleibt – auch wenn ein anderes Thema schwächer ist', () => {
    const fo = focusDoc({ v: 1, s: 2, k: 1, d0: addDays(TODAY, -2), d: addDays(TODAY, -1), n: 2 });
    const p = focusPick({ docs: emrah({ passive: begun('passive', 0.62, { fo }) }), today: TODAY, nowMs: NOW });
    expect(p).toMatchObject({ topic: 'passive', stage: 2, rule: false, reason: 'run' });
  });

  it('nach „sitzt“ kommt das nächste schwache Thema; ein ruhendes wird übergangen', () => {
    const ok = focusDoc({ v: 1, s: 4, k: 3, m: 1, d0: addDays(TODAY, -6), d: addDays(TODAY, -1), n: 5, ok: addDays(TODAY, -1) });
    const d = emrah({ conditionals: begun('conditionals', 0.83, { fo: ok }) });
    expect(focusPick({ docs: d, today: TODAY, nowMs: NOW })?.topic).toBe('c1-participle');
    const rest = focusDoc({ v: 1, s: 1, k: 0, d0: addDays(TODAY, -20), d: addDays(TODAY, -1), n: FOCUS_MAX_DAYS });
    const d2 = emrah({ conditionals: begun('conditionals', 0.5, { fo: rest, recent: [0, 0, 0, 0, 0, 0] }) });
    expect(focusPick({ docs: d2, today: TODAY, nowMs: NOW })?.topic).not.toBe('conditionals');
  });

  it('ohne schwaches Thema: das Kapitel-Thema (neu → Einführung), sonst das nächste neue im Pfad; alles sitzt und begonnen → null bzw. neu', () => {
    const strong = new Map<string, Doc>([
      ['pres-simple-cont', begun('pres-simple-cont', 0.9)],
      ['past-simple-perfect', begun('past-simple-perfect', 0.95)],
    ]);
    expect(focusPick({ docs: strong, today: TODAY, nowMs: NOW, chapterTopic: 'past-perfect' })).toMatchObject({ topic: 'past-perfect', fresh: true, rule: true, reason: 'chapter' });
    expect(focusPick({ docs: strong, today: TODAY, nowMs: NOW })).toMatchObject({ topic: 'pres-perf-cont', fresh: true, reason: 'new' });
  });

  it('ist deterministisch', () => {
    const d = emrah();
    expect(focusPick({ docs: d, today: TODAY, nowMs: NOW })).toEqual(focusPick({ docs: new Map(d), today: TODAY, nowMs: NOW }));
  });
});

describe('Muster des Tages und Regel (focusDay)', () => {
  it('begonnenes Thema, alles eingeführt: die zwei schwächsten Muster, Regel nur am ersten Tag', () => {
    const pats = { ...allPats('conditionals'), 'cn.third': { n: 8, c: 2, i: '2026-09-01' }, 'cn.second': { n: 8, c: 3, i: '2026-09-01' } };
    const doc = begun('conditionals', 0.55, { pats });
    expect(focusDay('conditionals', doc, TODAY)).toEqual({ pats: ['cn.third', 'cn.second'], rule: true, more: false });
    const running = { ...doc, fo: focusDoc({ v: 1, s: 1, k: 2, d0: TODAY, d: TODAY, n: 1 }) };
    expect(focusDay('conditionals', running, TODAY).rule).toBe(false);
    expect(focusDay('conditionals', { ...doc, fo: focusDoc({ v: 1, s: 3, k: 0, d0: TODAY, d: TODAY, n: 3 }) }, TODAY)).toEqual({ pats: [], rule: false, more: false });
  });

  it('neues Thema: der erste Einführungsschritt mit Regel; der nächste Schritt erst, wenn der vorige saß (am nächsten Lerntag)', () => {
    const plan = patternsOf('conditionals')!.introPlan;
    expect(focusDay('conditionals', undefined, TODAY)).toEqual({ pats: plan[0], rule: true, more: true });
    const i = { n: 2, c: 2, i: TODAY };
    const day1 = { n: 3, c: 3, p: 0.5, pats: { [plan[0]![0]!]: i, [plan[0]![1]!]: i } };
    const notYet = { ...day1, fo: focusDoc({ v: 1, s: 1, k: 1, d0: TODAY, d: TODAY, n: 1 }) };
    expect(focusDay('conditionals', notYet, addDays(TODAY, 1))).toEqual({ pats: plan[0], rule: false, more: true });
    const passed = { ...day1, fo: focusDoc({ v: 1, s: 1, k: 0, d0: TODAY, d: TODAY, n: 1, u: TODAY, gp: TODAY }) };
    expect(focusDay('conditionals', passed, TODAY)).toEqual({ pats: plan[0], rule: false, more: true });
    expect(focusDay('conditionals', passed, addDays(TODAY, 1))).toEqual({ pats: plan[1], rule: true, more: true });
  });

  it('groupOf und groupsLeft', () => {
    expect(groupOf('conditionals', 'cn.were')).toEqual(['cn.second', 'cn.were']);
    expect(groupsLeft('conditionals', (id) => id.startsWith('cn.'))).toBe(false);
    expect(groupsLeft('conditionals', (id) => id === 'cn.zero')).toBe(true);
  });
});

const input = (over: Partial<FocusRoundIn> = {}): FocusRoundIn => ({ grammarDocs: emrah(), dailyOpen: [], pool: [], seed: 's', nowMs: NOW, size: 4, topic: 'conditionals', stage: 1, pats: ['cn.second', 'cn.third'], rule: false, profile: 'touch', ...over });

describe('Fokus-Runde (selectFocusRound)', () => {
  it('Form der Runde: 1 Aufwärm-Aufgabe (ab 5 Plätzen 2); am Regel-Tag kostet die Regel einen Platz', () => {
    expect(focusShape(4, false)).toEqual({ total: 4, warm: 1 });
    expect(focusShape(5, false)).toEqual({ total: 5, warm: 2 });
    expect(focusShape(7, false)).toEqual({ total: 7, warm: 2 });
    expect(focusShape(4, true)).toEqual({ total: 3, warm: 0 });
    expect(focusShape(5, true)).toEqual({ total: 4, warm: 1 });
    expect(focusShape(3, true)).toEqual({ total: 3, warm: 0 });
  });

  it('5 Minuten (4 Plätze): 1 Aufwärmen aus einem früheren Thema, dann 3 Fokus-Aufgaben nur zum Fokus-Thema', () => {
    for (const seed of ['a', 'b', 'c', 'd']) {
      const r = selectFocusRound(input({ seed }));
      expect(r.warm).toBe(1);
      expect(r.tasks).toHaveLength(4);
      expect(r.tasks[0]).toMatchObject({ warm: true });
      expect(r.tasks[0]!.topic).not.toBe('conditionals');
      for (const t of r.tasks.slice(1)) {
        expect(t).toMatchObject({ topic: 'conditionals', fo: 1, slot: 'focus' });
        expect(['mc', 'meaning', 'gap']).toContain(t.type);
        expect(['cn.second', 'cn.third']).toContain(t.pat);
      }
      expect(new Set(r.tasks.map((t) => t.key)).size).toBe(4);
    }
  });

  it('Stufen: Bilden = Lücken und höchstens ein Fehler finden; Umformen = Fehler finden und Umformung, die erste mit Bausteinen', () => {
    const b = selectFocusRound(input({ stage: 2 })).tasks.filter((t) => t.fo);
    expect(b.every((t) => t.type === 'gap' || t.type === 'find')).toBe(true);
    expect(b.filter((t) => t.type === 'find').length).toBeLessThanOrEqual(1);
    const u = selectFocusRound(input({ stage: 3, pats: [] })).tasks.filter((t) => t.fo);
    expect(u.map((t) => t.type)).toEqual(['find', 'kwt', 'find']);
    const kwt = u.find((t) => t.type === 'kwt')!;
    expect(kwt).toMatchObject({ ease: 'tiles', fo: 3, topic: 'conditionals' });
    expect(kwt.c1?.kind).toBe('kwt');
    const six = selectFocusRound(input({ stage: 3, pats: [], size: 6 })).tasks.filter((t) => t.type === 'kwt');
    expect(six.filter((t) => t.ease === 'tiles')).toHaveLength(1);
  });

  it('Mischen: der Verwechslungs-Partner aus derselben Familie ist dabei, zählt aber nicht für den Lauf', () => {
    const d = emrah({ 'mixed-cond': begun('mixed-cond', 0.75) });
    expect(focusPartner('conditionals', d, NOW)).toBe('mixed-cond');
    const r = selectFocusRound(input({ grammarDocs: d, stage: 4, pats: [] }));
    const rest = r.tasks.slice(r.warm);
    expect(rest.map((t) => t.topic)).toEqual(['conditionals', 'mixed-cond', 'conditionals']);
    expect(rest[1]!.fo).toBeUndefined();
    expect(rest[1]!.slot).toBe('family');
    expect(focusPartner('c1-participle', d, NOW)).toBeNull();
  });

  it('Handy: nie ein ganzer Satz; Laptop darf in Umformen ganze Sätze', () => {
    for (const stage of [1, 2, 3, 4] as const) for (const t of selectFocusRound(input({ stage, pats: [] })).tasks) expect(wholeSentence(t), t.prompt).toBe(false);
    expect(stageForms(3, 'keys').flat()).toContain('correct');
    expect(stageForms(3, 'touch').flat()).not.toContain('correct');
  });

  it('Aufwärmen: fällige frühere Themen zuerst, eigene Fehlersätze höchstens 2 und abwechselnd', () => {
    expect(warmTopics(emrah(), NOW, 'conditionals', 2)).toHaveLength(2);
    expect(warmTopics(emrah(), NOW, 'conditionals', 9)).not.toContain('conditionals');
    let errors: readonly Record<string, unknown>[] = [];
    for (let k = 0; k < 4; k++) errors = addError(errors, { q: `If I would have time ${k}, I would help.`, given: 'would have', ans: `If I had time ${k}, I would help.`, t: NOW - 4 * DAY - k, src: 'review' });
    const d = emrah({ passive: begun('passive', 0.62, { errors }) });
    const errFirst = selectFocusRound(input({ grammarDocs: d, size: 5, warmFirst: 'error' }));
    expect(errFirst.warm).toBe(2);
    expect(errFirst.tasks.slice(0, 2).map((t) => t.errorT !== null)).toEqual([true, false]);
    const revFirst = selectFocusRound(input({ grammarDocs: d, size: 5, warmFirst: 'review' }));
    expect(revFirst.tasks.slice(0, 2).map((t) => t.errorT !== null)).toEqual([false, true]);
    expect(revFirst.tasks.filter((t) => t.errorT !== null).length).toBeLessThanOrEqual(2);
    for (const t of errFirst.tasks.slice(2)) expect(t.errorT).toBeNull();
  });

  it('Regel-Tag bei 4 Plätzen: kein Aufwärmen, 3 Fokus-Aufgaben', () => {
    const r = selectFocusRound(input({ rule: true }));
    expect(r.warm).toBe(0);
    expect(r.tasks).toHaveLength(3);
    expect(r.tasks.every((t) => t.fo === 1)).toBe(true);
  });

  it('Stufenwechsel mitten in der Runde: die offenen Fokus-Aufgaben werden in der neuen Stufe neu gewählt, die Zahl bleibt', () => {
    const r = selectFocusRound(input({ size: 5 }));
    const out = refocus(input({ size: 5, stage: 2 }), r.tasks, 3, r.tasks.length);
    expect(out).toHaveLength(r.tasks.length);
    expect(out.slice(0, 3)).toEqual(r.tasks.slice(0, 3));
    for (const t of out.slice(3)) expect(t).toMatchObject({ topic: 'conditionals', fo: 2 });
    expect(new Set(out.map((t) => t.key)).size).toBe(out.length);
  });
});

describe('Speichern (grammarWrite) und Tagesplan', () => {
  const task = (over: Partial<GrammarTask> = {}): GrammarTask => ({ key: 'k1', topic: 'conditionals', type: 'gap', prompt: 'If I ___ (have) time, I would help.', answer: 'had', accepted: [], options: null, hint: null, expl: { de: null, en: null }, src: 'seed', ref: null, errorT: null, pat: 'cn.second', fo: 1, ...over });
  const answer = (t: number, over: Partial<GrammarAnswer> = {}): GrammarAnswer => ({ kind: 'g', t, day: TODAY, lang: 'de', ctx: 'duty', task: task(), given: 'had', dontKnow: false, verdict: 'correct', grade: 3, ms: 9000, help: { level: 0 }, judged: 'local', ...over });

  it('nur Fokus-Aufgaben schreiben `fo`; drei saubere Antworten heben die Stufe; alte Felder bleiben unberührt', () => {
    let doc: Doc = begun('conditionals', 0.55);
    const plain = grammarWrite(doc, answer(NOW, { task: task({ fo: undefined }) }));
    expect(plain.kind === 'update' && 'fo' in plain.patch).toBe(false);
    for (let k = 1; k <= 3; k++) {
      const w = grammarWrite(doc, answer(NOW + k, { task: task({ key: `k${k}` }) }));
      if (w.kind !== 'update') throw new Error('update erwartet');
      expect(Object.keys(w.patch)).toContain('fo');
      doc = { ...doc, ...w.patch };
    }
    expect(readFocus(doc)).toMatchObject({ s: 2, k: 0, u: TODAY, d0: TODAY });
    expect(doc.n).toBe(33);
    expect(Array.isArray(doc.hist)).toBe(true);
  });

  it('Stufe „Verstehen“ führt mit der ersten Antwort den ganzen Einführungsschritt ein', () => {
    const w = grammarWrite(undefined, answer(NOW, { task: task({ pat: 'cn.zero' }) }));
    if (w.kind !== 'create') throw new Error('create erwartet');
    const pats = w.doc.pats as Record<string, { i?: string }>;
    expect(pats['cn.zero']?.i).toBe(TODAY);
    expect(pats['cn.first']?.i).toBe(TODAY);
    expect(pats['cn.second']).toBeUndefined();
    expect(focusOpen(readFocus(w.doc))).toBe(true);
  });

  it('freezeGrammarDay: das Fokus-Thema steht vorn (Marke `fo`), dahinter höchstens 2 Aufwärm-Themen; kein neues Thema → keine Einführung', () => {
    const { gt } = freezeGrammarDay({ docs: emrah(), today: TODAY, nowMs: NOW, introPlanOf: (t) => patternsOf(t)?.introPlan ?? null, seed: TODAY });
    expect(gt.fo).toBe(1);
    expect(gt.topics[0]).toBe('conditionals');
    expect(gt.topics.length).toBeLessThanOrEqual(3);
    expect(new Set(gt.topics).size).toBe(gt.topics.length);
    expect(gt.intro).toBeNull();
    expect(gt.pats).toEqual([]);
    expect(gt.ch).toBeUndefined();
  });

  it('focusOfDay (für Anwenden): Thema und Muster des heutigen Schritts und ein sicheres früheres Muster aus einem anderen Thema', () => {
    const safe = { n: 9, c: 9, last: NOW - 3 * DAY, h: 0, r: 31, k: 5, dd: [addDays(TODAY, -9), addDays(TODAY, -3)], s: addDays(TODAY, -9), i: '2026-09-01' };
    const d = emrah({ 'pres-perf-cont': begun('pres-perf-cont', 0.96, { pats: { ...allPats('pres-perf-cont'), [patternsOf('pres-perf-cont')!.patterns[0]!.id]: safe } }) });
    const { gt } = freezeGrammarDay({ docs: d, today: TODAY, nowMs: NOW, introPlanOf: () => null, seed: TODAY });
    const f = focusOfDay({ docs: d, today: TODAY, nowMs: NOW, gt });
    expect(f.topic).toBe('conditionals');
    expect(f.stage).toBe(1);
    expect(f.pattern?.topic).toBe('conditionals');
    expect(f.pattern?.form.de).toBeTruthy();
    expect(f.safe).toMatchObject({ topic: 'pres-perf-cont', id: patternsOf('pres-perf-cont')!.patterns[0]!.id });
    expect(focusOfDay({ docs: d, today: TODAY, nowMs: NOW, gt })).toEqual(f);
    expect(focusOfDay({ docs: new Map(), today: TODAY, nowMs: NOW }).safe).toBeNull();
  });
});
