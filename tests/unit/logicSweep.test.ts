import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWriter, type Writer } from '../../src/data/writer';
import { createMemoryDb, type MemoryDbHandle } from '../../src/platform/dev/memoryDb';
import type { Db } from '../../src/platform/types';
import { useLive } from '../../src/data/live';
import { dayKey } from '../../src/domain/date';
import { deriveToday, type DayEntry } from '../../src/domain/plan/buildPlan';
import type { StoredPlan } from '../../src/domain/plan/types';
import { mergeLogEntries, type AnyLogEntry, type LogEntry } from '../../src/domain/progress/logPatch';
import { compactSeq } from '../../src/domain/progress/profilePatch';
import { compactPlan, profileWithout } from '../../src/domain/capacity/compact';
import { gramRoundPartial } from '../../src/domain/grammar/tasks';
import { DUTY_ROUND } from '../../src/domain/plan/channels';
import { buildTrainCards } from '../../src/domain/srs/cards';
import { dueCards, planRound } from '../../src/domain/srs/queue';
import type { AnswerEvent } from '../../src/domain/srs/types';
import { runDailyIntake } from '../../src/features/progress/dayJobs';
import { berlin, loadSeed } from './helpers';

// Befunde der Logik-Prüfung (B1, W1–W4, H1–H4) mit erfundenen Daten.

type Doc = Record<string, unknown>;
const holder = vi.hoisted(() => ({ writer: null as Writer | null, db: null as Db | null }));
vi.mock('../../src/data', () => ({ getWriter: () => holder.writer }));
vi.mock('../../src/platform/capabilities', async (orig) => ({ ...(await orig<Record<string, unknown>>()), getDb: () => holder.db }));

const persist = await import('../../src/features/progress/persist');
const store = await import('../../src/features/today/store');
const vocabSession = await import('../../src/features/vocab/session');

const plan = (d: string, duty: StoredPlan['duty'], review = 0): StoredPlan => ({ d, ids: [], why: [], v: 1, duty, goal: { review }, lesson: null, at: 0 });
const baseProfile = (): Doc => ({ days: {}, xpDays: {}, act: {}, answers: 0, vAnswers: 0, gAnswers: 0, xp: 0 });
const ans = (t: number, day: string, id: string): AnswerEvent => ({ t, day, kind: 'v', id, ex: 'type', grade: 3, given: 'x', ans: 'x', ms: 1000, lang: 'de', ctx: 'rev' });

let h: MemoryDbHandle;
const setup = (seed: Record<string, Doc>) => {
  h = createMemoryDb({ seed });
  holder.db = h.db;
  holder.writer = createWriter(h.db);
};
const profile = () => h.dump()['app/profile'] as Doc;

beforeEach(() => {
  persist.resetPersistForTests();
  store.resetTodayForTests();
  useLive.setState({ day: null, docs: {}, collections: {} });
  vi.spyOn(Math, 'random').mockReturnValue(0);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  holder.writer = null;
  holder.db = null;
});

describe('B1: Pflicht des Vortags geht über 04:00 nicht verloren', () => {
  const D = '2026-10-06';
  const D2 = '2026-10-07';

  it('gescheiterter Stapel wird erst am Folgetag gesendet → pflicht[Vortag] = 1', async () => {
    setup({ 'app/profile': baseProfile() });
    store.useTodayPlan.setState({ day: D, plan: plan(D, ['ch:gram']), status: 'ready', exhausted: null });
    await store.ensureDay(berlin(D, 23, 40)); // Plan steht → Pflicht-Resolver angemeldet
    h.setFailWrites('resource_exhausted');
    await persist.recordRoundEnd({ day: D, act: 'gram', partial: false, n: 6, right: 5, activeMs: 300_000 });
    expect(persist.usePending.getState().failed).toBe(true);
    // 07:00 am Folgetag: neuer Lerntag mit eigenem Plan, dann gelingt das Speichern.
    store.useTodayPlan.setState({ day: D2, plan: plan(D2, ['ch:gram']), status: 'ready', exhausted: null });
    h.setFailWrites(undefined);
    await persist.flush();
    expect((profile().act as Record<string, Doc>)[D]?.gram).toBe(1);
    expect((profile().pflicht as Doc | undefined)?.[D]).toBe(1);
    expect((profile().pflicht as Doc | undefined)?.[D2]).toBeUndefined();
  });

  it('Runde über 04:00: Wiederholungen des Vortags setzen dessen Pflicht (Live-Einträge gemerkt)', async () => {
    setup({ 'app/profile': baseProfile() });
    store.useTodayPlan.setState({ day: D, plan: plan(D, ['review'], 3), status: 'ready', exhausted: null });
    const first: DayEntry = { t: 1, k: 'v', id: 'w0', ok: true, ctx: 'rev' };
    useLive.setState({ day: { key: D, doc: { date: D, entries: [first] }, invalid: false } });
    await store.ensureDay(berlin(D, 23, 50));
    // 04:01: Tageswechsel, das Live-Abo zeigt schon den neuen Tag.
    store.useTodayPlan.setState({ day: D2, plan: plan(D2, ['review'], 3), status: 'ready', exhausted: null });
    useLive.setState({ day: { key: D2, doc: null, invalid: false } });
    persist.recordAnswer(ans(10, D, 'w1'), false);
    persist.recordAnswer(ans(11, D, 'w2'), false);
    await persist.recordRoundEnd({ day: D, act: 'review', partial: false, n: 3, right: 3, activeMs: 120_000 });
    expect((profile().pflicht as Doc | undefined)?.[D]).toBe(1);
  });

  it('beim Tageswechsel wird der Vortag einmal geheilt (Zähler da, pflicht fehlte)', async () => {
    setup({ 'app/profile': { ...baseProfile(), days: { [D]: 6 }, act: { [D]: { gram: 1 } } } });
    store.useTodayPlan.setState({ day: D, plan: plan(D, ['ch:gram']), status: 'ready', exhausted: null });
    store.useTodayPlan.setState({ day: D2, plan: plan(D2, ['ch:gram']), status: 'ready', exhausted: null });
    await store.ensureDay(berlin(D2, 8));
    await vi.waitFor(() => expect((profile().pflicht as Doc | undefined)?.[D]).toBe(1));
    expect((profile().pflicht as Doc | undefined)?.[D2]).toBeUndefined();
  });
});

