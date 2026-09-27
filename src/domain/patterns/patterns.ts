import { addDays, dayKey, isoWeek } from '../date';
import { repairNorm } from '../repair/repair';
import type { Mistake } from './mistakes';

// Persönliche „Deutsch-Fallen“ (Lernberatung 27.09., V3): das Dokument `app/patterns`
// `{d, t, lang, pv, items, history}` lesen, kappen, lokal zählen (ohne KI) und daraus Verlauf,
// Top-Muster und den Wochenfokus (V8/Nr. 9) ableiten. Rein und getestet.

type Doc = Readonly<Record<string, unknown>>;

export const PATTERNS_MAX = 8;
export const EXAMPLES_MAX = 4;
export const KEYS_MAX = 6;
export const TASKS_MAX = 3;
export const HISTORY_MAX = 26;
export const FOCUS_MAX = 3;
const TEXT_MAX = 240;

export type PatternExample = { wrong: string; right: string };
export type Pattern = {
  id: string;
  title_de: string;
  title_en: string;
  /** Regel in der Sprache `PatternsDoc.lang`. */
  rule: string;
  examples: PatternExample[];
  /** Anzahl laut Claude beim Erkennen (Anzeige nur, wenn lokal nichts gezählt wurde). */
  count: number;
  /** Stichwörter für die lokale Zuordnung (klein, Englisch). */
  keys: string[];
  /** 2–3 Aufgaben für freie Sätze (Englisch). */
  tasks: string[];
};
export type WeekCounts = { w: string; counts: Record<string, number> };
export type PatternsDoc = { d: string; t: number; lang: string; pv: string; items: Pattern[]; history: WeekCounts[] };

const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const clip = (v: unknown, max = TEXT_MAX): string => {
  const s = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
};
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const WEEK_RE = /^\d{4}-W\d{2}$/;

