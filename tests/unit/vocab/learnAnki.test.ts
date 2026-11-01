import { describe, expect, it } from 'vitest';
import { createWriter } from '../../../src/data/writer';
import { createMemoryDb } from '../../../src/platform/dev/memoryDb';
import { type CheckDict } from '../../../src/modules/vocab/domain/check';
import { applyAnswer, emptyLex, introduce, FLAG, type PlanCtx } from '../../../src/modules/vocab/domain/planner';
import { DEFAULT_CFG, type Lex } from '../../../src/modules/vocab/domain/types';
import { type DraftStore, LearnRun } from '../../../src/modules/vocab/ui/learnRun';

// Großpaket A S6b-3: Anki-Modus im Wörter-Modul (Bild s2-13, plan.md F3): nur Verstehen wird aufgedeckt und selbst bewertet; Benutzen bleibt unberührt.

type Doc = Record<string, unknown>;
const T0 = Date.parse('2026-11-02T18:00:00Z');
const D = 86_400_000;
const dict: CheckDict = { isWord: () => false, misspell: new Map(), confusable: new Map(), toUS: (w) => w };
const ctx = (): PlanCtx => ({ cfg: DEFAULT_CFG, path: 'vocab/scope', planned: true, load: () => 0, siblings: new Set() });
const base: Doc = { word: 'scope', de: 'Umfang, Rahmen', pos: 'noun', ex: 'We need to define the scope of the project.', wx: [{ en: 'The scope is too wide.', de: 'Der Umfang ist zu groß.' }] };
const SCHEMA: Doc = { vocabModule: { v: 1, t: 1, state: 'done' } };

function uDue(): Lex {
  const t = T0 - 10 * D;
  let l = introduce(emptyLex('w', 'core', t), t);
  l = applyAnswer(l, { t: t + 60_000, form: 'gap_hint', outcome: 'ok', hint: 0, ms: 9000, fk: 2000, sentence: 'a' }, ctx()).lex;
  l = applyAnswer(l, { t: t + 300_000, form: 'gap', outcome: 'ok', hint: 0, ms: 9000, fk: 2000, sentence: 'a' }, ctx()).lex;
  l.b!.due = T0 + 20 * D;
  l.u.due = T0 - D;
  return l;
}

const store = (): DraftStore => {
  let v: string | null = null;
  return { get: () => v, set: (x) => void (v = x), remove: () => void (v = null) };
};

function setup(profile: Doc) {
  const lex = uDue();
  const docOf = { ...base, lex };
  const h = createMemoryDb({ seed: { 'vocab/scope': docOf } });
  let now = T0;
  const run = new LearnRun({ deps: { writer: createWriter(h.db), device: 'phone' }, dict, lang: () => 'de', drafts: store(), readDay: () => Promise.resolve(null), now: () => (now += 1000) });
  const start = () => run.start({ kind: 'free', docs: [['vocab/scope', docOf]], profile, schema: SCHEMA, paths: ['vocab/scope'] });
  const lexIn = () => (h.dump()['vocab/scope'] as Doc).lex as Lex;
  const entries = () =>
    Object.entries(h.dump())
      .filter(([p]) => /^vlog\/\d/.test(p))
      .flatMap(([, d]) => Object.values(d.e as Doc).filter(Boolean));
  return { run, start, lexIn, entries, before: lex };
}

describe('Anki-Modus (S6b-3)', () => {
  it('aus: Verstehen wird wie bisher getippt bzw. abgefragt, keine Aufdeck-Karte', async () => {
    const s = setup({ vcfg: { min: 15, ret: 0.9, mod: 1 } });
    await s.start();
    const v = s.run.get();
    expect(v.k).toBe('card');
    if (v.k !== 'card') return;
    expect(v.card.mode).not.toBe('flip');
    expect(s.run.listenFirst()).toBe(true);
  });

  it('an: Aufdecken zeigt vier Noten mit Termin; „Gut“ bucht nur Verstehen (dayU), Benutzen bleibt, Verlauf mit Anki-Marke', async () => {
    const s = setup({ vcfg: { min: 15, ret: 0.9, mod: 1, anki: 1, pre: 0 } });
    await s.start();
    expect(s.run.listenFirst()).toBe(false);
    const v = s.run.get();
    expect(v.k).toBe('card');
    if (v.k !== 'card') return;
    expect(v.card.mode).toBe('flip');
    expect(v.card.form).toBe('flip');
    // Vor dem Aufdecken keine Noten; „Gut“ vor dem Aufdecken bucht nichts.
    expect(v.flip ?? null).toBeNull();
    s.run.flipGrade(3);
    expect(s.run.get().k).toBe('card');
    s.run.flipOpen({ ms: 4000, fk: 4000 });
    const o = s.run.get();
    if (o.k !== 'card' || !o.flip) throw new Error('keine Rückseite');
    expect(o.flip.opts.map((x) => x.g)).toEqual([1, 2, 3, 4]);
    const good = o.flip.opts.find((x) => x.g === 3)!.when;
    const easy = o.flip.opts.find((x) => x.g === 4)!.when;
    expect(good.k).toBe('day');
    expect(easy.k).toBe('day');
    if (good.k === 'day' && easy.k === 'day') expect(easy.day >= good.day).toBe(true);
    // Zweites Aufdecken ändert nichts (eingefrorene Zeit).
    s.run.flipOpen({ ms: 99_000, fk: 99_000 });
    expect(s.run.get()).toBe(o);
    s.run.flipGrade(3);
    await s.run.settled();
    const after = s.lexIn();
    expect(after.u.due).toBeGreaterThan(T0);
    expect(after.b).toEqual(s.before.b);
    expect(after.dayU).toBeTruthy();
    const e = s.entries();
    expect(e).toHaveLength(1);
    // Verlaufseintrag (Tupel): Spur u = 0, Form „flip“, Kennzeichen zuletzt.
    const row = e[0] as unknown[];
    expect(row[2]).toBe(0);
    expect(row[3]).toBe('flip');
    expect((Number(row[row.length - 1]) & FLAG.anki) !== 0).toBe(true);
  });

  it('„Nochmal“ zählt als nicht gewusst: Verstehen fällt zurück, Benutzen bleibt', async () => {
    const s = setup({ vcfg: { min: 15, ret: 0.9, mod: 1, anki: 1 } });
    await s.start();
    s.run.flipOpen({ ms: 4000, fk: 4000 });
    s.run.flipGrade(1);
    await s.run.settled();
    const after = s.lexIn();
    expect(after.b).toEqual(s.before.b);
    expect(after.u.s).toBeLessThanOrEqual(s.before.u.s);
  });
});
