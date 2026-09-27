import { addDays, daysBetween, isDayKey } from '../date';
import { topicP } from '../grammar/bkt';
import { TOPICS } from '../content';

// Verlauf (Plan §7.4, E14): `profile.history[]` (≤ 120) wird fortgeführt – ein Tagesbild je
// Lerntag, gekennzeichnet mit `lx: 1` (neue Definition). Die Formeln der alten App sind nicht
// belegt; die Nahtstelle wird im Diagramm markiert.
//   o = ema.all, vo = ema.recog, co = ema.colloc, li = ema.listen, wr = ema.write,
//   gr = Mittel der Anzeige-Beherrschung (mit Verfall), re = Mittel der letzten 5 Leseergebnisse
//   (sonst Vorwert), fl = Sprint-Trefferquote (sonst Vorwert), vs = Wortschatz jetzt (sonst Vorwert).

type Doc = Readonly<Record<string, unknown>>;
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});
const arr = (v: unknown): Doc[] => (Array.isArray(v) ? v.map(obj) : []);
const numOr = (v: unknown, d: number | null): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const r3 = (x: number) => Math.round(x * 1000) / 1000;

export const HISTORY_MAX = 120;
export type HistSnap = { d: string; o: number | null; vo: number | null; co: number | null; li: number | null; wr: number | null; gr: number; re: number | null; fl: number | null; vs: number | null; lx: 1 };

export function hasHistory(profile: Doc | undefined, day: string): boolean {
  return arr(profile?.history).some((h) => h.d === day);
}

export function historySnapshot(i: { day: string; nowMs: number; profile: Doc; grammar: ReadonlyMap<string, Doc>; readingScores?: readonly number[]; vocabNow: number | null }): HistSnap {
  const p = i.profile;
  const ema = obj(p.ema);
  const hist = arr(p.history);
  const prev = hist[hist.length - 1] ?? {};
  const gr = TOPICS.reduce((a, t) => a + topicP(t.id, i.grammar.get(t.id), i.nowMs), 0) / Math.max(1, TOPICS.length);
  const sprints = arr(p.sprints).sort((a, b) => (numOr(a.t, 0) ?? 0) - (numOr(b.t, 0) ?? 0));
  const sp = sprints[sprints.length - 1];
  const fl = sp && numOr(sp.n, 0) ? (numOr(sp.ok, 0) ?? 0) / (numOr(sp.n, 1) ?? 1) : numOr(prev.fl, null);
  const rs = (i.readingScores ?? []).slice(0, 5);
  const re = rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length / 100 : numOr(prev.re, null);
  const rnd = (x: number | null) => (x === null ? null : r3(x));
  return {
    d: i.day,
    o: rnd(numOr(ema.all, null)),
    vo: rnd(numOr(ema.recog, null)),
    co: rnd(numOr(ema.colloc, null)),
    li: rnd(numOr(ema.listen, null)),
    wr: rnd(numOr(ema.write, null)),
    gr: r3(gr),
    re: rnd(re),
    fl: rnd(fl),
    vs: i.vocabNow ?? numOr(prev.vs, null),
    lx: 1,
  };
}

/** Profil-Änderung für das Tagesbild (einmal je Lerntag, ≤ 120) oder `null`. */
export function historyPatch(profile: Doc, snap: HistSnap): Record<string, unknown> | null {
  if (hasHistory(profile, snap.d)) return null;
  const hist = Array.isArray(profile.history) ? (profile.history as unknown[]) : [];
  return { history: [...hist, snap].slice(-HISTORY_MAX) };
}

export type SeriesKey = 'gr' | 'vo' | 'li' | 'wr';
export type SeriesPoint = { d: string; v: number };

/** Linien der letzten `days` Tage (ohne fehlende Werte) und der erste Tag mit `lx` (Nahtstelle). */
export function historySeries(profile: Doc | null | undefined, today: string, days = 120): { series: Record<SeriesKey, SeriesPoint[]>; seam: string | null } {
  const from = addDays(today, -(days - 1));
  const hist = arr(profile?.history)
    .filter((h) => isDayKey(h.d) && (h.d) >= from && (h.d) <= today)
    .sort((a, b) => ((a.d as string) < (b.d as string) ? -1 : 1));
  const out: Record<SeriesKey, SeriesPoint[]> = { gr: [], vo: [], li: [], wr: [] };
  for (const h of hist) for (const k of Object.keys(out) as SeriesKey[]) {
    const v = numOr(h[k], null);
    if (v !== null) out[k].push({ d: h.d as string, v: Math.max(0, Math.min(1, v)) });
  }
  const seam = hist.find((h) => h.lx === 1 || h.lx === '1');
  return { series: out, seam: seam && hist.some((h) => h.lx === undefined) ? (seam.d as string) : null };
}

export type HeatCell = { d: string; minutes: number; answers: number; level: 0 | 1 | 2 | 3 | 4 };

/** Aktivität der letzten 26 Wochen (Mo–So), Stufe aus Minuten (bzw. Antworten, wenn Minuten fehlen). */
export function heatmap(profile: Doc | null | undefined, today: string, weeks = 26): HeatCell[][] {
  const minutes = obj(profile?.minutes);
  const days = obj(profile?.days);
  const d = new Date(`${today}T12:00:00Z`);
  const monday = addDays(today, -((d.getUTCDay() + 6) % 7));
  const start = addDays(monday, -(weeks - 1) * 7);
  const out: HeatCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: HeatCell[] = [];
    for (let k = 0; k < 7; k++) {
      const day = addDays(start, w * 7 + k);
      if (daysBetween(day, today) < 0) continue;
      const m = Math.max(0, numOr(minutes[day], 0) ?? 0);
      const a = Math.max(0, numOr(days[day], 0) ?? 0);
      const x = m || a / 3;
      const level = (x <= 0 ? 0 : x < 5 ? 1 : x < 12 ? 2 : x < 25 ? 3 : 4);
      col.push({ d: day, minutes: Math.round(m), answers: Math.round(a), level });
    }
    out.push(col);
  }
  return out;
}
