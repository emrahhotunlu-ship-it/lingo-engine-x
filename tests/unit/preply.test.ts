import { describe, expect, it } from 'vitest';
import { createActor, fromPromise, waitFor } from 'xstate';
import { validateDoc } from '../../src/data/validate';
import { TOPICS } from '../../src/domain/content';
import { grammarErrorsOp, planApply, poolOp, radarOp, wordState, type GrammarErr, type PoolItem, type RadarEvent } from '../../src/domain/preply/apply';
import { openPlan, preplyList, readImport, readPlan } from '../../src/domain/preply/docs';
import { heldOp } from '../../src/domain/preply/held';
import { profilePatch, type RoundEnd } from '../../src/domain/progress/profilePatch';
import { newVocabDoc } from '../../src/domain/srs/newCard';
import { importMachine } from '../../src/features/preply/importMachine';
import type { ApplyOutcome } from '../../src/features/preply/actions';
import { loadSeed, type Doc } from './helpers';

const seed = loadSeed();
const topicIds = new Set(TOPICS.map((t) => t.id));
const now = Date.parse('2026-09-26T19:00:00+02:00');

const piNew = readImport('pi1790000000000', {
  kind: 'import',
  t: 1790000000000,
  lang: 'de',
  title: 'Stunde',
  summary: 'Kurz',
  corrections: [
    { wrong: 'It depends of the budget.', right: 'It depends on the budget.', topic: 'prepositions', why: 'on' },
    { wrong: 'I am agree.', right: 'I agree.', topic: 'other', why: 'Verb' },
  ],
  tasks: ['It depends ___ the budget.'],
  items: [{ type: 'gap', topic: 'prepositions', prompt: 'It depends ___ the budget.', answer: 'on', accepted: ['on'], options: [], hint_de: '', explanation_de: 'd', explanation_en: 'e' }],
  words: [
    { en: 'would rather', de: 'lieber wollen', pos: 'phrase', ex: 'I would rather start with a small pilot.', fromLesson: true },
    { en: 'bottleneck', de: 'Engpass', pos: 'noun', ex: 'The approval process is our biggest bottleneck.', fromLesson: true },
    { en: 'to leverage', de: 'nutzen', pos: 'verb', ex: 'We should use our network.', fromLesson: false },
  ],
  homework: ['Fünf Sätze'],
  applied: false,
  appliedT: 0,
});
const vocabIds = new Set(Object.keys(seed).filter((k) => k.startsWith('vocab/')).map((k) => k.slice(6)));

describe('Preply-Dokumente lesen', () => {
  it('Seed-Altformen: pi mit tasks als Strings, pp gehalten; Schemas gültig', () => {
    expect(validateDoc('preply/pi1789668000000', seed['preply/pi1789668000000']).ok).toBe(true);
    expect(validateDoc('preply/pp1789581600000', seed['preply/pp1789581600000']).ok).toBe(true);
    const pi = readImport('pi1789668000000', seed['preply/pi1789668000000']!);
    expect(pi.tasks).toEqual(['Write five sentences with "would rather".']);
    expect(pi.items).toEqual([]);
    expect(pi.applied).toBe(true);
    expect(pi.t).toBe(1789668000000);
    const pp = readPlan('pp1789581600000', seed['preply/pp1789581600000']!);
    expect(pp.done).toBe(true);
    const list = preplyList(new Map(Object.entries(seed).filter(([k]) => k.startsWith('preply/')).map(([k, v]) => [k.slice(7), v])));
    expect(list[0]!.id).toBe('pi1789668000000');
    expect(openPlan(list)).toBeNull();
  });

  it('Neuform mit allen neuen Feldern ist gültig', () => {
    const doc: Doc = { kind: 'import', t: 1, lang: 'de', pv: 'preply-import@1', items: [{ type: 'gap', prompt: 'x ___', answer: 'y' }], hwDone: { '0': '2026-09-26' }, sel: { c: [0] }, res: { c: 1 }, applied: true, appliedT: 2 };
    expect(validateDoc('preply/pi1', doc).ok).toBe(true);
    expect(validateDoc('preply/pp1', { t: 1, ctx: { kind: 'held' }, heldDay: '2026-09-26', heldMin: 50, done: true, doneT: 1, watch: [], say: [] }).ok).toBe(true);
  });
});

