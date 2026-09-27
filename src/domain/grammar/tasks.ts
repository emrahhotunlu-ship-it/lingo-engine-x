import grammarJson from '../../content/legacy/grammar.json';
import extraJson from '../../content/grammar-extra.json';
import rulesJson from '../../content/legacy/rules.json';
import { TOPICS, topicById } from '../content';
import type { GrammarTask, GrammarTaskType, TaskSrc } from '../learn/types';
import { hash32, mulberry32, shuffle } from '../random';
import { topicP } from './bkt';
import { dueErrors } from './errors';
import { legacyTaskKey } from './key';
import { asText } from '../text/str';

// Aufgaben: Normalisierung (Port von `validG`, grammar.js:51) und Auswahl einer Runde
// (phase2-plan §5.2). Rein: Zeit und Startwert kommen als Parameter.

type Doc = Record<string, unknown>;

const TYPES: readonly GrammarTaskType[] = ['mc', 'gap', 'transform', 'correct'];
const s = asText;
const strOrNull = (v: unknown): string | null => {
  const t = s(v).trim();
  return t ? t : null;
};

/**
 * Rohaufgabe (Seed, `daily/*`, Pool, Lektion, KI) → Aufgabe oder `null` (wie `validG`):
 * Thema bekannt, Typ gültig, Prompt und Lösung da; `mc` mit ≥ 2 Optionen und der Lösung darunter.
 */
export function normalizeTask(raw: unknown, src: TaskSrc, ref: string | null = null): GrammarTask | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const it = raw as Doc;
  const topic = s(it.topic);
  if (!topicById(topic)) return null;
  const type = TYPES.includes(it.type as GrammarTaskType) ? (it.type as GrammarTaskType) : null;
  const prompt = s(it.prompt).trim();
  const answer = s(it.answer).trim();
  if (!type || !prompt || !answer) return null;
  let options: string[] | null = null;
  if (type === 'mc') {
    options = Array.isArray(it.options) ? it.options.map(s).filter(Boolean) : [];
    if (options.length < 2 || !options.some((o) => o.trim() === answer)) return null;
  }
  const accepted = Array.isArray(it.accepted) ? it.accepted.map(s).map((x) => x.trim()).filter(Boolean) : [];
  return {
    key: legacyTaskKey(prompt),
    topic,
    type,
    prompt,
    answer,
    accepted,
    options,
    hint: strOrNull(it.hint_de) ?? strOrNull(it.hint),
    expl: { de: strOrNull(it.explanation_de) ?? strOrNull(it.expl), en: strOrNull(it.explanation_en) ?? strOrNull(it.expl_en) },
    src,
    ref: ref ?? strOrNull(it.ref),
    errorT: null,
  };
}

/** Aufgabe in der Speicherform der alten App (Pool-Eintrag, `validG`-Felder). */
export function toPoolItem(t: GrammarTask): Doc {
  const out: Doc = {
    topic: t.topic,
    type: t.type,
    prompt: t.prompt,
    options: t.options,
    answer: t.answer,
    accepted: t.accepted,
    hint_de: t.hint ?? '',
    explanation_de: t.expl.de ?? '',
    explanation_en: t.expl.en ?? '',
    src: t.src,
  };
  if (t.ref) out.ref = t.ref;
  return out;
}

type RuleTrap = { bad?: unknown; good?: unknown; why?: unknown };
const RULES = (rulesJson as { rules: Record<string, { traps?: RuleTrap[] }> }).rules;

let seedCache: GrammarTask[] | null = null;
/**
 * Startaufgaben ohne KI: die 48 Aufgaben der alten App plus je Falle aus dem Regelwerk eine
 * Satzkorrektur (`bad` → `good`) und wenige ergänzte Aufgaben (content/grammar-extra.json). So hat
 * jedes Thema mindestens vier Aufgaben (Grundfassung, D11).
 */
export function seedTasks(): readonly GrammarTask[] {
  if (seedCache) return seedCache;
  const out: GrammarTask[] = [];
  const keys = new Set<string>();
  const push = (t: GrammarTask | null) => {
    if (t && !keys.has(t.key)) {
      keys.add(t.key);
      out.push(t);
    }
  };
  for (const g of grammarJson.seedGrammar as unknown[]) push(normalizeTask(g, 'seed'));
  for (const g of extraJson.tasks as unknown[]) push(normalizeTask(g, 'seed', 'content/grammar-extra'));
  for (const tp of TOPICS) {
    for (const trap of RULES[tp.id]?.traps ?? []) {
      const why = Array.isArray(trap.why) ? trap.why.map(s) : [];
      push(normalizeTask({ topic: tp.id, type: 'correct', prompt: s(trap.bad), answer: s(trap.good), expl: why[0], expl_en: why[1] }, 'seed', `rules/${tp.id}`));
    }
  }
  seedCache = out;
  return out;
}

