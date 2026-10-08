import { addDays, daysBetween } from '../date';
import { programStart, slopePerDay, type K1Measure, type K4Measure } from '../metrics/c1';
import type { C1Check, C1Doc } from './c1doc';
import { CHECK_GAP_DAYS, inCheckWindow, isLastSaturday } from './checkSchedule';
import { C1_GOALS, type CritId, type CriteriaResult } from './criteria';

// Prognose „C1-Etappe“ (Lernplattform 3.0 §4.6, P44). Je Kriterium Rest = Schwelle − Stand, Tempo = Mittel der letzten 8 Wochen
// (K4 Fest-Zuwachs, K1 neu sichere Muster, K5/K7 Steigung über die Checks). Gesamt = das späteste Kriterium, es wird genannt.
// Gezeigt wird nur ein Zeitraum in Monaten (mindestens 3 Monate breit), erst bei ≥ 6 Wochen Programm UND ≥ 3 Checks; davor
// „noch nicht abschätzbar, ab <Datum des 3. Checks>“. Gerechnet wird nur im Check-Fenster und im Check-Eintrag eingefroren (`checks[].fc`),
// dazwischen steht der eingefrorene Wert: die Anzeige flackert nie. Tempo ≤ 0 → `fc: null` („Nach deiner Pause rechnet die App ab dem
// nächsten Check neu“). K2, K3 und K6 haben kein Tempo (§4.6) und fließen nicht ein; sie stehen nur als Zeilen da. Rein.

export const FC_MIN_CHECKS = 3;
export const FC_MIN_DAYS = 42;
export const FC_MIN_MONTHS = 3;
/** Spanne um das Tempo: Rest / (Tempo × 1,25) bis Rest / (Tempo × 0,75). */
export const FC_FAST = 1.25;
export const FC_SLOW = 0.75;
/** Weiter als 10 Jahre wird nicht gerechnet (eine solche Zahl sagt nichts). */
const FC_MAX_DAYS = 3650;

export type FcValue = { from: string; to: string; late: string };

export type CritEta = { id: CritId; rest: number; perDay: number; lo: number; hi: number; mid: number };

export type ForecastCalc =
  | { kind: 'reached' }
  | { kind: 'none'; missing: CritId[] }
  | { kind: 'pause'; ids: CritId[] }
  | { kind: 'range'; from: string; to: string; late: CritId; etas: CritEta[]; missing: CritId[] };

const monthOf = (day: string): string => day.slice(0, 7);
function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const k = (y ?? 1970) * 12 + ((m ?? 1) - 1) + n;
  return `${Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, '0')}`;
}
const monthsBetween = (a: string, b: string): number => {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return ((yb ?? 0) - (ya ?? 0)) * 12 + ((mb ?? 0) - (ma ?? 0));
};

/**
 * Rechnung zum Tag `today` aus den Kriterien und ihren Messwerten. Rein. Nur Kriterien mit Tempo (§4.6): K1 (Muster, 80 % sicher),
 * K4 (750 fest), K5 (60 % im Laptop-Check), K7 (≤ 3,0 Fehler je 100 Wörter). Erfüllte Kriterien haben Rest 0; fehlt einem offenen Kriterium
 * die Datenbasis, steht es unter `missing` und zählt nicht.
 */
export function forecastCalc(i: { today: string; crit: CriteriaResult; k1: K1Measure; k4: K4Measure }): ForecastCalc {
  if (i.crit.stage) return { kind: 'reached' };
  const state = new Map(i.crit.list.map((c) => [c.id, c.state]));
  const missing: CritId[] = [];
  const pause: CritId[] = [];
  const etas: CritEta[] = [];
  const add = (id: CritId, rest: number | null, perDay: number | null): void => {
    if (state.get(id) === 'met') return;
    if (rest === null || perDay === null) {
      missing.push(id);
      return;
    }
    if (rest <= 0) {
      etas.push({ id, rest: 0, perDay, lo: 0, hi: 0, mid: 0 });
      return;
    }
    if (perDay <= 0) {
      pause.push(id);
      return;
    }
    const cap = (d: number): number => Math.min(FC_MAX_DAYS, Math.ceil(d));
    etas.push({ id, rest, perDay, lo: cap(rest / (perDay * FC_FAST)), hi: cap(rest / (perDay * FC_SLOW)), mid: cap(rest / perDay) });
  };

  const k1 = i.k1;
  add('k1', k1.total > 0 ? Math.max(0, Math.ceil(C1_GOALS.k1.safeShare * k1.total) - k1.safe) : null, k1.total > 0 ? k1.newSafe56 / 56 : null);
  const g = i.k4.growth;
  add('k4', i.k4.learned > 0 || i.k4.fest > 0 ? Math.max(0, C1_GOALS.k4.fest - i.k4.fest) : null, g && g.days > 0 ? g.delta / g.days : null);
  const desk = i.crit.desk;
  const lastDesk = desk[desk.length - 1];
  add('k5', lastDesk ? Math.max(0, C1_GOALS.k5.pct - lastDesk.pct) : null, slopePerDay(desk.map((c) => [c.d, c.pct] as const)));
  const k7 = i.crit.k7Days.filter((x) => x.r.state === 'ok' && x.r.rate !== null).map((x) => [x.d, x.r.rate as number] as const);
  const k7Last = k7[k7.length - 1];
  const k7Slope = slopePerDay(k7);
  add('k7', k7Last ? Math.max(0, k7Last[1] - C1_GOALS.k7.rate) : null, k7Slope === null ? null : -k7Slope);

  if (pause.length) return { kind: 'pause', ids: pause };
  if (!etas.length) return { kind: 'none', missing };
  const late = etas.reduce((a, b) => (b.mid > a.mid ? b : a));
  const lo = Math.max(...etas.map((e) => e.lo));
  const hi = Math.max(...etas.map((e) => e.hi));
  let from = monthOf(addDays(i.today, lo));
  let to = monthOf(addDays(i.today, hi));
  if (monthsBetween(from, to) < FC_MIN_MONTHS - 1) {
    // Mindestens 3 Monate breit: um den Mittelpunkt erweitern, nie vor den laufenden Monat.
    const need = FC_MIN_MONTHS - 1 - monthsBetween(from, to);
    const before = Math.min(Math.floor(need / 2), monthsBetween(monthOf(i.today), from));
    from = addMonths(from, -before);
    to = addMonths(to, need - before);
  }
  return { kind: 'range', from, to, late: late.id, etas, missing };
}

