import patternMapRaw from '../../content/grammar/pattern-map.json?raw';
import pathRaw from '../../content/grammar/path.json?raw';
import retiredRaw from '../../content/grammar/retired.json?raw';
import tasksV2Raw from '../../content/grammar/tasks-v2.json?raw';
import { logError } from '../../platform/diagnostics';
import type { Bi, TaskWhy, WhyRule } from '../explain/types';
import type { GrammarTask } from '../learn/types';
import { legacyNorm, legacyTaskKey } from './key';
import {
  PathFileSchema,
  PatternMapSchema,
  RetiredFileSchema,
  TopicPatternsSchema,
  V2FileSchema,
  type PatternMap,
  type PathFile,
  type Pattern,
  type TopicPatterns,
  type V2Task,
} from './patternTypes';

// Muster der Grammatik (Lernplattform 2.0 §3.2–§3.5, §4.7). Alle Inhaltsdateien sind als Text eingebettet und werden erst
// beim ersten Gebrauch geparst (wie `raw.ts`); ungültige Dateien werden protokolliert und fehlen dann (die App fällt auf
// die aufgabeneigene Erklärung zurück, Leitsatz 5: lieber kein Beispiel als ein falsches).

const patternFiles = import.meta.glob('../../content/grammar/patterns/*.json', { query: '?raw', import: 'default', eager: true });

function parseJson(raw: string, name: string): unknown {
  try {
    return JSON.parse(raw);
  } catch (err) {
    logError('grammar:patterns', err, name);
    return null;
  }
}

