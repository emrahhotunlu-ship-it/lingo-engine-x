import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWriter, type Writer } from '../../src/data/writer';
import { createMemoryDb, type MemoryDbHandle } from '../../src/platform/dev/memoryDb';
import type { Db } from '../../src/platform/types';
import { useLive } from '../../src/data/live';
import { dayKey } from '../../src/domain/date';
import type { StoredPlan } from '../../src/domain/plan/types';
import type { TrainerSnapshot } from '../../src/features/vocab/session';

// Trainer-Sitzung im Anki-Modus (P3): Modus je Karte, Fortsetzen (Momentaufnahme → Herstellen →
// gleiche Position, nie Schreiben), Überspringen ohne Bewertung, Block 1 meldet unitDone(1).

type Doc = Record<string, unknown>;
const holder = vi.hoisted(() => ({ writer: null as Writer | null, db: null as Db | null, done: [] as number[] }));
vi.mock('../../src/data', () => ({ getWriter: () => holder.writer }));
vi.mock('../../src/platform/capabilities', async (orig) => ({ ...(await orig<Record<string, unknown>>()), getDb: () => holder.db }));
vi.mock('../../src/app/unit/done', () => ({ unitDone: (b: number) => holder.done.push(b), setUnitDoneHandler: () => undefined }));

const persist = await import('../../src/features/progress/persist');
const store = await import('../../src/features/today/store');
const S = await import('../../src/features/vocab/session');
const { useDecks } = await import('../../src/features/vocab/decksStore');
const { readDecks } = await import('../../src/domain/srs/decks');

const NOW = Date.now();
const DAY = dayKey(NOW);
const plan = (review: number): StoredPlan => ({ d: DAY, ids: [], why: [], v: 1, duty: ['review'], goal: { review }, lesson: null, at: 0 });
const card = (i: number, over: Doc = {}): Doc => ({ word: `word${i}`, de: `Wort ${i}`, def: `word number ${i}`, ex: `We say [word${i}] often.`, pos: 'noun', state: 'review', stage: 1, S: 3, D: 5, due: NOW - 86_400_000 * (10 - i), last: NOW - 86_400_000 * 20, reps: 3, lapses: 0, src: 'lookup', ...over });
const vocab = (n: number, over: Doc = {}) => new Map(Array.from({ length: n }, (_, i) => [`word${i}`, card(i, over)] as [string, Doc]));

let h: MemoryDbHandle;
beforeEach(() => {
  persist.resetPersistForTests();
  store.resetTodayForTests();
  h = createMemoryDb({ seed: {} });
  holder.db = h.db;
  holder.writer = createWriter(h.db);
  holder.done = [];
  useDecks.setState({ decks: readDecks({ v: 1, prefs: { mode: 'auto' } }) });
  useLive.setState({ day: null, docs: { 'app/profile': { newPerDay: 0 } }, collections: { vocab: vocab(8), chunk: new Map() } });
  store.useTodayPlan.setState({ day: DAY, plan: plan(6), status: 'ready', exhausted: null });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  S.useSession.setState({ active: false });
});

describe('Modus je Karte', () => {
  it('auto: Stufe 1 wird aufgedeckt, Tippen-Standard tippt', () => {
    S.startSession('pflicht');
    expect(S.useSession.getState().exercise?.ex).toBe('flip');
    expect(S.useSession.getState().exercise?.dir).toBe('de-en');
    useDecks.setState({ decks: readDecks({ v: 1, prefs: { mode: 'type' } }) });
    S.startSession('pflicht');
    expect(S.useSession.getState().exercise?.ex).not.toBe('flip');
  });
  it('gespeicherte Stufe ≥ 3 → getippt', () => {
    useLive.setState({ collections: { vocab: vocab(8, { stage: 4 }), chunk: new Map() } });
    S.startSession('pflicht');
    expect(S.useSession.getState().exercise?.ex).not.toBe('flip');
  });
});

describe('Fortsetzen (Resumable trainer)', () => {
  it('Momentaufnahme → Herstellen → gleiche Karte, ohne Schreiben', async () => {
    S.startSession('pflicht');
    S.commitAnswer({ grade: 3, given: '', ms: 2000, ok: true });
    S.commitAnswer({ grade: 3, given: '', ms: 2000, ok: true });
    const at = S.useSession.getState();
    const key = at.queue[at.pos]?.key;
    const snap = JSON.parse(JSON.stringify(S.trainerSnapshot())) as TrainerSnapshot;
    expect(snap.pos).toBe(2);
    await persist.flush();
    const writes = h.writes().length;
    S.useSession.setState({ active: false, queue: [], pos: 0 });
    expect(S.restoreTrainer(snap)).toBe(true);
    const s = S.useSession.getState();
    expect(s.queue[s.pos]?.key).toBe(key);
    expect(s.exercise?.card.key).toBe(key);
    expect(s.results).toHaveLength(2);
    expect(s.activeMs).toBe(0);
    expect(h.writes().length).toBe(writes);
  });
  it('inzwischen beantwortete Karte wird übersprungen; fremder Lerntag verworfen', () => {
    S.startSession('pflicht');
    const snap = S.trainerSnapshot() as TrainerSnapshot;
    const first = snap.queue[0]?.key.slice(6) ?? '';
    const docs = vocab(8);
    docs.set(first, { ...(docs.get(first) as Doc), last: snap.at + 10 });
    useLive.setState({ collections: { vocab: docs, chunk: new Map() } });
    expect(S.restoreTrainer(snap)).toBe(true);
    expect(S.useSession.getState().exercise?.card.key).not.toBe(`vocab/${first}`);
    expect(S.restoreTrainer({ ...snap, day: '2000-01-01' })).toBe(false);
  });
});

describe('Überspringen und Block 1', () => {
  it('skipCurrent geht ohne Bewertung weiter', () => {
    S.startSession('pflicht');
    const before = S.useSession.getState();
    S.skipCurrent();
    const after = S.useSession.getState();
    expect(after.pos).toBe(before.pos + 1);
    expect(after.results).toHaveLength(0);
  });
  it('reguläres Ende der Einheits-Runde meldet unitDone(1)', () => {
    store.useTodayPlan.setState({ day: DAY, plan: plan(2), status: 'ready', exhausted: null });
    S.startSession('pflicht', { unit: true });
    S.commitAnswer({ grade: 3, given: '', ms: 2000, ok: true });
    S.commitAnswer({ grade: 3, given: '', ms: 2000, ok: true });
    expect(S.useSession.getState().status).toBe('summary');
    expect(holder.done).toEqual([1]);
  });
});
