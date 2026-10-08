import type { C1Check, C1Doc } from '../c1/c1doc';
import type { ChapterStateResult } from '../c1/state';
import type { C1Item } from '../c1x/types';
import { addDays, dayKey, daysBetween, isDayKey } from '../date';
import { recentWeeks, type PatternsDoc } from '../patterns/patterns';
import type { TrainCard } from '../srs/types';
import { patsOf, readPatEntry } from './pattern';
import { vtestView, type VtestView } from './tests';
import { festUnits, retention28, type Retention28 } from './vocab';

// Messwerte der sieben C1-Kriterien (Lernplattform 3.0 §4.5, P44): EINE Quelle je Zahl. Kriterienzeile, Detail, „Messwerte dahinter“, Prognose
// und die Belegzeilen von `assess@4` lesen nur hier. Rein: Tag, Uhr und Dokumente kommen vom Aufrufer, nichts wird gespeichert.
// Die Urteile (Zustandswort, Schwelle, „auf Kurs“) stehen in `domain/c1/criteria.ts`, die Prognose in `domain/c1/forecast.ts`.

type Doc = Readonly<Record<string, unknown>>;
type Card = Pick<TrainCard, 'hidden' | 'isNew' | 'stage' | 'fsrs' | 'doc'>;

/** Fenster der Messungen aus dem Protokoll (Tage) und des Trends (Tage = 8 Wochen). */
export const C1_LOG_DAYS = 28;
export const C1_TREND_DAYS = 56;
/** Teile des C1-Checks: mcc, ocl, wf, kwt (8 + 8 + 8 + 6 × 2 = 36, Plan K-6). */
export const CHECK_PART_MAX: readonly [number, number, number, number] = [8, 8, 8, 12];
export const CHECK_MAX = 36;
export const CHAPTERS_TOTAL = 7;

const DAY_MS = 86_400_000;
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

// ------------------------------------------------------------------ K1 Grammatik-Weg

export type K1Measure = {
  /** Bestandene Kapitelprüfungen (verschiedene Kapitel mit `ok`). */
  gates: number;
  /** Muster Sicher oder Fest / alle Muster der vorhandenen Themen (aus `chapterState`, dieselbe Zahl wie die Programmkarte). */
  safe: number;
  total: number;
  /** Freie C1-Aufgaben (getippt) der letzten 28 Tage; `null` = Protokoll nicht gelesen. */
  free: { ok: number; n: number } | null;
  /** Muster, die in den letzten 8 Wochen zum ersten Mal „Sicher“ wurden (`pats.s`). */
  newSafe56: number;
};

export function k1Measure(i: { c1: C1Doc; chapters: ChapterStateResult; grammar: ReadonlyMap<string, Doc>; entries: readonly LogEntry[] | null; today: string }): K1Measure {
  const passed = new Set<number>();
  for (const g of i.c1.gates) if (g.ok === true && typeof g.ch === 'number') passed.add(g.ch);
  let safe = 0;
  let total = 0;
  for (const ch of i.chapters.chapters) {
    safe += ch.patSafe;
    total += ch.patTotal;
  }
  let newSafe56 = 0;
  const from = addDays(i.today, -C1_TREND_DAYS);
  for (const doc of i.grammar.values()) {
    for (const raw of Object.values(patsOf(doc))) {
      const s = readPatEntry(raw)?.s;
      if (s && s > from && s <= i.today) newSafe56++;
    }
  }
  let free: K1Measure['free'] = null;
  if (i.entries) {
    free = { ok: 0, n: 0 };
    for (const e of i.entries) {
      if (typeof e.c1k !== 'string' || e.free !== true) continue;
      free.n++;
      if (e.ok === true) free.ok++;
    }
  }
  return { gates: passed.size, safe, total, free, newSafe56 };
}

// ------------------------------------------------------------------ K2 Deutsch-Fallen

export type K2Measure = {
  /** Rückfälle aller Fallen in den letzten 4 Kalenderwochen; `null` = noch keine Fallen erkannt. */
  relapses: number | null;
  /** Dieselbe Zahl in den 4 Wochen davor (Trend), `null` ohne Verlauf. */
  prev: number | null;
  traps: number;
};

export function k2Measure(patterns: PatternsDoc | null, today: string): K2Measure {
  if (!patterns || !patterns.items.length) return { relapses: null, prev: null, traps: 0 };
  const ids = patterns.items.map((p) => p.id);
  const sum = (weeks: readonly string[]): number => {
    let n = 0;
    for (const w of weeks) {
      const h = patterns.history.find((x) => x.w === w);
      if (!h) continue;
      for (const id of ids) n += h.counts[id] ?? 0;
    }
    return n;
  };
  const cur = recentWeeks(today, 4);
  const before = recentWeeks(addDays(today, -28), 4);
  const known = new Set(patterns.history.map((h) => h.w));
  return { relapses: sum(cur), prev: before.some((w) => known.has(w)) ? sum(before) : null, traps: ids.length };
}

// ------------------------------------------------------------------ K3 Wörter verstehen

