import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWriter, type Writer } from '../../src/data/writer';
import { createMemoryDb, type MemoryDbHandle } from '../../src/platform/dev/memoryDb';
import type { Db } from '../../src/platform/types';
import { useLive } from '../../src/data/live';
import { dayKey } from '../../src/domain/date';
import type { StoredPlan } from '../../src/domain/plan/types';

// Emrahs Rückmeldung 6 (10.10.2026): „Gut – in 7 Tagen“ kam in derselben Runde zurück. Simulation einer GANZEN Runde: je Wort wird
// gezählt, wie oft und aus welchem Grund es kommt. Regel: Was der Knopf verspricht, gilt – ein Wort mit „Gut/Leicht“ und einem
// versprochenen Abstand über dem Lernschritt kommt in der Runde nie wieder als normale Abfrage; nur der Kontrast-Schritt darf
// (sichtbar begründet) direkt danach kommen, höchstens einmal je Runde.

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
const LEARN_MS = 20 * 60_000;
const plan = (review: number, n = 0): StoredPlan => ({ d: DAY, ids: [], why: [], v: 1, duty: ['review'], goal: { review, new: n }, lesson: null, at: 0 });

const WORDS = ['assume', 'avoid', 'claim', 'deliver', 'ensure', 'expand', 'handle', 'improve', 'manage', 'measure', 'obtain', 'prevent', 'reduce', 'require', 'resolve', 'review', 'settle', 'submit', 'support', 'verify'];
const DE = ['annehmen', 'vermeiden', 'behaupten', 'liefern', 'sicherstellen', 'erweitern', 'bearbeiten', 'verbessern', 'leiten', 'messen', 'erhalten', 'verhindern', 'senken', 'verlangen', 'lösen', 'prüfen', 'begleichen', 'einreichen', 'unterstützen', 'bestätigen'];

/** Gemischter Bestand: Wiederholungen auf Stufe 1–4 (alte und neue Planung), alte Lernkarten, Rückfälle und neue Karten. */
function deck(): Map<string, Doc> {
  const out = new Map<string, Doc>();
  // Dasselbe Wort als zweite Karte („to avoid“ neben „avoid“, z. B. eigener Fund und C1-Paket), ebenfalls fällig.
  out.set('to-avoid', { word: 'to avoid', de: 'vermeiden', def: 'to keep away from something', ex: 'We [avoid] long meetings on Fridays.', pos: 'verb', src: 'c1pack', added: '2026-08-02', order: 99, reps: 3, lapses: 0, state: 'review', stage: 2, S: 4, D: 5, last: NOW - 9 * DAY_MS, due: NOW - 2 * 3_600_000, hist: [], intro: '2026-08-02' });
  WORDS.forEach((w, i) => {
    const kind = i % 5;
    const doc: Doc = {
      word: w,
      de: DE[i],
      def: `to ${w} something`,
      ex: `Every week we [${w}] the open items with the client.`,
      pos: 'verb',
      src: 'lookup',
      added: '2026-08-01',
      order: i,
      reps: 4,
      lapses: kind === 3 ? 1 : 0,
      state: kind === 2 || kind === 3 ? 'learning' : 'review',
      stage: 1 + (i % 4),
      S: 2 + (i % 7),
      D: 5,
      last: NOW - (8 + i) * DAY_MS,
      due: NOW - (i + 1) * 3_600_000,
      hist: [],
      intro: '2026-08-01',
    };
    if (kind === 4) Object.assign(doc, { state: 'new', stage: 0, S: 0, reps: 0, last: 0, due: 0, intro: undefined, hist: undefined });
    out.set(w, doc);
  });
  return out;
}

type Seen = { key: string; word: string; reason: string; ex: string; check?: string; promised?: number; stored?: number };

/** Ganze Runde durchspielen: alles „Gut“ (Aufdecken) bzw. richtig (Tippen, Auswahl, Kontrast). */
function playRound(): Seen[] {
  const seen: Seen[] = [];
  for (let guard = 0; guard < 400; guard++) {
    const s = S.useSession.getState();
    if (!s.active || s.status !== 'running') break;
    const item = s.queue[s.pos];
    if (!item) break;
    if (item.phase === 'intro') {
      seen.push({ key: item.key, word: s.cards.get(item.key)?.word ?? '', reason: item.reason, ex: 'intro' });
      S.continueIntro();
      continue;
    }
    const e = s.exercise;
    if (!e) break;
    const row: Seen = { key: e.card.key, word: e.card.word, reason: item.reason, ex: e.ex, ...(e.check ? { check: e.check } : {}) };
    if (e.ex === 'flip') {
      const t = persist.nextT();
      // Genau der Abstand, den der Knopf „Gut“ zeigt (FlipCard), und der danach gespeicherte.
      row.promised = S.flipIntervals(e.card, t)[3];
      seen.push(row);
      S.commitAnswer({ grade: 3, given: '', ms: 2500, ok: true, t });
      const after = S.useSession.getState().cards.get(e.card.key);
      if (after) row.stored = after.fsrs.due - t;
    } else {
      seen.push(row);
      S.commitAnswer({ grade: 3, given: e.accepted[0] ?? e.card.word, ms: 2500, ok: true });
    }
  }
  return seen;
}

