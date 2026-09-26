import { describe, expect, it } from 'vitest';
import { createWriter } from '../../src/data/writer';
import { dailyHash, dailyIntake, dailyOpenTasks, openDailyDays, seenByTopic } from '../../src/domain/plan/dailyIntake';
import { legacyTaskKey } from '../../src/domain/grammar/key';
import { ensurePflichtSince, healPflicht, runDailyIntake } from '../../src/features/progress/dayJobs';
import type { StoredPlan } from '../../src/domain/plan/types';
import { createMemoryDb } from '../../src/platform/dev/memoryDb';
import { berlin } from './helpers';

const now = berlin('2026-09-28', 10);
const g = (i: number, topic = 'passive') => ({ topic, type: 'gap', prompt: `The report ${'abcdefghij'[i]} ___ (send) yesterday.`, answer: 'was sent', explanation_de: 'x', explanation_en: 'y' });
const word = (w: string) => ({ word: w, de: `de-${w}`, def: 'd', ex: `We discussed the ${w} in the meeting.`, level: 'B2', pos: 'noun' });

describe('dailyIntake (rein)', () => {
  const daily = new Map<string, Record<string, unknown>>([
    ['2026-09-25', { grammarItems: [g(0), g(1)], newWords: [word('backlog')] }],
    ['2026-09-27', { grammarItems: [g(2)], newWords: [word('roadmap'), word('backlog')] }],
    ['2026-10-02', { grammarItems: [g(3)] }],
    ['notes', { grammarItems: [g(4)] }],
  ]);

  it('alle offenen Tage bis heute, ältester zuerst; Zukunft und fremde Schlüssel nie', () => {
    const days = openDailyDays({ daily, lxDaily: null, nowMs: now });
    expect(days.map((d) => d.day)).toEqual(['2026-09-25', '2026-09-27']);
  });

  it('erledigt nur bei gleichem Fingerabdruck und ohne offene Aufgaben', () => {
    const h = dailyHash(daily.get('2026-09-25'));
    expect(openDailyDays({ daily, lxDaily: { '2026-09-25': { h, open: 0 } }, nowMs: now }).map((d) => d.day)).toEqual(['2026-09-27']);
    expect(openDailyDays({ daily, lxDaily: { '2026-09-25': { h, open: 2 } }, nowMs: now }).map((d) => d.day)).toContain('2026-09-25');
    expect(openDailyDays({ daily, lxDaily: { '2026-09-25': { h: h + 1, open: 0 } }, nowMs: now }).map((d) => d.day)).toContain('2026-09-25');
    // Schlüsselreihenfolge egal.
    expect(dailyHash({ a: 1, b: [1, { c: 2, d: 3 }] })).toBe(dailyHash({ b: [1, { d: 3, c: 2 }], a: 1 }));
  });

  it('Karten: jede Kennung nur einmal, bekannte ausgelassen, mit Ursprung', () => {
    const r = dailyIntake({ daily, lxDaily: null, knownVocab: new Set(['roadmap']), grammarDocs: new Map(), today: '2026-09-28', nowMs: now });
    expect(r.words.map((w) => w.id)).toEqual(['backlog']);
    expect(r.words[0]!.doc).toMatchObject({ src: 'coach', origin: { kind: 'daily', ref: 'daily/2026-09-25' }, ex: 'We discussed the [backlog] in the meeting.' });
    expect(r.batches.map((b) => b.day)).toEqual(['2026-09-25', '2026-09-27']);
  });

  it('offene Aufgaben für die Runde: neueste Tage zuerst, gesehene nie', () => {
    const seen = seenByTopic(new Map([['passive', { seen: [legacyTaskKey(g(2).prompt)] }]]));
    const tasks = dailyOpenTasks(daily, seen, now);
    expect(tasks.map((t) => t.ref)).toEqual(['daily/2026-09-25', 'daily/2026-09-25']);
    expect(dailyOpenTasks(daily, new Map(), now)[0]!.ref).toBe('daily/2026-09-27');
  });
});

