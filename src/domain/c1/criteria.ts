import { addDays } from '../date';
import { deskChecks, CHAPTERS_TOTAL, type DeskCheck, type K1Measure, type K2Measure, type K3Measure, type K4Measure, type K6Measure } from '../metrics/c1';
import type { C1Doc } from './c1doc';
import { prodRate, type ProdRate } from './prod';

// Die sieben Kriterien K1–K7 und „C1-Etappe“ (Lernplattform 3.0 §4.5, P44). Je Kriterium EINE Quelle (`domain/metrics/c1.ts` bzw. `prod.ts`),
// ein Zustandswort und EIN Beleg. Rein: gleiche Messwerte → gleiches Ergebnis. Schwellen sind Arbeitswerte, geeicht ist keiner.
//
// Zustandswörter: erreicht (`met`) · auf Kurs (`course`) · noch offen (`open`) · zu wenig Daten (`few`).
// „Auf Kurs“ = mindestens 50 % des Wegs zur Schwelle UND der Trend der letzten 8 Wochen zeigt nach vorn. Für Kriterien, bei denen weniger
// besser ist (K2 Rückfälle, K7 Fehler je 100 Wörter), heißt „50 % des Wegs“: höchstens das Doppelte der Schwelle. Keine Prozentzahl „x % C1“.

export const CRITERIA = ['k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7'] as const;
export type CritId = (typeof CRITERIA)[number];
export type CritState = 'met' | 'course' | 'open' | 'few';

/** Schwellen (§4.5). */
export const C1_GOALS = {
  k1: { gates: CHAPTERS_TOTAL, safeShare: 0.8, freeRate: 0.75, freeMin: 20 },
  k2: { relapses: 2 },
  k3: { passive: 4000, lo: 3600 },
  k4: { fest: 750, retention: 0.88 },
  k5: { pct: 0.6, partMin: 0.4, inARow: 2 },
  k6: { rate: 0.8, cleanRate: 0.75, min: 20, cleanMin: 5 },
  k7: { rate: 3.0, checkDays: 2 },
} as const;

/** Anteil des Wegs, ab dem ein Kriterium mit Trend nach vorn „auf Kurs“ ist. */
export const ON_COURSE_SHARE = 0.5;
/** K1-Trend „nach vorn“ erst ab so vielen neu sicheren Mustern in 8 Wochen (ein einzelnes kann Zufall sein). */
export const K1_TREND_MIN = 2;

export type Criterion = {
  id: CritId;
  state: CritState;
  /** Der eine Beleg der Zeile: Werte für den Text (`p44Ev_<id>`) und die Belegzeile `[c1:<id>]` von `assess@4`. */
  ev: Record<string, number | string | null>;
  /** Anteil des Wegs zur Schwelle (0–1), `null` ohne Daten. Nur intern (Prognose, „auf Kurs“), nie als Prozentzahl gezeigt. */
  progress: number | null;
  /** Trend der letzten 8 Wochen: nach vorn, gleich/zurück, unbekannt. */
  trend: 'up' | 'flat' | null;
  /** Nur bei „noch offen“: weniger als die Hälfte des Wegs (`far`) oder mehr als die Hälfte ohne messbaren Fortschritt (`flat`). */
  why?: 'far' | 'flat';
};

export type CriteriaInput = {
  today: string;
  c1: C1Doc;
  k1: K1Measure;
  k2: K2Measure;
  k3: K3Measure;
  k4: K4Measure;
  /** `null` = Protokoll noch nicht gelesen (K6 dann „zu wenig Daten“). */
  k6: K6Measure | null;
};

export type CriteriaResult = {
  list: Criterion[];
  met: number;
  /** „C1-Etappe bei Grammatik, Wörtern und Genauigkeit im eigenen Text“: erst wenn K1–K7 erfüllt sind. */
  stage: boolean;
  /** Laptop-Checks (K5) und K7 je Check-Tag: dieselben Zahlen für Detail und Prognose. */
  desk: DeskCheck[];
  k7Days: Array<{ d: string; r: ProdRate }>;
};

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const r2 = (x: number): number => Math.round(x * 100) / 100;

