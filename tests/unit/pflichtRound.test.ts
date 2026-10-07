import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWriter, type Writer } from '../../src/data/writer';
import { createMemoryDb, type MemoryDbHandle } from '../../src/platform/dev/memoryDb';
import type { Db } from '../../src/platform/types';
import { useLive } from '../../src/data/live';
import { dayKey } from '../../src/domain/date';
import { buildUnitStored } from '../../src/domain/unit/plan';
import { readDecks } from '../../src/domain/srs/decks';

// Lernplattform 2.0 §2.3/§4.8: Bei Regelversion 2 enthält die Pflichtrunde (Schritt 1) nur Karten – keine Reparatur-Sätze – und die Zahl
// der Rundenelemente ist `goal.review`. Bei Regelversion 1 gilt das alte Verhalten (bis zu 3 Reparatur-Sätze zählen mit).

type Doc = Record<string, unknown>;
const holder = vi.hoisted(() => ({ writer: null as Writer | null, db: null as Db | null }));
vi.mock('../../src/data', () => ({ getWriter: () => holder.writer }));
vi.mock('../../src/platform/capabilities', async (orig) => ({ ...(await orig<Record<string, unknown>>()), getDb: () => holder.db }));
vi.mock('../../src/app/unit/done', () => ({ unitDone: () => undefined, setUnitDoneHandler: () => undefined }));

const persist = await import('../../src/features/progress/persist');
const store = await import('../../src/features/today/store');
const S = await import('../../src/features/vocab/session');
const { useDecks } = await import('../../src/features/vocab/decksStore');

const NOW = Date.now();
const DAY = dayKey(NOW);
const card = (i: number): Doc => ({ word: `word${i}`, de: `Wort ${i}`, def: `word number ${i}`, ex: `We say [word${i}] often.`, pos: 'noun', state: 'review', stage: 1, S: 3, D: 5, due: NOW - 86_400_000 * (12 - i), last: NOW - 86_400_000 * 20, reps: 3, lapses: 0, src: 'lookup' });
const vocab = new Map(Array.from({ length: 12 }, (_, i) => [`word${i}`, card(i)] as [string, Doc]));
const repairDoc = { items: [1, 2, 3].map((n) => ({ id: `r${n}`, wrong: `I am agree number ${n}.`, right: `I agree number ${n}.`, src: 'say', t: NOW - 5 * 86_400_000, box: 0, due: NOW - 1000 })) };
const planFor = (rv: 1 | 2, goal: number) => buildUnitStored({ day: DAY, nowMs: NOW, week: null, goalMin: 25, review: { goal, due: goal, fresh: 0, repairs: 0, sec: 470, overdue: 0 }, fixDue: 6, rv });

let h: MemoryDbHandle;
beforeEach(() => {
  persist.resetPersistForTests();
  store.resetTodayForTests();
  h = createMemoryDb({ seed: Object.fromEntries([...vocab].map(([k, v]) => [`vocab/${k}`, v])) });
  holder.db = h.db;
  holder.writer = createWriter(h.db);
  useDecks.setState({ decks: readDecks({ v: 1, prefs: { mode: 'auto' } }) });
  useLive.setState({ day: null, docs: { 'app/profile': { newPerDay: 0 }, 'app/repair': repairDoc }, collections: { vocab, chunk: new Map() } });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(async () => {
  S.commitHeld();
  await persist.flush();
  vi.restoreAllMocks();
  S.useSession.setState({ active: false });
});

describe('Pflichtrunde: Reparatur-Sätze nach Regelversion', () => {
  it('rv 2: 0 Reparatur-Sätze, die Runde hat genau goal.review Karten', () => {
    store.useTodayPlan.setState({ day: DAY, plan: planFor(2, 8), status: 'ready', exhausted: null });
    S.startSession('pflicht');
    const s = S.useSession.getState();
    expect(s.repairs).toHaveLength(0);
    expect(s.queue).toHaveLength(8);
    expect(s.target).toBe(8);
  });
  it('rv 1: das alte Verhalten, bis zu 3 Reparatur-Sätze zählen zur Runde', () => {
    store.useTodayPlan.setState({ day: DAY, plan: planFor(1, 8), status: 'ready', exhausted: null });
    S.startSession('pflicht');
    const s = S.useSession.getState();
    expect(s.repairs.length).toBe(3);
    expect(s.queue.length + s.repairs.length).toBe(8);
  });
  it('freie Runde „alle“ (Extra) bleibt unberührt', () => {
    store.useTodayPlan.setState({ day: DAY, plan: planFor(2, 8), status: 'ready', exhausted: null });
    S.startSession('extra', { deck: 'all', size: 6 });
    expect(S.useSession.getState().repairs.length).toBeGreaterThan(0);
  });
});
