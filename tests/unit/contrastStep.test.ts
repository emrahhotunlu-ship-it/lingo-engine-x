import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWriter, type Writer } from '../../src/data/writer';
import { createMemoryDb, type MemoryDbHandle } from '../../src/platform/dev/memoryDb';
import type { Db } from '../../src/platform/types';
import { useLive } from '../../src/data/live';
import { dayKey } from '../../src/domain/date';
import { contrastMissOp } from '../../src/domain/srs/applyReview';
import { toTrainCard } from '../../src/domain/srs/cards';
import { buildExercise } from '../../src/domain/srs/exercise';
import type { AnswerEvent, QueueItem, TrainCard } from '../../src/domain/srs/types';

// Lernplattform 3.0 P52, Korrekturrunde 2: „Welches Wort passt?“ ist ein reiner Zusatzschritt. Er kommt nur nach einer RICHTIGEN regulären
// Abfrage, ändert die Planung nie (auch nicht bei falscher Wahl), reiht nichts als „Nochmal“ ein und zählt nicht zum Rundenzähler.

type Doc = Record<string, unknown>;
const holder = vi.hoisted(() => ({ writer: null as Writer | null, db: null as Db | null }));
vi.mock('../../src/data', () => ({ getWriter: () => holder.writer }));
vi.mock('../../src/platform/capabilities', async (orig) => ({ ...(await orig<Record<string, unknown>>()), getDb: () => holder.db }));
vi.mock('../../src/app/unit/done', () => ({ unitDone: () => undefined, setUnitDoneHandler: () => undefined }));
vi.mock('../../src/domain/srs/crossLink', () => ({ crossSentences: () => [] }));

const persist = await import('../../src/features/progress/persist');
const store = await import('../../src/features/today/store');
const S = await import('../../src/features/vocab/session');

const NOW = Date.now();
const DAY = dayKey(NOW);
const DAY_MS = 86_400_000;
const PV = 'word-ctx@1';
const CFX = [
  {
    w: 'influence',
    en: 'Her influence on the final budget decision was clear to everyone in the room.',
    why: { de: 'influence ist allgemeiner Einfluss, leverage ist ein Druckmittel.', en: 'Influence is general sway; leverage is a bargaining advantage.' },
    t: NOW - 1000,
    pv: PV,
  },
];

const base = (id: string, word: string, de: string, ex: string, over: Doc = {}): Doc => ({
  id,
  word,
  pos: 'noun',
  de,
  def: `meaning of ${word}`,
  ex,
  col: [],
  level: 'C1',
  state: 'review',
  S: 10,
  D: 5,
  last: NOW - 10 * DAY_MS,
  due: NOW - 1000,
  reps: 4,
  lapses: 0,
  modes: {},
  order: 900,
  src: 'ai',
  added: '2026-08-01',
  stage: 2,
  hist: [],
  intro: '2026-08-01',
  ...over,
});
const LEV = base('leverage', 'leverage', 'Hebelwirkung', 'We use [leverage] in every price talk.', { cfx: CFX });
const INF = base('influence', 'influence', 'Einfluss', 'She has [influence] in the team.');
const settle = () => new Promise((r) => setTimeout(r, 30));
const PLAN = ['vocab/leverage', 'vocab/influence'];

let h: MemoryDbHandle;

function startWith(levDoc: Doc): void {
  const lev = toTrainCard('leverage', levDoc, true, NOW) as TrainCard;
  const inf = toTrainCard('influence', INF, true, NOW) as TrainCard;
  const cards = new Map<string, TrainCard>([
    [lev.key, lev],
    [inf.key, inf],
  ]);
  const queue: QueueItem[] = PLAN.map((key) => ({ key, reason: 'due', phase: 'quiz' }));
  const exercise = buildExercise(lev, 'mc_de', 'de', [lev, inf], 'seed');
  S.useSession.setState({
    active: true,
    status: 'running',
    round: 'extra',
    day: DAY,
    lang: 'de',
    cards,
    pool: [lev, inf],
    queue,
    pos: 0,
    exercise,
    step: 1,
    shown: {},
    recentEx: [],
    answered: [],
    results: [],
    target: 2,
    doneBefore: 0,
    repairs: [],
    repairPos: 0,
    mode: 'type',
    contrasted: false,
  });
}

const stored = (): Doc => h.dump()['vocab/leverage'] as Doc;
const PLANNING = ['fsrs', 'S', 'D', 'due', 'lapses', 'stage', 'reps', 'last', 'xs', 'modes'] as const;
const planning = (d: Doc) => Object.fromEntries(PLANNING.map((k) => [k, d[k]]));