let topicCache: Map<string, TopicPatterns> | null = null;
function topicMap(): Map<string, TopicPatterns> {
  if (topicCache) return topicCache;
  const out = new Map<string, TopicPatterns>();
  for (const [path, raw] of Object.entries(patternFiles)) {
    const name = path.replace(/^.*\//, '');
    const r = TopicPatternsSchema.safeParse(parseJson(raw, name));
    if (r.success) out.set(r.data.topic, r.data);
    else logError('grammar:patterns', r.error, name);
  }
  topicCache = out;
  return out;
}

/** Muster eines Themas oder `null`, wenn es (noch) keine Musterdatei gibt. */
export function patternsOf(topic: string): TopicPatterns | null {
  return topicMap().get(topic) ?? null;
}

/** Themen mit Musterdatei. */
export const topicsWithPatterns = (): string[] => [...topicMap().keys()];

let idCache: Map<string, Pattern & { topic: string }> | null = null;
function idMap(): Map<string, Pattern & { topic: string }> {
  if (idCache) return idCache;
  const out = new Map<string, Pattern & { topic: string }>();
  for (const [topic, tp] of topicMap()) for (const p of tp.patterns) out.set(p.id, { ...p, topic });
  idCache = out;
  return out;
}

/** Muster nach Kennung. `topic:id` und die bloße `id` sind beide erlaubt. */
export function patternById(id: string): (Pattern & { topic: string }) | null {
  const bare = id.includes(':') ? id.slice(id.indexOf(':') + 1) : id;
  const hit = idMap().get(bare) ?? null;
  if (!hit) return null;
  if (id.includes(':') && hit.topic !== id.slice(0, id.indexOf(':'))) return null;
  return hit;
}

let mapCache: PatternMap | null = null;
function patternMap(): PatternMap {
  if (mapCache) return mapCache;
  const r = PatternMapSchema.safeParse(parseJson(patternMapRaw, 'pattern-map.json'));
  if (!r.success) logError('grammar:patterns', r.error, 'pattern-map.json');
  mapCache = r.success ? r.data : {};
  return mapCache;
}

/** Eintrag der Zuordnungstabelle: Schlüssel `${topic}|${legacyTaskKey(prompt)}`. */
export function mapEntryOf(topic: string, key: string): PatternMap[string] | null {
  return patternMap()[`${topic}|${key}`] ?? null;
}

type TaskRef = Pick<GrammarTask, 'topic' | 'prompt'> & { pat?: string | null; answer?: string };

/** Zeichenfolge aus Satz und Lösung für den Signalwort-Abgleich (Lücke gefüllt). */
const sentenceOf = (t: TaskRef): string => (t.answer ? t.prompt.replace(/_{3,}/, t.answer) + ' ' + t.answer : t.prompt);

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Kommt das Signalwort als ganzes Wort (bzw. ganze Wortfolge) im Text vor? */
export function hasSignal(text: string, signal: string): boolean {
  const s = signal.trim();
  if (!s) return false;
  return new RegExp(`(^|[^A-Za-z'])${escapeRe(s).replace(/\s+/g, '\\s+')}($|[^A-Za-z'])`, 'i').test(text);
}

/**
 * Muster einer Aufgabe: erst `task.pat`, dann die Zuordnungstabelle, bei Aufgaben außerhalb der Tabelle (Pool, Tagesauftrag)
 * über die Signalwörter in Satz und Lösung, aber nur bei eindeutigem Treffer (genau ein Muster mit den meisten Treffern,
 * mindestens einer). Sonst `null`.
 */
export function patternOf(task: TaskRef): Pattern | null {
  if (task.pat) {
    const p = patternById(task.pat.includes(':') ? task.pat : `${task.topic}:${task.pat}`);
    if (p) return p;
  }
  const tp = patternsOf(task.topic);
  if (!tp) return null;
  const e = mapEntryOf(task.topic, legacyTaskKey(task.prompt));
  if (e) return tp.patterns.find((p) => p.id === e.pat) ?? null;
  return patternBySignals(tp, sentenceOf(task));
}

/** Eindeutiger Treffer über Signalwörter (siehe `patternOf`). */
export function patternBySignals(tp: TopicPatterns, text: string): Pattern | null {
  const scored = tp.patterns.map((p) => ({ p, n: p.signals.filter((s) => hasSignal(text, s)).length }));
  const best = Math.max(0, ...scored.map((x) => x.n));
  if (best <= 0) return null;
  const top = scored.filter((x) => x.n === best);
  return top.length === 1 ? (top[0] as { p: Pattern }).p : null;
}

// ------------------------------------------------------------------ Begründung zu einer Antwort

/** Aufgabengenaue Begründung: die der Aufgabe selbst, sonst aus der Zuordnungstabelle. */
export function taskWhy(task: Pick<GrammarTask, 'topic' | 'prompt' | 'why'>): TaskWhy | null {
  return task.why ?? mapEntryOf(task.topic, legacyTaskKey(task.prompt))?.why ?? null;
}

const normWords = (s: string): string => ` ${legacyNorm(s)} `;
const has = (hay: string, needle: string): boolean => {
  const n = legacyNorm(needle);
  return n !== '' && hay.includes(` ${n} `);
};
const sameText = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

function matches(rule: WhyRule, input: { given?: string; picked?: string; tapped?: string }): boolean {
  const cond = rule.opt !== undefined || rule.tap !== undefined || rule.if !== undefined || rule.not !== undefined;
  if (!cond) return true; // nur `pat`: allgemeine Auffangregel
  if (rule.opt !== undefined) return input.picked !== undefined && sameText(input.picked, rule.opt);
  if (rule.tap !== undefined) {
    if (input.tapped === undefined) return false;
    if (rule.tap === '*') return input.tapped !== 'none';
    return sameText(String(input.tapped), rule.tap);
  }
  const given = normWords(input.given ?? '');
  if (rule.if && !rule.if.every((w) => has(given, w))) return false;
  if (rule.not && rule.not.some((w) => has(given, w))) return false;
  return true;
}

/** Die erste passende Regel zur falschen Antwort und der „Richtig, weil“-Text der Aufgabe (beides `null`, wenn es keine Begründung gibt). */
export function whyFor(
  task: Pick<GrammarTask, 'topic' | 'prompt' | 'why'>,
  input: { given?: string; picked?: string; tapped?: string },
): { rule: WhyRule | null; ok: Bi | null } {
  const w = taskWhy(task);
  if (!w) return { rule: null, ok: null };
  return { rule: w.wrong.find((r) => matches(r, input)) ?? null, ok: w.ok };
}

// ------------------------------------------------------------------ Pfad, Familien, neue Aufgaben, stillgelegte Aufgaben

let pathCache: PathFile | null = null;
function pathFile(): PathFile {
  if (pathCache) return pathCache;
  const r = PathFileSchema.safeParse(parseJson(pathRaw, 'path.json'));
  if (!r.success) logError('grammar:patterns', r.error, 'path.json');
  pathCache = r.success ? r.data : { chapters: [] as unknown as PathFile['chapters'], families: [] };
  return pathCache;
}

/** Die sieben Kapitel des Grammatik-Pfads. */
export function chapters(): Array<{ id: string; name: Bi; topics: string[] }> {
  return pathFile().chapters.map((c) => ({ id: c.id, name: c.name, topics: [...c.topics] }));
}

/** Themen derselben Kontrastfamilie (ohne das Thema selbst); leer, wenn es keine gibt. */
export function familyOf(topic: string): string[] {
  const fam = pathFile().families.find((f) => f.includes(topic));
  return fam ? fam.filter((t) => t !== topic) : [];
}

let v2Cache: readonly V2Task[] | null = null;
/** Neue Aufgaben (Schlüsselwort, Fehler finden, Bedeutungspaar), optional eines Themas. */
export function v2Tasks(topic?: string): readonly V2Task[] {
  if (!v2Cache) {
    const r = V2FileSchema.safeParse(parseJson(tasksV2Raw, 'tasks-v2.json'));
    if (!r.success) logError('grammar:patterns', r.error, 'tasks-v2.json');
    v2Cache = r.success ? r.data.tasks : [];
  }
  return topic ? v2Cache.filter((t) => t.topic === topic) : v2Cache;
}

let retiredCache: { full: Set<string>; keys: Set<string> } | null = null;
function retired(): { full: Set<string>; keys: Set<string> } {
  if (retiredCache) return retiredCache;
  const r = RetiredFileSchema.safeParse(parseJson(retiredRaw, 'retired.json'));
  if (!r.success) logError('grammar:patterns', r.error, 'retired.json');
  const list = r.success ? r.data.retired : [];
  retiredCache = { full: new Set(list.map((x) => x.key)), keys: new Set(list.map((x) => x.key.slice(x.key.indexOf('|') + 1))) };
  return retiredCache;
}

/** Ist die Aufgabe stillgelegt (`retired.json`)? Ohne Thema zählt der Schlüssel des Satzes allein. */
export function isRetired(q: unknown, topic?: string): boolean {
  if (typeof q !== 'string' || !q.trim()) return false;
  const key = legacyTaskKey(q);
  return topic ? retired().full.has(`${topic}|${key}`) : retired().keys.has(key);
}
