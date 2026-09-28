import { COMPARE_TASKS } from '../../content/compare';
import { addDays, daysBetween } from '../date';
import { wordCount } from '../input/textStats';
import { hasWords, normText, phraseCore } from '../week/text';
import { matchTraps } from '../week/traps';

// Monatliche Vergleichsaufgabe (Backlog B1, lehrer.md X1, Lücke 10): dieselbe Sprech- (45 s) und
// Schreibaufgabe wie beim letzten Mal, beide Fassungen nebeneinander, Claude beschreibt den
// Fortschritt in Worten (compare@1). Messwerte lokal, ohne KI: Wörter pro Minute (45-s-Durchgang),
// Fallen je 100 Wörter, frei benutzte Wendungen. Ein Dokument `app/compare` `{v, items}` mit
// höchstens 12 Läufen (ein Jahr), Texte ≤ 1.500 Zeichen (A6.6). Reine Logik.

export const COMPARE_PATH = 'app/compare';
export const COMPARE_MAX = 12;
export const COMPARE_TEXT_MAX = 1_500;
export const COMPARE_VERDICT_MAX = 1_200;
/** Sprechdurchgang in Sekunden (wie der 45-s-Durchgang in Flüssigkeit 90 – 60 – 45). */
export const SPEAK_SEC = 45;
/** Mindestabstand zur Vergleichsfassung („wie vor 4 Wochen“), damit zwei Läufe nie aus derselben Woche stammen. */
export const BASE_MIN_DAYS = 21;
/** Angebot in der letzten Monatswoche: die letzten 7 Tage des Monats. */
export const LAST_WEEK_DAYS = 7;

export type Metrics = { words: number; traps: number; per100: number; phrases: string[]; wpm?: number };
export type CompareSide = { text: string; m: Metrics; sec?: number };
export type CompareVerdict = { summary: string; better: string[]; next: string; level: string; lang: 'de' | 'en'; pv: string };
export type CompareRun = { month: string; day: string; t: number; task: string; speak: CompareSide; write: CompareSide; base?: string; verdict?: CompareVerdict };

type Doc = Readonly<Record<string, unknown>>;
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

export const monthOf = (day: string): string => day.slice(0, 7);

