import { addDays, dayKey, daysBetween } from '../shared';
import { FLAG, YOUNG_MAX_LV } from './planner';
import { ivlFactor } from './tracks';
import type { Form, Lex, Outcome } from './types';
import type { VlogTuple } from './vlog';

// Großpaket A S6: Rechnungen für Wort-Seite (B2, N5), Übersicht (B1, M18, M63, N7) und Einstellungen (B9). Rein, ohne Datenbank.
// Grundlage ist der Verlauf `vlog` (Tupel siehe vlog.ts) und der Lernstand der Lexeme.

// ---------- Behaltensrate (M18, N7)

export type Rate = { ok: number; all: number };
export type Retention = { all: Rate; mature: Rate; young: Rate };

/** Fenster der echten Behaltensrate in Lerntagen. */
export const RET_WINDOW_DAYS = 30;
/** Ab so vielen Antworten je Gruppe ist die Rate belastbar (sonst kein Urteil, kein Nachsteuern). */
export const RET_MIN_SAMPLE = 40;
/** Abweichung in Punkten, ab der die App einen Hinweis gibt (N7) bzw. junge Wörter früher holt (Emrahs Wahl, 01.11.). */
export const RET_GAP = 0.05;
/** Aufschlag auf das Ziel für junge Wörter, solange ihre Rate zu niedrig ist; höchstens `RET_Y_MAX`. */
export const RET_Y_STEP = 0.03;
export const RET_Y_MAX = 0.97;
/** Ab dieser Stufe (vor der Antwort) gilt ein Wort als gefestigt. */
export const MATURE_LV = YOUNG_MAX_LV + 1;

/**
 * Stufe VOR der Antwort aus dem Tupel (es speichert die Stufe danach): ein Fehler ab Stufe 3 steigt eine Stufe ab (ladder.ts `descend`, nie
 * unter 2). Bei 2 nach einem Fehler war es 2 oder 3; beides ist „jung“.
 */
function lvBefore(lv: number, ok: boolean): number {
  return !ok && lv >= 2 ? lv + 1 : lv;
}

/**
 * Echte Behaltensrate der letzten `days` Lerntage: nur Antworten mit Planwirkung (Note > 0), ohne Lernschritte; richtig = Note ≥ 2.
 * Übernommene Einträge der Umstellung (Stufe 0) zählen nur im Ganzen.
 */
export function retention(tuples: readonly VlogTuple[], nowMs: number, days = RET_WINDOW_DAYS): Retention {
  const from = addDays(dayKey(nowMs), -(days - 1));
  const r: Retention = { all: { ok: 0, all: 0 }, mature: { ok: 0, all: 0 }, young: { ok: 0, all: 0 } };
  for (const tp of tuples) {
    const [t, , , , note, , , , , , lv, flags] = tp;
    if (note <= 0 || (flags & FLAG.step) !== 0 || t > nowMs || dayKey(t) < from) continue;
    const ok = note >= 2;
    const add = (x: Rate) => {
      x.all++;
      if (ok) x.ok++;
    };
    add(r.all);
    if (lv <= 0) continue;
    add(lvBefore(lv, ok) >= MATURE_LV ? r.mature : r.young);
  }
  return r;
}

/** Rate als Anteil, `null` unter der Mindestzahl. */
export function rateOf(x: Rate, min = RET_MIN_SAMPLE): number | null {
  return x.all >= min ? x.ok / x.all : null;
}

/**
 * Junge Wörter früher (Emrahs Wahl F, 01.11.): Liegt die Rate der jungen Wörter mehr als 5 Punkte unter dem Ziel, bekommen sie ein etwas
 * höheres Ziel (kürzere Abstände). Liefert das Ziel für junge Wörter oder `null` (kein Nachsteuern).
 */
export function youngBoost(ret: number, r: Retention): number | null {
  const y = rateOf(r.young);
  if (y === null || y >= ret - RET_GAP) return null;
  const to = Math.min(RET_Y_MAX, Math.round((ret + RET_Y_STEP) * 100) / 100);
  return to > ret ? to : null;
}

/** Ehrlichkeits-Hinweis (N7): welche Gruppe liegt mehr als 5 Punkte unter dem Ziel? Junge zuerst (dort steuert die App selbst nach). */
export function retentionGap(ret: number, r: Retention): { group: 'young' | 'mature'; rate: number } | null {
  const y = rateOf(r.young);
  if (y !== null && y < ret - RET_GAP) return { group: 'young', rate: y };
  const m = rateOf(r.mature);
  if (m !== null && m < ret - RET_GAP) return { group: 'mature', rate: m };
  return null;
}

/** Mehrminuten am Tag, wenn junge Wörter mit `retY` statt `ret` geplant werden (Wiederholungsminuten der jungen Wörter je Tag). */
export function boostExtraMinutes(youngReviewMin: number, ret: number, retY: number): number {
  if (!(youngReviewMin > 0) || retY <= ret) return 0;
  return youngReviewMin * (1 / ivlFactor(ret, retY) - 1);
}

// ---------- Minuten (M63, B9)