describe('W1: gescheiterte Karte des Tagesauftrags wird nachgeholt', () => {
  it('Tag bleibt offen, der nächste Abgleich legt die Karte an', async () => {
    const daily = { newWords: [{ word: 'to streamline', pos: 'verb', de: 'straffen', def: 'to make simpler', ex: 'We [streamline] the process.', level: 'C1' }], grammarItems: [] };
    setup({ 'daily/2026-10-05': daily });
    const writer = holder.writer as Writer;
    h.failWritesTo('vocab/to-streamline', 'unavailable', 2);
    h.failWritesTo('vocab/streamline', 'unavailable', 2);
    const now = berlin('2026-10-06', 9);
    const r1 = await runDailyIntake({ db: h.db, writer, nowMs: now, tab: 't1', today: '2026-10-06', knownVocab: new Set(), grammarDocs: new Map() });
    expect(r1.status).toBe('error');
    expect(Object.keys(h.dump()).filter((k) => k.startsWith('vocab/'))).toHaveLength(0);
    await new Promise((r) => setTimeout(r, 20));
    const r2 = await runDailyIntake({ db: h.db, writer, nowMs: now + 86_400_000, tab: 't1', today: '2026-10-07', knownVocab: new Set(), grammarDocs: new Map() });
    expect(r2.status).toBe('done');
    expect(Object.keys(h.dump()).filter((k) => k.startsWith('vocab/'))).toHaveLength(1);
  });
});

describe('W2: Wiederholungen haben Vorrang, neue Wörter kommen trotzdem', () => {
  const seed = loadSeed();
  const vocab = new Map(Object.entries(seed).filter(([k]) => k.startsWith('vocab/')).map(([k, v]) => [k.slice(6), v]));
  const now = berlin('2026-12-01', 12);
  const cards = buildTrainCards(vocab, now);

  it('viele Fällige: neue höchstens ~40 % des Budgets, mindestens 10 Fällige', () => {
    expect(dueCards(cards.filter((c) => !c.hidden), now).length).toBeGreaterThan(40);
    const r = planRound({ cards, nowMs: now, newPerDay: 10, introducedToday: 0, lang: 'de' });
    expect(r.new).toBeLessThanOrEqual(5);
    expect(r.new).toBeGreaterThanOrEqual(2);
    expect(r.due).toBeGreaterThanOrEqual(10);
  });

  it('Untergrenze min(2, newPerDay) bleibt', () => {
    expect(planRound({ cards, nowMs: now, newPerDay: 2, introducedToday: 0, lang: 'de' }).new).toBe(2);
    expect(planRound({ cards, nowMs: now, newPerDay: 0, introducedToday: 0, lang: 'de' }).new).toBe(0);
  });
});

