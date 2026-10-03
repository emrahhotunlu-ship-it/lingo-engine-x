import { addDays, daysBetween, isoWeek } from '../domain/date';
import { GRAMMAR_TOPICS } from './grammar';
import { dueIds, isSolid, newQuota } from './session';
import type { CardRec, DayRec, ProfileDoc } from './types';

// Abgeleitete Werte für Heute und Fahrplan. Alles lokal berechnet, ohne KI.

export const VOCAB_C1 = 6000;
export const SOLID_TOPIC = 0.8;

export const pct = (ok: number, ans: number): number => (ans ? Math.round((ok / ans) * 100) : 0);

/** Serie: Tag zählt mit erledigtem Kern-Training (oder aktivem Tag der alten App). Ein Ruhetag je Kalenderwoche. */
export function streakOf(days: Readonly<Record<string, DayRec>>, legacyDays: readonly string[], today: string): { count: number; todayDone: boolean } {
  const legacy = new Set(legacyDays);
  const active = (d: string) => days[d]?.core === 1 || legacy.has(d);
  const todayDone = active(today);
  let d = todayDone ? today : addDays(today, -1);
  let count = 0;
  const rested = new Set<string>();
  for (let i = 0; i < 1000; i++) {
    if (active(d)) count++;
    else {
      const wk = isoWeek(d);
      if (rested.has(wk) || (count === 0 && i > 0)) break;
      rested.add(wk);
    }
    d = addDays(d, -1);
  }
  return { count, todayDone };
}

export type TodayPlan = { due: number; fresh: number; minutes: number };

export function todayPlan(cards: ReadonlyMap<string, CardRec>, profile: ProfileDoc | null, today: DayRec, nowMs: number): TodayPlan {
  const due = Math.min(60, dueIds(cards, nowMs).length);
  const fresh = newQuota(dueIds(cards, nowMs).length, profile?.newPerDay ?? 10, today.nw);
  return { due, fresh, minutes: Math.max(1, Math.round((due * 12 + fresh * 50) / 60)) };
}

/** Wörter, die zuletzt oft danebengingen (für den Satz des Trainers). */
export function stubborn(cards: ReadonlyMap<string, CardRec>, n = 3): string[] {
  return [...cards]
    .filter(([, c]) => (c.bad ?? 0) >= 2 && c.lv <= 1)
    .sort((a, b) => (b[1].bad ?? 0) - (a[1].bad ?? 0) || b[1].f.lapses - a[1].f.lapses)
    .slice(0, n)
    .map(([id]) => id);
}

export function learnedSince(cards: ReadonlyMap<string, CardRec>, sinceMs: number): number {
  let n = 0;
  for (const c of cards.values()) if (!c.known && c.add >= sinceMs && isSolid(c)) n++;
  return n;
}

export function vocabNow(profile: ProfileDoc | null, cards: ReadonlyMap<string, CardRec>): number {
  const p = profile?.placement;
  if (!p) return 0;
  return p.size + learnedSince(cards, p.at);
}

export function grammarSolid(profile: ProfileDoc | null): { solid: number; total: number; weakest: string[] } {
  const g = profile?.placement?.grammar ?? {};
  const scored = GRAMMAR_TOPICS.map((t) => ({ id: t.id, v: g[t.id] ?? 0 }));
  return {
    solid: scored.filter((s) => s.v >= SOLID_TOPIC).length,
    total: GRAMMAR_TOPICS.length,
    weakest: scored
      .filter((s) => s.v < SOLID_TOPIC)
      .sort((a, b) => a.v - b.v)
      .slice(0, 4)
      .map((s) => s.id),
  };
}

/** Etappe 1–4 nach Monaten seit dem Start des Fahrplans. */
export function stageOf(planStart: string | undefined, today: string): number {
  if (!planStart) return 1;
  const months = Math.floor(Math.max(0, daysBetween(planStart, today)) / 30.4);
  return Math.min(4, Math.floor(months / 3) + 1);
}

/** Prognose: Tage bis zum C1-Wortschatz bei gleichem Tempo (null = noch zu wenig Daten). */
export function forecastDays(profile: ProfileDoc | null, cards: ReadonlyMap<string, CardRec>, days: Readonly<Record<string, DayRec>>, today: string): number | null {
  const p = profile?.placement;
  if (!p) return null;
  let trained = 0;
  let newWords = 0;
  for (let i = 1; i <= 28; i++) {
    const d = days[addDays(today, -i)];
    if (d && d.ans > 0) {
      trained++;
      newWords += d.nw;
    }
  }
  if (trained < 7) return null;
  const perDay = (newWords / 28) * 0.85;
  const gap = VOCAB_C1 - vocabNow(profile, cards);
  if (gap <= 0) return 0;
  if (perDay <= 0) return null;
  return Math.round(gap / perDay);
}
