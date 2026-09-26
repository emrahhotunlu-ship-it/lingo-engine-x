import type { RoundPlan } from '../srs/queue';
import type { StoredPlan, TodayState, WhyKey } from './types';

// Ein Plan je Lerntag, nie neu gewürfelt (Kap. 15). Der Plan ist eine reine Funktion der Daten.

type Doc = Record<string, unknown>;

/** Kanäle, die diese Ausbaustufe ausführen kann (Phase 1: keine – nur „Wiederholen"). */
export const EXECUTABLE_CHANNELS: readonly string[] = [];

const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

/** Gespeicherten Plan lesen; `null`, wenn er nicht von diesem Tag oder nicht von dieser App ist. */
export function readPlan(v: unknown, today: string): StoredPlan | null {
  if (!v || typeof v !== 'object') return null;
  const p = v as Doc;
  if (p.d !== today || p.v !== 1) return null;
  const goal = p.goal && typeof p.goal === 'object' ? (p.goal as Doc) : {};
  const review = typeof goal.review === 'number' && Number.isFinite(goal.review) ? Math.max(0, Math.round(goal.review)) : 0;
  return {
    d: today,
    ids: isStrArr(p.ids) ? p.ids : [],
    why: Array.isArray(p.why) ? (p.why as WhyKey[][]) : [],
    v: 1,
    duty: isStrArr(p.duty) ? (p.duty as StoredPlan['duty']) : [],
    goal: { review },
    lesson: typeof p.lesson === 'string' ? p.lesson : null,
    at: typeof p.at === 'number' ? p.at : 0,
  };
}

/**
 * Plan für heute:
 * - schon ein Plan dieser App von heute → unverändert;
 * - Plan der alten App von heute, alle Kanäle ausführbar → übernehmen (ids, why bleiben);
 * - sonst ein neuer, vollständiger Plan (fester Schlüsselsatz, weil `update` verschmilzt).
 */
export function buildPlan(i: { today: string; existing: unknown; round: RoundPlan; nowMs: number }): { plan: StoredPlan; changed: boolean } {
  const kept = readPlan(i.existing, i.today);
  if (kept) return { plan: kept, changed: false };
  const duty: StoredPlan['duty'] = i.round.target > 0 ? ['review'] : [];
  const base = { v: 1 as const, duty, goal: { review: i.round.target }, lesson: null, at: i.nowMs };
  const ex = i.existing && typeof i.existing === 'object' ? (i.existing as Doc) : null;
  if (ex && ex.d === i.today && ex.v === undefined && isStrArr(ex.ids) && ex.ids.every((id) => EXECUTABLE_CHANNELS.includes(id))) {
    return { plan: { d: i.today, ids: ex.ids, why: Array.isArray(ex.why) ? (ex.why as WhyKey[][]) : [], ...base }, changed: true };
  }
  return { plan: { d: i.today, ids: [], why: [], ...base }, changed: true };
}

export type DayEntry = { t?: unknown; id?: unknown; k?: unknown; ok?: unknown; ctx?: unknown; type?: unknown; n?: unknown };

/** Einträge von Datenbank und Puffer zusammenführen, doppelte (gleiches t|id) nur einmal. */
export function mergeEntries(live: readonly DayEntry[], pending: readonly DayEntry[]): DayEntry[] {
  const seen = new Set(live.map((e) => `${String(e.t)}|${String(e.id)}`));
  return [...live, ...pending.filter((e) => !seen.has(`${String(e.t)}|${String(e.id)}`))];
}

/**
 * Die EINE Ableitung für Statuszeile, Knopf und Häkchen (Kap. 2.2): Fortschritt aus dem
 * Tagesprotokoll. Freiwillige Extra-Antworten zählen nie zur Pflicht (Kap. 15).
 */
export function deriveToday(i: { day: string; plan: StoredPlan | null; entries: readonly DayEntry[]; minutes: number }): TodayState {
  const reviewed = new Set<string>();
  let extra = 0;
  let correct = 0;
  let answers = 0;
  let talks = 0;
  let biz = 0;
  for (const e of i.entries) {
    // Phase 3 (Plan §3.7): Gespräche und Business-Einheiten sind keine Antworten der Trefferquote.
    if (e.type === 'speak') {
      talks++;
      continue;
    }
    if (e.type === 'biz') {
      biz++;
      continue;
    }
    answers++;
    if (e.ok === true) correct++;
    if (e.ctx === 'rev' && e.k === 'v' && typeof e.id === 'string') reviewed.add(e.id);
    if (e.ctx === 'xtra') extra++;
  }
  const balance = { answers, correct, minutes: Math.max(0, Math.round(i.minutes)), talks, biz };
  if (!i.plan) return { day: i.day, status: 'noPlan', review: { done: 0, total: 0 }, extra, balance };
  const total = i.plan.duty.includes('review') ? i.plan.goal.review : 0;
  const done = Math.min(total, reviewed.size);
  const status = total === 0 ? 'nothing' : done >= total ? 'allDone' : 'open';
  return { day: i.day, status, review: { done, total }, extra, balance };
}
