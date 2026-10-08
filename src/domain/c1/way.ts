import type { C1Item } from '../c1x/types';
import { readPatterns } from '../patterns/patterns';
import { k1Measure, k2Measure, k3Measure, k4Measure, k6Measure, logEntriesOf, CHECK_PART_MAX, type K1Measure, type K2Measure, type K3Measure, type K4Measure, type K6Measure } from '../metrics/c1';
import { readC1, type C1Doc } from './c1doc';
import { c1Criteria, type CritId, type CritState, type Criterion, type CriteriaResult } from './criteria';
import { fcOf, forecastCalc, forecastView, freezeIndex, type FcValue, type ForecastCalc, type ForecastView } from './forecast';
import { chapterState, type ChapterStateResult } from './state';

// „Weg zu C1“ (Lernplattform 3.0 §4.4–§4.6, P45): alle Messwerte, Kriterien und die Prognose in EINEM reinen Aufruf, dazu die englischen
// Belegzeilen für `assess@4`. Blatt und Einschätzung rechnen damit dieselben Zahlen. Rein: Tag, Uhr und Dokumente kommen vom Aufrufer.

type Doc = Readonly<Record<string, unknown>>;
type Card = Parameters<typeof k4Measure>[0][number];

export type WayInput = {
  today: string;
  nowMs: number;
  /** `app/c1` roh (tolerant gelesen). */
  c1: unknown;
  grammar: ReadonlyMap<string, Doc>;
  profile: Doc | undefined;
  cards: readonly Card[];
  /** `app/patterns` roh, `undefined` = noch nicht gelesen. */
  patterns: unknown;
  /** Protokolle der letzten 28 Tage; `null` = noch nicht gelesen (K1 frei und K6 dann „zu wenig Daten“). */
  logs: readonly Doc[] | null;
  itemOf: (id: string) => C1Item | null;
};

export type Way = {
  c1: C1Doc;
  chapters: ChapterStateResult;
  k1: K1Measure;
  k2: K2Measure;
  k3: K3Measure;
  k4: K4Measure;
  k6: K6Measure | null;
  crit: CriteriaResult;
  calc: ForecastCalc;
  view: ForecastView;
  /** Gar keine Datenbasis (jedes Kriterium „zu wenig Daten“): sauberer Leerzustand. */
  empty: boolean;
};

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const nums = (v: unknown, n: number): boolean => Array.isArray(v) && v.length >= n && v.slice(0, n).every(isNum);
const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Nur Einträge mit erwartetem Aufbau (fremde oder kaputte Einträge zählen nicht, gelöscht wird nichts). */
export function saneC1(c1: C1Doc): C1Doc {
  return {
    ...c1,
    checks: c1.checks.filter((c) => !!c && isDay(c.d) && nums(c.p, 4) && isNum(c.pts)),
    gates: c1.gates.filter((g) => !!g && isDay(g.d) && isNum(g.ch) && nums(g.g, 2) && nums(g.w, 2)),
    prod: c1.prod.filter((p) => !!p && isDay(p.d) && isNum(p.w) && isNum(p.e)),
    ...(c1.place && isDay(c1.place.d) && isNum(c1.place.n) ? {} : { place: undefined }),
  };
}

export function c1Way(i: WayInput): Way {
  const c1 = saneC1(readC1(i.c1));
  const chapters = chapterState({ docs: i.grammar, today: i.today, nowMs: i.nowMs });
  const entries = i.logs ? logEntriesOf(i.logs) : null;
  const k1 = k1Measure({ c1, chapters, grammar: i.grammar, entries, today: i.today });
  const k2 = k2Measure(i.patterns && typeof i.patterns === 'object' ? readPatterns(i.patterns as Record<string, unknown>) : null, i.today);
  const k3 = k3Measure(i.profile, i.nowMs, i.today);
  const k4 = k4Measure(i.cards, i.profile?.history, i.nowMs, i.today);
  const k6 = entries ? k6Measure(entries, i.itemOf, i.nowMs) : null;
  const crit = c1Criteria({ today: i.today, c1, k1, k2, k3, k4, k6 });
  const calc = forecastCalc({ today: i.today, crit, k1, k4, chapters });
  const view = forecastView(c1, i.today, crit.stage);
  const empty = crit.list.every((c) => c.state === 'few') && !c1.checks.length && !c1.gates.length && !c1.place;
  return { c1, chapters, k1, k2, k3, k4, k6, crit, calc, view, empty };
}

/**
 * Was jetzt eingefroren werden soll (K-d): nur wenn ALLES geladen ist (`loaded`: Protokolle, app/c1, app/profile, vocab, chunk, grammar),
 * nur im Check-Fenster für den Check dieses Monats ohne Wert. `null` = nichts tun. Rein.
 */
export function freezePlan(w: Way, today: string, loaded: boolean): { d: string; fc: FcValue } | null {
  if (!loaded) return null;
  const check = w.c1.checks[freezeIndex(w.c1, today)];
  const fc = fcOf(w.calc);
  return check && fc !== undefined ? { d: check.d, fc } : null;
}

/** Kriterien, die noch fehlen (nicht erreicht), in fester Reihenfolge. */
export const openCrit = (crit: CriteriaResult): CritId[] => crit.list.filter((c) => c.state !== 'met').map((c) => c.id);

// ------------------------------------------------------------------ Belegzeilen für assess@4

export type C1EvLine = { id: string; text: string };

const STATE_EN: Record<CritState, string> = { met: 'met', course: 'on track', open: 'open', few: 'too little data' };
const pct = (x: number | string | null | undefined): string => (typeof x === 'number' ? `${Math.round(x * 100)}%` : 'n/a');
const val = (x: number | string | null | undefined): string => (x === null || x === undefined ? 'n/a' : String(x));

