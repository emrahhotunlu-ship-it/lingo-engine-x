import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWriter, type Writer } from '../../src/data/writer';
import { createMemoryDb, type MemoryDbHandle } from '../../src/platform/dev/memoryDb';
import type { Db } from '../../src/platform/types';
import { useLive } from '../../src/data/live';
import { dayKey } from '../../src/domain/date';
import { isFest } from '../../src/domain/metrics/definitions';
import { toTrainCard } from '../../src/domain/srs/cards';
import { knownOp } from '../../src/domain/srs/vocabList';
import { readDecks } from '../../src/domain/srs/decks';
import type { StoredPlan } from '../../src/domain/plan/types';

// „Kenne ich“ (Lernplattform 2.0 §4.8): keine Behauptung, sondern eine Prüffrage. Richtig ohne Hilfe → Stufe 3, 10 Tage, `hist m:'known'`
// statt eines erfundenen `{m:'type', g:4}`. Die Karte ist danach nicht „Fest“. Falsch → wie jede andere Antwort.

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
const DAY_MS = 86_400_000;
const fresh = (i: number): Doc => ({ word: `word${i}`, de: `Wort ${i}`, def: `word number ${i}`, ex: `We say [word${i}] often.`, pos: 'noun', state: 'new', S: 0, D: 5, last: 0, due: 0, reps: 0, lapses: 0, stage: 0, src: 'lookup', added: DAY, order: i });
const vocab = new Map(Array.from({ length: 6 }, (_, i) => [`word${i}`, fresh(i)] as [string, Doc]));
const plan: StoredPlan = { d: DAY, ids: [], why: [], v: 1, duty: ['review'], goal: { review: 3, due: 0, new: 3, ahead: 0 }, lesson: null, at: 0 };
const settle = () => new Promise((r) => setTimeout(r, 30));

describe('knownOp: Stufe 3, 10 Tage, nichts Erfundenes', () => {
  it('schreibt m:known, Stufe 3, S 10, fällig in 10 Tagen – und die Karte ist nicht „Fest“', () => {
    const op = knownOp(fresh(1), 'vocab/word1', null, NOW, DAY);
    expect(op && 'update' in op).toBe(true);
    const p = (op as { update: Doc }).update;
    expect(p.stage).toBe(3);
    expect(p.S).toBe(10);
    expect(p.due).toBe(NOW + 10 * DAY_MS);
    const hist = p.hist as Array<{ m: string; g: number }>;
    expect(hist.at(-1)?.m).toBe('known');
    expect(hist.some((x) => x.m === 'type' && x.g === 4)).toBe(false);
    const c = toTrainCard('word1', { ...fresh(1), ...p }, true, NOW);
    expect(c && isFest(c)).toBe(false);
  });
  it('bestehende Einträge der alten Regel (m:type) bleiben unverändert stehen', () => {
    const old = { ...fresh(2), hist: [{ t: 1, m: 'type', g: 4 }] };
    const hist = (knownOp(old, 'vocab/word2', null, NOW, DAY) as { update: Doc }).update.hist as Array<{ m: string }>;
    expect(hist.map((x) => x.m)).toEqual(['type', 'known']);
  });
});

describe('Prüffrage in der Runde', () => {
  let h: MemoryDbHandle;
  beforeEach(() => {
    persist.resetPersistForTests();
    store.resetTodayForTests();
    h = createMemoryDb({ seed: Object.fromEntries([...vocab].map(([k, v]) => [`vocab/${k}`, v])) });
    holder.db = h.db;
    holder.writer = createWriter(h.db);
    useDecks.setState({ decks: readDecks({ v: 1, prefs: { mode: 'auto' } }) });
    useLive.setState({ day: null, docs: { 'app/profile': { newPerDay: 3 } }, collections: { vocab, chunk: new Map() } });
    store.useTodayPlan.setState({ day: DAY, plan, status: 'ready', exhausted: null });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(async () => {
    S.commitHeld();
    await persist.flush();
    await settle();
    vi.restoreAllMocks();
    S.useSession.setState({ active: false });
  });

  it('richtig ohne Hilfe → Stufe 3 und m:known; die Karte kommt heute nicht noch einmal', async () => {
    S.startSession('pflicht');
    expect(S.useSession.getState().queue[0]?.phase).toBe('intro');
    const key = S.useSession.getState().queue[0]?.key ?? '';
    expect(S.startKnownProbe()).toBe('typed');
    const e = S.useSession.getState().exercise;
    expect(e?.check).toBe('known');
    expect(e?.sentence?.sentence).toContain('often');
    S.commitAnswer({ grade: 3, given: e?.accepted[0] ?? '', ms: 2000, ok: true, hint: 0 });
    await persist.flush();
    await settle();
    const doc = h.dump()[key] as Doc;
    expect(doc.stage).toBe(3);
    expect((doc.hist as Array<{ m: string }>).at(-1)?.m).toBe('known');
    expect(S.useSession.getState().queue.filter((q) => q.key === key)).toHaveLength(1);
  });

  it('falsch → gewöhnliche Antwort (Stufe 1, kein m:known)', async () => {
    S.startSession('pflicht');
    const key = S.useSession.getState().queue[0]?.key ?? '';
    S.startKnownProbe();
    S.commitAnswer({ grade: 1, given: 'xyz', ms: 2000, ok: false });
    await persist.flush();
    await settle();
    const doc = h.dump()[key] as Doc;
    expect(doc.stage).toBeLessThanOrEqual(1);
    expect((doc.hist as Array<{ m: string }>).some((x) => x.m === 'known')).toBe(false);
  });

  it('richtig, aber mit Tipp → keine Abkürzung', async () => {
    S.startSession('pflicht');
    const key = S.useSession.getState().queue[0]?.key ?? '';
    S.startKnownProbe();
    S.commitAnswer({ grade: 2, given: 'word0', ms: 2000, ok: true, hint: 2 });
    await persist.flush();
    await settle();
    const doc = h.dump()[key] as Doc;
    expect((doc.hist as Array<{ m: string }>).some((x) => x.m === 'known')).toBe(false);
  });
});
