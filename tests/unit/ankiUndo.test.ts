import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWriter, type Writer } from '../../src/data/writer';
import { createMemoryDb, type MemoryDbHandle } from '../../src/platform/dev/memoryDb';
import type { Db } from '../../src/platform/types';
import { useLive } from '../../src/data/live';
import { dayKey } from '../../src/domain/date';
import type { StoredPlan } from '../../src/domain/plan/types';

// B4 Anki „Rückgängig“: Eine Aufdeck-Bewertung wird 5 s zurückgehalten. Bis zum Festschreiben ist
// nichts gespeichert (Karte, Protokoll, Zähler, Rundenende); „Rückgängig“ stellt die Runde exakt
// wieder her. Festgeschrieben wird genau einmal: nach Ablauf, bei der nächsten Antwort, beim Verlassen.

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
const card = (i: number): Doc => ({ word: `word${i}`, de: `Wort ${i}`, def: `word number ${i}`, ex: `We say [word${i}] often.`, pos: 'noun', state: 'review', stage: 1, S: 3, D: 5, due: NOW - 86_400_000 * (10 - i), last: NOW - 86_400_000 * 20, reps: 3, lapses: 0, src: 'lookup' });
const vocab = (n: number) => new Map(Array.from({ length: n }, (_, i) => [`word${i}`, card(i)] as [string, Doc]));
const settle = () => new Promise((r) => setTimeout(r, 30));
const cardWrites = () => h.writes().filter((w) => w.path.startsWith('vocab/'));
const flip = (grade: 1 | 2 | 3 | 4) => S.commitAnswer({ grade, given: '', ms: 2000, ok: grade > 1, t: persist.nextT() });

