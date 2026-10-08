import { describe, expect, it } from 'vitest';
import { emptyC1, type C1Doc } from '../../src/domain/c1/c1doc';
import { c1Criteria, K1_TREND_MIN, type CriteriaInput } from '../../src/domain/c1/criteria';
import { addProdTo } from '../../src/domain/c1/prod';
import { c1EvidenceLines, c1Way, freezePlan, type Way, type WayInput } from '../../src/domain/c1/way';
import { k6Measure, TP_SINCE, type LogEntry } from '../../src/domain/metrics/c1';
import type { C1Item } from '../../src/domain/c1x/types';
import { grammarLogEntry } from '../../src/domain/progress/logPatch';
import type { GrammarAnswer } from '../../src/domain/learn/types';
import { wayLiveLoaded, wayLoadState } from '../../src/features/c1/wayData';
import { tpBoundary } from '../../src/domain/metrics/c1';
import { reasonText } from '../../src/features/c1/WayToC1';

// Nachbesserung P44/P45 (Prüfung learning-scientist und data-guard): je Regel ein Test.

const input = (o: Partial<CriteriaInput> = {}): CriteriaInput => ({
  today: '2026-12-26',
  c1: emptyC1(),
  k1: { gates: 2, safe: 40, total: 100, free: { ok: 30, n: 40 }, newSafe56: 16 },
  k2: { relapses: 3, prev: 5, traps: 6 },
  k3: { view: { state: 'valid', t: 0, passive: 3500, lo: 3200, hi: 3800 }, series: [] },
  k4: { fest: 450, learned: 900, retention: { rate: 0.9, n: 60, enough: true, band: 'in' }, growth: { delta: 56, days: 56 } },
  k6: { n: 25, ok: 18, clean: 8, cleanOk: 7, older: 0.6, recent: 0.8, unmarked: 0 },
  ...o,
});

describe('Kriterien', () => {
  it('K-h: K1-Trend „nach vorn“ erst ab 2 neu sicheren Mustern', () => {
    const k1 = { gates: 4, safe: 70, total: 100, free: { ok: 30, n: 40 }, newSafe56: 1 };
    expect(c1Criteria(input({ k1 })).list[0]?.trend).toBe('flat');
    expect(c1Criteria(input({ k1: { ...k1, newSafe56: K1_TREND_MIN } })).list[0]?.trend).toBe('up');
  });
  it('B1: „noch offen“ trägt den Grund – weit weg (< 50 %) oder ohne Fortschritt (≥ 50 %)', () => {
    const far = c1Criteria(input({ k4: { fest: 300, learned: 900, retention: { rate: 0.9, n: 60, enough: true, band: 'in' }, growth: { delta: 30, days: 56 } } })).list[3]!;
    expect(far).toMatchObject({ state: 'open', why: 'far' });
    const flat = c1Criteria(input({ k4: { fest: 450, learned: 900, retention: { rate: 0.9, n: 60, enough: true, band: 'in' }, growth: { delta: 0, days: 56 } } })).list[3]!;
    expect(flat).toMatchObject({ state: 'open', why: 'flat' });
    expect(c1Criteria(input()).list[3]?.why).toBeUndefined(); // auf Kurs
  });
  it('N2: mehr als die Hälfte, aber noch kein Trend (eine Messung) → `notrend`', () => {
    const k6 = { n: 25, ok: 15, clean: 8, cleanOk: 7, older: null, recent: 0.6, unmarked: 0 };
    const c = c1Criteria(input({ k6 })).list[5]!;
    expect(c).toMatchObject({ state: 'open', trend: null, why: 'notrend' });
  });
  it('B7: K5 zeigt die Punkte des letzten Laptop-Checks direkt (keine Umrechnung)', () => {
    const c1: C1Doc = { ...emptyC1(), checks: [{ d: '2026-12-26', f: 'A', inp: 'desk', p: [6, 5, 5, 7], pts: 23, max: 36 }] };
    expect(c1Criteria(input({ c1 })).list[4]?.ev.pts).toBe(23);
  });
});