function critText(c: Criterion): string {
  const e = c.ev;
  const s = `state: ${STATE_EN[c.state]}`;
  switch (c.id) {
    case 'k1':
      return `K1 grammar path (${s}): chapter gates passed ${val(e.gates)}/${val(e.gatesMax)}; patterns safe ${val(e.safe)}/${val(e.total)} (goal 80%); typed C1 tasks correct ${val(e.freeOk)}/${val(e.freeN)} in 28 days (goal 75%, at least 20); ${val(e.newSafe)} patterns newly safe in 8 weeks.`;
    case 'k2':
      return `K2 German interference traps (${s}): relapses in the last 4 weeks ${val(e.relapses)} (goal at most 2), the 4 weeks before ${val(e.prev)}; ${val(e.traps)} personal traps known.`;
    case 'k3':
      return e.passive === null
        ? `K3 passive vocabulary (${s}): no valid vocabulary test${e.old ? ' (last one is too old)' : ''}.`
        : `K3 passive vocabulary (${s}): estimate ${val(e.passive)} words (range ${val(e.lo)}–${val(e.hi)}); goal 4,000 with the lower bound at least 3,600.`;
    case 'k4':
      return `K4 active words and phrases (${s}): ${val(e.fest)} firmly learned (goal ${val(e.goal)})${e.delta !== null && e.delta !== undefined ? `, ${Number(e.delta) >= 0 ? '+' : ''}${val(e.delta)} in ${val(e.days)} days` : ''}; 28-day retention ${pct(e.ret)} over ${val(e.retN)} reviews (goal 88%).`;
    case 'k5':
      return e.pct === null
        ? `K5 exam formats (${s}): no C1 check on a laptop yet (phone checks do not count).`
        : `K5 exam formats (${s}): last laptop C1 check ${pct(e.pct)}, weakest part ${pct(e.minPart)}, ${val(e.checks)} laptop checks; goal at least 60% with every part at least 40%, in 2 checks in a row.`;
    case 'k6':
      return `K6 error correction (${s}): typed corrections right ${val(e.ok)}/${val(e.n)} (goal 80%, at least 20); clean sentences left as they were ${pct(e.clean)} (goal 75%)${Number(e.unmarked) > 0 ? `; ${val(e.unmarked)} answers from before timed answers were marked may include timed ones` : ''}.`;
    case 'k7':
      // Unter der Mindestmenge keine Rate: eine Zahl aus zwei Texten ist kein Beleg (P5).
      return c.state === 'few'
        ? `K7 accuracy in own writing (${s}): ${val(e.words)} of 600 words, ${val(e.entries)} of 6 texts, ${val(e.weeks)} of 3 weeks; no rate below the minimum.`
        : `K7 accuracy in own writing (${s}; counted by Claude, guide value only): ${val(e.rate)} errors per 100 words over ${val(e.words)} words, ${val(e.entries)} texts, ${val(e.weeks)} weeks (goal at most 3.0 at two checks in a row).`;
  }
}

/**
 * Englische Belegzeilen `[c1:k1]`…`[c1:k7]`, `[chk:<Monat>]` (höchstens 6), `[gate:<Kapitel>]` (letzter Versuch je Kapitel), `[place]`.
 * Keine Prozentzahl „x % C1“ und kein Gesamtwert: nur Messwerte mit Schwelle.
 */
export function c1EvidenceLines(w: Way): C1EvLine[] {
  const out: C1EvLine[] = w.crit.list.map((c) => ({ id: `c1:${c.id}`, text: critText(c) }));
  const byMonth = new Map<string, (typeof w.c1.checks)[number]>();
  for (const c of [...w.c1.checks].sort((a, b) => a.d.localeCompare(b.d))) byMonth.set(c.d.slice(0, 7), c);
  for (const [m, c] of [...byMonth].slice(-6)) {
    const parts = ['multiple-choice cloze', 'open cloze', 'word formation', 'key word transformation'].map((n, k) => `${n} ${c.p[k] ?? 0}/${CHECK_PART_MAX[k]}`).join(', ');
    out.push({ id: `chk:${m}`, text: `C1 check on ${c.d} (${c.inp === 'desk' ? 'laptop' : 'phone'}): ${c.pts}/36; ${parts}.` });
  }
  const gates = new Map<number, (typeof w.c1.gates)[number]>();
  for (const g of [...w.c1.gates].sort((a, b) => a.d.localeCompare(b.d))) gates.set(g.ch, g);
  for (const [ch, g] of [...gates].sort((a, b) => a[0] - b[0])) {
    out.push({ id: `gate:${ch}`, text: `Chapter ${ch} gate on ${g.d}: ${g.ok ? 'passed' : 'not passed'}; grammar ${g.g[0]}/${g.g[1]}, words ${g.w[0]}/${g.w[1]}.` });
  }
  const p = w.c1.place;
  if (p) out.push({ id: 'place', text: `Placement on ${p.d}: ${p.n} items${typeof p.th === 'number' && typeof p.se === 'number' ? `, ability ${p.th.toFixed(2)} (standard error ${p.se.toFixed(2)})` : ''}.` });
  return out;
}

export function c1EvidenceText(lines: readonly C1EvLine[]): string {
  return ['## C1 criteria (the app measures grammar, vocabulary and accuracy in writing; it does not measure speaking, listening or reading)', ...lines.map((l) => `[${l.id}] ${l.text}`)].join('\n');
}