describe('Übernahme planen (planApply)', () => {
  const sel = { c: [0, 1], t: [0], w: [0, 1, 2] };

  it('no_sentence, exists, Themen gebündelt, unbekanntes Thema nur Radar, feste Kennungen', () => {
    const plan = planApply(piNew, sel, { now, today: '2026-09-26', vocabIds, topicIds });
    expect(plan.vocab.map((v) => v.path)).toEqual(['vocab/would-rather']);
    expect(plan.skipped).toEqual(
      expect.arrayContaining([
        { group: 'w', i: 1, reason: 'exists' },
        { group: 'w', i: 2, reason: 'no_sentence' },
      ]),
    );
    expect(plan.grammar).toHaveLength(1);
    expect(plan.grammar[0]!.path).toBe('grammar/prepositions');
    expect(plan.grammar[0]!.add[0]).toMatchObject({ box: 0, src: 'preply', t: 1790000000000, due: now + 86_400_000, done: false });
    expect(plan.radar.map((r) => r.c)).toEqual(['prep', 'wordchoice']);
    expect(plan.pool[0]).toMatchObject({ id: 'pi1790000000000-t0', src: 'preply', options: null });
    expect(plan.vocab[0]!.made.doc).toMatchObject({ src: 'preply', origin: { kind: 'preply', ref: 'preply/pi1790000000000' } });
    expect(wordState(piNew, piNew.words[2]!, vocabIds)).toBe('invalid');
    expect(wordState(piNew, piNew.words[1]!, vocabIds)).toBe('exists');
  });

  it('zweimal angewendet ändert nichts (Grammatik, Radar, Pool)', () => {
    const plan = planApply(piNew, sel, { now, today: '2026-09-26', vocabIds, topicIds });
    const g = grammarErrorsOp(undefined, plan.grammar[0]!.add, { id: 'prepositions' });
    const gDoc = 'set' in g.op! ? g.op.set : {};
    expect(grammarErrorsOp(gDoc, plan.grammar[0]!.add, {}).op).toBeNull();
    const r = radarOp(undefined, plan.radar);
    const rDoc = r && 'set' in r ? r.set : {};
    expect(radarOp(rDoc, plan.radar)).toBeNull();
    const p = poolOp(undefined, plan.pool, now);
    const pDoc = p.op && 'set' in p.op ? p.op.set : {};
    expect(poolOp(pDoc, plan.pool, now).op).toBeNull();
  });

  it('Grammatik-Deckel 10: erst erledigte, dann älteste offene; ersetzt wird gezählt', () => {
    const errs = Array.from({ length: 9 }, (_, i) => ({ q: `q${i}`, given: `g${i}`, ans: `a${i}`, t: i, box: 1, due: 0, done: i === 3, last: 0 }));
    const add: GrammarErr[] = [0, 1, 2].map((i) => ({ q: `n${i}`, given: `n${i}`, ans: `m${i}`, t: 100 + i, src: 'preply', box: 0, due: 0, done: false, last: 0 }));
    const r = grammarErrorsOp({ errors: errs }, add, {});
    const list = (r.op && 'update' in r.op ? r.op.update.errors : []) as Array<{ t: number }>;
    expect(list).toHaveLength(10);
    expect(list.some((e) => e.t === 3)).toBe(false);
    expect(list.some((e) => e.t === 0)).toBe(false);
    expect(r.replaced).toBe(1);
    expect(list.slice(-3).map((e) => e.t)).toEqual([100, 101, 102]);
  });

  it('Radar ≤ 400, neueste vorn; Pool 88 + 5 → 2 rein, 3 abgewiesen (kein Verdrängen)', () => {
    const events = Array.from({ length: 400 }, (_, i) => ({ c: 'x', s: 'g', t: i, q: `q${i}`, g: 'g', a: 'a' }));
    const add: RadarEvent[] = [{ c: 'y', s: 'g', t: 1000, q: 'neu', g: 'g', a: 'a' }];
    const r = radarOp({ events }, add);
    const next = (r && 'update' in r ? r.update.events : []) as Array<{ t: number }>;
    expect(next).toHaveLength(400);
    expect(next[0]!.t).toBe(1000);
    const items = Array.from({ length: 88 }, (_, i) => ({ id: `x${i}`, prompt: 'p' }));
    const more: PoolItem[] = Array.from({ length: 5 }, (_, i) => ({ id: `pi1-t${i}`, src: 'preply', prompt: 'p' }));
    const p = poolOp({ items }, more, now);
    expect(p.added).toBe(2);
    expect(p.refused).toBe(3);
    expect(p.op && 'update' in p.op ? (p.op.update.items as unknown[]).length : 0).toBe(90);
  });
});