describe('Tagesabläufe mit Speicher-Datenbank (zwei Writer = zwei Tabs)', () => {
  const seed = () => ({
    'daily/2026-09-26': { grammarItems: [g(0), g(1), { topic: 'x' }], newWords: [word('backlog')] },
    'daily/2026-09-27': { grammarItems: [g(2)], newWords: [word('roadmap')] },
    'feed/2026-09-27': { id: 'f', items: [] },
    'app/pool': { items: [], t: 1 },
    'app/profile': { days: { '2026-09-27': 3 }, act: {} },
    'app/schema': { version: 1, cutover: '2026-09-26', migratedAt: 1 },
  });

  it('2× ausgeführt → identischer Stand; daily/* und feed/* bytegleich; kein delete, kein set auf Bestehendes', async () => {
    const h = createMemoryDb({ seed: seed() });
    const w = createWriter(h.db);
    const args = { db: h.db, writer: w, nowMs: now, tab: 'tabA', today: '2026-09-28', knownVocab: new Set<string>(), grammarDocs: new Map() };
    const r1 = await runDailyIntake(args);
    expect(r1).toMatchObject({ status: 'done', createdCards: 2 });
    const after1 = JSON.stringify(h.dump());
    const r2 = await runDailyIntake({ ...args, knownVocab: new Set(['backlog', 'roadmap']) });
    expect(r2.createdCards).toBe(0);
    expect(r2.pool).toBeNull();
    expect(JSON.stringify(h.dump())).toBe(after1);
    const dump = h.dump();
    expect(dump['daily/2026-09-26']).toEqual(seed()['daily/2026-09-26']);
    expect(dump['feed/2026-09-27']).toEqual(seed()['feed/2026-09-27']);
    expect((dump['app/pool']!.items as unknown[]).length).toBe(3);
    expect(Object.keys(dump['app/pool']!.lxDaily as object).sort()).toEqual(['2026-09-26', '2026-09-27']);
    const writes = h.writes();
    expect(writes.some((x) => x.op === 'delete')).toBe(false);
    expect(writes.filter((x) => x.op === 'set').map((x) => x.path).sort()).toEqual(['vocab/backlog', 'vocab/roadmap']);
  });

  it('zwei Tabs gleichzeitig → keine doppelten Karten oder Aufgaben', async () => {
    const h = createMemoryDb({ seed: seed(), latencyMs: 2 });
    const a = createWriter(h.db);
    const b = createWriter(h.db);
    const args = { db: h.db, nowMs: now, today: '2026-09-28', knownVocab: new Set<string>(), grammarDocs: new Map() };
    const [ra, rb] = await Promise.all([runDailyIntake({ ...args, writer: a, tab: 'tabA' }), runDailyIntake({ ...args, writer: b, tab: 'tabB' })]);
    expect([ra.status, rb.status].sort()).toEqual(['busy', 'done']);
    const items = h.dump()['app/pool']!.items as Array<{ prompt: string }>;
    expect(new Set(items.map((i) => i.prompt)).size).toBe(items.length);
    expect(ra.createdCards + rb.createdCards).toBe(2);
  });

  const p2plan: StoredPlan = { d: '2026-09-28', ids: ['gram', 'order', 'sprint'], why: [], v: 1, duty: ['review', 'ch:gram'], goal: { review: 5, ch: 6 }, lesson: null, at: 1 };

  it('zwei Tabs setzen pflichtSince → genau ein Wert, nie früher als der letzte Aktivtag', async () => {
    const h = createMemoryDb({ seed: seed(), latencyMs: 2 });
    const common = { nowMs: now, today: '2026-09-28', plan: p2plan, schema: seed()['app/schema'], profile: seed()['app/profile'], tts: false, ai: false };
    const res = await Promise.all([ensurePflichtSince({ ...common, writer: createWriter(h.db), tab: 'A' }), ensurePflichtSince({ ...common, writer: createWriter(h.db), tab: 'B' })]);
    expect(res.filter((r) => r === 'set')).toHaveLength(1);
    expect(h.dump()['app/schema']!.pflichtSince).toBe('2026-09-28');
    // Später nie geändert.
    const again = await ensurePflichtSince({ ...common, schema: h.dump()['app/schema'], writer: createWriter(h.db), tab: 'A', nowMs: now + 5 * 86_400_000, today: '2026-10-03' });
    expect(again).toBe('skipped');
    expect(h.dump()['app/schema']!.pflichtSince).toBe('2026-09-28');
  });

  it('Phase-1-Plan von heute → pflichtSince wird nicht gesetzt (erst am nächsten Lerntag)', async () => {
    const h = createMemoryDb({ seed: seed() });
    const p1: StoredPlan = { ...p2plan, ids: [], duty: ['review'] };
    const r = await ensurePflichtSince({ writer: createWriter(h.db), tab: 'A', nowMs: now, today: '2026-09-28', plan: p1, schema: seed()['app/schema'], profile: {}, tts: false, ai: false });
    expect(r).toBe('skipped');
    expect(h.dump()['app/schema']!.pflichtSince).toBeUndefined();
  });

  it('Selbstheilung pflicht[heute]: setzt nur bei Aktivität und erfüllter Pflicht, nie zweimal', async () => {
    const h = createMemoryDb({ seed: { 'app/profile': { days: { '2026-09-28': 4 }, act: { '2026-09-28': { gram: 1 } } } } });
    const w = createWriter(h.db);
    const i = { day: '2026-09-28', plan: p2plan, reviewDone: true, exhausted: false, course: null, pendingLessonDay: false };
    expect(await healPflicht(w, i)).toBe('set');
    expect(await healPflicht(w, i)).toBe('unchanged');
    expect(h.dump()['app/profile']!.pflicht).toEqual({ '2026-09-28': 1 });
    const h2 = createMemoryDb({ seed: { 'app/profile': { days: {}, act: { '2026-09-28': { gram: 1 } } } } });
    expect(await healPflicht(createWriter(h2.db), i)).toBe('unchanged');
  });
});
