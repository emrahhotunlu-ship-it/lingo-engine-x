import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWriter, type Writer } from '../../src/data/writer';
import { createMemoryDb, type MemoryDbHandle } from '../../src/platform/dev/memoryDb';
import type { Db } from '../../src/platform/types';
import { useLive } from '../../src/data/live';
import { addDays, dayKey } from '../../src/domain/date';
import type { StoredPlan } from '../../src/domain/plan/types';
import { readWk } from '../../src/domain/srs/werkstatt';

// Wort-Lernen 2, Teil 2 – Simulation: Ein Wort mit 3 freien Fehlversuchen kommt in der Pflichtrunde als Werkstatt-Schritt (Diagnose, neuer Anker),
// danach EIN Abruf drei Karten später (Korrekturrunde S5) mit Ruhe 2–3 Tage; nach einem Fehler einmal erneut, dann ohne Ruhe (FSRS). Der Pflicht-Zähler bleibt stimmig: Die Werkstatt ersetzt die Wiederholung (ein Eintrag der Runde, Nenner fest,
// genau eine Antwort für das Wort) und zählt nichts dazu. „Pausieren“ blendet aus und setzt eine fällige Ersatzkarte in die Runde.

type Doc = Record<string, unknown>;
const holder = vi.hoisted(() => ({ writer: null as Writer | null, db: null as Db | null }));
vi.mock('../../src/data', () => ({ getWriter: () => holder.writer }));
vi.mock('../../src/platform/capabilities', async (orig) => ({ ...(await orig<Record<string, unknown>>()), getDb: () => holder.db }));
vi.mock('../../src/app/unit/done', () => ({ unitDone: () => undefined, setUnitDoneHandler: () => undefined }));
vi.mock('../../src/domain/srs/crossLink', () => ({ crossSentences: () => [] }));

const persist = await import('../../src/features/progress/persist');
const store = await import('../../src/features/today/store');
const S = await import('../../src/features/vocab/session');
const { useDecks } = await import('../../src/features/vocab/decksStore');
const { readDecks } = await import('../../src/domain/srs/decks');

const NOW = Date.now();
const DAY = dayKey(NOW);
const DAY_MS = 86_400_000;
const GOAL = 6;
const plan = (review: number): StoredPlan => ({ d: DAY, ids: [], why: [], v: 1, duty: ['review'], goal: { review, new: 0 }, lesson: null, at: 0 });

const WORDS = ['assume', 'deliver', 'ensure', 'expand', 'handle', 'improve', 'measure', 'obtain', 'prevent', 'reduce'];
const DE = ['annehmen', 'liefern', 'sicherstellen', 'erweitern', 'bearbeiten', 'verbessern', 'messen', 'erhalten', 'verhindern', 'senken'];
const fail = (t: number, x = 'cloze'): Doc => ({ t, m: x, g: 1, x });

function deck(over: Doc = {}): Map<string, Doc> {
  const out = new Map<string, Doc>();
  WORDS.forEach((w, i) => {
    out.set(w, {
      word: w,
      de: DE[i],
      def: `to ${w} something`,
      ex: `Every week we [${w}] the open items with the client.`,
      pos: 'verb',
      src: 'lookup',
      added: '2026-08-01',
      intro: '2026-08-01',
      order: i,
      reps: 5,
      lapses: 1,
      state: 'review',
      stage: 3,
      S: 4,
      D: 5,
      last: NOW - 6 * DAY_MS,
      due: NOW - (i + 2) * 3_600_000,
      hist: [],
    });
  });
  // Das Sorgenwort: am längsten fällig, drei freie Fehlversuche an den letzten zwei Lerntagen (nicht am Einführungstag).
  out.set('leverage', {
    word: 'leverage',
    de: 'nutzen',
    def: 'to use something to get an advantage',
    ex: 'We can [leverage] our network in the next round.',
    pos: 'verb',
    src: 'lookup',
    added: '2026-08-01',
    intro: '2026-08-01',
    order: 99,
    reps: 7,
    lapses: 3,
    state: 'review',
    stage: 3,
    S: 1,
    D: 8,
    last: NOW - 6 * DAY_MS,
    due: NOW - 5 * DAY_MS,
    hist: [fail(NOW - 2 * DAY_MS), fail(NOW - DAY_MS, 'type'), fail(NOW - DAY_MS + 60_000)],
    ...over,
  });
  return out;
}