export type K3Measure = {
  view: VtestView;
  /** Wortschatztests der letzten 8 Wochen vor dem neuesten (für Trend und Tempo): `[tag, geschätzt]`, ältester zuerst. */
  series: Array<[string, number]>;
};

export function k3Measure(profile: Doc | undefined, nowMs: number, today: string): K3Measure {
  const view = vtestView(profile, nowMs);
  const from = addDays(today, -C1_TREND_DAYS);
  const series: Array<[string, number]> = [];
  for (const v of arr(profile?.vtests)) {
    if (!isObj(v)) continue;
    const t = num(v.t);
    const p = num(v.passive);
    if (t === null || p === null || t > nowMs) continue;
    const day = typeof v.d === 'string' && isDayKey(v.d) ? v.d : dayKey(t);
    if (day >= from) series.push([day, p]);
  }
  series.sort((a, b) => a[0].localeCompare(b[0]));
  return { view, series };
}

// ------------------------------------------------------------------ K4 Wörter aktiv

export type K4Measure = {
  /** Wörter und Wendungen fest (`festUnits`). */
  fest: number;
  /** Gelernte Karten (nicht neu, nicht ausgeblendet): 0 = noch keine Daten. */
  learned: number;
  retention: Retention28;
  /** Zuwachs der Fest-Zahl in bis zu 8 Wochen aus dem Tagesbild `vu` (mindestens 21 Tage Datenbasis), sonst `null`. */
  growth: { delta: number; days: number } | null;
};

export function k4Measure(cards: readonly Card[], history: unknown, nowMs: number, today: string): K4Measure {
  const fest = festUnits(cards);
  const learned = cards.filter((c) => !c.hidden && !c.isNew).length;
  const rows = arr(history)
    .filter(isObj)
    .map((h) => ({ d: h.d, v: num(h.vu) }))
    .filter((h): h is { d: string; v: number } => isDayKey(h.d) && h.v !== null)
    .filter((h) => daysBetween(h.d, today) >= 0 && daysBetween(h.d, today) <= C1_TREND_DAYS)
    .sort((a, b) => a.d.localeCompare(b.d));
  const first = rows[0];
  const days = first ? daysBetween(first.d, today) : 0;
  const growth = first && days >= 21 ? { delta: fest - first.v, days } : null;
  return { fest, learned, retention: retention28(cards, nowMs), growth };
}

// ------------------------------------------------------------------ K5 Prüfungsformate

/** `pts` = Punkte des Checks (0–36), genau wie gespeichert (Anzeige „x von 36“ ohne Umrechnung). */
export type DeskCheck = { d: string; pct: number; pts: number; parts: [number, number, number, number] };

/** Anteil einer Check-Punktzahl und je Teil (0–1). Nur Laptop-Checks (`inp: 'desk'`) zählen für K5. */
export function deskChecks(checks: readonly C1Check[]): DeskCheck[] {
  const out: DeskCheck[] = [];
  for (const c of checks) {
    if (c.inp !== 'desk' || !Array.isArray(c.p) || c.p.length !== 4) continue;
    const pts = num(c.pts) ?? c.p.reduce((s, x) => s + (num(x) ?? 0), 0);
    const parts = c.p.map((x, k) => Math.max(0, Math.min(1, (num(x) ?? 0) / (CHECK_PART_MAX[k] ?? 1)))) as [number, number, number, number];
    out.push({ d: c.d, pct: Math.max(0, Math.min(1, pts / CHECK_MAX)), pts: Math.max(0, Math.min(CHECK_MAX, pts)), parts });
  }
  return out.sort((a, b) => a.d.localeCompare(b.d));
}

// ------------------------------------------------------------------ K6 Selbstkorrektur

export type K6Measure = {
  /** Sätze MIT Fehler, Korrektur getippt: Antworten und davon voll richtig (Fundort + Korrektur). */
  n: number;
  ok: number;
  /** Fehlerfreie Sätze (jede Eingabeform; „Kein Fehler“ ist nie getippt): Antworten und davon richtig als fehlerfrei erkannt. */
  clean: number;
  cleanOk: number;
  /** Gezählte Antworten aus der Zeit vor der Tempo-Kennung (`tp`, ab `TP_SINCE`): darunter können noch Tempo-Antworten sein. */
  unmarked: number;
  /** Trefferquote der ersten und der zweiten Hälfte des Fensters (Trend), `null` ohne Antworten. */
  older: number | null;
  recent: number | null;
};

/** Ein Eintrag aus `log/<tag>.entries` (nur gelesene Felder). `tp` = Antwort aus einer Tempo-Runde (seit P44-Nachbesserung). */
export type LogEntry = { t?: number; ok?: boolean; c1k?: string; cid?: string; free?: boolean; pts?: number[]; tp?: boolean };

/**
 * Ab diesem Tag tragen Tempo-Antworten im Protokoll `tp: true` (P44-Nachbesserung, K-a). Ältere Antworten lassen sich nicht trennen; bis das
 * 28-Tage-Fenster sauber ist, sagt das K6-Detail „Enthält noch Tempo-Antworten“. Bewusst etwas nach dem Bau gewählt (vorsichtig).
 */
export const TP_SINCE = '2026-10-15';

