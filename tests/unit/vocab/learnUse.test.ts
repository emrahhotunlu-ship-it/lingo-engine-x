import { describe, expect, it } from 'vitest';
import { createWriter } from '../../../src/data/writer';
import { createMemoryDb } from '../../../src/platform/dev/memoryDb';
import type { WordJudgement } from '../../../src/modules/vocab/prompts/judge';
import { type CheckDict } from '../../../src/modules/vocab/domain/check';
import { available } from '../../../src/modules/vocab/domain/forms';
import { applyAnswer, emptyLex, introduce, type PlanCtx } from '../../../src/modules/vocab/domain/planner';
import { DEFAULT_CFG, type Lex } from '../../../src/modules/vocab/domain/types';
import { readUseDoc } from '../../../src/modules/vocab/data/store';
import type { UseLater } from '../../../src/modules/vocab/data/schemas';
import { type DraftStore, LearnRun, type LearnView, readDrafts, type UseAi, UseFail, type UseQuery, type UseVerdicts } from '../../../src/modules/vocab/ui/learnRun';

// Großpaket A Schritt 5c-2: Steuerung der Anwenden-Karte (ohne React): Schreiben → Prüfen → Urteil → Weiter bucht genau einmal (je Wort eigener
// Zeitpunkt); ohne Claude Selbstvergleich und „Später prüfen lassen“; gemerkte Texte am Rundenanfang nur als Beleg; zweite Prüfung nur milder;
// Fehlerarten; Verlassen im Hintergrund bricht die Prüfung nicht ab.

type Doc = Record<string, unknown>;
const T0 = Date.parse('2026-11-02T18:00:00Z'); // Mo 19:00 Berlin
const D = 86_400_000;
const dict: CheckDict = { isWord: () => false, misspell: new Map(), confusable: new Map(), toUS: (w) => w };
const PROFILE: Doc = { vcfg: { min: 15, ret: 0.9, mod: 1 } };
const SCHEMA: Doc = { vocabModule: { v: 1, t: 1, state: 'done' } };
const PATHS = ['vocab/budget', 'vocab/deadline', 'vocab/scope'];
const DOCS: Record<string, Doc> = {
  'vocab/scope': { word: 'scope', de: 'Umfang, Rahmen', pos: 'noun', ex: 'We need to define the scope of the project.', wx: [{ en: 'The scope is too wide.', de: 'Der Umfang ist zu groß.' }] },
  'vocab/budget': { word: 'budget', de: 'Budget, Etat', pos: 'noun', ex: 'We are still within budget this quarter.', wx: [{ en: 'The budget is tight.', de: 'Das Budget ist knapp.' }] },
  'vocab/deadline': { word: 'deadline', de: 'Frist, Abgabetermin', pos: 'noun', ex: 'We will miss the deadline if we wait.', wx: [{ en: 'The deadline is on Friday.', de: 'Die Frist ist am Freitag.' }] },
};

/** Gelerntes Wort auf Stufe `lv`, Benutzen-Termin in zwei Tagen (Anwenden ersetzt diese Wiederholung). */
function learned(path: string, lv: number): Lex {
  const t = T0 - 30 * D;
  const ctx: PlanCtx = { cfg: DEFAULT_CFG, path, planned: true, load: () => 0, siblings: new Set() };
  let l = introduce(emptyLex('w', 'core', t), t);
  l = applyAnswer(l, { t: t + 60_000, form: 'gap_hint', outcome: 'ok', hint: 0, ms: 9000, fk: 2000, sentence: 'a' }, ctx).lex;
  l = applyAnswer(l, { t: t + 300_000, form: 'gap', outcome: 'ok', hint: 0, ms: 9000, fk: 2000, sentence: 'a' }, ctx).lex;
  return { ...l, lv, step: null, u: { ...l.u, due: T0 + 30 * D }, b: { ...l.b!, due: T0 + 2 * D } };
}

