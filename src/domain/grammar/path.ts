import { TOPICS } from '../content';
import { daysBetween } from '../date';
import type { GrammarTask, GrammarTaskType } from '../learn/types';
import { certainty, topicP } from './bkt';
import { errorsOf } from './errors';

// Grammatik-Pfad (Gesamtkonzept Kap. 3.4, `docs/umbau/02-lehrplan.md` Kap. 4): die Themen in
// Lehrreihenfolge B2 → C1, der Zustand je Thema, die Einführungsbremse und der Lernweg ①–⑤.
// Rein: Zeit und Daten kommen als Parameter. Nichts wird gespeichert; alles lässt sich aus
// `grammar/<thema>` ableiten (`n`, `p`, `hist`, `errors`).

type Doc = Record<string, unknown>;

/**
 * Lehrreihenfolge (Lehrplan Kap. 4, Zeilen 1–39 ohne `ellipsis`, das es noch nicht gibt). `pres-simple-cont`
 * (B1) steht vorn als Einstieg, damit jedes Thema der App im Pfad erreichbar ist; die sieben C1-Werkzeuge
 * sind alle vier bis fünf Themen eingeschoben.
 */
export const GRAMMAR_PATH: readonly string[] = [
  'pres-simple-cont',
  'past-simple-perfect',
  'pres-perf-cont',
  'future-forms',
  'time-clauses',
  'c1-hedging',
  'future-perf-cont',
  'past-perfect',
  'used-to',
  'c1-diplomacy',
  'conditionals',
  'cond-alt',
  'mixed-cond',
  'passive',
  'c1-discourse',
  'passive-plus',
  'reported',
  'report-verbs',
  'questions',
  'c1-emphasis',
  'relative',
  'modals-deduction',
  'modals-advice',
  'gerund-inf',
  'verb-patterns',
  'c1-participle',
  'mandative',
  'articles',
  'countable',
  'prepositions',
  'prep-noun',
  'c1-nominal',
  'prep-time',
  'compound-mod',
  'phrasal-syntax',
  'word-order',
  'c1-precision',
  'linkers',
  'comparison',
];

/** Pfad nur mit Themen, die es gibt (Schutz, falls ein Thema aus den Inhalten verschwindet), Rest hinten angehängt. */
export function pathTopics(): string[] {
  const known = new Set(TOPICS.map((t) => t.id));
  const inPath = GRAMMAR_PATH.filter((id) => known.has(id));
  const rest = TOPICS.map((t) => t.id).filter((id) => !inPath.includes(id));
  return [...inPath, ...rest];
}

export type TopicState = 'new' | 'learning' | 'safe' | 'firm';

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** Noch nie geübt: kein Dokument oder keine Antwort. */
export const isNewTopic = (doc: Readonly<Doc> | undefined): boolean => num(doc?.n) === 0;

/**
 * Zustand eines Themas aus p mit Verfall (dieselbe Sicherheitsskala wie in der Statuszeile):
 * Neu (keine Antwort) · Lernt (Stufen 1–3) · Sicher (4) · Fest (5, gefestigt).
 */
export function topicState(topic: string, doc: Readonly<Doc> | undefined, nowMs: number): TopicState {
  if (isNewTopic(doc)) return 'new';
  const p = topicP(topic, doc, nowMs);
  const word = certainty(p, { n: num(doc?.n), recent: Array.isArray(doc?.recent) ? (doc.recent as number[]) : null }).word;
  return word >= 5 ? 'firm' : word >= 4 ? 'safe' : 'learning';
}

/** Lerntag, an dem das Thema zum ersten Mal geübt wurde (Anfang von `hist`), sonst `null`. */
export function introDay(doc: Readonly<Doc> | undefined): string | null {
  const h = Array.isArray(doc?.hist) ? (doc.hist as unknown[]) : [];
  const first = h[0];
  const d = first && typeof first === 'object' ? (first as Doc).d : null;
  return typeof d === 'string' ? d : null;
}

/** Wie viele Lerntage mindestens zwischen zwei neuen Themen liegen (Gesamtkonzept: 1 je 3 Lerntage). */
export const INTRO_EVERY_DAYS = 3;
/** Ab so vielen offenen Fehlersätzen kommt kein neues Thema dazu. */
export const INTRO_BLOCK_ERRORS = 10;

/** Offene (noch nicht erledigte) Fehlersätze über alle Themen. */
export function openErrorCount(docs: ReadonlyMap<string, Readonly<Doc>>): number {
  let n = 0;
  for (const doc of docs.values()) n += errorsOf(doc).filter((e) => e.done !== true).length;
  return n;
}