/** Ab wann Antworten sicher gekennzeichnet sind (ms): später von `TP_SINCE` und der frühesten `tp`-Antwort im Protokoll. Rein. */
export function tpBoundary(entries: readonly LogEntry[]): number {
  let first = Infinity;
  for (const e of entries) if (e.tp === true && typeof e.t === 'number' && e.t < first) first = e.t;
  const floor = Date.parse(`${TP_SINCE}T00:00:00`);
  return Number.isFinite(first) ? Math.max(floor, first) : floor;
}

/** Einträge aus den Tagesprotokollen (tolerant): nur Objekte mit bekannten Feldtypen. */
export function logEntriesOf(logs: Iterable<Doc>): LogEntry[] {
  const out: LogEntry[] = [];
  for (const doc of logs) {
    for (const e of arr(doc.entries)) {
      if (!isObj(e)) continue;
      const pts = Array.isArray(e.pts) && e.pts.every((x) => typeof x === 'number') ? (e.pts) : undefined;
      out.push({
        ...(typeof e.t === 'number' ? { t: e.t } : {}),
        ...(typeof e.ok === 'boolean' ? { ok: e.ok } : {}),
        ...(typeof e.c1k === 'string' ? { c1k: e.c1k } : {}),
        ...(typeof e.cid === 'string' ? { cid: e.cid } : {}),
        ...(e.free === true ? { free: true } : {}),
        ...(pts ? { pts } : {}),
        ...(e.tp === true ? { tp: true } : {}),
      });
    }
  }
  return out;
}

/**
 * K6 aus „Fehler finden“ (§4.5): Trefferquote nur für Sätze mit Fehler und getippter Korrektur (`free`), Fehlalarm-Untergrenze getrennt aus
 * den fehlerfreien Sätzen (jede Eingabeform, denn „Kein Fehler“ wird nie getippt). Antworten im Chip-Modus haben kein `free` und zählen nicht. Tempo-Antworten (`tp`) zählen
 * nie (Zeitdruck ist keine Messung der Selbstkorrektur); ältere Einträge ohne Kennung werden unter `unmarked` gezählt.
 */
export function k6Measure(entries: readonly LogEntry[], itemOf: (id: string) => C1Item | null, nowMs: number): K6Measure {
  const mid = nowMs - (C1_LOG_DAYS / 2) * DAY_MS;
  // Grenze für „ohne Kennung“: TP_SINCE als Untergrenze; gibt es schon gekennzeichnete Tempo-Antworten und liegt die früheste später, gilt
  // diese (dann war die Kennung erst später live). Vorsichtig: im Zweifel bleibt der Hinweis etwas länger stehen.
  const tpSince = tpBoundary(entries);
  let n = 0;
  let ok = 0;
  let clean = 0;
  let cleanOk = 0;
  let unmarked = 0;
  const half = { older: [0, 0], recent: [0, 0] };
  for (const e of entries) {
    if (e.c1k !== 'err' || !e.cid || !e.pts || e.tp === true) continue;
    const item = itemOf(e.cid);
    if (!item || item.kind !== 'err') continue;
    if (item.bad && e.free !== true) continue;
    if (typeof e.t !== 'number' || e.t < tpSince) unmarked++;
    const full = (e.pts[0] ?? 0) >= (e.pts[1] ?? 2);
    if (!item.bad) {
      clean++;
      if (full) cleanOk++;
      continue;
    }
    n++;
    if (full) ok++;
    const h = typeof e.t === 'number' && e.t >= mid ? half.recent : half.older;
    h[1]!++;
    if (full) h[0]!++;
  }
  const rate = (h: number[]): number | null => (h[1] ? h[0]! / h[1] : null);
  return { n, ok, clean, cleanOk, unmarked, older: rate(half.older), recent: rate(half.recent) };
}

// ------------------------------------------------------------------ Programmstart

/** Erster Tag des Programms: frühester Tag aus Einstufung, Checks und Kapitelprüfungen; `null` ohne Programm. */
export function programStart(c1: C1Doc): string | null {
  const days = [c1.place?.d, ...c1.checks.map((c) => c.d), ...c1.gates.map((g) => g.d)].filter((d): d is string => isDayKey(d));
  return days.length ? days.reduce((a, b) => (a < b ? a : b)) : null;
}

/** Steigung (je Tag) einer Reihe `[tag, wert]` nach kleinsten Quadraten; `null` unter 2 Punkten oder ohne Zeitabstand. Rein. */
export function slopePerDay(series: ReadonlyArray<readonly [string, number]>): number | null {
  if (series.length < 2) return null;
  const x0 = series[0]![0];
  const xs = series.map(([d]) => daysBetween(x0, d));
  const ys = series.map(([, v]) => v);
  const mx = xs.reduce((s, x) => s + x, 0) / xs.length;
  const my = ys.reduce((s, y) => s + y, 0) / ys.length;
  let sxx = 0;
  let sxy = 0;
  xs.forEach((x, k) => {
    sxx += (x - mx) ** 2;
    sxy += (x - mx) * (ys[k]! - my);
  });
  return sxx > 0 ? sxy / sxx : null;
}