describe('„Stunde gehalten" (held)', () => {
  const profile = seed['app/profile']!;

  it('Profil-Zähler (Sammel-Warteschlange, act preply): +1 und +Minuten, lxSeq verhindert Doppelzählung, keine Serienfelder', () => {
    const r = (minutes: number): RoundEnd => ({ day: '2026-09-26', act: 'preply', partial: false, n: 1, right: 1, activeMs: minutes * 60_000 });
    const p = profilePatch(profile, [], [r(50)], { deviceId: 'dev1', seq: 5 });
    expect(p).toMatchObject({ act: { '2026-09-26': { preply: 1 } }, minutes: { '2026-09-26': 50 }, lxSeq: { dev1: 5 } });
    expect(p).not.toHaveProperty('days');
    expect(p).not.toHaveProperty('xpDays');
    expect(p).not.toHaveProperty('xp');
    expect(p).not.toHaveProperty('pflicht');
    const after = { ...profile, lxSeq: { dev1: 5 } };
    expect(profilePatch(after, [], [r(50)], { deviceId: 'dev1', seq: 5 })).toBeNull();
    expect(profilePatch({ days: 'kaputt' }, [], [r(50)], { deviceId: 'dev1', seq: 6 })).toBeNull();
    expect(profilePatch(profile, [], [r(500)], { deviceId: null, seq: 1 })?.minutes).toEqual({ '2026-09-26': 120 });
  });

  it('heldOp: bereits gehalten → nichts', () => {
    expect(heldOp({ done: true }, { day: '2026-09-26', minutes: 50, now })).toBeNull();
    expect(heldOp({ done: false }, { day: '2026-09-26', minutes: 50, now })).toEqual({ update: { done: true, doneT: now, heldDay: '2026-09-26', heldMin: 50 } });
  });
});

describe('Neue Karte aus Preply/Übersetzer', () => {
  it('src und origin.kind der Phase 5', () => {
    const made = newVocabDoc({ word: 'would rather', de: 'lieber', ex: 'I would rather wait.', src: 'translate', origin: { v: 1, kind: 'translate', t: 1 }, today: '2026-09-26' });
    expect(made?.doc).toMatchObject({ src: 'translate', origin: { kind: 'translate' }, ex: 'I [would rather] wait.' });
  });
});

describe('Ablauf Import (importMachine)', () => {
  const outcome = (ok: boolean): ApplyOutcome => ({ ok, failed: ok ? [] : ['pool'], res: { c: 1, t: 1, w: 1, skipped: 0, poolFull: 0, replaced: 0 }, plan: { vocab: [], grammar: [], radar: [], pool: [], skipped: [] } });

  it('Übergänge: editing → analyzing → review → applying → partial → RETRY → applied', async () => {
    let applyCalls = 0;
    const m = importMachine.provide({
      actors: {
        analyze: fromPromise(() => Promise.resolve({ pi: piNew, sel: { c: [0], t: [0], w: [0] } })),
        apply: fromPromise(() => {
          applyCalls += 1;
          return Promise.resolve(outcome(applyCalls > 1));
        }),
      },
    });
    const a = createActor(m, { input: { raw: '' } }).start();
    a.send({ type: 'ANALYZE' });
    expect(a.getSnapshot().value).toBe('editing');
    a.send({ type: 'EDIT', raw: 'Teacher: depend on' });
    a.send({ type: 'ANALYZE' });
    await waitFor(a, (s) => s.matches('review'));
    a.send({ type: 'TOGGLE', group: 'w', i: 0 });
    expect(a.getSnapshot().context.sel.w).toEqual([]);
    a.send({ type: 'APPLY' });
    await waitFor(a, (s) => s.matches('partial'));
    expect(a.getSnapshot().context.failed).toEqual(['pool']);
    a.send({ type: 'RETRY' });
    await waitFor(a, (s) => s.matches('applied'));
    expect(applyCalls).toBe(2);
  });

  it('STOP während der Analyse → editing, Text bleibt, Signal abgebrochen', () => {
    let aborted = false;
    const m = importMachine.provide({
      actors: {
        analyze: fromPromise(({ signal }) => {
          signal.addEventListener('abort', () => (aborted = true));
          return new Promise<never>(() => undefined);
        }),
        apply: fromPromise(() => Promise.resolve(outcome(true))),
      },
    });
    const a = createActor(m, { input: { raw: 'Text' } }).start();
    a.send({ type: 'ANALYZE' });
    expect(a.getSnapshot().matches('analyzing')).toBe(true);
    a.send({ type: 'STOP' });
    expect(a.getSnapshot().value).toBe('editing');
    expect(a.getSnapshot().context.raw).toBe('Text');
    expect(aborted).toBe(true);
  });
});