/** Letzter Tag, an dem ein neues Thema begonnen wurde (abgeleitet aus `hist`, kein eigenes Feld). */
export function lastIntroDay(docs: ReadonlyMap<string, Readonly<Doc>>): string | null {
  let last: string | null = null;
  for (const doc of docs.values()) {
    if (isNewTopic(doc)) continue;
    const d = introDay(doc);
    if (d && (last === null || d > last)) last = d;
  }
  return last;
}

export type IntroCheck = { ok: true } | { ok: false; reason: 'recent' | 'errors' };

/** Darf heute ein neues Thema beginnen? Höchstens eines je 3 Lerntage, nie bei ≥ 10 offenen Fehlersätzen. */
export function canIntroduce(docs: ReadonlyMap<string, Readonly<Doc>>, today: string): IntroCheck {
  if (openErrorCount(docs) >= INTRO_BLOCK_ERRORS) return { ok: false, reason: 'errors' };
  const last = lastIntroDay(docs);
  if (last !== null && daysBetween(last, today) < INTRO_EVERY_DAYS) return { ok: false, reason: 'recent' };
  return { ok: true };
}

/** Das nächste neue Thema in Pfadreihenfolge (oder `null`, wenn alles begonnen ist). */
export function nextNewTopic(docs: ReadonlyMap<string, Readonly<Doc>>): string | null {
  return pathTopics().find((id) => isNewTopic(docs.get(id))) ?? null;
}

/** Das Thema, das heute neu dazukommen darf (Bremse beachtet), sonst `null`. */
export function introTopic(docs: ReadonlyMap<string, Readonly<Doc>>, today: string): string | null {
  return canIntroduce(docs, today).ok ? nextNewTopic(docs) : null;
}

/**
 * Lernweg ①–⑤ eines Themas (Erklären · Erkennen · Gelenkt · Frei · Fehlerschleife), nur aus vorhandenen
 * Daten: ① ab der ersten Antwort, ② Erkennen ab 3 Antworten und p ≥ .40 (Form Auswahl/Lücke mit Hilfe),
 * ③ Gelenkt ab 5 Antworten und p ≥ .55, ④ Frei ab 8 Antworten und p ≥ .70 (Formen nach `wantTypes`),
 * ⑤ Fehlerschleife, wenn ④ erreicht ist und kein Fehlersatz des Themas mehr offen ist.
 */
export function lernweg(topic: string, doc: Readonly<Doc> | undefined, nowMs: number): { done: readonly boolean[]; current: number } {
  const n = num(doc?.n);
  const p = topicP(topic, doc, nowMs);
  const d1 = n >= 1;
  const d2 = n >= 3 && p >= 0.4;
  const d3 = n >= 5 && p >= 0.55;
  const d4 = n >= 8 && p >= 0.7;
  const d5 = d4 && errorsOf(doc).every((e) => e.done === true);
  const done = [d1, d2, d3, d4, d5];
  const firstOpen = done.findIndex((x) => !x);
  return { done, current: firstOpen < 0 ? 4 : firstOpen };
}

/** Dauer einer Themenrunde in Minuten (8 Aufgaben je etwa 40 s), für „Als Nächstes · n Min.“. */
export const TOPIC_ROUND_MIN = 5;

// ------------------------------------------------------------------ Rückstufung in der Runde

const RANK: Record<GrammarTaskType, number> = { mc: 0, gap: 1, transform: 2, correct: 3 };
const BY_RANK: readonly GrammarTaskType[] = ['mc', 'gap', 'transform', 'correct'];

/**
 * Rückstufung (Gesamtkonzept 3.4): Zwei Fehlschläge in Folge im selben Thema → die nächste Aufgabe dieses
 * Themas wird eine Form leichter (correct → transform → gap → mc). Gilt nur in der laufenden Runde: es
 * wird nichts gespeichert, die Beherrschung (p) bleibt, wie sie ist. Eigene Fehlersätze bleiben unverändert.
 * Gibt es keine passende ungesehene Aufgabe, bleibt alles wie es ist.
 */
export function stepDownTasks(
  tasks: readonly GrammarTask[],
  pos: number,
  results: ReadonlyArray<{ topic: string; ok: boolean }>,
  candidates: readonly GrammarTask[],
  seen: ReadonlySet<string>,
): GrammarTask[] {
  const cur = tasks[pos];
  if (!cur || cur.errorT !== null || cur.type === 'mc') return [...tasks];
  const last = results.filter((r) => r.topic === cur.topic).slice(-2);
  if (last.length < 2 || last.some((r) => r.ok)) return [...tasks];
  const target = BY_RANK[RANK[cur.type] - 1];
  const used = new Set(tasks.map((t) => t.key));
  const easier = candidates.find((t) => t.topic === cur.topic && t.type === target && t.errorT === null && !used.has(t.key) && !seen.has(t.key));
  if (!easier) return [...tasks];
  const out = [...tasks];
  out[pos] = easier;
  return out;
}