describe('Detail „Warum“ (B1)', () => {
  const t = (k: string, v?: Record<string, string | number>): string => `${k}${v ? JSON.stringify(v) : ''}`;
  const num = (n: number): string => String(n);
  const list = (xs: string[]): string => xs.join(' + ');
  const crit = c1Criteria(input()).list;
  it('offen: weit weg / ohne Fortschritt', () => {
    expect(reasonText({ ...crit[3]!, state: 'open', why: 'far' }, t, num, list)).toBe('pxKReason_openFar');
    expect(reasonText({ ...crit[3]!, state: 'open', why: 'flat' }, t, num, list)).toBe('pxKReason_openFlat');
    expect(reasonText({ ...crit[5]!, state: 'open', why: 'notrend' }, t, num, list)).toBe('pxKReason_openNoTrend');
  });
  it('zu wenig Daten: die fehlende Menge wird genannt (K6, K7)', () => {
    expect(reasonText({ ...crit[5]!, state: 'few', ev: { ok: 3, n: 12, need: 20, clean: null } }, t, num, list)).toBe('pxKReasonFew_k6{"n":"8"}');
    expect(reasonText({ ...crit[6]!, state: 'few', ev: { rate: 4, words: 450, entries: 6, weeks: 2 } }, t, num, list)).toBe(
      'pxKReasonFew_k7{"list":"pxKFewWords{\\"n\\":\\"150\\"} + pxKFewWeeks{\\"n\\":\\"1\\"}"}',
    );
  });
});

describe('K7 ohne Rate bei „zu wenig Daten“ (P5)', () => {
  it('unter der Mindestmenge: „zu wenig Daten“ ohne Wegstück (die Belegzeile ohne Rate prüft assess4.test)', () => {
    const w = c1Way({
      today: '2026-10-08',
      nowMs: Date.parse('2026-10-08T12:00:00+02:00'),
      c1: { v: 1, checks: [], gates: [], prod: [{ d: '2026-10-01', s: 'mail', w: 200, e: 9 }], bad: [], place: { d: '2026-09-01', se: 1, n: 12, skip: [] } },
      grammar: new Map(),
      profile: undefined,
      cards: [],
      patterns: undefined,
      logs: null,
      itemOf: () => null,
    });
    const k7 = w.crit.list[6]!;
    expect(k7.state).toBe('few');
    expect(k7.progress).toBeNull();
  });
});

describe('Einfrieren erst nach dem Laden (K-d)', () => {
  const live = { docs: { 'app/c1': null, 'app/profile': {} }, collections: { vocab: new Map(), chunk: new Map(), grammar: new Map() } };
  it('Live-Daten: jedes fehlende Stück hält das Einfrieren an; ein fehlendes Dokument (null) gilt als geladen', () => {
    expect(wayLiveLoaded(live)).toBe(true);
    expect(wayLiveLoaded({ ...live, docs: { 'app/c1': null } })).toBe(false);
    expect(wayLiveLoaded({ ...live, collections: { vocab: new Map(), chunk: new Map() } })).toBe(false);
  });
  it('freezePlan: ohne Laden nie, mit Laden nur im Check-Fenster für den Check dieses Monats', () => {
    const checks = [
      { d: '2026-10-31', f: 'A', inp: 'desk', p: [4, 4, 4, 6], pts: 18, max: 36 },
      { d: '2026-11-28', f: 'B', inp: 'desk', p: [5, 4, 4, 7], pts: 20, max: 36 },
      { d: '2026-12-26', f: 'A', inp: 'desk', p: [5, 5, 5, 8], pts: 23, max: 36 },
    ];
    const wayIn: WayInput = {
      today: '2026-12-26',
      nowMs: Date.parse('2026-12-26T12:00:00+01:00'),
      c1: { v: 1, checks, gates: [], prod: [], bad: [], place: { d: '2026-10-01', se: 1, n: 12, skip: [] } },
      grammar: new Map(),
      profile: undefined,
      cards: [],
      patterns: undefined,
      logs: [],
      itemOf: () => null,
    };
    const w = c1Way(wayIn);
    expect(freezePlan(w, '2026-12-26', false)).toBeNull();
    const plan = freezePlan(w, '2026-12-26', true);
    expect(plan?.d).toBe('2026-12-26');
    expect(plan?.fc).toBeDefined();
    expect(freezePlan(w, '2027-01-05', true)).toBeNull();
  });
});

describe('Doppelschutz für prod (data-guard)', () => {
  it('derselbe Eintrag (Tag, Quelle, Wörter, Fehler) wird kein zweites Mal gebucht; ein anderer schon', () => {
    const one = addProdTo(emptyC1(), { d: '2026-10-08', s: 'clinic', w: 120, e: 3 })!;
    expect(one.prod).toHaveLength(1);
    expect(addProdTo(one, { d: '2026-10-08', s: 'clinic', w: 120, e: 3 })).toBeNull();
    expect(addProdTo(one, { d: '2026-10-08', s: 'mail', w: 120, e: 3 })?.prod).toHaveLength(2);
    expect(addProdTo(one, { d: '2026-10-08', s: 'clinic', w: 121, e: 3 })?.prod).toHaveLength(2);
    // Eine Wochensumme ist kein Doppel.
    const wk: C1Doc = { ...emptyC1(), prod: [{ d: '2026-10-05', s: 'clinic', w: 120, e: 3, wk: true }] };
    expect(addProdTo(wk, { d: '2026-10-05', s: 'clinic', w: 120, e: 3 })?.prod).toHaveLength(2);
  });
});