let h: MemoryDbHandle;
function setup(v: Map<string, Doc>): void {
  persist.resetPersistForTests();
  store.resetTodayForTests();
  h = createMemoryDb({ seed: Object.fromEntries([...v].map(([k, d]) => [`vocab/${k}`, d])) });
  holder.db = h.db;
  holder.writer = createWriter(h.db);
  useDecks.setState({ decks: readDecks({ v: 1, prefs: { mode: 'type' } }) });
  useLive.setState({ day: null, docs: { 'app/profile': { newPerDay: 0 } }, collections: { vocab: v, chunk: new Map() } });
  store.useTodayPlan.setState({ day: DAY, plan: plan(GOAL), status: 'ready', exhausted: null });
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(async () => {
  S.commitHeld();
  await persist.flush();
  await new Promise((r) => setTimeout(r, 30));
  vi.restoreAllMocks();
  S.useSession.setState({ active: false });
});

const progress = () => S.roundProgress(S.useSession.getState());

describe('Werkstatt in der Pflichtrunde', () => {
  it('3 Fehlversuche → Werkstatt-Schritt → ein Abruf mit Ruhe; Nenner fest, eine Antwort je Wort, nichts zusätzlich gezählt', async () => {
    setup(deck());
    S.startSession('pflicht');
    const s0 = S.useSession.getState();
    expect(s0.status).toBe('running');
    expect(s0.target).toBe(GOAL);
    const wkItems = s0.queue.filter((q) => q.phase === 'werkstatt');
    expect(wkItems.map((q) => q.key)).toEqual(['vocab/leverage']);
    const total0 = progress()?.total;
    expect(total0).toBe(GOAL);

    const log: Array<{ key: string; phase: string; wk: boolean }> = [];
    for (let guard = 0; guard < 100; guard++) {
      const s = S.useSession.getState();
      if (!s.active || s.status !== 'running') break;
      const item = s.queue[s.pos];
      if (!item) break;
      // Der Nenner wächst nie, auch nicht durch den Werkstatt-Schritt.
      expect(progress()?.total).toBe(total0);
      if (item.phase === 'werkstatt') {
        log.push({ key: item.key, phase: 'werkstatt', wk: false });
        S.continueWerkstatt();
        // Der Abruf kommt NICHT sofort, sondern nach drei anderen Karten.
        expect(S.useSession.getState().exercise?.card.key).not.toBe('vocab/leverage');
      }
      const e = S.useSession.getState().exercise;
      if (!e) break;
      if (e.wk) {
        // Der Abruf ist ein Abruf mit Anfangsbuchstaben bzw. Bausteinen (nach dem neuen Anker), keine Aufdeckkarte.
        expect(e.card.key).toBe('vocab/leverage');
        expect(e.ex).not.toBe('flip');
      }
      log.push({ key: e.card.key, phase: 'quiz', wk: e.wk === true });
      S.commitAnswer({ grade: 3, given: e.accepted[0] ?? e.card.word, ms: 2500, ok: true });
    }
    S.commitHeld();
    const entries = S.todayEntries(DAY);
    await persist.flush();

    // Genau ein Werkstatt-Schritt und genau EINE gewertete Antwort für das Sorgenwort.
    expect(log.filter((r) => r.phase === 'werkstatt')).toHaveLength(1);
    expect(log.filter((r) => r.phase === 'quiz' && r.key === 'vocab/leverage')).toHaveLength(1);
    expect(log.filter((r) => r.wk)).toHaveLength(1);
    const wkAt = log.findIndex((r) => r.phase === 'werkstatt');
    expect(log.findIndex((r) => r.wk) - wkAt).toBe(4);
    // Tagesprotokoll: je beantworteter Karte genau ein Eintrag, das Sorgenwort einmal (mit Werkstatt-Kennzeichen).
    expect(entries.filter((x) => JSON.stringify(x).includes('leverage'))).toHaveLength(1);
    // Pflicht-Zähler: so viele verschiedene Karten wie geplant – nicht mehr (Werkstatt ersetzt die Wiederholung).
    const keys = new Set(log.filter((r) => r.phase === 'quiz').map((r) => r.key));
    expect(keys.size).toBe(GOAL);
    expect(entries.length).toBe(GOAL);
    // Gespeichert: wk {n:1, d:heute}, Fälligkeit 2–3 Tage später; am nächsten Tag keine neue Werkstatt.
    await new Promise((r) => setTimeout(r, 30));
    const doc = h.dump()['vocab/leverage'];
    if (!doc) throw new Error('vocab/leverage fehlt');
    expect(readWk(doc)).toMatchObject({ n: 1, d: DAY });
    const dueDay = dayKey(Number(doc.due));
    expect(dueDay >= addDays(DAY, 2) && dueDay <= addDays(DAY, 3)).toBe(true);
  });

  it('Fehler beim verzögerten Abruf → genau eine Wiederholung drei Karten später; keine Ruhe nach dem Fehler, eine Runde (n = 1)', async () => {
    setup(deck());
    S.startSession('pflicht');
    const log: Array<{ key: string; wk: boolean; pos: number }> = [];
    let first = true;
    let lenAtFail = 0;
    for (let guard = 0; guard < 100; guard++) {
      const s = S.useSession.getState();
      if (!s.active || s.status !== 'running') break;
      const item = s.queue[s.pos];
      if (!item) break;
      if (item.phase === 'werkstatt') {
        S.continueWerkstatt();
        continue;
      }
      const e = s.exercise;
      if (!e) break;
      log.push({ key: e.card.key, wk: e.wk === true, pos: s.pos });
      if (e.wk && first) {
        first = false;
        lenAtFail = s.queue.length;
        S.commitAnswer({ grade: 1, given: 'exploit', ms: 4000, ok: false });
        // Nach dem Fehler (vor der Wiederholung): Fälligkeit wie FSRS sie rechnet, nicht in die Ruhe geschoben.
        await persist.flush();
        await new Promise((r) => setTimeout(r, 30));
        const mid = h.dump()['vocab/leverage'];
        if (!mid) throw new Error('vocab/leverage fehlt');
        expect(dayKey(Number(mid.due)) < addDays(DAY, 2)).toBe(true);
        expect(readWk(mid)).toMatchObject({ n: 1, d: DAY });
        continue;
      }
      S.commitAnswer({ grade: 3, given: e.accepted[0] ?? e.card.word, ms: 2500, ok: true });
    }
    S.commitHeld();
    await persist.flush();
    await new Promise((r) => setTimeout(r, 30));
    const recalls = log.filter((r) => r.wk);
    expect(recalls).toHaveLength(2);
    // Drei andere Karten dazwischen – höchstens ans Ende der Runde (hier ist die Runde kürzer).
    expect(recalls[1]!.pos - recalls[0]!.pos).toBe(Math.min(4, lenAtFail - recalls[0]!.pos));
    const doc = h.dump()['vocab/leverage'];
    if (!doc) throw new Error('vocab/leverage fehlt');
    // Die gelungene Wiederholung legt die Ruhe; dieselbe Werkstatt zählt als eine Runde.
    expect(readWk(doc)).toMatchObject({ n: 1, d: DAY });
    const dueDay = dayKey(Number(doc.due));
    expect(dueDay >= addDays(DAY, 2) && dueDay <= addDays(DAY, 3)).toBe(true);
  });

  it('„pausieren“ (ab 6 Vergessen): Wort ausgeblendet, fällige Ersatzkarte in der Runde, Nenner unverändert', () => {
    // Mehr fällige Karten als die Runde fasst, damit es einen Ersatz gibt.
    setup(deck({ lapses: 6 }));
    S.startSession('pflicht');
    const s0 = S.useSession.getState();
    const target = s0.target;
    const total0 = progress()?.total;
    // Bis zum Werkstatt-Schritt spielen.
    for (let guard = 0; guard < 50; guard++) {
      const s = S.useSession.getState();
      const item = s.queue[s.pos];
      if (!item || item.phase === 'werkstatt') break;
      const e = s.exercise;
      if (!e) break;
      S.commitAnswer({ grade: 3, given: e.accepted[0] ?? e.card.word, ms: 2500, ok: true });
    }
    const before = S.useSession.getState();
    expect(before.queue[before.pos]?.phase).toBe('werkstatt');
    const inBefore = new Set(before.queue.map((q) => q.key));
    const hidden: string[] = [];
    S.pauseWord((c) => {
      hidden.push(c.key);
      return Promise.resolve(true);
    });
    const after = S.useSession.getState();
    expect(hidden).toEqual(['vocab/leverage']);
    expect(after.queue.slice(after.pos).some((q) => q.key === 'vocab/leverage')).toBe(false);
    const added = after.queue.filter((q) => !inBefore.has(q.key));
    expect(added).toHaveLength(1);
    expect(after.target).toBe(target);
    expect(progress()?.total).toBe(total0);
  });

  it('Extra-Runde „Abend-Check“ (free): keine Werkstatt, keine Aktivierung, nur freier Abruf', () => {
    setup(deck());
    S.startSession('extra', { only: ['vocab/leverage', 'vocab/assume'], mode: 'type', free: true, allowNew: false, label: 'Abend-Check' });
    const s = S.useSession.getState();
    expect(s.free).toBe(true);
    expect(s.queue.some((q) => q.phase === 'werkstatt')).toBe(false);
    expect(s.acts.size).toBe(0);
    const ex = s.exercise?.ex;
    expect(['cloze', 'type', 'cloze_part']).toContain(ex);
    expect(S.trainerSnapshot()?.free).toBe(true);
  });
});
