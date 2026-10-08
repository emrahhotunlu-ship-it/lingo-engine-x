import { TOPICS } from '../content';
import { addDays, isoWeek } from '../date';
import { patternById } from '../grammar/patterns';

// Wochenbericht „was du diese Woche wirklich dazugelernt hast" (Kap. 6.13, Plan §7.3): Fakten
// deterministisch, jeder mit Kennung, damit ein KI-Text (weekly-report@1) sie nur zitieren kann.
// Die Woche folgt dem Lerntag (Wechsel um 04:00) und der ISO-Woche (Mo–So).

type Doc = Readonly<Record<string, unknown>>;
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});
const arr = (v: unknown): Doc[] => (Array.isArray(v) ? v.map(obj) : []);
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Montag der ISO-Woche eines Lerntags. */
export function weekStart(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  return addDays(day, -((d.getUTCDay() + 6) % 7));
}

/** Die sieben Lerntage der Woche und ihre Kennung `JJJJ-Www`. */
export function weekDays(day: string): { w: string; days: string[] } {
  const mo = weekStart(day);
  return { w: isoWeek(mo), days: Array.from({ length: 7 }, (_, k) => addDays(mo, k)) };
}

/** Die zuletzt abgeschlossene ISO-Woche vor dem Lerntag `today`. */
export const lastWeekOf = (today: string) => weekDays(addDays(weekStart(today), -1));

export type WeekFact =
  /** Wort oder Wendung, die in der Woche zum ersten Mal Fest ist (`ff`, Lernplattform 3.0 P50). */
  | { id: string; kind: 'word'; word: string }
  /** Muster, das in der Woche zum ersten Mal Sicher ist (`grammar/<thema>.pats[muster].s`, P50). */
  | { id: string; kind: 'pattern'; pat: string }
  | { id: string; kind: 'topic'; topic: string; from: number; to: number }
  | { id: string; kind: 'fixed'; topic: string; n: number }
  | { id: string; kind: 'text'; title: string; titles: { de: string; en: string } | null; lesson: string | null }
  | { id: string; kind: 'talk'; title: string }
  /** `pflichtDays` ist `null`, solange die Woche keinen Tag ab `pflichtSince` enthält (alte Serienregel). */
  | { id: string; kind: 'time'; minutes: number; activeDays: number; pflichtDays: number | null };

export const topicName = (id: string, lang: 'de' | 'en'): string => {
  const t = TOPICS.find((x) => x.id === id);
  return t ? (lang === 'en' ? (t.name_en ?? t.name) : t.name) : id;
};

/** Höchstens so viele Wörter als einzelne Fakten (der Bericht fasst sie in einer Zeile zusammen). */
const WORDS_MAX = 12;

/**
 * Wörter und Wendungen, die in den Tagen `days` zum ersten Mal Fest sind (Feld `ff`, nie gelöscht, auch wenn die Karte später zurückfällt).
 * Ausgeblendete Karten zählen nicht. Reihenfolge: erster Fest-Tag, dann Wort. Alle, ungekürzt.
 */
export function newFestWords(i: { days: readonly string[]; vocab: ReadonlyMap<string, Doc>; chunk?: ReadonlyMap<string, Doc> }): Array<Extract<WeekFact, { kind: 'word' }> & { ff: string; unit: 'vocab' | 'chunk' }> {
  const set = new Set(i.days);
  const out: Array<Extract<WeekFact, { kind: 'word' }> & { ff: string; unit: 'vocab' | 'chunk' }> = [];
  for (const [id, d] of i.vocab) {
    const ff = str(d.ff);
    if (set.has(ff) && d.hidden !== true) out.push({ id: `vw:${id}`, kind: 'word', word: str(d.word) || id, ff, unit: 'vocab' });
  }
  for (const [id, d] of i.chunk ?? []) {
    const ff = str(d.ff);
    if (set.has(ff) && d.hidden !== true) out.push({ id: `cw:${id}`, kind: 'word', word: str(d.en) || id, ff, unit: 'chunk' });
  }
  return out.sort((a, b) => (a.ff < b.ff ? -1 : a.ff > b.ff ? 1 : a.word.localeCompare(b.word)));
}

/** Muster, deren erster „Sicher“-Tag (`pats[muster].s`) in `days` liegt; nur Muster, die es in den Inhalten gibt. Sortiert nach Kennung. */
export function patternsNewSafe(grammar: ReadonlyMap<string, Doc>, days: readonly string[]): string[] {
  const set = new Set(days);
  const out = new Set<string>();
  for (const d of grammar.values()) {
    for (const [pat, e] of Object.entries(obj(d.pats))) {
      if (set.has(str(obj(e).s)) && patternById(pat)) out.add(pat);
    }
  }
  return [...out].sort();
}