export const avg = (xs: readonly number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/**
 * Sicherheit mit Minuten (B9, F3): Minuten am Tag für jede Wahl. Wiederholungen skalieren mit dem Abstandsfaktor gegenüber der aktuellen
 * Wahl (gleiche Stabilität, FSRS); neue Wörter kosten unabhängig davon gleich viel.
 */
export function safetyMinutes(reviewMinPerDay: number, newMinPerDay: number, cur: number, options: readonly number[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of options) out[String(r)] = Math.round(reviewMinPerDay / ivlFactor(cur, r) + newMinPerDay);
  return out;
}

// ---------- Gruppen (B1)

export type Groups = { fresh: number; lv: number[]; recognize: number; onway: number; produce: number; total: number };

/** Zahl je Stufe 1–7 (Index 0 = Stufe 1), neue (noch nicht eingeführte) Wörter extra. */
export function groupCounts(lexes: Iterable<Lex>): Groups {
  const g: Groups = { fresh: 0, lv: [0, 0, 0, 0, 0, 0, 0], recognize: 0, onway: 0, produce: 0, total: 0 };
  for (const l of lexes) {
    g.total++;
    if (l.intro === null) {
      g.fresh++;
      continue;
    }
    const lv = Math.max(1, Math.min(7, l.lv));
    g.lv[lv - 1]!++;
    if (lv <= 2) g.recognize++;
    else if (lv <= 5) g.onway++;
    else g.produce++;
  }
  return g;
}

// ---------- Verlauf eines Worts (N5)

/** Farbe eines Tages: frei richtig · mit Hilfe/schwer · falsch · nur Übung (ohne Planwirkung). */
export type Cell = 'ok' | 'help' | 'wrong' | 'none';
export const HISTORY_DAYS = 42;

export type Attempt = {
  t: number;
  form: Form;
  outcome: Outcome;
  note: number;
  hint: number;
  track: 0 | 1 | 2;
  lv: number;
  /** Wirkung: Aufstieg, Abstieg, Plan gebucht ohne Stufenwechsel, keine Wirkung auf den Plan. */
  fx: 'up' | 'down' | 'stay' | 'none';
  /** Stufe vorher (nur bei Auf-/Abstieg). */
  from: number | null;
  mig: boolean;
  /** Beleg aus einem anderen Bereich (Lesen, C1-Aufgabe; `FLAG.ext`): „Auch woanders gesehen“ (N6). */
  ext: boolean;
};

function cellOf(note: number, hint: number): Cell {
  if (note <= 0) return 'none';
  if (note === 1) return 'wrong';
  return note === 2 || hint > 0 ? 'help' : 'ok';
}
const RANK: Record<Cell, number> = { none: 0, ok: 1, help: 2, wrong: 3 };

/** Alle Versuche eines Lexems, älteste zuerst (Duplikate nach Zeit und Form zusammengefasst). */
export function attemptsOf(tuples: readonly VlogTuple[], path: string): Attempt[] {
  const seen = new Set<string>();
  const own = tuples
    .filter((tp) => tp[1] === path)
    .filter((tp) => {
      const k = `${tp[0]}:${tp[3]}:${tp[2]}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => a[0] - b[0]);
  const out: Attempt[] = [];
  let prev: number | null = null;
  for (const tp of own) {
    const [t, , track, form, note, outcome, , , hint, , lv, flags] = tp;
    const mig = (flags & FLAG.mig) !== 0;
    const ext = (flags & FLAG.ext) !== 0;
    let fx: Attempt['fx'] = note > 0 ? 'stay' : 'none';
    let from: number | null = null;
    if (!mig && lv > 0 && prev !== null && prev > 0 && lv !== prev) {
      fx = lv > prev ? 'up' : 'down';
      from = prev;
    }
    out.push({ t, form, outcome, note, hint, track, lv, fx, from, mig, ext });
    if (lv > 0) prev = lv;
  }
  return out;
}

/** Zeitleiste der letzten `days` Lerntage (älteste zuerst): ein Feld je Tag, die schlechteste Antwort mit Planwirkung gewinnt. */
export function timeline(attempts: readonly Attempt[], nowMs: number, days = HISTORY_DAYS): (Cell | null)[] {
  const today = dayKey(nowMs);
  const cells: (Cell | null)[] = Array.from({ length: days }, () => null);
  for (const a of attempts) {
    if (a.mig) continue;
    const idx = days - 1 - daysBetween(dayKey(a.t), today);
    if (idx < 0 || idx >= days) continue;
    const c = cellOf(a.note, a.hint);
    const cur = cells[idx];
    if (cur === null || cur === undefined || RANK[c] > RANK[cur]) cells[idx] = c;
  }
  return cells;
}

/** Der Lerntag von `days - 1` Tagen vor heute (Beginn der Zeitleiste). */
export const timelineStart = (nowMs: number, days = HISTORY_DAYS): string => addDays(dayKey(nowMs), -(days - 1));

/** Ganze Tage bis zum nächsten Abruf einer Spur (0 = heute fällig oder überfällig). */
export function daysUntil(due: number, nowMs: number): number {
  return Math.max(0, daysBetween(dayKey(nowMs), dayKey(due)));
}

/** Fehlwörter (Großpaket B3, Wörter-Reiter „Deine Fehlwörter“): Fenster in Lerntagen und Größe der Runde. */
export const MISTAKE_DAYS = 14;
export const MISTAKE_MAX = 12;

/**
 * Lexeme mit mindestens einer falschen Antwort (Note 1) in den letzten `days` Lerntagen, jüngster Fehler zuerst, höchstens `max`.
 * Umgestellte Einträge (`FLAG.mig`) und Belege aus anderen Bereichen (`FLAG.ext`) zählen nicht; ob ein Lexem neu oder ausgeblendet ist,
 * entscheidet die Runde selbst (sie nimmt nur eingeführte Lexeme).
 */
export function mistakePaths(tuples: readonly VlogTuple[], nowMs: number, days = MISTAKE_DAYS, max = MISTAKE_MAX): string[] {
  const from = addDays(dayKey(nowMs), -(days - 1));
  const last = new Map<string, number>();
  for (const tp of tuples) {
    const [t, path, , , note, , , , , , , flags] = tp;
    if (note !== 1 || (flags & (FLAG.mig | FLAG.ext)) !== 0 || dayKey(t) < from) continue;
    if ((last.get(path) ?? -1) < t) last.set(path, t);
  }
  return [...last.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([p]) => p);
}