function memStore(): DraftStore & { value: string | null } {
  const s = {
    value: null as string | null,
    get: () => s.value,
    set: (v: string) => {
      s.value = v;
    },
    remove: () => {
      s.value = null;
    },
  };
  return s;
}

const ok = (key: string): WordJudgement => ({ key, v: 'ok', err: null, at: '', why: 'Passt.' });
const verdicts = (words: WordJudgement[]): UseVerdicts => ({ words, extra: null, fixed: 'Fixed text.', fixedUnsure: false, better: 'Better text.' });

type FakeAi = UseAi & { calls: UseQuery[]; answer: (q: UseQuery, signal: AbortSignal) => Promise<UseVerdicts>; on: boolean };

function fakeAi(answer?: FakeAi['answer']): FakeAi {
  const ai: FakeAi = {
    calls: [],
    on: true,
    answer: answer ?? ((q) => Promise.resolve(verdicts(q.m.targets.map((t) => ok(t.key))))),
    ready: () => ai.on,
    check: (q, signal) => {
      ai.calls.push(q);
      return ai.answer(q, signal);
    },
  };
  return ai;
}

function setup(o: { ai?: FakeAi | null; lv?: number; seed?: Record<string, Doc> } = {}) {
  const lv = o.lv ?? 5;
  const docs = PATHS.map((p) => [p, { ...DOCS[p], lex: learned(p, lv) }] as const);
  const h = createMemoryDb({ seed: { ...Object.fromEntries(docs), ...(o.seed ?? {}) } });
  const drafts = memStore();
  let now = T0;
  const ai = o.ai === null ? undefined : (o.ai ?? fakeAi());
  const run = new LearnRun({
    deps: { writer: createWriter(h.db), device: 'phone' },
    dict,
    lang: () => 'de',
    drafts,
    readDay: () => Promise.resolve(null),
    now: () => (now += 1000),
    ...(ai ? { ai } : {}),
    readUse: () => Promise.resolve((h.dump()['vmod/use']) ?? null),
  });
  const start = async () => {
    await run.start({ kind: 'use', docs, profile: PROFILE, schema: SCHEMA });
    if (run.get().k === 'start') run.begin();
  };
  const use = (): Extract<LearnView, { k: 'use' }> => {
    const v = run.get();
    if (v.k !== 'use') throw new Error(`keine Anwenden-Karte: ${v.k}`);
    return v;
  };
  const lexIn = (p: string) => (h.dump()[p] as Doc).lex as Lex;
  const vlog = () => Object.entries(h.dump()).filter(([p]) => /^vlog\/\d/.test(p)).flatMap(([, d]) => Object.values(d.e as Doc).filter(Boolean)) as Doc[];
  const vlogKeys = () => Object.entries(h.dump()).filter(([p]) => /^vlog\/\d/.test(p)).flatMap(([, d]) => Object.entries(d.e as Doc).filter(([, x]) => x).map(([k]) => k));
  const tick = () => new Promise((r) => setTimeout(r, 0));
  return { h, run, drafts, ai, start, use, lexIn, vlog, vlogKeys, tick };
}