function stateOf(met: boolean, progress: number | null, trend: Criterion['trend']): CritState {
  if (met) return 'met';
  if (progress === null) return 'few';
  return progress >= ON_COURSE_SHARE && trend === 'up' ? 'course' : 'open';
}

/** Grund für „noch offen“ (Detail „Warum“). */
const whyOpen = (c: Criterion): Criterion => (c.state === 'open' && c.progress !== null ? { ...c, why: c.progress < ON_COURSE_SHARE ? 'far' : 'flat' } : c);

/** „Weniger ist besser“: Weg zur Schwelle; Wert ≤ Schwelle = 1, doppelte Schwelle = 0,5, darüber weniger. */
const lowerBetter = (value: number, goal: number): number => (value <= goal ? 1 : clamp01(goal / value));

function k1(m: K1Measure): Criterion {
  const g = C1_GOALS.k1;
  const share = m.total > 0 ? m.safe / m.total : null;
  const freeRate = m.free && m.free.n > 0 ? m.free.ok / m.free.n : null;
  const freeOk = m.free !== null && m.free.n >= g.freeMin && freeRate !== null && freeRate >= g.freeRate;
  const met = m.gates >= g.gates && share !== null && share >= g.safeShare && freeOk;
  const parts = [clamp01(m.gates / g.gates), share === null ? 0 : clamp01(share / g.safeShare), freeRate === null ? 0 : clamp01(freeRate / g.freeRate)];
  // Nichts geübt (kein Muster sicher, keine Kapitelprüfung, keine getippte C1-Aufgabe): „zu wenig Daten“ statt „0 von N“.
  const progress = (m.total === 0 || m.safe === 0) && m.gates === 0 && !m.free?.n ? null : parts.reduce((s, x) => s + x, 0) / parts.length;
  const trend = m.newSafe56 >= K1_TREND_MIN ? 'up' : 'flat';
  return {
    id: 'k1',
    state: stateOf(met, progress, trend),
    ev: { gates: m.gates, gatesMax: g.gates, safe: m.safe, total: m.total, freeOk: m.free?.ok ?? null, freeN: m.free?.n ?? null, newSafe: m.newSafe56 },
    progress,
    trend,
  };
}

function k2(m: K2Measure): Criterion {
  const g = C1_GOALS.k2;
  if (m.relapses === null) return { id: 'k2', state: 'few', ev: { relapses: null, prev: null, traps: 0 }, progress: null, trend: null };
  const met = m.relapses <= g.relapses;
  const trend = m.prev === null ? null : m.relapses < m.prev ? 'up' : 'flat';
  const progress = lowerBetter(m.relapses, g.relapses);
  return { id: 'k2', state: stateOf(met, progress, trend), ev: { relapses: m.relapses, prev: m.prev, traps: m.traps }, progress, trend };
}

function k3(m: K3Measure): Criterion {
  const g = C1_GOALS.k3;
  if (m.view.state !== 'valid') return { id: 'k3', state: 'few', ev: { passive: null, lo: null, hi: null, old: m.view.state === 'old' ? 1 : 0 }, progress: null, trend: null };
  const { passive, lo, hi } = m.view;
  const met = passive >= g.passive && lo !== null && lo >= g.lo;
  const first = m.series[0];
  const last = m.series[m.series.length - 1];
  const trend = m.series.length >= 2 && first && last ? (last[1] > first[1] ? 'up' : 'flat') : null;
  const progress = clamp01(passive / g.passive);
  return { id: 'k3', state: stateOf(met, progress, trend), ev: { passive, lo, hi, old: 0 }, progress, trend };
}

function k4(m: K4Measure): Criterion {
  const g = C1_GOALS.k4;
  if (m.learned === 0 && m.fest === 0) return { id: 'k4', state: 'few', ev: { fest: 0, goal: g.fest, delta: null, ret: null, retN: m.retention.n }, progress: null, trend: null };
  const ret = m.retention.enough && m.retention.rate !== null ? m.retention.rate : null;
  const met = m.fest >= g.fest && ret !== null && ret >= g.retention;
  const trend = m.growth === null ? null : m.growth.delta > 0 ? 'up' : 'flat';
  const progress = clamp01(m.fest / g.fest);
  return {
    id: 'k4',
    state: stateOf(met, progress, trend),
    ev: { fest: m.fest, goal: g.fest, delta: m.growth?.delta ?? null, days: m.growth?.days ?? null, ret: ret === null ? null : r2(ret), retN: m.retention.n },
    progress,
    trend,
  };
}

