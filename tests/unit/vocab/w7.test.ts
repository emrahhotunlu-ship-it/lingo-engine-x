import { describe, expect, it } from 'vitest';
import { Catalog } from '../../../src/modules/vocab/domain/catalog';
import { type CheckDict } from '../../../src/modules/vocab/domain/check';
import { sentencesOf, tidySentence, usableSentences } from '../../../src/modules/vocab/domain/card';
import { pickSentence } from '../../../src/modules/vocab/domain/forms';
import { dayKey } from '../../../src/domain/date';
import { cardOf, evaluate } from '../../../src/modules/vocab/domain/flow';
import { applyAnswer, emptyLex, introduce, type PlanCtx } from '../../../src/modules/vocab/domain/planner';
import { MAX_PER_ROUND, SessionRun, type Task } from '../../../src/modules/vocab/domain/session';
import { DEFAULT_CFG, type Lex } from '../../../src/modules/vocab/domain/types';

// W7 (Emrah, Live-Kommentare 05.11.2026): „gewähren“ für grant, keine Karte 4–5-mal je Runde, nach „unfair“ nicht wieder, keine Romane und „…“.

const T0 = Date.parse('2026-11-05T12:00:00Z');
const D = 86_400_000;
const ctx = (over: Partial<PlanCtx> = {}): PlanCtx => ({ cfg: DEFAULT_CFG, path: 'vocab/grant', planned: true, load: () => 0, siblings: new Set(), ...over });
function learned(t: number): Lex {
  let l = introduce(emptyLex('w', 'core', t), t);
  l = applyAnswer(l, { t: t + 60_000, form: 'gap_hint', outcome: 'ok', hint: 0, ms: 9000, fk: 2000, sentence: 'a' }, ctx()).lex;
  return applyAnswer(l, { t: t + 300_000, form: 'gap', outcome: 'ok', hint: 0, ms: 9000, fk: 2000, sentence: 'a' }, ctx()).lex;
}

describe('N3 Bedeutung: Wörterbuch-Sinne derselben Wortart zählen', () => {
  const doc = { word: 'grant', de: 'bewilligen, zugestehen', pos: 'verb', ex: 'The board will grant the budget next week.' };
  const task: Task = { path: 'vocab/grant', form: 'meaning', step: 0, intro: false, planned: true, why: 'due', sent: 's', cue: false };
  const base: CheckDict = { isWord: () => false, misspell: new Map(), confusable: new Map(), toUS: (w) => w };
  const senses = () => [
    { pos: 'v', de: 'gewähren, erteilen' },
    { pos: 'n', de: 'Zuschuss, Fördergeld' },
  ];
  const m = cardOf({ task, doc, lex: learned(T0 - 10 * D), teach: {}, nowMs: T0, sbGate: null })!;
  it('„gewähren“ ist richtig, ein Sinn einer anderen Wortart nicht, ohne Wörterbuch wie bisher', () => {
    expect(evaluate(m, 'gewähren', { ...base, senses }).outcome).toBe('ok');
    expect(evaluate(m, 'Zuschuss', { ...base, senses }).outcome).toBe('wrong');
    expect(evaluate(m, 'gewähren', base).outcome).toBe('wrong');
    expect(evaluate(m, 'bewilligen', { ...base, senses }).outcome).toBe('ok');
  });
});

