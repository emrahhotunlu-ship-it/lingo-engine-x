import { TOPICS } from '../content';
import { dayKey, daysBetween } from '../date';
import type { GrammarTask, GrammarTaskType } from '../learn/types';
import { patternState, patternStateNo, patsOf } from '../metrics/pattern';
import type { GrammarDay, PatState } from '../plan/types';
import { grammarFehlersaetzeDue } from '../repair/fehlersaetze';
import { certainty, topicP } from './bkt';
import { liveErrorsOf } from './errors';
import { rankTopics } from './tasks';

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
/** Ab so vielen FÄLLIGEN Fehlersätzen kommt kein neues Thema dazu (offene, noch nicht fällige zählen nicht: der Dauerstand würde sonst jede Einführung stoppen). */
export const INTRO_BLOCK_ERRORS = 10;

/**
 * Fällige Grammatik-Fehlersätze über alle Themen (Lernplattform 2.0 §4.9, `grammarErrorsDue`): derselbe Filter wie bei „Fehler korrigieren“ –
 * Sätze vom heutigen Lerntag nie, nichts doppelt, nur gültige Sätze. Die Bremse und die Zahl auf dem Knopf zählen dasselbe.
 */
export function dueErrorCount(docs: ReadonlyMap<string, Readonly<Doc>>, nowMs: number): number {
  return grammarFehlersaetzeDue({ grammarDocs: docs, nowMs, today: dayKey(nowMs) });
}

/** Letzter Tag, an dem ein neues Thema begonnen wurde (abgeleitet aus `hist`, kein eigenes Feld). */
export function lastIntroDay(docs: ReadonlyMap<string, Readonly<Doc>>): string | null {
  let last: string | null = null;
  for (const doc of docs.values()) {
    if (isNewTopic(doc)) continue;
    // Ein bestandener Vortest hält das nächste neue Thema nicht auf (Lernplattform 2.0 §4.7): solche Themen zählen nicht als Einführungstag.
    const vt = doc.vt;
    if (vt && typeof vt === 'object' && !Array.isArray(vt) && (vt as Doc).ok === true) continue;
    const d = introDay(doc);
    if (d && (last === null || d > last)) last = d;
  }
  return last;
}

export type IntroCheck = { ok: true } | { ok: false; reason: 'recent' | 'errors' };

/** Darf heute ein neues Thema beginnen? Höchstens eines je 3 Lerntage, nie bei ≥ 10 fälligen Fehlersätzen. */
export function canIntroduce(docs: ReadonlyMap<string, Readonly<Doc>>, today: string, nowMs: number): IntroCheck {
  if (dueErrorCount(docs, nowMs) >= INTRO_BLOCK_ERRORS) return { ok: false, reason: 'errors' };
  const last = lastIntroDay(docs);
  if (last !== null && daysBetween(last, today) < INTRO_EVERY_DAYS) return { ok: false, reason: 'recent' };
  return { ok: true };
}

/** Das nächste neue Thema in Pfadreihenfolge (oder `null`, wenn alles begonnen ist). */
export function nextNewTopic(docs: ReadonlyMap<string, Readonly<Doc>>): string | null {
  return pathTopics().find((id) => isNewTopic(docs.get(id))) ?? null;
}

/** Das Thema, das heute neu dazukommen darf (Bremse beachtet), sonst `null`. */
export function introTopic(docs: ReadonlyMap<string, Readonly<Doc>>, today: string, nowMs: number): string | null {
  return canIntroduce(docs, today, nowMs).ok ? nextNewTopic(docs) : null;
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
  const d5 = d4 && liveErrorsOf(doc, topic).every((e) => e.done === true);
  const done = [d1, d2, d3, d4, d5];
  const firstOpen = done.findIndex((x) => !x);
  return { done, current: firstOpen < 0 ? 4 : firstOpen };
}

/** Dauer einer Themenrunde in Minuten (8 Aufgaben je etwa 40 s), für „Als Nächstes · n Min.“. */
export const TOPIC_ROUND_MIN = 5;

// ------------------------------------------------------------------ Rückstufung in der Runde

const RANK: Record<GrammarTaskType, number> = { meaning: 0, mc: 0, gap: 1, transform: 2, find: 2, kwt: 2, correct: 3 };
const BY_RANK: readonly GrammarTaskType[] = ['mc', 'gap', 'transform', 'correct'];
/** Rückstufung der neuen Arten (Lernplattform 2.0 §10.0): kwt → gap, find → mc; die übrigen gehen eine Stufe in BY_RANK zurück. */
const STEP_DOWN: Partial<Record<GrammarTaskType, GrammarTaskType>> = { kwt: 'gap', find: 'mc' };

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
  if (!cur || cur.errorT !== null || RANK[cur.type] === 0) return [...tasks];
  const last = results.filter((r) => r.topic === cur.topic).slice(-2);
  if (last.length < 2 || last.some((r) => r.ok)) return [...tasks];
  const target = STEP_DOWN[cur.type] ?? BY_RANK[RANK[cur.type] - 1];
  const used = new Set(tasks.map((t) => t.key));
  const easier = candidates.find((t) => t.topic === cur.topic && t.type === target && t.errorT === null && !used.has(t.key) && !seen.has(t.key));
  if (!easier) return [...tasks];
  const out = [...tasks];
  out[pos] = easier;
  return out;
}