/** Der eingefrorene Wert eines Check-Eintrags aus einer Rechnung; `undefined` = nichts einfrieren (keine Datenbasis). */
export function fcOf(calc: ForecastCalc): FcValue | null | undefined {
  if (calc.kind === 'range') return { from: calc.from, to: calc.to, late: calc.late };
  if (calc.kind === 'pause') return null;
  return undefined;
}

// ------------------------------------------------------------------ Wann darf gerechnet und gezeigt werden?

/** ≥ 6 Wochen Programm und ≥ 3 Checks (§4.6). */
export function forecastAllowed(c1: C1Doc, today: string): boolean {
  const start = programStart(c1);
  return c1.checks.length >= FC_MIN_CHECKS && start !== null && daysBetween(start, today) >= FC_MIN_DAYS;
}

/** Nächster möglicher Check-Tag ab `from` (letzter Samstag eines Monats, Mindestabstand zum letzten Check). Rein. */
export function nextCheckDay(from: string, lastCheck: string | null): string {
  let d = from;
  if (lastCheck && addDays(lastCheck, CHECK_GAP_DAYS) > d) d = addDays(lastCheck, CHECK_GAP_DAYS);
  for (let k = 0; k < 120 && !isLastSaturday(d); k++) d = addDays(d, 1);
  return d;
}

/** Ab wann die Prognose frühestens erscheint: der Tag des 3. Checks, nicht vor 6 Wochen Programm. `null` ohne Programm. Rein. */
export function forecastFrom(c1: C1Doc, today: string): string | null {
  const start = programStart(c1);
  if (!start) return null;
  const days = c1.checks.map((c) => c.d).sort();
  let last = days[days.length - 1] ?? null;
  let probe = today;
  while ((days.length < FC_MIN_CHECKS || (last ?? '') < addDays(start, FC_MIN_DAYS)) && days.length <= 40) {
    const d = nextCheckDay(probe, last);
    days.push(d);
    last = d;
    probe = addDays(d, 1);
  }
  return days.find((d, k) => k >= FC_MIN_CHECKS - 1 && daysBetween(start, d) >= FC_MIN_DAYS) ?? null;
}

export type ForecastView =
  /** Noch nicht abschätzbar, ab `from` (Datum des 3. Checks; `null` = sobald das Programm läuft). */
  | { kind: 'wait'; from: string | null }
  /** Erlaubt, aber noch kein eingefrorener Wert: entsteht am nächsten Check-Tag. */
  | { kind: 'pending'; next: string }
  | { kind: 'pause' }
  | { kind: 'range'; from: string; to: string; late: CritId }
  | { kind: 'reached' };

const isCrit = (v: string): v is CritId => /^k[1-7]$/.test(v);

/** Was die Anzeige zeigt: nur eingefrorene Werte, nie live gerechnet (kein Flackern). Rein. */
export function forecastView(c1: C1Doc, today: string, stage: boolean): ForecastView {
  if (stage) return { kind: 'reached' };
  if (!forecastAllowed(c1, today)) return { kind: 'wait', from: forecastFrom(c1, today) };
  const frozen = [...c1.checks].sort((a, b) => a.d.localeCompare(b.d)).reverse().find((c) => c.fc !== undefined);
  if (!frozen) {
    const last = c1.checks.map((c) => c.d).sort().pop() ?? null;
    return { kind: 'pending', next: nextCheckDay(today, last) };
  }
  if (!frozen.fc) return { kind: 'pause' };
  const { from, to, late } = frozen.fc;
  if (!/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}$/.test(to) || !isCrit(late)) return { kind: 'pause' };
  return { kind: 'range', from, to, late };
}

/**
 * Index des Checks, dessen Prognose JETZT eingefroren werden soll, sonst `-1`: nur im Check-Fenster, nur der neueste Check aus diesem
 * Monat, nur wenn er noch keinen Wert hat und die Prognose erlaubt ist. So ändert sie sich nur an Check-Tagen.
 */
export function freezeIndex(c1: C1Doc, today: string): number {
  if (!inCheckWindow(today) || !forecastAllowed(c1, today)) return -1;
  let idx = -1;
  c1.checks.forEach((c, k) => {
    if (idx < 0 || c.d >= (c1.checks[idx] as C1Check).d) idx = k;
  });
  const c = c1.checks[idx];
  if (!c || c.fc !== undefined || monthOf(c.d) !== monthOf(today) || c.d > today) return -1;
  return idx;
}

/** Änderung für `patchC1`: den Wert in den Check `d` schreiben, nur wenn dort noch keiner steht. Rein. */
export function withFc(doc: C1Doc, d: string, fc: FcValue | null): C1Doc | null {
  const k = doc.checks.findIndex((c) => c.d === d && c.fc === undefined);
  if (k < 0) return null;
  const checks = doc.checks.map((c, j) => (j === k ? { ...c, fc } : c));
  return { ...doc, checks };
}