function clipText(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

/** Messwerte eines eigenen Texts. `sec` nur beim Sprechen (Wörter pro Minute). */
export function measure(text: string, phrases: readonly string[], sec?: number): Metrics {
  const words = wordCount(text);
  const traps = matchTraps(text).length;
  const normed = normText(text.normalize('NFKC').replace(/[’‘`´]/g, "'"));
  const used = [...new Set(phrases.filter((p) => {
    const core = phraseCore(p);
    return core.split(' ').length >= 2 && hasWords(normed, core);
  }))].slice(0, 20);
  const m: Metrics = { words, traps, per100: words ? Math.round((traps / words) * 1000) / 10 : 0, phrases: used };
  if (sec !== undefined) {
    const s = Math.min(SPEAK_SEC, Math.max(5, sec));
    m.wpm = Math.round((words / s) * 60);
  }
  return m;
}

function readMetrics(v: unknown): Metrics | null {
  if (!isObj(v)) return null;
  const words = num(v.words);
  const traps = num(v.traps);
  const per100 = num(v.per100);
  if (words === null || traps === null || per100 === null) return null;
  const wpm = num(v.wpm);
  return { words, traps, per100, phrases: strs(v.phrases), ...(wpm !== null ? { wpm } : {}) };
}

function readSide(v: unknown): CompareSide | null {
  if (!isObj(v) || typeof v.text !== 'string') return null;
  const m = readMetrics(v.m);
  if (!m) return null;
  const sec = num(v.sec);
  return { text: v.text, m, ...(sec !== null ? { sec } : {}) };
}

function readVerdict(v: unknown): CompareVerdict | undefined {
  if (!isObj(v) || typeof v.summary !== 'string' || (v.lang !== 'de' && v.lang !== 'en')) return undefined;
  return { summary: v.summary, better: strs(v.better), next: typeof v.next === 'string' ? v.next : '', level: typeof v.level === 'string' ? v.level : '', lang: v.lang, pv: typeof v.pv === 'string' ? v.pv : '' };
}

function readRun(v: unknown): CompareRun | null {
  if (!isObj(v) || typeof v.month !== 'string' || typeof v.day !== 'string' || typeof v.task !== 'string') return null;
  const t = num(v.t);
  const speak = readSide(v.speak);
  const write = readSide(v.write);
  if (t === null || !speak || !write) return null;
  const verdict = readVerdict(v.verdict);
  return { month: v.month, day: v.day, t, task: v.task, speak, write, ...(typeof v.base === 'string' ? { base: v.base } : {}), ...(verdict ? { verdict } : {}) };
}

/** Lesbare Läufe, älteste zuerst. */
export function readCompare(doc: Doc | null | undefined): CompareRun[] {
  const items = doc?.items;
  if (!Array.isArray(items)) return [];
  return items
    .map(readRun)
    .filter((x): x is CompareRun => x !== null)
    .sort((a, b) => a.day.localeCompare(b.day));
}

/** Kap. 9, Regel 6: nur schreiben, wenn `items` fehlt oder vollständig lesbar ist. */
export function compareWritable(doc: Doc | null | undefined): boolean {
  if (!doc || doc.items == null) return true;
  if (!Array.isArray(doc.items)) return false;
  return readCompare(doc).length === doc.items.length;
}

/** Liegt `day` in der letzten Woche seines Monats? */
export function inLastWeek(day: string): boolean {
  return monthOf(addDays(day, LAST_WEEK_DAYS)) !== monthOf(day);
}

export type CompareOffer = { due: boolean; done: CompareRun | null; base: CompareRun | null; task: string };

/**
 * Einplanung (P1-Regel „letzte Woche im Monat“): fällig, wenn `day` in der letzten Monatswoche liegt
 * und in diesem Monat noch kein Lauf gespeichert ist. Vergleichsfassung ist der jüngste frühere Lauf
 * mit mindestens BASE_MIN_DAYS Abstand; seine Aufgabe wird wiederholt. Ohne früheren Lauf ist der
 * erste Lauf die Ausgangsfassung (erste Aufgabe).
 */
export function compareOffer(day: string, runs: readonly CompareRun[]): CompareOffer {
  const month = monthOf(day);
  const done = runs.find((r) => r.month === month) ?? null;
  const earlier = runs.filter((r) => r.month < month && daysBetween(r.day, day) >= BASE_MIN_DAYS);
  const base = earlier[earlier.length - 1] ?? null;
  const task = base?.task ?? COMPARE_TASKS[0]?.id ?? 'ct1';
  return { due: inLastWeek(day) && !done, done, base, task };
}

/** Einen Lauf eintragen: derselbe Monat wird ersetzt, höchstens COMPARE_MAX (älteste fallen heraus). */
export function addRun(runs: readonly CompareRun[], run: CompareRun): CompareRun[] {
  const clean: CompareRun = {
    ...run,
    speak: { ...run.speak, text: clipText(run.speak.text, COMPARE_TEXT_MAX) },
    write: { ...run.write, text: clipText(run.write.text, COMPARE_TEXT_MAX) },
  };
  const next = [...runs.filter((r) => r.month !== run.month), clean].sort((a, b) => a.day.localeCompare(b.day));
  return next.length > COMPARE_MAX ? next.slice(next.length - COMPARE_MAX) : next;
}

/** Claudes Urteil an einen Lauf hängen (gekürzt). `null` = Lauf fehlt. */
export function withVerdict(runs: readonly CompareRun[], month: string, v: CompareVerdict): CompareRun[] | null {
  if (!runs.some((r) => r.month === month)) return null;
  const verdict: CompareVerdict = {
    ...v,
    summary: clipText(v.summary, COMPARE_VERDICT_MAX),
    better: v.better.slice(0, 3).map((b) => clipText(b, 240)),
    next: clipText(v.next, 300),
    level: clipText(v.level, 300),
  };
  return runs.map((r) => (r.month === month ? { ...r, verdict } : r));
}
