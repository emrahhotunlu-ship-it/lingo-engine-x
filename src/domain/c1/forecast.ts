import { addDays, daysBetween } from '../date';
import { programStart, slopePerDay, type K1Measure, type K4Measure } from '../metrics/c1';
import type { C1Check, C1Doc } from './c1doc';
import { CHECK_GAP_DAYS, inCheckWindow, isLastSaturday } from './checkSchedule';
import { C1_GOALS, CRITERIA, type CritId, type CriteriaResult } from './criteria';
import type { ChapterStateResult } from './state';

// Prognose „C1-Etappe“ (Lernplattform 3.0 §4.6, P44). Je Kriterium Rest = Schwelle − Stand, Tempo = Mittel der letzten 8 Wochen
// (K4 Fest-Zuwachs, K1 neu sichere Muster, K5/K7 Steigung über die Checks). Gesamt = das späteste Kriterium, es wird genannt.
// Gezeigt wird nur ein Zeitraum in Monaten (mindestens 3 Monate breit), erst bei ≥ 6 Wochen Programm UND ≥ 3 Checks; davor
// „noch nicht abschätzbar, ab <Datum des 3. Checks>“. Gerechnet wird nur im Check-Fenster und im Check-Eintrag eingefroren (`checks[].fc`),
// dazwischen steht der eingefrorene Wert: die Anzeige flackert nie. Tempo ≤ 0 → `fc: {pause: <Kriterium>}` („Bei <Kriterium> ging es zuletzt
// nicht voran …“; ältere Einträge `fc: null` lesen sich neutral). K2, K3 und K6 haben kein Tempo (§4.6) und fließen nicht ein; welche
// Kriterien eingerechnet sind (`inc`) und welche nicht (`out`), wird mit eingefroren und angezeigt. K1 hat eine Untergrenze aus den offenen
// Kapiteln (je offenes Thema 1 Tag, je Kapitel 14 Tage): schneller als das Programm selbst kann der Grammatik-Weg nicht fertig sein. Rein.

export const FC_MIN_CHECKS = 3;
export const FC_MIN_DAYS = 42;
export const FC_MIN_MONTHS = 3;
/** Spanne um das Tempo: Rest / (Tempo × 1,25) bis Rest / (Tempo × 0,75). */
export const FC_FAST = 1.25;
export const FC_SLOW = 0.75;
/** Weiter als 10 Jahre wird nicht gerechnet (eine solche Zahl sagt nichts). */
const FC_MAX_DAYS = 3650;

/** Eingefrorene Prognose: Zeitraum mit eingerechneten (`inc`) und nicht eingerechneten (`out`) Kriterien, oder Pause mit dem Kriterium ohne Fortschritt. */
export type FcRange = { from: string; to: string; late: string; inc?: string[]; out?: string[] };
export type FcPause = { pause: string };
export type FcValue = FcRange | FcPause;

/** Mindestdauer des Grammatik-Wegs je offenes Thema und je offenes Kapitel (Tage). */
export const K1_DAYS_PER_TOPIC = 1;
export const K1_DAYS_PER_CHAPTER = 14;

export type CritEta = { id: CritId; rest: number; perDay: number; lo: number; hi: number; mid: number };

export type ForecastCalc =
  | { kind: 'reached' }
  | { kind: 'none'; missing: CritId[] }
  | { kind: 'pause'; ids: CritId[] }
  | { kind: 'range'; from: string; to: string; late: CritId; etas: CritEta[]; missing: CritId[]; out: CritId[] };

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

/** Untergrenze des Grammatik-Wegs in Tagen aus dem Kapitelstand: offene Themen × 1 Tag + offene Kapitel × 14 Tage. Rein. */
export function k1FloorDays(chapters: ChapterStateResult | undefined): number {
  if (!chapters) return 0;
  let topics = 0;
  let open = 0;
  for (const ch of chapters.chapters) {
    if (ch.status === 'done') continue;
    open++;
    topics += ch.topics.filter((t) => !t.safe).length;
  }
  return topics * K1_DAYS_PER_TOPIC + open * K1_DAYS_PER_CHAPTER;
}