describe('Tempo-Kennung im Protokoll (K-a)', () => {
  it('Antworten aus einer Tempo-Runde tragen `tp: true`, andere nicht', () => {
    const a = {
      t: 1,
      lang: 'de',
      ctx: 'xtra',
      task: { topic: 'passive', type: 'gap', prompt: 'p', answer: 'a', src: 'c1x', c1: { id: 'err-1', pat: 'p', kind: 'err' } },
      given: 'a',
      dontKnow: false,
      verdict: 'correct',
      grade: 3,
      ms: 900,
      help: 0,
      judged: 'local',
      pts: [2, 2],
      c1k: 'err',
      free: true,
    } as unknown as GrammarAnswer;
    expect(grammarLogEntry(a).tp).toBeUndefined();
    expect(grammarLogEntry({ ...a, tempo: true }).tp).toBe(true);
  });
});

describe('K6-Belegzeile mit älteren Antworten ohne Kennung (N4)', () => {
  const lineOf = (unmarked: number): string => {
    const crit = c1Criteria(input({ k6: { n: 25, ok: 18, clean: 8, cleanOk: 7, older: 0.6, recent: 0.8, unmarked } }));
    const w = { crit, c1: emptyC1() } as unknown as Way;
    return c1EvidenceLines(w).find((l) => l.id === 'c1:k6')!.text;
  };
  it('mit `unmarked > 0` steht der Hinweis in der Zeile, sonst nicht', () => {
    expect(lineOf(3)).toContain('; 3 answers from before timed answers were marked may include timed ones.');
    expect(lineOf(0)).not.toContain('timed');
  });
});

describe('Grenze für die Tempo-Kennung (N1)', () => {
  const floor = Date.parse(`${TP_SINCE}T00:00:00`);
  const day = 86_400_000;
  it('TP_SINCE ist die Untergrenze; eine spätere erste `tp`-Antwort verschiebt die Grenze nach hinten, eine frühere nicht', () => {
    expect(tpBoundary([])).toBe(floor);
    expect(tpBoundary([{ t: floor + 5 * day, tp: true }, { t: floor + 9 * day, tp: true }, { t: floor + 2 * day }])).toBe(floor + 5 * day);
    expect(tpBoundary([{ t: floor - 3 * day, tp: true }])).toBe(floor);
  });
  it('K6 zählt Antworten vor der Grenze als „ohne Kennung“', () => {
    const item = { id: 'e1', kind: 'err', bad: true } as unknown as C1Item;
    const e = (t: number, x: Partial<LogEntry> = {}): LogEntry => ({ t, c1k: 'err', cid: 'e1', pts: [2, 2], free: true, ...x });
    const now = floor + 20 * day;
    const entries = [e(floor + 1 * day), e(floor + 3 * day), e(floor + 6 * day, { tp: true }), e(floor + 8 * day)];
    const m = k6Measure(entries, () => item, now);
    expect(m.n).toBe(3);
    expect(m.unmarked).toBe(2);
  });
});

describe('Laden ohne Datenbank oder mit gescheitertem Abo', () => {
  const base = { db: 'ready', liveStatus: 'ready', onceStatus: 'ready', liveLoaded: true } as const;
  it('fehlt db oder scheitert das Live-Abo, zeigt das Blatt den Fehlerzustand statt ewig das Skelett', () => {
    expect(wayLoadState({ ...base, db: 'absent', onceStatus: 'loading', liveLoaded: false })).toBe('error');
    expect(wayLoadState({ ...base, liveStatus: 'error', liveLoaded: false })).toBe('error');
  });
  it('sonst: laden, bis Protokolle und Live-Daten da sind', () => {
    expect(wayLoadState({ ...base, db: 'pending', liveStatus: 'waiting', onceStatus: 'loading', liveLoaded: false })).toBe('loading');
    expect(wayLoadState({ ...base, liveLoaded: false })).toBe('loading');
    expect(wayLoadState({ ...base, onceStatus: 'error' })).toBe('ready');
    expect(wayLoadState(base)).toBe('ready');
  });
});