/** Wunschformen nach Beherrschung (§5.2): unsicher erkennen, mittel ergänzen, sicher selbst bauen. */
export function wantTypes(p: number): GrammarTaskType[] {
  if (p < 0.4) return ['mc', 'gap'];
  if (p <= 0.7) return ['gap', 'transform'];
  return ['correct', 'transform'];
}

/** Stufe mit Hilfe (Platzhalter von Anfang an sichtbar): p < .40. */
export const scaffolded = (p: number): boolean => p < 0.4;

export type RoundMode = 'duty' | 'xtra' | 'errors' | 'topic';

export type RoundInput = {
  mode: RoundMode;
  /** Nur bei `topic`: das Thema. */
  topic?: string | null;
  /** Thema der nächsten offenen Lektion (wird eingemischt). */
  nextLessonTopic?: string | null;
  /** Thema der heutigen Lektion – in der Pflichtrunde ausgenommen (Kap. 15, nichts dreimal). */
  lessonTopicToday?: string | null;
  grammarDocs: ReadonlyMap<string, Readonly<Doc>>;
  /** Offene Aufgaben aus `daily/*`, neueste Tage zuerst. */
  dailyOpen: readonly GrammarTask[];
  pool: readonly GrammarTask[];
  /** Aufgaben erledigter Lektionen. */
  lessonTasks: readonly GrammarTask[];
  nowMs: number;
  size: number;
  /** Startwert, z. B. `${tag}|${modus}`. */
  seed: string;
};

export const ROUND_SIZE = { duty: 6, xtra: 8, errors: 8, topic: 8 } as const;
export const ERRORS_PER_ROUND = 3;

const seenOf = (doc: Readonly<Doc> | undefined): Set<string> => new Set(Array.isArray(doc?.seen) ? (doc.seen as unknown[]).map(s) : []);

/** Themen nach Bedarf: schwach, fällig, wenig geübt zuerst; Gleichstand per Startwert. */
export function rankTopics(i: Pick<RoundInput, 'grammarDocs' | 'nowMs' | 'seed'>): Array<{ topic: string; p: number; need: number }> {
  return TOPICS.map((tp) => {
    const doc = i.grammarDocs.get(tp.id);
    const p = topicP(tp.id, doc, i.nowMs);
    const n = typeof doc?.n === 'number' ? doc.n : 0;
    const due = typeof doc?.due === 'number' ? doc.due : null;
    let need = (1 - p) * (tp.level === 'B1' ? 0.85 : 1);
    if (n < 3) need += 0.2;
    if (n && due !== null) need += due <= i.nowMs ? 0.18 : p > 0.6 ? -0.2 : 0;
    return { topic: tp.id, p, need, tie: hash32(`${i.seed}|${tp.id}`) };
  })
    .sort((a, b) => b.need - a.need || a.tie - b.tie)
    .map(({ topic, p, need }) => ({ topic, p, need }));
}

/**
 * Runde zusammenstellen (§5.2). Quellen je Thema in dieser Reihenfolge: offene `daily`-Aufgaben,
 * Pool, Aufgaben erledigter Lektionen, Startaufgaben (ungesehen; notfalls auch gesehene, damit
 * die Runde voll wird). Fällige Fehler (höchstens 3) stehen vorn; ab Box 1 wird bevorzugt eine
 * ungesehene Variante gleichen Themas und Typs gestellt. Verschachtelt: ≥ 3 Themen, höchstens
 * 2 gleiche hintereinander (nur ein sehr schwaches Thema, p < .35, beginnt mit 2 am Stück).
 */