describe('W4: Kürzung auf 300 behält die Wiederholungen', () => {
  it('„Wiederholen" bleibt erledigt, auch nach vielen freiwilligen Antworten', () => {
    const day = '2026-10-06';
    const p = plan(day, ['review'], 20);
    const t0 = 1_790_000_000_000;
    const entry = (t: number, id: string, ctx: LogEntry['ctx']): AnyLogEntry => ({ t, ok: true, lang: 'de', k: 'v', id, m: 'recog', given: 'x', ans: 'x', g: 3, ms: 1000, ctx });
    const rev = Array.from({ length: 20 }, (_, k) => entry(t0 + k, `r${k}`, 'rev'));
    let log = mergeLogEntries([], rev);
    expect(deriveToday({ day, plan: p, entries: log as DayEntry[], minutes: 10 }).duties.items[0]?.state).toBe('done');
    const extra = Array.from({ length: 290 }, (_, k) => entry(t0 + 1000 + k, `x${k}`, 'xtra'));
    log = mergeLogEntries(log, extra);
    expect(log).toHaveLength(300);
    expect(deriveToday({ day, plan: p, entries: log as DayEntry[], minutes: 60 }).duties.items[0]?.state).toBe('done');
    // Nach Zeit sortiert, die neuesten freiwilligen bleiben.
    const ts = (log as Array<{ t: number }>).map((e) => e.t);
    expect([...ts].sort((a, b) => a - b)).toEqual(ts);
    expect(ts.at(-1)).toBe(t0 + 1000 + 289);
  });
});

describe('H1: leere Pflichtrunde nach dem Neuladen', () => {
  it('Ziel > 0, nichts abzufragen → „Wiederholen" gilt als erschöpft', () => {
    setup({});
    const day = dayKey(Date.now());
    store.useTodayPlan.setState({ day, plan: plan(day, ['review'], 5), status: 'ready', exhausted: null });
    // Nur Startwörter (neu) und heute keine neuen mehr: nichts Fälliges, nichts Neues.
    useLive.setState({ docs: { 'app/profile': { ...baseProfile(), newPerDay: 0 } } });
    const first = vocabSession.startSession('pflicht');
    expect(first).toBeNull();
    expect(store.useTodayPlan.getState().exhausted).toBe(day);
  });
});

describe('H2: stillgelegte lxSeq-Einträge', () => {
  it('fallen beim Verdichten weg, Zahlen bleiben', () => {
    expect(compactSeq({ a: 5, b: null, c: 7 })).toEqual({ a: 5, c: 7 });
    const prof: Doc = { ...baseProfile(), days: { '2023-03-01': 3, '2026-10-01': 4 }, lxSeq: { tabA: 1, tabB: null, tabC: null } };
    const slim = profileWithout(prof, compactPlan(prof, '2026-10-06', 1));
    expect(slim.lxSeq).toEqual({ tabA: 1 });
    expect(slim.days).toEqual({ '2026-10-01': 4 });
  });
});

describe('H3: Grammatik-Pflicht erst mit voller Pflichtrunde', () => {
  it('weniger als DUTY_ROUND.gram Antworten → teilweise', () => {
    const n = DUTY_ROUND.gram;
    expect(gramRoundPartial({ aborted: false, pos: 3, tasks: 3, ctx: 'duty', answers: 3, dutyMin: n })).toBe(true);
    expect(gramRoundPartial({ aborted: false, pos: n, tasks: n, ctx: 'duty', answers: n, dutyMin: n })).toBe(false);
    expect(gramRoundPartial({ aborted: false, pos: 3, tasks: 3, ctx: 'xtra', answers: 3, dutyMin: n })).toBe(false);
    expect(gramRoundPartial({ aborted: true, pos: 2, tasks: 8, ctx: 'xtra', answers: 2, dutyMin: n })).toBe(true);
    // Reguläre Pflichtrunde mit nur 3 verfügbaren Aufgaben, vollständig beantwortet → erfüllt (nie unerfüllbar).
    expect(gramRoundPartial({ aborted: false, pos: 3, tasks: 3, ctx: 'duty', mode: 'duty', answers: 3, dutyMin: n })).toBe(false);
    expect(gramRoundPartial({ aborted: false, pos: 1, tasks: 1, ctx: 'duty', mode: 'errors', answers: 1, dutyMin: n })).toBe(true);
  });
});

describe('H4: Tagesauftrag nach 20 Uhr beim Sichtbarwerden neu abgleichen', () => {
  it('einmal je Lerntag, ohne Zeitgeber', async () => {
    const day = '2026-10-06';
    setup({});
    store.useTodayPlan.setState({ day, plan: plan(day, []), status: 'ready', exhausted: null });
    // Der Tagesauftrag kommt erst im Laufe des Tages an.
    await h.db.doc(`daily/${day}`).set({ newWords: [{ word: 'to pivot', pos: 'verb', de: 'umschwenken', def: 'to change direction', ex: 'We had to [pivot].', level: 'B2' }], grammarItems: [] });
    await store.ensureDay(berlin(day, 19));
    await new Promise((r) => setTimeout(r, 30));
    expect(Object.keys(h.dump()).filter((k) => k.startsWith('vocab/'))).toHaveLength(0);
    await store.ensureDay(berlin(day, 21));
    await vi.waitFor(() => expect(Object.keys(h.dump()).filter((k) => k.startsWith('vocab/'))).toHaveLength(1));
  });
});
