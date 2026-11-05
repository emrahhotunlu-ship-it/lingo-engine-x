// M0 (docs/umbau/module/plan.md, Nachtrag architect Nr. 1): Gleichheitstest. Dieselbe Antwortfolge über alle Wege AUSSER Tempo/c1x-`ext`
// ergibt dieselben Dokumente wie vor M0. Die Golden-Datei `__golden__/grammar-ext-equality.json` wurde auf dem Stand VOR M0 (de6371b) erzeugt
// und darf sich durch M0 nicht ändern. Geprüft wird der ganze Schreibweg `learnRecorder.grammar` (grammar/<topic>, app/profile, log/<tag>,
// app/radar) gegen die Speicher-Datenbank.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import pilotErr from '../../src/content/c1x/src/pilot/err.json';
import pilotKwt from '../../src/content/c1x/src/pilot/kwt.json';
import examples from '../fixtures/c1x/examples.json';
import { createWriter, type Writer } from '../../src/data/writer';
import { bookAnswer, type C1Run } from '../../src/domain/c1x/book';
import { toTask } from '../../src/domain/c1x/runtime';
import { c1Item } from '../../src/domain/c1x/schema';
import { scoreC1 } from '../../src/domain/c1x/score';
import type { C1Item, C1Response } from '../../src/domain/c1x/types';
import type { GrammarAnswer } from '../../src/domain/learn/types';
import { createMemoryDb, type MemoryDbHandle } from '../../src/platform/dev/memoryDb';
import { berlin } from './helpers';
import { answer } from './learnHelpers';

const holder = vi.hoisted(() => ({ writer: null as Writer | null }));
vi.mock('../../src/data', () => ({ getWriter: () => holder.writer }));
const persist = await import('../../src/features/progress/persist');

const parse = (raw: unknown): C1Item => c1Item.parse(raw);
const items = [...pilotKwt.items, ...pilotErr.items, ...(examples.items as unknown[])].map(parse);
const byId = (id: string): C1Item => items.find((i) => i.id === id) as C1Item;

const D1 = '2026-10-05';
const D2 = '2026-10-06';
const T1 = berlin(D1, 10);
const T2 = berlin(D2, 10);

function c1(id: string, response: C1Response, run: Partial<C1Run> & { t: number; day: string }, typed: boolean): GrammarAnswer {
  const item = byId(id);
  const score = scoreC1(item, typed ? ({ ...response, typed: true } as C1Response) : response);
  return bookAnswer(toTask(item), score, response, { form: typed ? 'typed' : 'tap', inp: 'desk', timeMs: 6000, help: 0, lang: 'de', ctx: 'xtra', ...run });
}

/** Die Antwortfolge: Pflicht, freie Runde, Vortest, Themen-Test, „Auch richtig“, Hilfe, zweite Sicht, „Weiß ich nicht“, c1x getippt und angetippt. */
export function sequence(): GrammarAnswer[] {
  let k = 0;
  const t = (base: number) => base + ++k * 1000;
  return [
    answer({ t: t(T1), day: D1, ctx: 'duty' }),
    answer({ t: t(T1), day: D1, ctx: 'duty', verdict: 'wrong', given: 'finish' }),
    answer({ t: t(T1), day: D1, ctx: 'xtra', vt: { ok: true, pats: ['fp.by'] } }),
    answer({ t: t(T1), day: D1, ctx: 'xtra', alt: true }),
    answer({ t: t(T1), day: D1, ctx: 'xtra', help: { level: 1 } }),
    answer({ t: t(T1), day: D1, ctx: 'xtra', again: true }),
    answer({ t: t(T1), day: D1, ctx: 'xtra', verdict: 'wrong', dontKnow: true, given: '' }),
    c1('kwt-9001', { kind: 'kwt', text: 'is said to be' }, { t: t(T1), day: D1, ctx: 'duty' }, true),
    c1('kwt-9001', { kind: 'kwt', text: 'is said that it is' }, { t: t(T1), day: D1, ctx: 'xtra' }, true),
    c1('err-9001', { kind: 'err', tap: 5, fix: 'hearing', typed: true }, { t: t(T1), day: D1, ctx: 'xtra' }, true),
    c1('err-9001', { kind: 'err', tap: 5 }, { t: t(T1), day: D1, ctx: 'xtra' }, false),
    c1('wf-0001', { kind: 'wf', text: 'x' }, { t: t(T1), day: D1, ctx: 'xtra' }, true),
    answer({ t: t(T2), day: D2, ctx: 'duty', tt: { c: 5, n: 6, w: ['fp.by'] } }),
    answer({ t: t(T2), day: D2, ctx: 'xtra', verdict: 'near', given: 'will have finish' }),
    c1('kwt-9001', { kind: 'kwt', text: 'is said to be' }, { t: t(T2), day: D2, ctx: 'xtra' }, true),
    c1('err-9001', { kind: 'err', tap: 5, fix: 'heard', typed: true }, { t: t(T2), day: D2, ctx: 'duty' }, true),
  ];
}

let h: MemoryDbHandle;
beforeEach(() => {
  persist.resetPersistForTests();
  vi.spyOn(Math, 'random').mockReturnValue(0.25);
  vi.spyOn(Date, 'now').mockReturnValue(T2 + 3_600_000);
  h = createMemoryDb({ seed: { 'app/profile': { days: {}, xpDays: {}, act: {}, answers: 0, vAnswers: 0, gAnswers: 0, xp: 0 } } });
  holder.writer = createWriter(h.db);
});
afterEach(() => {
  holder.writer = null;
  vi.restoreAllMocks();
});

/** Alle Dokumente nach der Folge; `lxSeq` (Folgenummern je Tab, von der Uhr abhängig) fällt heraus. */
export async function runAll(list: readonly GrammarAnswer[]): Promise<Record<string, unknown>> {
  for (const a of list) await persist.learnRecorder.grammar(a);
  await persist.flush();
  const dump = h.dump();
  const profile = { ...(dump['app/profile'] as Record<string, unknown>) };
  delete profile.lxSeq;
  return { ...dump, 'app/profile': profile };
}

describe('M0 Gleichheit: Wege ohne `ext` schreiben wie vor M0', () => {
  it('learnRecorder.grammar: dieselben Dokumente wie die Golden-Datei (Stand vor M0)', async () => {
    const out = await runAll(sequence());
    await expect(JSON.stringify(out, null, 1)).toMatchFileSnapshot('./__golden__/grammar-ext-equality.json');
  });
});
