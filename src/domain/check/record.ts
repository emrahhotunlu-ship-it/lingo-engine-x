import { isDayKey, isoWeek } from '../date';

// Wochen-Check (Funktionsabgleich M10): Ergebnisse stehen wie in der alten App in
// `app/profile.checks[]` (höchstens 20, älteste fallen heraus – Regel der alten App, `saveCheck`):
//   {d, t, n, ok, vocab: [ok, n], colloc: [ok, n], gram: [ok, n], topics: [themen], words: [kartenIds], lvl?}
// Gelesen wird tolerant (unbekannte Felder bleiben unberührt, kaputte Einträge werden übersprungen),
// geschrieben wird nur durch Anhängen. `profile.feed[]` (letzte Fortschritte) schreibt nur die alte
// App; die neue liest es nur.

type Doc = Readonly<Record<string, unknown>>;
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Höchstzahl gespeicherter Checks (wie in der alten App). */
export const CHECKS_MAX = 20;
/** Aufgaben je Check: 5 Wörter, 2 Wendungen, 5 Grammatik (wie in der alten App). */
export const CHECK_PLAN = { vocab: 5, colloc: 2, gram: 5 } as const;
export const CHECK_SIZE = CHECK_PLAN.vocab + CHECK_PLAN.colloc + CHECK_PLAN.gram;
/** Ab so vielen Antworten wird ein abgebrochener Check gespeichert (wie in der alten App). */
export const CHECK_MIN_SAVE = 6;

export type Pair = { ok: number; n: number };
export type CheckRecord = {
  d: string;
  t: number;
  n: number;
  ok: number;
  vocab: Pair;
  colloc: Pair;
  gram: Pair;
  topics: string[];
  words: string[];
};

const pair = (v: unknown): Pair => {
  if (!Array.isArray(v)) return { ok: 0, n: 0 };
  const ok = num(v[0]) ?? 0;
  const n = num(v[1]) ?? 0;
  return n > 0 && ok >= 0 && ok <= n ? { ok, n } : { ok: 0, n: 0 };
};
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);

/** Alle lesbaren Checks, älteste zuerst. */
export function readChecks(profile: unknown): CheckRecord[] {
  const list = obj(profile).checks;
  if (!Array.isArray(list)) return [];
  const out: CheckRecord[] = [];
  for (const raw of list) {
    const c = obj(raw);
    const t = num(c.t);
    const n = num(c.n);
    const ok = num(c.ok);
    if (t === null || n === null || ok === null || n <= 0 || ok < 0 || ok > n) continue;
    const d = isDayKey(c.d) ? c.d : '';
    out.push({ d, t, n, ok, vocab: pair(c.vocab), colloc: pair(c.colloc), gram: pair(c.gram), topics: strs(c.topics), words: strs(c.words) });
  }
  return out.sort((a, b) => a.t - b.t);
}

export const checkPct = (c: Pick<CheckRecord, 'ok' | 'n'>): number => (c.n > 0 ? Math.round((c.ok / c.n) * 100) : 0);

/** Kalenderwoche (Mo–So) eines Checks: aus `d`, sonst aus dem Zeitstempel. */
function weekOf(c: CheckRecord, dayOfMs: (ms: number) => string): string {
  return isoWeek(c.d || dayOfMs(c.t));
}

/** Gibt es in der Kalenderwoche von `today` schon einen Check? (Angebot höchstens einmal je Woche.) */
export function checkDoneThisWeek(checks: readonly CheckRecord[], today: string, dayOfMs: (ms: number) => string): boolean {
  const w = isoWeek(today);
  return checks.some((c) => weekOf(c, dayOfMs) === w);
}

export type ResultItem =
  | { kind: 'v'; id: string; colloc: boolean; ok: boolean }
  | { kind: 'g'; topic: string; ok: boolean };

