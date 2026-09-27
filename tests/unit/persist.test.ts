import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWriter, type Writer } from '../../src/data/writer';
import { createMemoryDb, type MemoryDbHandle } from '../../src/platform/dev/memoryDb';
import type { AnswerEvent } from '../../src/domain/srs/types';
import { answer } from './learnHelpers';

// Die EINE Sammel-Warteschlange gegen die Speicher-Datenbank. `getWriter` zeigt auf einen
// Writer, dessen Datenbank die Tests gezielt scheitern lassen.

const holder = vi.hoisted(() => ({ writer: null as Writer | null }));
vi.mock('../../src/data', () => ({ getWriter: () => holder.writer }));

const persist = await import('../../src/features/progress/persist');

const day = '2026-09-28';
const a = (t: number, grade: 1 | 3 = 3): AnswerEvent => ({ t, day, kind: 'v', id: `w${t}`, ex: 'type', grade, given: 'x', ans: 'x', ms: 1000, lang: 'de', ctx: 'rev' });

let h: MemoryDbHandle;
beforeEach(() => {
  persist.resetPersistForTests();
  h = createMemoryDb({ seed: { 'app/profile': { days: {}, xpDays: {}, act: {}, answers: 0, vAnswers: 0, gAnswers: 0, xp: 0 } } });
  holder.writer = createWriter(h.db);
});
afterEach(() => {
  holder.writer = null;
});

const profile = () => h.dump()['app/profile']!;

describe('Sammel-Warteschlange', () => {
  it('W1: ein gescheiterter Stapel behält seine Folgenummer, blockiert den Folgestapel und wirkt nur einmal', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    h.setFailWrites('resource_exhausted');
    persist.recordAnswer(a(1), true);
    await persist.flush();
    expect(persist.usePending.getState().failed).toBe(true);
    expect(profile().answers).toBe(0);
    // Neue Antworten sammeln sich im Folgestapel; solange der alte scheitert, wird nichts gesendet.
    persist.recordAnswer(a(2), false);
    await persist.flush();
    expect(profile().answers).toBe(0);
    h.setFailWrites(undefined);
    await persist.flush();
    expect(profile().answers).toBe(2);
    const seqs = Object.values(profile().lxSeq as Record<string, number>);
    expect(seqs).toHaveLength(1);
    // Noch einmal speichern ändert nichts (Stapel schon angewendet).
    await persist.flush();
    expect(profile().answers).toBe(2);
    expect(persist.usePending.getState().failed).toBe(false);
    vi.restoreAllMocks();
  });

  it('W1: war das scheinbar gescheiterte update doch angekommen, zählt die Wiederholung nicht doppelt', async () => {
    // Die Datenbank schreibt, meldet aber einen Fehler (Antwort ging verloren).
    const realDb = h.db;
    let lie = true;
    const lyingDb = {
      ...realDb,
      doc(path: string) {
        const ref = realDb.doc(path);
        return {
          ...ref,
          get: () => ref.get(),
          set: (d: Record<string, unknown>) => ref.set(d),
          async update(d: Record<string, unknown>) {
            await ref.update(d);
            if (lie && path === 'app/profile') throw Object.assign(new Error('Antwort verloren'), { code: 'resource_exhausted' });
          },
          acquire: (o: AcquireOptions) => ref.acquire(o),
        };
      },
    };
    holder.writer = createWriter(lyingDb);
    persist.recordAnswer(a(1), true);
    await persist.flush();
    expect(profile().answers).toBe(1);
    lie = false;
    persist.recordAnswer(a(2), false);
    await persist.flush();
    expect(profile().answers).toBe(2);
  });

  it('zwei Tab-Kennungen verwerfen einander nie', async () => {
    persist.recordAnswer(a(1), true);
    await persist.flush();
    const tabA = persist.tabId();
    // Zweiter Tab: eigene Kennung, niedrigere Folgenummer.
    persist.resetPersistForTests();
    persist.recordAnswer(a(2), true);
    await persist.flush();
    const tabB = persist.tabId();
    expect(tabA).not.toBe(tabB);
    // W3: Tab A hält noch die kurze Sperre – der Stapel von Tab B bleibt vorgemerkt …
    expect(profile().answers).toBe(1);
    expect(persist.usePending.getState().failed).toBe(false);
    // … und geht nach Ablauf der Sperre hinaus.
    const later = Date.now() + 6000;
    vi.spyOn(Date, 'now').mockReturnValue(later);
    await persist.flush();
    vi.restoreAllMocks();
    expect(profile().answers).toBe(2);
    expect(Object.keys(profile().lxSeq as object).sort()).toEqual([tabA, tabB].sort());
  });

  it('Pflicht wird sofort mit dem Rundenende gespeichert', async () => {
    persist.setPflichtResolver(({ profile: p }) => {
      const act = (p.act as Record<string, Record<string, number>> | undefined)?.[day];
      return act?.gram ? day : null;
    });
    await persist.learnRecorder.grammar(answer({ t: 10, day, ctx: 'duty' }));
    expect(profile().pflicht).toBeUndefined();
    const ok = await persist.learnRecorder.roundEnd({ day, act: 'gram', ctx: 'duty', partial: false, n: 1, right: 1, activeMs: 60_000 });
    expect(ok).toBe(true);
    expect(profile().pflicht).toEqual({ [day]: 1 });
    expect(profile().gAnswers).toBe(1);
    expect((profile().act as Record<string, Record<string, number>>)[day]).toEqual({ gram: 1 });
  });

  it('LearnRecorder: Grammatik sofort, Log/Radar/Kurs gesammelt; Übungen ohne grammar/vocab', async () => {
    await persist.learnRecorder.grammar(answer({ t: 20, day, verdict: 'wrong', given: 'finish' }));
    expect(h.dump()['grammar/future-perf-cont']).toMatchObject({ n: 1, c: 0 });
    persist.learnRecorder.drill({ kind: 'x', t: 21, day, lang: 'de', ctx: 'xtra', type: 'cloze', q: 'We need to ___ a decision.', given: 'do', ans: 'make', verdict: 'wrong', grade: 1, ms: 3000, radar: { c: 'wordchoice', s: 'v', t: 21, q: 'make a decision', g: 'do', a: 'make' } });
    await persist.learnRecorder.lessonDone({ lid: 'l07', day, t: 22, n: 12, ok: 10 });
    const dump = h.dump();
    expect(dump['app/course']).toEqual({ done: { l07: { d: day, t: 22, n: 12, ok: 10 } }, res: {} });
    expect((dump[`log/${day}`]!.entries as Array<Record<string, unknown>>).map((e) => e.k ?? e.type)).toEqual(['g', 'cloze']);
    expect((dump['app/radar']!.events as unknown[]).length).toBe(2);
    expect(Object.keys(dump).filter((k) => k.startsWith('vocab/'))).toEqual([]);
    expect(profile()).toMatchObject({ answers: 2, gAnswers: 1, vAnswers: 1 });
    expect(persist.usePending.getState()).toMatchObject({ entries: [], lessonDays: [], rounds: [] });
  });
});

