import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWriter, type Writer } from '../../src/data/writer';
import { createMemoryDb, type MemoryDbHandle } from '../../src/platform/dev/memoryDb';
import type { Db } from '../../src/platform/types';
import { useLive } from '../../src/data/live';
import { dayKey } from '../../src/domain/date';
import { buildUnitStored } from '../../src/domain/unit/plan';
import { readDecks } from '../../src/domain/srs/decks';

// Die Pflichtrunde (Schritt 1) und jede andere Wortschatz-Runde enthält nur Karten; die Zahl der Rundenelemente ist `goal.review`.

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

// 11.10.2026 (Emrah): „Grammatik Übungen hat in Vokabel Übungen nichts zu suchen“ – keine Wortschatz-Runde enthält Fehlersätze,
// egal über welchen Einstieg und egal wie viele Fehlersätze fällig sind.
const api = { focusNow: () => undefined, blur: () => undefined } as never;
const keysOf = () => [...vocab.keys()].slice(0, 4).map((k) => `vocab/${k}`);

describe('Wortschatz-Runden enthalten nie Fehlersätze', () => {
  const expectCardsOnly = (n = 1) => {
    const s = S.useSession.getState();
    expect(s.status).toBe('running');
    expect(s.queue.length).toBeGreaterThanOrEqual(n);
    expect((s as unknown as { repairs?: unknown }).repairs).toBeUndefined();
    expect(S.trainerSnapshot()).not.toHaveProperty('repairs');
  };
  for (const rv of [1, 2] as const) {
    it(`Pflichtrunde, Regelversion ${rv}: nur Karten, genau goal.review viele`, () => {
      store.useTodayPlan.setState({ day: DAY, plan: planFor(rv, 8), status: 'ready', exhausted: null });
      S.startSession('pflicht');
      expectCardsOnly(8);
      expect(S.useSession.getState().queue).toHaveLength(8);
      expect(S.useSession.getState().target).toBe(8);
    });
  }
  it('Extra „alle“ (Alle fälligen ohne Pflicht)', () => {
    store.useTodayPlan.setState({ day: DAY, plan: planFor(2, 8), status: 'ready', exhausted: null });
    S.startSession('extra', { deck: 'all', size: 6 });
    expectCardsOnly(6);
    expect(S.useSession.getState().queue).toHaveLength(6);
  });
  it('Knopf „Alle fälligen“ (startAllDue) mit und ohne Pflicht', async () => {
    const { startAllDue } = await import('../../src/features/vocab/start');
    store.useTodayPlan.setState({ day: DAY, plan: planFor(1, 8), status: 'ready', exhausted: null });
    startAllDue(api);
    expectCardsOnly();
    S.useSession.setState({ active: false });
    store.useTodayPlan.setState({ day: DAY, plan: null, status: 'ready', exhausted: null });
    startAllDue(api);
    expectCardsOnly();
  });
  it('Stapel, Auswahl, Anki „Aufdecken“, einzelne Karten, Falsche wiederholen', async () => {
    const { startExtra } = await import('../../src/features/vocab/start');
    store.useTodayPlan.setState({ day: DAY, plan: planFor(2, 8), status: 'ready', exhausted: null });
    startExtra(api, { deck: 'hard', size: 5 });
    S.useSession.setState({ active: false });
    startExtra(api, { deck: 'all', pick: () => true, size: 5 });
    expectCardsOnly();
    S.useSession.setState({ active: false });
    startExtra(api, { deck: 'all', size: 5, mode: 'flip' });
    expectCardsOnly();
    S.useSession.setState({ active: false });
    startExtra(api, { only: [...vocab.keys()].slice(0, 3).map((k) => `vocab/${k}`) });
    expectCardsOnly();
    S.useSession.setState({ active: false });
    S.startSession('extra', { only: [keysOf()[0] as string] });
    expectCardsOnly();
  });
  it('Fortsetzen nach dem Neuladen bringt keine Fehlersätze zurück', () => {
    store.useTodayPlan.setState({ day: DAY, plan: planFor(1, 8), status: 'ready', exhausted: null });
    S.startSession('pflicht');
    const snap = { ...S.trainerSnapshot()!, repairs: ['r1', 'r2'], repairPos: 0 } as never;
    S.useSession.setState({ active: false });
    expect(S.restoreTrainer(snap)).toBe(true);
    expectCardsOnly();
  });
});