/** Ergebnis im Format der alten App (`saveCheck`). */
export function checkRecord(results: readonly ResultItem[], day: string, t: number): CheckRecord {
  const area = (f: (r: ResultItem) => boolean): Pair => {
    const rs = results.filter(f);
    return { ok: rs.filter((r) => r.ok).length, n: rs.length };
  };
  const unique = <T,>(xs: T[]): T[] => [...new Set(xs)];
  return {
    d: day,
    t,
    n: results.length,
    ok: results.filter((r) => r.ok).length,
    vocab: area((r) => r.kind === 'v' && !r.colloc),
    colloc: area((r) => r.kind === 'v' && r.colloc),
    gram: area((r) => r.kind === 'g'),
    topics: unique(results.flatMap((r) => (r.kind === 'g' && !r.ok ? [r.topic] : []))).slice(0, 4),
    words: unique(results.flatMap((r) => (r.kind === 'v' && !r.ok ? [r.id] : []))).slice(0, 6),
  };
}

/** Speicherform der alten App: Paare als `[ok, n]`. */
export function toStored(c: CheckRecord): Record<string, unknown> {
  return { d: c.d, t: c.t, n: c.n, ok: c.ok, vocab: [c.vocab.ok, c.vocab.n], colloc: [c.colloc.ok, c.colloc.n], gram: [c.gram.ok, c.gram.n], topics: c.topics, words: c.words };
}

export type AppendResult = { patch: { checks: unknown[] } } | { skip: 'invalid' | 'duplicate' | 'week' };

/**
 * Neuen Check an den FRISCHEN Stand anhängen (im `transform`). Bestehende Einträge bleiben
 * unverändert (auch unbekannte Felder), nur über 20 hinaus fällt der älteste heraus (alte Regel).
 * Kein zweiter Check in derselben Kalenderwoche (z. B. aus einem zweiten Tab).
 */
export function appendCheck(cur: unknown, rec: CheckRecord, dayOfMs: (ms: number) => string): AppendResult {
  const raw = obj(cur).checks;
  if (raw !== undefined && raw !== null && !Array.isArray(raw)) return { skip: 'invalid' };
  const list: unknown[] = Array.isArray(raw) ? [...(raw as unknown[])] : [];
  const known = readChecks({ checks: list });
  if (known.some((c) => c.t === rec.t)) return { skip: 'duplicate' };
  if (checkDoneThisWeek(known, rec.d, dayOfMs)) return { skip: 'week' };
  list.push(toStored(rec));
  return { patch: { checks: list.slice(-CHECKS_MAX) } };
}

/** Vergleich mit dem vorigen Check: Unterschied in Prozentpunkten (`null` beim ersten Check). */
export function compareLast(checks: readonly CheckRecord[]): { pct: number; prevPct: number | null; prevT: number | null; delta: number | null } | null {
  const last = checks[checks.length - 1];
  if (!last) return null;
  const prev = checks[checks.length - 2];
  const pct = checkPct(last);
  if (!prev) return { pct, prevPct: null, prevT: null, delta: null };
  const prevPct = checkPct(prev);
  return { pct, prevPct, prevT: prev.t, delta: pct - prevPct };
}

// ------------------------------------------------------------------ feed[] (nur lesen)

export type FeedEntry = { t: number; act: string; vocab: number; grammar: number };

/** Letzte Fortschritte der alten App (`profile.feed[]`), neueste zuerst. XP und Punktestände bleiben weg (Kap. 2.3). */
export function readFeed(profile: unknown, limit = 8): FeedEntry[] {
  const list = obj(profile).feed;
  if (!Array.isArray(list)) return [];
  const out: FeedEntry[] = [];
  for (const raw of list) {
    const e = obj(raw);
    const t = num(e.t);
    const act = str(e.act);
    if (t === null || !act) continue;
    const d = obj(e.d);
    const vp = num(d.vp) ?? 0;
    const gr = num(d.gr) ?? 0;
    out.push({ t, act, vocab: Math.round(vp), grammar: Math.abs(gr) >= 0.5 ? Math.round(gr) : 0 });
  }
  return out.sort((a, b) => b.t - a.t).slice(0, limit);
}