function k5(desk: readonly DeskCheck[]): Criterion {
  const g = C1_GOALS.k5;
  const last = desk[desk.length - 1];
  if (!last) return { id: 'k5', state: 'few', ev: { pct: null, pts: null, minPart: null, checks: 0 }, progress: null, trend: null };
  const prev = desk[desk.length - 2];
  const passes = (c: DeskCheck): boolean => c.pct >= g.pct && c.parts.every((p) => p >= g.partMin);
  const met = !!prev && passes(prev) && passes(last);
  const trend = prev ? (last.pct > prev.pct ? 'up' : 'flat') : null;
  const progress = clamp01(last.pct / g.pct);
  return { id: 'k5', state: stateOf(met, progress, trend), ev: { pct: r2(last.pct), pts: last.pts, minPart: r2(Math.min(...last.parts)), checks: desk.length, d: last.d }, progress, trend };
}

function k6(m: K6Measure | null): Criterion {
  const g = C1_GOALS.k6;
  if (!m || m.n < g.min) return { id: 'k6', state: 'few', ev: { ok: m?.ok ?? null, n: m?.n ?? null, need: g.min, clean: m ? (m.clean ? r2(m.cleanOk / m.clean) : null) : null }, progress: null, trend: null };
  const rate = m.ok / m.n;
  const cleanRate = m.clean >= g.cleanMin ? m.cleanOk / m.clean : null;
  const met = rate >= g.rate && cleanRate !== null && cleanRate >= g.cleanRate;
  const trend = m.older !== null && m.recent !== null ? (m.recent > m.older ? 'up' : 'flat') : null;
  const progress = clamp01(rate / g.rate);
  return { id: 'k6', state: stateOf(met, progress, trend), ev: { ok: m.ok, n: m.n, rate: r2(rate), clean: cleanRate === null ? null : r2(cleanRate), cleanN: m.clean }, progress, trend };
}

/** K7 an den Check-Tagen (alle Checks, auch Handy: K7 misst Schreiben, nicht den Check), ältester zuerst. */
export function k7AtChecks(c1: C1Doc): Array<{ d: string; r: ProdRate }> {
  const days = [...new Set(c1.checks.map((c) => c.d))].sort();
  return days.map((d) => ({ d, r: prodRate(c1.prod, d) }));
}

function k7(c1: C1Doc, today: string, atChecks: ReadonlyArray<{ d: string; r: ProdRate }>): Criterion {
  const g = C1_GOALS.k7;
  const now = prodRate(c1.prod, today);
  const ev = { rate: now.rate, words: now.words, entries: now.entries, weeks: now.weeks };
  if (now.state === 'few' || now.rate === null) return { id: 'k7', state: 'few', ev, progress: null, trend: null };
  const lastTwo = atChecks.slice(-g.checkDays);
  const met = lastTwo.length === g.checkDays && lastTwo.every((x) => x.r.state === 'ok' && x.r.rate !== null && x.r.rate <= g.rate);
  const before = prodRate(c1.prod, addDays(today, -28));
  const trend = before.state === 'ok' && before.rate !== null ? (now.rate < before.rate ? 'up' : 'flat') : null;
  const progress = lowerBetter(now.rate, g.rate);
  return { id: 'k7', state: stateOf(met, progress, trend), ev, progress, trend };
}

/** Alle sieben Kriterien. Rein. */
export function c1Criteria(i: CriteriaInput): CriteriaResult {
  const desk = deskChecks(i.c1.checks);
  const k7Days = k7AtChecks(i.c1);
  const list = [k1(i.k1), k2(i.k2), k3(i.k3), k4(i.k4), k5(desk), k6(i.k6), k7(i.c1, i.today, k7Days)].map(whyOpen);
  const met = list.filter((c) => c.state === 'met').length;
  return { list, met, stage: met === CRITERIA.length, desk, k7Days };
}