/**
 * Rechnung zum Tag `today` aus den Kriterien und ihren Messwerten. Rein. Nur Kriterien mit Tempo (§4.6): K1 (Muster, 80 % sicher),
 * K4 (750 fest), K5 (60 % im Laptop-Check), K7 (≤ 3,0 Fehler je 100 Wörter). Erfüllte Kriterien haben Rest 0; fehlt einem offenen Kriterium
 * die Datenbasis, steht es unter `missing` und zählt nicht. `out` = alle offenen Kriterien, die nicht eingerechnet sind (ohne Tempo oder ohne Daten).
 */
export function forecastCalc(i: { today: string; crit: CriteriaResult; k1: K1Measure; k4: K4Measure; chapters?: ChapterStateResult }): ForecastCalc {
  if (i.crit.stage) return { kind: 'reached' };
  const state = new Map(i.crit.list.map((c) => [c.id, c.state]));
  const missing: CritId[] = [];
  const pause: CritId[] = [];
  const etas: CritEta[] = [];
  const cap = (d: number): number => Math.min(FC_MAX_DAYS, Math.ceil(d));
  const add = (id: CritId, rest: number | null, perDay: number | null, floor = 0): void => {
    if (state.get(id) === 'met') return;
    if (rest === null || perDay === null) {
      missing.push(id);
      return;
    }
    const f = cap(floor);
    if (rest <= 0) {
      etas.push({ id, rest: 0, perDay, lo: f, hi: f, mid: f });
      return;
    }
    if (perDay <= 0) {
      pause.push(id);
      return;
    }
    etas.push({ id, rest, perDay, lo: Math.max(f, cap(rest / (perDay * FC_FAST))), hi: Math.max(f, cap(rest / (perDay * FC_SLOW))), mid: Math.max(f, cap(rest / perDay)) });
  };

  const k1 = i.k1;
  add('k1', k1.total > 0 ? Math.max(0, Math.ceil(C1_GOALS.k1.safeShare * k1.total) - k1.safe) : null, k1.total > 0 ? k1.newSafe56 / 56 : null, k1FloorDays(i.chapters));
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
  const inc = new Set(etas.map((e) => e.id));
  const out = CRITERIA.filter((id) => state.get(id) !== 'met' && !inc.has(id));
  return { kind: 'range', from, to, late: late.id, etas, missing, out };
}

/** Der eingefrorene Wert eines Check-Eintrags aus einer Rechnung; `undefined` = nichts einfrieren (keine Datenbasis). */
export function fcOf(calc: ForecastCalc): FcValue | undefined {
  if (calc.kind === 'range') return { from: calc.from, to: calc.to, late: calc.late, inc: calc.etas.map((e) => e.id), out: [...calc.out] };
  if (calc.kind === 'pause') return { pause: calc.ids[0] ?? 'k1' };
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
  /** Kein Fortschritt bei `id` (`null` = älterer Eintrag ohne Kriterium): neutral, nie „Pause“ unterstellt. */
  | { kind: 'pause'; id: CritId | null }
  /** `inc`/`out`: eingerechnete und nicht eingerechnete Kriterien (`null` = älterer Eintrag ohne Listen). */
  | { kind: 'range'; from: string; to: string; late: CritId; inc: CritId[] | null; out: CritId[] | null }
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
  const fc: unknown = frozen.fc;
  if (!fc || typeof fc !== 'object') return { kind: 'pause', id: null };
  const o = fc as Record<string, unknown>;
  if ('pause' in o) return { kind: 'pause', id: typeof o.pause === 'string' && isCrit(o.pause) ? o.pause : null };
  const { from, to, late } = o;
  if (typeof from !== 'string' || typeof to !== 'string' || typeof late !== 'string' || !/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}$/.test(to) || !isCrit(late)) return { kind: 'pause', id: null };
  const ids = (v: unknown): CritId[] | null => (Array.isArray(v) ? v.filter((x): x is CritId => typeof x === 'string' && isCrit(x)) : null);
  return { kind: 'range', from, to, late, inc: ids(o.inc), out: ids(o.out) };
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