describe('contrastMissOp (rein)', () => {
  const a = (t: number): AnswerEvent => ({ t, day: DAY, kind: 'v', id: 'leverage', ex: 'contrast', grade: 3, given: 'leverage', ans: 'influence', ms: 900, lang: 'de', ctx: 'xtra' });
  it('nur hist: genau ein Eintrag {x: contrast, g: 1}; derselbe Zeitstempel nie doppelt; ausgeblendet/fehlend → null', () => {
    const op = contrastMissOp('vocab/leverage', LEV, a(NOW));
    expect(Object.keys(op?.update ?? {})).toEqual(['hist']);
    expect(op?.update.hist).toHaveLength(1);
    expect((op?.update.hist as Doc[])[0]).toMatchObject({ t: NOW, g: 1, x: 'contrast' });
    expect(contrastMissOp('vocab/leverage', { ...LEV, hist: [{ t: NOW, g: 1, x: 'contrast' }] }, a(NOW))).toBeNull();
    expect(contrastMissOp('vocab/leverage', { ...LEV, hidden: true }, a(NOW))).toBeNull();
    expect(contrastMissOp('vocab/leverage', undefined, a(NOW))).toBeNull();
  });
});

describe('Kontrast-Schritt in der Runde', () => {
  beforeEach(() => {
    persist.resetPersistForTests();
    store.resetTodayForTests();
    h = createMemoryDb({ seed: { 'vocab/leverage': LEV, 'vocab/influence': INF } });
    holder.db = h.db;
    holder.writer = createWriter(h.db);
    useLive.setState({ day: null, docs: { 'app/profile': { newPerDay: 3 } }, collections: { vocab: new Map([['leverage', LEV], ['influence', INF]]), chunk: new Map() } });
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

  it('reguläre Abfrage richtig → Kontrast direkt danach; Zähler „n / gesamt“ und „+n“ bleiben beim Kontrast unverändert', () => {
    startWith(LEV);
    const before = S.roundProgress(S.useSession.getState());
    S.commitAnswer({ grade: 3, given: 'Hebelwirkung', ms: 1500, ok: true });
    const s = S.useSession.getState();
    expect(s.queue[s.pos]).toMatchObject({ key: 'vocab/leverage', reason: 'contrast' });
    expect(s.exercise?.ex).toBe('contrast');
    expect(S.roundProgress(s)).toEqual(before);
  });

  it('reguläre Abfrage falsch → kein Kontrast in dieser Runde', () => {
    startWith(LEV);
    S.commitAnswer({ grade: 1, given: 'Einfluss', ms: 1500, ok: false });
    const s = S.useSession.getState();
    expect(s.queue.some((q) => q.reason === 'contrast')).toBe(false);
    expect(s.contrasted).toBe(false);
  });

  it('Kontrast falsch (Kartenwort gewählt) → fsrs, S, D, due, lapses, stage unverändert, hist genau einen Eintrag länger, kein „Nochmal“', async () => {
    startWith(LEV);
    S.commitAnswer({ grade: 3, given: 'Hebelwirkung', ms: 1500, ok: true });
    await settle();
    const afterRegular = stored();
    const histBefore = (afterRegular.hist as unknown[]).length;
    const s0 = S.useSession.getState();
    expect(s0.exercise?.ex).toBe('contrast');
    const queueLen = s0.queue.length;
    S.commitAnswer({ grade: 1, given: 'leverage', ms: 1500, ok: false });
    await settle();
    const afterMiss = stored();
    expect(planning(afterMiss)).toEqual(planning(afterRegular));
    const hist = afterMiss.hist as Doc[];
    expect(hist).toHaveLength(histBefore + 1);
    expect(hist.at(-1)).toMatchObject({ x: 'contrast', g: 1 });
    const s1 = S.useSession.getState();
    expect(s1.queue).toHaveLength(queueLen);
    expect(s1.queue.slice(s0.pos + 1).some((q) => q.key === 'vocab/leverage')).toBe(false);
    // Lokal genauso: die Karte trägt den Eintrag, die Planung bleibt.
    expect((s1.cards.get('vocab/leverage')?.doc.hist as Doc[]).at(-1)).toMatchObject({ x: 'contrast', g: 1 });
    expect(s1.cards.get('vocab/leverage')?.fsrs.due).toBe(s0.cards.get('vocab/leverage')?.fsrs.due);
  });

  it('Kontrast richtig → Dokument unverändert (nur Protokoll)', async () => {
    startWith(LEV);
    S.commitAnswer({ grade: 3, given: 'Hebelwirkung', ms: 1500, ok: true });
    await settle();
    const afterRegular = stored();
    S.commitAnswer({ grade: 3, given: 'influence', ms: 1500, ok: true });
    await settle();
    expect(stored()).toEqual(afterRegular);
  });
});