/** Je Wort: wie oft und aus welchen Gründen (für die Fehlermeldung). */
const tally = (seen: readonly Seen[]) => {
  const m = new Map<string, string[]>();
  for (const r of seen) m.set(r.word, [...(m.get(r.word) ?? []), `${r.reason}:${r.ex}${r.check ? `/${r.check}` : ''}`]);
  return Object.fromEntries(m);
};

/** Verstöße: nach einem „Gut“ mit versprochenem Abstand über dem Lernschritt kommt dasselbe Wort später noch als normale Abfrage. */
function brokenPromises(seen: readonly Seen[]): string[] {
  const bad: string[] = [];
  seen.forEach((r, i) => {
    if (r.ex === 'intro' || r.ex === 'contrast') return;
    const promisedLong = r.promised !== undefined ? r.promised > LEARN_MS : false;
    if (!promisedLong) return;
    const later = seen.slice(i + 1).filter((x) => x.key === r.key && x.ex !== 'contrast');
    if (later.length) bad.push(`${r.word}: Gut (${Math.round((r.promised ?? 0) / DAY_MS)} T.) → später ${later.map((x) => `${x.reason}:${x.ex}`).join(', ')}`);
  });
  return bad;
}

/** Aufholmodus: über 40 überfällige, reife Karten (Stufe 3, Stabilität ≥ 7 Tage) – sie werden aufgedeckt statt getippt. */
function backlog(): Map<string, Doc> {
  const out = new Map<string, Doc>();
  for (let i = 0; i < 45; i++) {
    const w = `term${i}`;
    out.set(w, { word: w, de: `Begriff ${i}`, def: `term number ${i}`, ex: `We use [${w}] in the weekly report.`, pos: 'noun', src: 'lookup', added: '2026-07-01', order: i, reps: 6, lapses: 0, state: 'review', stage: 3, S: 8 + (i % 10), D: 5, last: NOW - (20 + i) * DAY_MS, due: NOW - (3 + (i % 5)) * DAY_MS, hist: [], intro: '2026-07-01' });
  }
  return out;
}

let h: MemoryDbHandle;
function setup(prefMode: 'auto' | 'flip', v: Map<string, Doc> = deck()): void {
  persist.resetPersistForTests();
  store.resetTodayForTests();
  h = createMemoryDb({ seed: Object.fromEntries([...v].map(([k, d]) => [`vocab/${k}`, d])) });
  holder.db = h.db;
  holder.writer = createWriter(h.db);
  useDecks.setState({ decks: readDecks({ v: 1, prefs: { mode: prefMode } }) });
  useLive.setState({ day: null, docs: { 'app/profile': { newPerDay: 3 } }, collections: { vocab: v, chunk: new Map() } });
  store.useTodayPlan.setState({ day: DAY, plan: plan(20, 3), status: 'ready', exhausted: null });
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

describe('Ganze Runde: Wiederholungen je Wort (Rückmeldung 6)', () => {
  for (const mode of ['auto', 'flip'] as const) {
    it(`Standard „${mode}“: „Gut“ mit Tagen kommt nie wieder; je Wort höchstens 3 Abfragen; Kontrast höchstens einmal`, () => {
      setup(mode);
      S.startSession('pflicht', mode === 'flip' ? { mode: 'flip' } : {});
      const seen = playRound();
      const counts = tally(seen);
      expect(seen.length, JSON.stringify(counts)).toBeGreaterThan(10);
      expect(brokenPromises(seen), JSON.stringify(counts, null, 1)).toEqual([]);
      for (const [w, list] of Object.entries(counts)) {
        const quiz = list.filter((x) => !x.endsWith(':intro') && !x.includes(':contrast'));
        expect(quiz.length, `${w}: ${list.join(' | ')}`).toBeLessThanOrEqual(3);
      }
      expect(seen.filter((r) => r.ex === 'contrast').length).toBeLessThanOrEqual(1);
      // Dasselbe Wort aus zwei Karten kommt nur einmal in die Runde.
      expect(seen.filter((r) => r.word === 'avoid' || r.word === 'to avoid').map((r) => r.key).filter((k, i, a) => a.indexOf(k) === i), JSON.stringify(counts)).toHaveLength(1);
      // Knopf = Speicherung.
      for (const r of seen) if (r.promised !== undefined) expect(r.stored, r.word).toBe(r.promised);
    });
  }

  it('Aufholmodus: der Knopf „Gut“ zeigt genau den gespeicherten Abstand, und kein Wort kommt zweimal', () => {
    setup('auto', backlog());
    S.startSession('pflicht');
    expect(S.useSession.getState().catchUp).toBe(true);
    const seen = playRound();
    const flips = seen.filter((r) => r.ex === 'flip');
    expect(flips.length).toBeGreaterThan(5);
    for (const r of flips) expect(r.stored, `${r.word}: Knopf ${r.promised} ms, gespeichert ${r.stored} ms`).toBe(r.promised);
    expect(brokenPromises(seen)).toEqual([]);
    // Fällige reife Karten mit „Gut“: genau einmal in der Runde.
    const dueKeys = seen.filter((r) => r.reason === 'due').map((r) => r.key);
    for (const k of dueKeys) expect(seen.filter((r) => r.key === k), JSON.stringify(tally(seen))).toHaveLength(1);
  });
});