export function selectRound(i: RoundInput): GrammarTask[] {
  const rng = mulberry32(hash32(i.seed));
  const used = new Set<string>();
  const seed = seedTasks();
  const sources: readonly (readonly GrammarTask[])[] = [i.dailyOpen, i.pool, i.lessonTasks, shuffle(seed, rng)];

  // Quellen haben Vorrang vor der Wunschform: Eine Aufgabe des Tagesauftrags kommt vor jeder
  // Startaufgabe; innerhalb einer Quelle gewinnt die gewünschte Form (`strict`: nur diese).
  const fresh = (topic: string, prefer: readonly GrammarTaskType[] | null, strict = false): GrammarTask | null => {
    const seen = seenOf(i.grammarDocs.get(topic));
    for (const list of sources) {
      const cands = list.filter((t) => t.topic === topic && !used.has(t.key) && !seen.has(t.key));
      if (!cands.length) continue;
      if (!prefer) return cands[0] ?? null;
      for (const ty of prefer) {
        const hit = cands.find((t) => t.type === ty);
        if (hit) return hit;
      }
      if (!strict) return cands[0] ?? null;
    }
    return null;
  };
  const anySeed = (topic: string): GrammarTask | null => seed.find((t) => t.topic === topic && !used.has(t.key)) ?? null;
  const take = (t: GrammarTask | null): GrammarTask | null => {
    if (!t) return null;
    used.add(t.key);
    return t;
  };

  // 1. Fällige Fehler.
  const errors: GrammarTask[] = [];
  const due = dueErrors(i.grammarDocs, i.nowMs).filter((d) => (i.mode === 'topic' ? d.topic === i.topic : true));
  const maxErr = i.mode === 'errors' ? i.size : Math.min(ERRORS_PER_ROUND, i.size);
  for (const d of due) {
    if (errors.length >= maxErr) break;
    if (used.has(d.task.key)) continue;
    used.add(d.task.key);
    const variant = d.box >= 1 ? fresh(d.topic, [d.task.type], true) : null;
    if (variant) {
      used.add(variant.key);
      errors.push({ ...variant, errorT: d.task.errorT });
    } else errors.push(d.task);
  }
  if (i.mode === 'errors') return errors;

  // 2. Themen der Runde.
  const ranked = rankTopics(i);
  let topics: string[];
  if (i.mode === 'topic' && i.topic && topicById(i.topic)) topics = [i.topic];
  else {
    const skip = i.mode === 'duty' ? i.lessonTopicToday ?? null : null;
    const order = ranked.map((r) => r.topic).filter((t) => t !== skip);
    const next = i.nextLessonTopic && i.nextLessonTopic !== skip && topicById(i.nextLessonTopic) ? i.nextLessonTopic : null;
    topics = order.slice(0, 3);
    if (next && !topics.includes(next)) topics = [topics[0] ?? next, next, ...topics.slice(1, 2)].filter((t, k, a) => a.indexOf(t) === k);
    for (const t of order) if (topics.length < 3 && !topics.includes(t)) topics.push(t);
  }

  // 3. Aufgaben je Thema, Formen nach Beherrschung im Wechsel.
  const pOf = (t: string) => topicP(t, i.grammarDocs.get(t), i.nowMs);
  const perTopic = new Map<string, GrammarTask[]>(topics.map((t) => [t, []]));
  const slots = Math.max(0, i.size - errors.length);
  let guard = 0;
  let k = 0;
  let placed = 0;
  while (placed < slots && guard < slots * topics.length * 4 + 8) {
    guard++;
    const topic = topics[k % topics.length] as string;
    k++;
    const list = perTopic.get(topic) as GrammarTask[];
    const want = wantTypes(pOf(topic));
    const type = want[list.length % want.length] as GrammarTaskType;
    const pick = take(fresh(topic, [type, ...want.filter((w) => w !== type)]));
    if (pick) {
      list.push(pick);
      placed++;
    } else if (guard > slots * topics.length) {
      const again = take(anySeed(topic));
      if (again) {
        list.push(again);
        placed++;
      }
    }
  }

  // 4. Verschachteln.
  const queues = topics.map((t) => [...(perTopic.get(t) ?? [])]);
  const out: GrammarTask[] = [];
  const first = topics[0];
  if (first && topics.length > 1 && pOf(first) < 0.35 && (queues[0]?.length ?? 0) >= 2) {
    out.push(queues[0]!.shift() as GrammarTask, queues[0]!.shift() as GrammarTask);
  }
  let idx = out.length ? 1 : 0;
  let emptyTurns = 0;
  while (queues.some((q) => q.length) && emptyTurns <= queues.length) {
    const q = queues[idx % queues.length] as GrammarTask[];
    idx++;
    const next = q[0];
    if (!next) {
      emptyTurns++;
      continue;
    }
    const a = out[out.length - 1];
    const b = out[out.length - 2];
    // Höchstens zwei gleiche hintereinander – außer es gibt nichts anderes mehr.
    if (a && b && a.topic === next.topic && b.topic === next.topic && queues.some((o) => o !== q && o.length)) {
      emptyTurns++;
      continue;
    }
    out.push(q.shift() as GrammarTask);
    emptyTurns = 0;
  }
  return [...errors, ...out];
}

/** Ungesehene Aufgaben eines Themas in allen Quellen (für „Neue Aufgaben" erst unter 8). */
export function unseenCount(topic: string, doc: Readonly<Doc> | undefined, lists: readonly (readonly GrammarTask[])[]): number {
  const seen = seenOf(doc);
  const keys = new Set<string>();
  for (const l of [...lists, seedTasks()]) for (const t of l) if (t.topic === topic && !seen.has(t.key)) keys.add(t.key);
  return keys.size;
}