// ------------------------------------------------------------------ Einführungsschritt und eingefrorenes Grammatikthema (Lernplattform 2.0 §2.3, §3.2)

const PAT_OK_N = 3;
const PAT_OK_C = 2;

/**
 * Der Einführungsschritt des Tages: höchstens EINER je Lerntag über alle Themen. Quelle der Schritte ist `introPlanOf(thema)` (aus der Musterdatei,
 * `introPlan`), eingespritzt, damit dieser Ordner nichts von den Inhaltsdateien weiß. Reihenfolge:
 * 1. Wurde heute schon ein Thema oder ein Schritt eingeführt (Grammatik-Reiter): `{ topic, pats: [], fresh: false }` – die Runde bleibt dort, ohne Vortest und Karten.
 * 2. Ein Folgeschritt eines begonnenen Themas (Pfadreihenfolge), wenn jedes Muster des vorigen Schritts mindestens 3 Antworten und 2 richtige hat
 *    und der vorige Schritt nicht von heute ist. Folgeschritte zählen nicht für die Bremse, belegen aber den Platz des Tages.
 * 3. Das nächste neue Thema, wenn die Bremse es erlaubt: sein erster Schritt (`fresh: true`, mit Vortest).
 * Ohne Musterdatei (`introPlanOf` → null) gibt es keine Muster (`pats: []`); das neue Thema selbst bleibt möglich.
 */
export function introStepFor(i: {
  docs: ReadonlyMap<string, Readonly<Doc>>;
  today: string;
  nowMs: number;
  introPlanOf: (topic: string) => string[][] | null;
}): { topic: string; pats: string[]; fresh: boolean } | null {
  const order = pathTopics();
  // 1. Heute schon eingeführt (Thema begonnen oder Schritt gelegt).
  for (const topic of order) {
    const doc = i.docs.get(topic);
    if (isNewTopic(doc)) continue;
    const pats = patsOf(doc);
    if (introDay(doc) === i.today || Object.values(pats).some((e) => e.i === i.today)) return { topic, pats: [], fresh: false };
  }
  // 2. Folgeschritt.
  for (const topic of order) {
    const doc = i.docs.get(topic);
    if (isNewTopic(doc)) continue;
    const plan = i.introPlanOf(topic);
    if (!plan) continue;
    const pats = patsOf(doc);
    const k = plan.findIndex((step) => !step.every((id) => pats[id]?.i !== undefined));
    if (k <= 0) continue;
    const prev = plan[k - 1] ?? [];
    const ready = prev.every((id) => {
      const e = pats[id];
      return !!e && (e.n ?? 0) >= PAT_OK_N && (e.c ?? 0) >= PAT_OK_C && e.i !== undefined && e.i < i.today;
    });
    if (ready) return { topic, pats: (plan[k] ?? []).slice(0, 2), fresh: false };
  }
  // 3. Neues Thema (Bremse beachtet).
  const topic = introTopic(i.docs, i.today, i.nowMs);
  if (!topic) return null;
  return { topic, pats: (i.introPlanOf(topic)?.[0] ?? []).slice(0, 2), fresh: true };
}

/** Obergrenze der eingefrorenen Musterzustände (`u.ps`). */
export const PS_MAX = 24;

/**
 * Das Grammatikthema des Tages und die Musterzustände vom Morgen, beim Anlegen des Plans eingefroren (`u.gt`, `u.ps`). Deterministisch für denselben
 * Stand (`seed` = Lerntag). Danach ändern erledigte oder neue Fehlersätze nichts mehr: Titel, gestartete Runde, Satzbau und Abschlusskarte lesen nur diese Werte.
 */
export function freezeGrammarDay(i: {
  docs: ReadonlyMap<string, Readonly<Doc>>;
  today: string;
  nowMs: number;
  introPlanOf: (topic: string) => string[][] | null;
  seed: string;
}): { gt: GrammarDay; ps: Record<string, PatState> } {
  const step = introStepFor(i);
  const intro = step?.topic ?? null;
  const pats = step ? step.pats.slice(0, 2) : [];
  let topics = rankTopics({ grammarDocs: i.docs, nowMs: i.nowMs, seed: i.seed, introduce: intro })
    .slice(0, 3)
    .map((r) => r.topic);
  // Wie `selectRound`: das Thema des Tages steht immer dabei, als zweites.
  if (intro && !topics.includes(intro)) topics = [topics[0] ?? intro, intro, ...topics.slice(1, 2)].filter((t, k, a) => a.indexOf(t) === k);
  topics = topics.slice(0, 3);
  const ps: Record<string, PatState> = {};
  for (const topic of topics) {
    const doc = i.docs.get(topic);
    const entries = patsOf(doc);
    const ids = [...new Set([...(i.introPlanOf(topic)?.flat() ?? []), ...Object.keys(entries)])];
    for (const id of ids) {
      if (Object.keys(ps).length >= PS_MAX) break;
      ps[id] = patternStateNo(patternState(entries[id], i.today));
    }
  }
  return { gt: { intro, pats, topics }, ps };
}