describe('LearnRun Anwenden', () => {
  it('gesprochen je Wort: nur Wörter aus diktierten Stücken zählen als gesprochener Beleg', async () => {
    const s = setup();
    await s.start();
    const v = s.use();
    const k0 = v.m.targets[0]!.key;
    s.run.useCheck('We set the budget, the deadline and the scope today.', true, { ms: 40_000, fk: 0 }, [k0]);
    await s.tick();
    expect(s.use().st.s).toBe('judged');
    s.run.next();
    await s.run.settled();
    expect(PATHS.map((p) => s.lexIn(p).ev.s)).toEqual([1, 0, 0]);
    expect(PATHS.map((p) => s.lexIn(p).ev.o)).toEqual([1, 1, 1]);
  });

  it('Schreiben → Prüfen → Urteil → Weiter: je Wort eine Buchung mit eigenem Zeitpunkt, Entwürfe danach leer, Runde zählt', async () => {
    const s = setup();
    await s.start();
    const v = s.use();
    expect(v.m.form).toBe('transfer');
    expect(v.m.targets.map((t) => t.path)).toEqual(PATHS);
    expect(v.st).toEqual({ s: 'write', fail: null });
    // Weiter beim Schreiben geht nicht.
    s.run.next();
    expect(s.use().st.s).toBe('write');
    s.run.useCheck('We set the budget, the deadline and the scope today.', false, { ms: 40_000, fk: 0 });
    expect(s.use().st.s).toBe('checking');
    await s.tick();
    const j = s.use();
    expect(j.st.s).toBe('judged');
    if (j.st.s !== 'judged') return;
    expect(j.st.rows.map((r) => r.fx)).toEqual(['up', 'up', 'up']);
    expect(j.st.rows.every((r) => r.ev === 1 && r.evNew)).toBe(true);
    expect(s.ai!.calls[0]!.first).toBeNull();
    expect(s.vlog()).toHaveLength(0);
    s.run.next();
    expect(readDrafts(s.drafts)).toHaveLength(3);
    await s.run.settled();
    // Je Wort ein eigener Verlaufseintrag (Schlüssel = Zeitpunkt).
    expect(s.vlogKeys()).toHaveLength(3);
    expect(new Set(s.vlogKeys()).size).toBe(3);
    expect(s.drafts.value).toBeNull();
    for (const p of PATHS) expect(s.lexIn(p).ev.o).toBe(1);
    expect(s.run.get()).toMatchObject({ k: 'done', n: 1 });
    // Kein zweites Buchen beim Verlassen.
    await s.run.leave();
    expect(s.vlog()).toHaveLength(3);
  });

  it('ohne Claude: Selbstvergleich, Pflicht zählt, nichts gebucht; „Später prüfen lassen“ merkt den Text in vmod/use', async () => {
    const s = setup({ ai: null });
    await s.start();
    s.run.useCheck('We set the budget today.', false, { ms: 20_000, fk: 0 });
    expect(s.use().st).toEqual({ s: 'self', later: false });
    s.run.useLater(true);
    expect(s.use().st).toEqual({ s: 'self', later: true });
    s.run.next();
    await s.run.settled();
    expect(s.vlog()).toHaveLength(0);
    expect(s.run.get()).toMatchObject({ k: 'done', n: 1 });
    const doc = readUseDoc(s.h.dump()['vmod/use']);
    expect(doc.later).toHaveLength(1);
    expect(doc.later[0]).toMatchObject({ form: 'transfer', text: 'We set the budget today.', w: PATHS.map((p) => [p, 5]) });
  });

  it('Claude nicht nutzbar (noai) → Selbstvergleich; „Erneut versuchen“ behält den Text; Abbruch zurück zum Schreiben', async () => {
    const ai = fakeAi(() => Promise.reject(new UseFail('noai')));
    const s = setup({ ai });
    await s.start();
    s.run.useCheck('Text one.', false, { ms: 1000, fk: 0 });
    await s.tick();
    expect(s.use().st).toEqual({ s: 'self', later: false });

    const s2 = setup({ ai: fakeAi(() => Promise.reject(new UseFail('retry', 'aiRateLimited'))) });
    await s2.start();
    s2.run.useCheck('Text two.', false, { ms: 1000, fk: 0 });
    await s2.tick();
    expect(s2.use()).toMatchObject({ text: 'Text two.', st: { s: 'write', fail: 'aiRateLimited' } });

    const s3 = setup({ ai: fakeAi(() => Promise.reject(new Error('kaputt'))) });
    await s3.start();
    s3.run.useCheck('Text three.', false, { ms: 1000, fk: 0 });
    await s3.tick();
    expect(s3.use().st).toEqual({ s: 'write', fail: 'aiFailed' });

    const s4 = setup({ ai: fakeAi(() => Promise.reject(new UseFail('cancelled'))) });
    await s4.start();
    s4.run.useCheck('Text four.', false, { ms: 1000, fk: 0 });
    await s4.tick();
    expect(s4.use().st).toEqual({ s: 'write', fail: null });
  });

  it('zweite Prüfung („War das auch richtig?“): einmal, nur ein milderes Urteil gilt; bekommt das erste Urteil mit', async () => {
    let n = 0;
    const ai = fakeAi((q) => {
      n += 1;
      const keys = q.m.targets.map((t) => t.key);
      if (n === 1) return Promise.resolve(verdicts([{ key: keys[0]!, v: 'wrong', err: 'sense', at: 'budget', why: 'Falscher Sinn.' }, ok(keys[1]!), { key: keys[2]!, v: 'odd', err: 'colloc', at: 'scope', why: 'Partner.' }]));
      // Zweites Urteil: w1 milder, w2 strenger (bleibt ok), w3 strenger (bleibt odd).
      return Promise.resolve(verdicts([ok(keys[0]!), { key: keys[1]!, v: 'wrong', err: 'sense', at: '', why: 'x' }, { key: keys[2]!, v: 'wrong', err: 'sense', at: '', why: 'x' }]));
    });
    const s = setup({ ai });
    await s.start();
    s.run.useCheck('The budget is the money. The deadline. Make the scope.', false, { ms: 1000, fk: 0 });
    await s.tick();
    const j = s.use();
    if (j.st.s !== 'judged') throw new Error(j.st.s);
    expect(j.st.open).toEqual(['w1', 'w3']);
    s.run.useRecheck();
    expect(s.use().st).toMatchObject({ recheck: 'busy' });
    await s.tick();
    const r = s.use();
    if (r.st.s !== 'judged') throw new Error(r.st.s);
    expect(r.st.recheck).toBe('done');
    expect(r.st.rows.map((x) => x.v)).toEqual(['ok', 'ok', 'odd']);
    expect(ai.calls[1]!.first).not.toBeNull();
    s.run.useRecheck();
    expect(ai.calls).toHaveLength(2);
  });

  it('gemerkter Text kommt am Rundenanfang zur Prüfung: nur Beleg (Termin bleibt), danach aus der Liste; ohne Claude nicht', async () => {
    const it: UseLater = { t: T0 - D, form: 'transfer', frame: 'mail', sit: 2, text: 'We cut the budget and kept the scope.', spoken: false, w: [['vocab/budget', 5], ['vocab/scope', 5]] };
    const seed = { 'vmod/use': { v: 1, life: null, later: [it] } };
    const off = fakeAi();
    off.on = false;
    const s0 = setup({ ai: off, seed });
    await s0.start();
    expect(s0.run.get().k === 'use' && s0.use().later).toBeFalsy();

    const s = setup({ seed });
    await s.start();
    const v = s.use();
    expect(v.later).toEqual(it);
    expect(v.text).toBe(it.text);
    expect(v.m).toMatchObject({ frame: 'mail', sit: 2, evidence: true });
    expect(v.m.targets.map((t) => t.path)).toEqual(['vocab/budget', 'vocab/scope']);
    const due0 = s.lexIn('vocab/budget').b!.due;
    s.run.useCheck('ignoriert', true, { ms: 1000, fk: 0 });
    await s.tick();
    s.run.next();
    await s.run.settled();
    expect(s.lexIn('vocab/budget').b!.due).toBe(due0);
    expect(s.lexIn('vocab/budget').ev.o).toBe(1);
    expect(readUseDoc(s.h.dump()['vmod/use']).later).toHaveLength(0);
    // Danach die normale Anwenden-Karte der Runde, ohne Zähler für die gemerkte.
    expect(s.use()).toMatchObject({ later: null, n: 0 });
    expect(s.ai!.calls[0]!.text).toBe(it.text);
  });

  it('Verwerfen eines gemerkten Textes nimmt ihn aus der Liste, ohne Buchung', async () => {
    const it: UseLater = { t: T0 - D, form: 'transfer', frame: 'call', sit: 0, text: 'Scope text.', spoken: false, w: [['vocab/scope', 5]] };
    const s = setup({ seed: { 'vmod/use': { v: 1, life: null, later: [it] } } });
    await s.start();
    expect(s.use().later).toEqual(it);
    s.run.useDrop();
    await s.run.settled();
    expect(readUseDoc(s.h.dump()['vmod/use']).later).toHaveLength(0);
    expect(s.vlog()).toHaveLength(0);
    expect(s.use().later).toBeNull();
  });

  it('Verlassen: im Hintergrund läuft die Prüfung weiter, beim Bildschirmwechsel bricht sie ab; ein gezeigtes Urteil wird gebucht', async () => {
    const signals: AbortSignal[] = [];
    let release: (() => void) | null = null;
    const ai = fakeAi(
      (q, signal) =>
        new Promise((res, rej) => {
          signals.push(signal);
          signal.addEventListener('abort', () => rej(new UseFail('cancelled')));
          release = () => res(verdicts(q.m.targets.map((t) => ok(t.key))));
        }),
    );
    const s = setup({ ai });
    await s.start();
    s.run.useCheck('Budget, deadline, scope.', false, { ms: 1000, fk: 0 });
    await s.run.leave(false);
    expect(signals[0]!.aborted).toBe(false);
    release!();
    await s.tick();
    expect(s.use().st.s).toBe('judged');
    await s.run.leave();
    expect(s.vlog()).toHaveLength(3);

    const s2 = setup({ ai: fakeAi((_q, signal) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(new UseFail('cancelled'))))) });
    await s2.start();
    s2.run.useCheck('Budget.', false, { ms: 1000, fk: 0 });
    await s2.run.leave();
    await s2.tick();
    expect(s2.use().st).toEqual({ s: 'write', fail: null });
    expect(s2.vlog()).toHaveLength(0);
  });

  it('nur Beleg (keine Termine in 1–3 Tagen): keine Planwirkung, zählt als Extra', async () => {
    // Termine weit weg: die Gruppe ist „nur Beleg“.
    const docs = PATHS.map((p) => [p, { ...DOCS[p], lex: { ...learned(p, 5), b: { ...learned(p, 5).b!, due: T0 + 20 * D } } }] as const);
    const h = createMemoryDb({ seed: Object.fromEntries(docs) });
    const run = new LearnRun({ deps: { writer: createWriter(h.db), device: 'phone' }, dict, lang: () => 'de', drafts: memStore(), readDay: () => Promise.resolve(null), now: () => T0, ai: fakeAi() });
    await run.start({ kind: 'use', docs, profile: PROFILE, schema: SCHEMA });
    if (run.get().k === 'start') run.begin();
    const v = run.get();
    if (v.k !== 'use') throw new Error(v.k);
    expect(v.m.evidence).toBe(true);
    expect(v.task.planned).toBe(false);
    run.useCheck('Budget, deadline, scope.', false, { ms: 1000, fk: 0 });
    await new Promise((r) => setTimeout(r, 0));
    run.next();
    await run.settled();
    for (const p of PATHS) expect(((h.dump()[p] as Doc).lex as Lex).b!.due).toBe(T0 + 20 * D);
    expect(run.get()).toMatchObject({ k: 'done', review: 0, extra: 3 });
  });
});

describe('eigener Satz nur mit Claude', () => {
  it('„own“ ist nur verfügbar, wenn Claude bereit ist', () => {
    const l = learned('vocab/scope', 6);
    expect(available('own', l, { de: true, ai: true })).toBe(true);
    expect(available('own', l, { de: true, ai: false })).toBe(false);
  });
});