describe('N5 Runde: höchstens dreimal je Wort, „unfair“ sperrt', () => {
  const fresh = (i: number) => ({ path: `vocab/n${i}`, lex: emptyLex('w', 'edge', T0), order: i });
  const filler = (i: number) => {
    const t = T0 - 10 * D;
    const l = learned(t);
    return { path: `vocab/r${i}`, lex: { ...l, u: { ...l.u, due: T0 }, b: { ...l.b!, due: T0 } }, order: 100 + i };
  };
  function play(run: SessionRun, cat: Catalog, wrongAlways: string, unfairAt?: number): Task[] {
    const out: Task[] = [];
    let now = T0;
    for (let g = 0; g < 300; g++) {
      const t = run.next(now);
      if (!t) break;
      out.push(t);
      const it = cat.get(t.path)!;
      if (t.intro) cat.set(t.path, introduce(it.lex, now));
      else {
        const bad = t.path === wrongAlways;
        cat.set(t.path, applyAnswer(it.lex, { t: now, form: t.form, outcome: bad ? 'wrong' : 'ok', hint: 0, ms: 9000, fk: 1000, sentence: null }, ctx({ path: t.path, planned: t.planned })).lex);
      }
      if (unfairAt !== undefined && t.path === wrongAlways && !t.intro && out.filter((x) => x.path === wrongAlways && !x.intro).length === unfairAt) run.block(t.path);
      run.done(t, now);
      now += 25_000;
    }
    return out;
  }
  it('immer falsch: höchstens MAX_PER_ROUND Abfragen (ohne Einführung)', () => {
    const cat = new Catalog([fresh(1), ...Array.from({ length: 12 }, (_, i) => filler(i))]);
    const run = new SessionRun('free', cat, null, T0, { cfg: DEFAULT_CFG, paths: ['vocab/n1', ...Array.from({ length: 12 }, (_, i) => `vocab/r${i}`)] });
    const tasks = play(run, cat, 'vocab/n1');
    const asked = tasks.filter((t) => t.path === 'vocab/n1' && !t.intro).length;
    expect(asked).toBeGreaterThan(0);
    expect(MAX_PER_ROUND).toBe(3);
    expect(asked).toBeLessThanOrEqual(3);
    // Nie dieselbe Abfrage direkt hintereinander.
    expect(tasks.some((t, i) => i > 0 && !t.intro && !tasks[i - 1]!.intro && tasks[i - 1]!.path === t.path)).toBe(false);
  });
  it('nach „unfair“ beim ersten Mal kommt das Wort in dieser Runde nicht mehr', () => {
    const cat = new Catalog([fresh(1), ...Array.from({ length: 12 }, (_, i) => filler(i))]);
    const run = new SessionRun('free', cat, null, T0, { cfg: DEFAULT_CFG, paths: ['vocab/n1', ...Array.from({ length: 12 }, (_, i) => `vocab/r${i}`)] });
    const tasks = play(run, cat, 'vocab/n1', 1);
    expect(tasks.filter((t) => t.path === 'vocab/n1' && !t.intro)).toHaveLength(1);
  });
});

describe('N8/N11 Sätze: kurz und vollständig', () => {
  const long = 'When the vendor finally sent the revised contract after weeks of back and forth, our legal team decided to grant them one more extension because the deadline was unrealistic.';
  it('tidySentence', () => {
    expect(tidySentence('The board will grant the budget.')).toBe(true);
    expect(tidySentence(long)).toBe(false);
    expect(tidySentence('… the board will grant the budget.')).toBe(false);
    expect(tidySentence('The board will grant the budget ...')).toBe(false);
  });
  it('lange Sätze und Ausschnitte nur, wenn sonst nichts da ist', () => {
    const s = (key: string, en: string) => ({ key, en, de: '', src: 'ex' }) as never;
    expect(usableSentences([s('a', long), s('w0', 'They will grant us more time.')], 'grant', false).ok.map((x) => x.sent.key)).toEqual(['w0']);
    expect(usableSentences([s('a', long)], 'grant', false).ok.map((x) => x.sent.key)).toEqual(['a']);
  });
});

describe('N4 (Emrah „1A“): geprüfte Claude-Sätze sofort in den Abfragen, Satz wechselt', () => {
  const doc = {
    word: 'broadly',
    ex: 'Broadly speaking, the rollout went well.',
    sb: [
      { en: 'The team broadly agreed with the new pricing.', src: 'ai', pv: 'word-know@1', t: T0 },
      { en: 'Our clients broadly support the change.', src: 'ai', pv: 'word-know@1', t: T0, bad: 1 },
      { en: 'Other prompts stay gated for broadly four weeks.', src: 'ai', pv: 'other@1', t: T0 },
    ],
  };
  it('word-know ja, gemeldet nein, andere Claude-Sätze erst nach Freigabe', () => {
    const en = sentencesOf(doc, T0, null).map((s) => s.en);
    expect(en).toEqual(['Broadly speaking, the rollout went well.', 'The team broadly agreed with the new pricing.']);
  });
  it('ein gelerntes Wort bekommt nicht immer den Ankersatz', () => {
    const keys = sentencesOf(doc, T0, null).map((s) => s.key);
    let l: Lex = learned(T0 - 20 * D);
    const seen = new Set<string>();
    for (let i = 0; i < 4; i++) {
      const day = dayKey(T0 + i * 3 * D);
      const k = pickSentence(l, keys, day)!;
      seen.add(k);
      l = { ...l, sn: [...l.sn.filter(([x]) => x !== k), [k, day]] };
    }
    expect(seen.size).toBe(2);
  });
});