export function weekFacts(i: {
  days: readonly string[];
  vocab: ReadonlyMap<string, Doc>;
  grammar: ReadonlyMap<string, Doc>;
  /** Wendungen (`chunk/*`), damit auch sie als „neu Fest“ erscheinen (P50). */
  chunk?: ReadonlyMap<string, Doc>;
  writing: ReadonlyMap<string, Doc>;
  talk: ReadonlyMap<string, Doc>;
  profile: Doc;
  /** `wprompt/<tag>`: Titel der Schreibaufgaben in beiden Sprachen (Sprachtreue, Befund H2). */
  prompts?: ReadonlyMap<string, Doc>;
  /** `app/schema.pflichtSince`: erst ab diesem Tag wird die Pflicht gezählt (Befund W4). */
  pflichtSince?: string | null;
}): WeekFact[] {
  const set = new Set(i.days);
  const first = i.days[0] ?? '';
  const last = i.days[i.days.length - 1] ?? '';
  const facts: WeekFact[] = [];

  // Neu Fest in dieser Woche (`ff` = erster Fest-Tag, P22): nicht mehr „Stabilität ≥ 3 Tage“ (Befund I10, passte nicht zu Neu · Lernt · Sicher · Fest).
  facts.push(...newFestWords({ days: i.days, vocab: i.vocab, ...(i.chunk ? { chunk: i.chunk } : {}) }).slice(0, WORDS_MAX));

  // Muster, die in der Woche neu Sicher wurden (`pats[*].s`).
  for (const pat of patternsNewSafe(i.grammar, i.days)) facts.push({ id: `gp:${pat}`, kind: 'pattern', pat });

  // Grammatik: Anstieg von p über die Woche (hist [{d,p}]).
  for (const [id, d] of i.grammar) {
    const hist = arr(d.hist).filter((h) => str(h.d));
    const before = hist.filter((h) => str(h.d) < first).pop();
    const during = hist.filter((h) => str(h.d) >= first && str(h.d) <= last).pop();
    if (!during) continue;
    // Anstieg nur gegen einen echten Vorwert vor der Woche (p0 ist kein Vorwert, Befund H1).
    const from = before ? num(before.p) : null;
    const to = num(during.p);
    if (from !== null && to - from >= 0.03) facts.push({ id: `gt:${id}`, kind: 'topic', topic: id, from: Math.round(from * 100) / 100, to: Math.round(to * 100) / 100 });
    const fixed = arr(d.errors).filter((e) => (e.done === true || num(e.box) >= 3) && set.has(dayOf(num(e.last)))).length;
    if (fixed) facts.push({ id: `ge:${id}`, kind: 'fixed', topic: id, n: fixed });
  }

  // Seit dem Umbau „Fokus Wörter und Grammatik“ (04.10.2026) gibt es im Wochenbericht keine Texte und
  // Gespräche mehr; die Daten dazu bleiben in der Datenbank.

  // Zeit und Pflicht.
  const minutes = obj(i.profile.minutes);
  const days = obj(i.profile.days);
  const pflicht = obj(i.profile.pflicht);
  let m = 0;
  let active = 0;
  let pf = 0;
  const since = i.pflichtSince ?? null;
  const counted = since ? i.days.filter((k) => k >= since).length : 0;
  for (const k of i.days) {
    m += num(minutes[k]);
    if (num(days[k]) > 0 || num(minutes[k]) > 0) active++;
    if (since && k >= since && pflicht[k] !== undefined && pflicht[k] !== null && pflicht[k] !== false && pflicht[k] !== 0) pf++;
  }
  if (active > 0) facts.push({ id: 'tm:week', kind: 'time', minutes: Math.round(m), activeDays: active, pflichtDays: counted > 0 ? pf : null });
  return facts;
}

/** Lerntag einer Uhrzeit (UTC-unabhängig genug für Wochenfakten: lokale Zeit, Wechsel 04:00). */
function dayOf(t: number): string {
  if (!t) return '';
  const d = new Date(t - 4 * 3_600_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Fakten, die ein KI-Text zitieren darf (ohne Zeitzeile – die bleibt Zahl). */
export const citableFacts = (facts: readonly WeekFact[]): WeekFact[] => facts.filter((f) => f.kind !== 'time');