describe('Phase 4 in derselben Warteschlange', () => {
  const unit = { day, act: 'read' as const, answers: 4, right: 3, activeMs: 360_000, domain: 'work' as const };

  it('recordUnitEnd: act, Zähler, Puffer; derselbe Stapel wirkt nur einmal', async () => {
    const p = persist.recordUnitEnd(unit);
    expect(persist.usePending.getState().units[day]).toEqual({ read: 1 });
    expect(await p).toBe(true);
    const pr = profile() as { act: Record<string, Record<string, number>>; answers: number; days: Record<string, number>; mix: Record<string, number>; lxSeq: Record<string, number> };
    expect(pr.act[day]).toEqual({ read: 1 });
    expect(pr.answers).toBe(4);
    expect(pr.days[day]).toBe(4);
    expect(pr.mix.work).toBe(1);
    expect(Object.keys(pr.lxSeq)).toHaveLength(1);
    expect(persist.usePending.getState().units[day]).toEqual({ read: 0 });
    await persist.flush();
    expect((profile() as { answers: number }).answers).toBe(4);
  });

  it('recordChannelEntries und recordRadar: Protokoll ohne id/k, Radar über mergeRadar', async () => {
    persist.recordChannelEntries([{ t: 5, ok: true, lang: 'de', type: 'read', ref: 'articles/a1', q: 'Q?', given: 'A', ans: 'A', ms: 900, ctx: 'xtra', day }]);
    const ev = { c: 'tense', s: 'w' as const, t: 7, q: 'We are here since May.', g: 'are', a: 'have been' };
    expect(await persist.recordRadar([ev, ev])).toBe(true);
    const d = h.dump();
    const entries = d[`log/${day}`]?.entries as Array<Record<string, unknown>>;
    expect(entries).toHaveLength(1);
    expect(entries[0]).not.toHaveProperty('id');
    expect(entries[0]).not.toHaveProperty('day');
    expect((d['app/radar'] as { events: unknown[] }).events).toEqual([ev]);
  });

  it('recordProfileFields: nur echte Änderung, frischer Stand; ohne Datenbank sofort false', async () => {
    const compute = (cur: Readonly<Record<string, unknown>>) => ((cur.disc as Record<string, unknown> | undefined)?.x ? null : { disc: { x: { prep: day } } });
    expect(await persist.recordProfileFields('discover:step', compute)).toBe(true);
    expect((profile() as { disc: unknown }).disc).toEqual({ x: { prep: day } });
    const writes = h.writes().length;
    expect(await persist.recordProfileFields('discover:step', compute)).toBe(true);
    expect(h.writes().length).toBe(writes);
    holder.writer = null;
    expect(await persist.recordProfileFields('discover:step', compute)).toBe(false);
  });
});
