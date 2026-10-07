import { addDays } from '../date';
import { isTempoKind, targetMs, type TempoKind } from '../c1x/tempo';
import type { C1Kind } from '../c1x/types';

// Messwerte der Tempo-Runde (Lernplattform 3.0 §2.3, P24): aus den Protokolleinträgen `log/<tag>.entries`. Rein, nichts wird gespeichert.
// `tm` steht an jeder getippten c1x-Antwort (Millisekunden bis zur Abgabe). Gerechnet wird nur mit RICHTIGEN, getippten Antworten:
// Ein Fehlversuch sagt nichts über die Abrufzeit. Kein Vergleich mit anderen, keine Wertung; die Zahlen stehen nur unter „Messwerte dahinter“ und in der Runde.

export type TempoLogEntry = { k?: string; c1k?: string; tm?: unknown; ok?: boolean; pat?: string; free?: boolean; dev?: string; t?: number };
export type TempoSample = { pat: string | null; kind: string; tm: number; dev: 't' | 'k'; t: number };

/** Mindestmenge, ab der eine Zeit „zuletzt“ genannt wird (darunter ist der Median Zufall). */
export const MIN_SAMPLES = 5;

/** Die richtigen, getippten Antworten mit gültiger Zeit. */
export function typedSamples(entries: readonly TempoLogEntry[]): TempoSample[] {
  const out: TempoSample[] = [];
  for (const e of entries) {
    if (e.k !== 'g' || e.ok !== true || e.free !== true || typeof e.c1k !== 'string') continue;
    if (typeof e.tm !== 'number' || !Number.isFinite(e.tm) || e.tm <= 0) continue;
    out.push({ pat: typeof e.pat === 'string' ? e.pat : null, kind: e.c1k, tm: e.tm, dev: e.dev === 't' ? 't' : 'k', t: typeof e.t === 'number' ? e.t : 0 });
  }
  return out;
}

export function median(xs: readonly number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

/** Median der richtigen getippten Antworten (ms); `null` ohne Daten. */
export const medianTm = (entries: readonly TempoLogEntry[]): number | null => median(typedSamples(entries).map((s) => s.tm));

/**
 * Verhältnis Median-Zeit zu Zielzeit je Muster (nur die drei Arten der Tempo-Runde). 1 = genau in der Zielzeit, über 1 = langsamer.
 * Je Muster zählt der Median seiner Antworten; die Auswahl nimmt die langsamsten zuerst.
 */
export function slownessByPattern(entries: readonly TempoLogEntry[]): Map<string, number> {
  const by = new Map<string, number[]>();
  for (const s of typedSamples(entries)) {
    if (!s.pat || !isTempoKind(s.kind as C1Kind)) continue;
    const target = targetMs(s.kind as TempoKind, s.dev === 't' ? 'touch' : 'desk');
    const list = by.get(s.pat) ?? [];
    list.push(s.tm / target);
    by.set(s.pat, list);
  }
  const out = new Map<string, number>();
  for (const [pat, xs] of by) out.set(pat, median(xs) as number);
  return out;
}

/** „zuletzt 7,4 s“: Median der letzten 28 Tage; `null`, wenn es zu wenige Antworten gibt. */
export function recentMedian(days: ReadonlyArray<{ day: string; entries: readonly TempoLogEntry[] }>): { ms: number; n: number } | null {
  const all = days.flatMap((d) => typedSamples(d.entries));
  if (all.length < MIN_SAMPLES) return null;
  return { ms: median(all.map((s) => s.tm)) as number, n: all.length };
}

/** Median je Woche, die letzten `weeks` Wochen (neueste zuerst); für „Messwerte dahinter“ (Trend über 4 Wochen). Eine Woche ohne genug Antworten hat `ms: null`. */
export function weeklyMedians(days: ReadonlyArray<{ day: string; entries: readonly TempoLogEntry[] }>, today: string, weeks = 4): Array<{ from: string; n: number; ms: number | null }> {
  const out: Array<{ from: string; n: number; ms: number | null }> = [];
  for (let w = 0; w < weeks; w++) {
    const to = addDays(today, -7 * w);
    const from = addDays(today, -7 * w - 6);
    const xs = days.filter((d) => d.day >= from && d.day <= to).flatMap((d) => typedSamples(d.entries).map((s) => s.tm));
    out.push({ from, n: xs.length, ms: xs.length >= MIN_SAMPLES ? median(xs) : null });
  }
  return out;
}

export type TempoRow = { kind: TempoKind; ok: boolean; ms: number; target: number };
export type TempoSummary = { total: number; right: number; inTarget: number; avgMs: number | null };

/** Ergebnis der Runde: „9 von 12 richtig · 7 davon in der Zielzeit · im Schnitt 5,8 s“ (Schnitt über die richtigen Antworten). */
export function summarizeTempo(rows: readonly TempoRow[]): TempoSummary {
  const right = rows.filter((r) => r.ok);
  return {
    total: rows.length,
    right: right.length,
    inTarget: right.filter((r) => r.ms <= r.target).length,
    avgMs: right.length ? right.reduce((a, r) => a + r.ms, 0) / right.length : null,
  };
}