let h: MemoryDbHandle;
beforeEach(() => {
  persist.resetPersistForTests();
  store.resetTodayForTests();
  h = createMemoryDb({ seed: Object.fromEntries([...vocab(8)].map(([k, v]) => [`vocab/${k}`, v])) });
  holder.db = h.db;
  holder.writer = createWriter(h.db);
  holder.done = [];
  useDecks.setState({ decks: readDecks({ v: 1, prefs: { mode: 'auto' } }) });
  useLive.setState({ day: null, docs: { 'app/profile': { newPerDay: 0 } }, collections: { vocab: vocab(8), chunk: new Map() } });
  store.useTodayPlan.setState({ day: DAY, plan: plan(6), status: 'ready', exhausted: null });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(async () => {
  S.commitHeld();
  vi.useRealTimers();
  // Laufende Sammel-Schreibvorgänge dieses Tests abwarten (sonst träfen sie den nächsten).
  await persist.flush();
  await settle();
  vi.restoreAllMocks();
  S.useSession.setState({ active: false });
});

describe('Rückgängig (B4)', () => {
  it('hält die Aufdeck-Bewertung zurück: nichts gespeichert, nichts vorgemerkt', async () => {
    S.startSession('pflicht');
    expect(S.useSession.getState().exercise?.ex).toBe('flip');
    flip(3);
    await settle();
    expect(cardWrites()).toHaveLength(0);
    expect(persist.usePending.getState().entries).toHaveLength(0);
    expect(S.useUndo.getState().t).not.toBeNull();
  });

  it('stellt die Runde exakt wieder her (Karte, Zähler, Warteschlange, Wiedervorlage)', async () => {
    S.startSession('pflicht');
    const before = S.useSession.getState();
    const key = before.exercise?.card.key;
    flip(1); // „Nochmal“ reiht die Karte wieder ein
    expect(S.useSession.getState().queue.length).toBe(before.queue.length + 1);
    expect(S.undoLast()).toBe('choice');
    const after = S.useSession.getState();
    expect(after.pos).toBe(before.pos);
    expect(after.queue).toEqual(before.queue);
    expect(after.results).toEqual(before.results);
    expect(after.answered).toEqual(before.answered);
    expect(after.shown).toEqual(before.shown);
    expect(after.cards.get(key ?? '')).toBe(before.cards.get(key ?? ''));
    expect(after.exercise?.card.key).toBe(key);
    expect(after.step).toBeGreaterThan(before.step);
    expect(after.status).toBe('running');
    expect(S.useUndo.getState().t).toBeNull();
    // Nichts wurde je geschrieben – auch nicht später.
    S.commitHeld();
    await persist.flush();
    await settle();
    expect(cardWrites()).toHaveLength(0);
    expect(h.dump()['app/profile']).toBeUndefined();
  });

  it('neue Bewertung nach „Rückgängig“ wird genau einmal gespeichert', async () => {
    S.startSession('pflicht');
    const id = S.useSession.getState().exercise?.card.id ?? '';
    flip(1);
    S.undoLast();
    const t2 = persist.nextT();
    S.commitAnswer({ grade: 4, given: '', ms: 1500, ok: true, t: t2 });
    S.commitHeld();
    await persist.flush();
    await settle();
    const doc = h.dump()[`vocab/${id}`] as Doc;
    expect(doc.last).toBe(t2);
    const hist = doc.hist as Array<{ t: number; g: number }>;
    expect(hist.filter((x) => x.g === 1)).toHaveLength(0);
    expect(hist.at(-1)).toMatchObject({ t: t2, g: 4 });
    const log = h.dump()[`log/${DAY}`] as { entries: Array<{ t: number }> };
    expect(log.entries.map((e) => e.t)).toEqual([t2]);
    const profile = h.dump()['app/profile'] as { days: Record<string, number> };
    expect(profile.days[DAY]).toBe(1);
  });

  it('die nächste Antwort schreibt die vorige fest; danach kein Rückgängig mehr für sie', async () => {
    S.startSession('pflicht');
    const first = S.useSession.getState().exercise?.card.id ?? '';
    flip(3);
    const heldT = S.useUndo.getState().t;
    flip(3);
    expect(S.useUndo.getState().t).not.toBe(heldT);
    await settle();
    expect(cardWrites().map((w) => w.path)).toEqual([`vocab/${first}`]);
    await persist.flush();
    const log = h.dump()[`log/${DAY}`] as { entries: Array<{ t: number }> };
    expect(log.entries.map((e) => e.t)).toEqual([heldT]);
  });

  it('nach dem Weitergehen (Überspringen) ist „Rückgängig“ vorbei, die Bewertung gilt', async () => {
    S.startSession('pflicht');
    flip(3);
    S.skipCurrent();
    expect(S.undoLast()).toBe(false);
    await settle();
    expect(cardWrites()).toHaveLength(1);
  });

  it('schreibt nach 5 s von selbst fest', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    S.startSession('pflicht');
    flip(3);
    vi.advanceTimersByTime(S.UNDO_MS - 1);
    expect(S.useUndo.getState().t).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(S.useUndo.getState().t).toBeNull();
    expect(persist.usePending.getState().entries.length + (h.dump()[`log/${DAY}`] ? 1 : 0)).toBeGreaterThan(0);
    await vi.runAllTimersAsync();
    vi.useRealTimers();
  });

  it('Tippen wird nicht zurückgehalten', () => {
    useDecks.setState({ decks: readDecks({ v: 1, prefs: { mode: 'type' } }) });
    S.startSession('pflicht');
    expect(S.useSession.getState().exercise?.ex).not.toBe('flip');
    S.commitAnswer({ grade: 3, given: 'x', ms: 2000, ok: true });
    expect(S.useUndo.getState().t).toBeNull();
    expect(persist.usePending.getState().entries).toHaveLength(1);
  });

  it('letzte Karte einer Runde gilt sofort (Rundenende, act/Serie unverändert); die vorige wird dabei festgeschrieben', async () => {
    store.useTodayPlan.setState({ day: DAY, plan: plan(2), status: 'ready', exhausted: null });
    S.startSession('pflicht');
    flip(3);
    expect(S.useUndo.getState().t).not.toBeNull();
    flip(3);
    expect(S.useSession.getState().status).toBe('summary');
    expect(S.useUndo.getState().t).toBeNull();
    expect(S.undoLast()).toBe(false);
    await persist.flush();
    await settle();
    await persist.flush();
    expect(cardWrites()).toHaveLength(2);
    const profile = h.dump()['app/profile'] as { act: Record<string, Record<string, number>>; days: Record<string, number> };
    expect(profile.act[DAY]?.review).toBe(1);
    expect(profile.days[DAY]).toBe(2);
  });

  it('Verlassen schreibt die zurückgehaltene Bewertung fest', async () => {
    S.startSession('pflicht');
    flip(3);
    S.leaveSession();
    expect(S.useUndo.getState().t).toBeNull();
    await persist.flush();
    await settle();
    expect(cardWrites()).toHaveLength(1);
    expect((h.dump()[`log/${DAY}`] as { entries: unknown[] }).entries).toHaveLength(1);
  });

  it('Ende von Block 1 der Tageseinheit wird nicht zurückgehalten', () => {
    store.useTodayPlan.setState({ day: DAY, plan: plan(1), status: 'ready', exhausted: null });
    S.startSession('pflicht', { unit: true });
    flip(3);
    expect(S.useUndo.getState().t).toBeNull();
    expect(holder.done).toEqual([1]);
  });
});

describe('Hör-Modus in der Runde (N35)', () => {
  it('Stapel im Hör-Modus fragt per Hör-Lücke; ohne Sprachausgabe über die Leiter', async () => {
    const { useSpeech } = await import('../../src/platform/speech');
    const prev = useSpeech.getState().status;
    useSpeech.setState({ status: 'ready' });
    S.startSession('extra', { deck: 'all', mode: 'listen', size: 5 });
    expect(S.useSession.getState().exercise?.ex).toBe('dictation');
    expect(S.useSession.getState().exercise?.speak).toContain('We say');
    useSpeech.setState({ status: 'novoice' });
    S.startSession('extra', { deck: 'all', mode: 'listen', size: 5 });
    const ex = S.useSession.getState().exercise?.ex;
    expect(ex).not.toBe('dictation');
    expect(ex).not.toBe('flip');
    useSpeech.setState({ status: prev });
  });
});