/** Kennung eines Musters: klein, a–z, 0–9 und Bindestrich, höchstens 40 Zeichen. */
export function patternSlug(v: unknown): string {
  return (typeof v === 'string' ? v : '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
}

function readPattern(raw: unknown): Pattern | null {
  const e = obj(raw);
  const id = patternSlug(e.id);
  const title_de = clip(e.title_de, 80);
  const title_en = clip(e.title_en, 80);
  if (!id || (!title_de && !title_en)) return null;
  const examples = arr(e.examples)
    .map((x) => ({ wrong: clip(obj(x).wrong), right: clip(obj(x).right) }))
    .filter((x) => x.wrong && x.right)
    .slice(0, EXAMPLES_MAX);
  return {
    id,
    title_de: title_de || title_en,
    title_en: title_en || title_de,
    rule: clip(e.rule),
    examples,
    count: Math.max(0, Math.round(num(e.count))),
    keys: [...new Set(arr(e.keys).map((k) => clip(k, 30).toLowerCase()).filter(Boolean))].slice(0, KEYS_MAX),
    tasks: arr(e.tasks)
      .map((x) => clip(x, 200))
      .filter(Boolean)
      .slice(0, TASKS_MAX),
  };
}

function readHistory(v: unknown): WeekCounts[] {
  const out: WeekCounts[] = [];
  for (const raw of arr(v)) {
    const h = obj(raw);
    const w = typeof h.w === 'string' ? h.w : '';
    if (!WEEK_RE.test(w) || out.some((x) => x.w === w)) continue;
    const counts: Record<string, number> = {};
    for (const [k, n] of Object.entries(obj(h.counts))) if (typeof n === 'number' && Number.isFinite(n) && n >= 0) counts[k] = Math.round(n);
    out.push({ w, counts });
  }
  return out.sort((a, b) => (a.w < b.w ? -1 : 1)).slice(-HISTORY_MAX);
}

/** `app/patterns` tolerant lesen; fehlt es oder hat es keine Muster, `null`. */
export function readPatterns(doc: Doc | null | undefined): PatternsDoc | null {
  if (!doc) return null;
  const seen = new Set<string>();
  const items: Pattern[] = [];
  for (const raw of arr(doc.items)) {
    const p = readPattern(raw);
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    items.push(p);
    if (items.length >= PATTERNS_MAX) break;
  }
  return {
    d: typeof doc.d === 'string' ? doc.d : '',
    t: num(doc.t),
    lang: typeof doc.lang === 'string' ? doc.lang : '',
    pv: typeof doc.pv === 'string' ? doc.pv : '',
    items,
    history: readHistory(doc.history),
  };
}

/** Kappen vor dem Schreiben (A6.6): höchstens 8 Muster, je 4 Beispiele, 26 Wochen Verlauf. */
export function capPatterns(items: readonly Pattern[]): Pattern[] {
  const seen = new Set<string>();
  const out: Pattern[] = [];
  for (const p of items) {
    const c = readPattern(p);
    if (!c || seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
    if (out.length >= PATTERNS_MAX) break;
  }
  return out;
}

// ------------------------------------------------------------------ lokale Zuordnung (ohne KI)

const hasWords = (hay: string, needle: string): boolean => {
  const n = repairNorm(needle);
  return !!n && ` ${hay} `.includes(` ${n} `);
};

/**
 * Welches Muster passt zu einem Fehler? Zuerst die eigenen Beispielsätze (gleicher Satz oder
 * enthalten), dann die Stichwörter im falschen Satz. Jeder Fehler zählt für höchstens EIN Muster.
 */
export function matchPattern(m: Pick<Mistake, 'wrong'>, items: readonly Pattern[]): string | null {
  const w = repairNorm(m.wrong);
  if (!w) return null;
  for (const p of items) {
    for (const ex of p.examples) {
      const e = repairNorm(ex.wrong);
      if (e && (e === w || (e.length >= 12 && w.includes(e)) || (w.length >= 12 && e.includes(w)))) return p.id;
    }
  }
  for (const p of items) if (p.keys.some((k) => hasWords(w, k))) return p.id;
  return null;
}

/** ISO-Woche eines Zeitpunkts nach dem Lerntag (Wechsel um 04:00). */
export const weekOfMs = (ms: number): string => isoWeek(dayKey(ms));

/** Zählung je Woche und Muster (nur Wochen aus `weeks`). */
export function countWeeks(mistakes: readonly Mistake[], items: readonly Pattern[], weeks: readonly string[]): WeekCounts[] {
  const want = new Set(weeks);
  const by = new Map<string, Record<string, number>>(weeks.map((w) => [w, {}]));
  for (const m of mistakes) {
    if (m.t <= 0) continue;
    const w = weekOfMs(m.t);
    if (!want.has(w)) continue;
    const id = matchPattern(m, items);
    if (!id) continue;
    const c = by.get(w) as Record<string, number>;
    c[id] = (c[id] ?? 0) + 1;
  }
  return weeks.map((w) => ({ w, counts: by.get(w) ?? {} }));
}

/** Diese und die letzten `n - 1` Wochen (älteste zuerst) zum Lerntag `today`. */
export function recentWeeks(today: string, n = 4): string[] {
  return Array.from({ length: n }, (_, k) => isoWeek(addDays(today, -7 * (n - 1 - k))));
}

/**
 * Frisch gezählte Wochen mit dem gespeicherten Verlauf zusammenführen, gekappt. Je Woche und Muster
 * gilt das Maximum: Quellen werden gekappt (z. B. höchstens 10 Grammatik-Fehler je Thema), ein
 * einmal gezählter Fehler verschwindet deshalb nicht aus dem Verlauf.
 */
export function mergeHistory(stored: readonly WeekCounts[], fresh: readonly WeekCounts[]): WeekCounts[] {
  const map = new Map<string, Record<string, number>>(stored.map((h) => [h.w, { ...h.counts }]));
  for (const f of fresh) {
    const cur = map.get(f.w) ?? {};
    for (const [id, n] of Object.entries(f.counts)) cur[id] = Math.max(cur[id] ?? 0, n);
    map.set(f.w, cur);
  }
  return [...map]
    .map(([w, counts]) => ({ w, counts }))
    .sort((a, b) => (a.w < b.w ? -1 : 1))
    .slice(-HISTORY_MAX);
}

/** Anzahl eines Musters in einer Woche (0, wenn die Woche fehlt). */
export function countIn(history: readonly WeekCounts[], w: string, id: string): number {
  return history.find((h) => h.w === w)?.counts[id] ?? 0;
}

export type Trend = 'fewer' | 'same' | 'more';
export type PatternTrend = { id: string; prev: number; cur: number; trend: Trend };

/** Verlauf eines Musters zwischen zwei Wochen („letzte Woche 3× → diese Woche 1×“). */
export function trendOf(history: readonly WeekCounts[], id: string, prevW: string, curW: string): PatternTrend {
  const prev = countIn(history, prevW, id);
  const cur = countIn(history, curW, id);
  return { id, prev, cur, trend: cur < prev ? 'fewer' : cur > prev ? 'more' : 'same' };
}

/** Gewicht eines Musters: Vorkommen der letzten zwei Wochen, sonst Claudes Zählung (schwach). */
function weight(p: Pattern, history: readonly WeekCounts[], today: string): number {
  const cur = isoWeek(today);
  const prev = isoWeek(addDays(today, -7));
  const recent = countIn(history, cur, p.id) + countIn(history, prev, p.id);
  return recent * 10 + Math.min(9, p.count);
}

/** Die wichtigsten Muster (stabile Reihenfolge bei Gleichstand: wie von Claude geliefert). */
export function topPatterns(doc: PatternsDoc | null, today: string, n = 3): Pattern[] {
  if (!doc) return [];
  return doc.items
    .map((p, i) => ({ p, i, w: weight(p, doc.history, today) }))
    .sort((a, b) => b.w - a.w || a.i - b.i)
    .slice(0, n)
    .map((x) => x.p);
}

/** Englische Hinweise für die Prompts von Rollenspiel-Analyse und „Sag es“ (Top 3). */
export function patternHintsOf(doc: PatternsDoc | null, today: string): string[] {
  return topPatterns(doc, today, 3).map((p) => p.title_en);
}

// ------------------------------------------------------------------ Wochenfokus (V8/Nr. 9)

export type FocusPoint = { id: string; de: string; en: string; patternId: string | null };
export type ImportLike = { corrections: ReadonlyArray<{ wrong: string; right: string; topic?: string }> } | null;

/**
 * Wochenfokus mit höchstens 3 Punkten aus den Top-Mustern und dem letzten Preply-Import:
 * Muster, die auch im letzten Import vorkamen, zuerst; dann nach Häufigkeit. Fehlen Muster,
 * füllen Themen der Import-Korrekturen auf (`topicName` liefert beide Sprachen).
 */
export function weekFocus(doc: PatternsDoc | null, imp: ImportLike, today: string, topicName: (id: string) => { de: string; en: string } | null): FocusPoint[] {
  const items = doc?.items ?? [];
  const inImport = new Map<string, number>();
  for (const c of imp?.corrections ?? []) {
    const id = matchPattern(c, items);
    if (id) inImport.set(id, (inImport.get(id) ?? 0) + 1);
  }
  const ranked = items
    .map((p, i) => ({ p, i, w: (inImport.get(p.id) ?? 0) * 100 + (doc ? weight(p, doc.history, today) : 0) }))
    .sort((a, b) => b.w - a.w || a.i - b.i)
    .map((x) => x.p);
  const out: FocusPoint[] = ranked.slice(0, FOCUS_MAX).map((p) => ({ id: p.id, de: p.title_de, en: p.title_en, patternId: p.id }));
  for (const c of imp?.corrections ?? []) {
    if (out.length >= FOCUS_MAX) break;
    if (matchPattern(c, items)) continue;
    const name = c.topic ? topicName(c.topic) : null;
    if (!name || out.some((o) => o.id === `topic:${c.topic}`)) continue;
    out.push({ id: `topic:${c.topic}`, de: name.de, en: name.en, patternId: null });
  }
  return out;
}

/** Zeile für die Nachricht an den Lehrer (immer Englisch). */
export function focusLine(points: readonly FocusPoint[]): string {
  return points.length ? `Please pay attention to: ${points.map((p) => p.en).join('; ')}.` : '';
}

/** Die Zeile an die Nachricht anhängen – nie doppelt. */
export function withFocusLine(message: string, points: readonly FocusPoint[]): string {
  const line = focusLine(points);
  if (!line || message.includes('Please pay attention to:')) return message;
  return message.trim() ? `${message.trim()}\n\n${line}` : line;
}

/** Soll „Dein Stand“ die Muster neu erkennen lassen? Höchstens einmal je ISO-Woche. */
export function patternsDue(doc: PatternsDoc | null, today: string): boolean {
  if (!doc || !doc.items.length) return false;
  return !doc.d || isoWeek(doc.d) !== isoWeek(today);
}
