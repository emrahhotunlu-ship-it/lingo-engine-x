import { hash32, mulberry32, shuffle } from '../domain/random';
import { GRAMMAR_TASKS, GRAMMAR_TOPICS, type GrammarTask } from './grammar';
import type { Placement } from './types';

// Grammatik-Modell des Trainers (docs/neustart.md §6): je Thema eine Sicherheit p (0–1), die mit
// jeder Antwort gleitend nachgeführt wird, und ein nächster Termin. Der Trainer wählt täglich ein
// Fokus-Thema (das schwächste fällige) und mischt zwei Aufgaben aus anderen Themen dazu.
// Gespeichert in coach/grammar: {t: {thema: TopicState}, seen: {aufgabe: ms}}.

export type TopicState = { p: number; n: number; c: number; last: number; due: number };
export type GrammarDoc = { t: Record<string, TopicState>; seen: Record<string, number> };

const DAY = 86_400_000;
export const BLOCK_FOCUS = 4;
export const BLOCK_MIX = 2;
const SEEN_MAX = 400;

export const taskKey = (t: Pick<GrammarTask, 'prompt' | 'topic'>): string => hash32(`${t.topic}|${t.prompt}`).toString(36);

/** Startwert eines Themas: Einstufung, sonst Startwert des Themas (unbekannt = 0,5). */
export function startP(topic: string, placement?: Placement): number {
  return placement?.grammar[topic] ?? 0.5;
}

export function topicState(doc: GrammarDoc | null, topic: string, placement?: Placement): TopicState {
  return doc?.t[topic] ?? { p: startP(topic, placement), n: 0, c: 0, last: 0, due: 0 };
}

/** Abstand bis zur nächsten Runde: unsicher bald wieder, sicher erst später. */
export function intervalDays(p: number): number {
  return p < 0.5 ? 1 : p < 0.7 ? 2 : p < 0.85 ? 4 : 10;
}

export function updateTopic(st: TopicState, correct: boolean, nowMs: number): TopicState {
  const p = Math.round((st.p * 0.75 + (correct ? 0.25 : 0)) * 1000) / 1000;
  return { p, n: st.n + 1, c: st.c + (correct ? 1 : 0), last: nowMs, due: nowMs + intervalDays(p) * DAY };
}

/** Welche Themen gerade dran sein dürfen: C1-Werkzeuge ab Etappe 3 oder wenn alles andere sitzt. */
export function eligibleTopics(doc: GrammarDoc | null, placement: Placement | undefined, stage: number): string[] {
  const core = GRAMMAR_TOPICS.filter((t) => t.level !== 'C1');
  const coreSolid = core.every((t) => topicState(doc, t.id, placement).p >= 0.8);
  return GRAMMAR_TOPICS.filter((t) => t.level !== 'C1' || stage >= 3 || coreSolid).map((t) => t.id);
}

/** Fokus-Thema und Mischthemen für heute. Fest je Tag (gleiche Wahl bei jedem Neuzeichnen). */
export function todaysTopics(doc: GrammarDoc | null, placement: Placement | undefined, stage: number, nowMs: number, day: string): { focus: string; mix: string[] } {
  const ids = eligibleTopics(doc, placement, stage);
  const st = (id: string) => topicState(doc, id, placement);
  const due = ids.filter((id) => st(id).due <= nowMs);
  const pool = due.length ? due : ids;
  const sorted = [...pool].sort((a, b) => st(a).p - st(b).p || st(a).last - st(b).last);
  const focus = sorted[0] ?? ids[0] ?? GRAMMAR_TOPICS[0]!.id;
  const rest = shuffle(
    ids.filter((id) => id !== focus),
    mulberry32(hash32(`mix-${day}`)),
  ).sort((a, b) => Number(st(b).due <= nowMs) - Number(st(a).due <= nowMs));
  return { focus, mix: rest.slice(0, BLOCK_MIX) };
}

/** Aufgaben eines Themas, am längsten nicht gesehene zuerst (nie gesehene vorn). */
export function pickTasks(topic: string, n: number, seen: Readonly<Record<string, number>>, seed: number): GrammarTask[] {
  const tasks = shuffle(
    GRAMMAR_TASKS.filter((t) => t.topic === topic),
    mulberry32(seed),
  );
  return [...tasks].sort((a, b) => (seen[taskKey(a)] ?? 0) - (seen[taskKey(b)] ?? 0)).slice(0, n);
}

export function grammarBlock(doc: GrammarDoc | null, placement: Placement | undefined, stage: number, nowMs: number, day: string): { focus: string; tasks: GrammarTask[] } {
  const { focus, mix } = todaysTopics(doc, placement, stage, nowMs, day);
  const seen = doc?.seen ?? {};
  const seed = hash32(`g-${day}`);
  const tasks = [...pickTasks(focus, BLOCK_FOCUS, seen, seed), ...mix.flatMap((m, i) => pickTasks(m, 1, seen, seed + i + 1))];
  return { focus, tasks };
}

/** Gesehen-Liste kappen (älteste fliegen raus), damit das Dokument klein bleibt. */
export function markSeen(seen: Readonly<Record<string, number>>, key: string, nowMs: number): Record<string, number> {
  const next = { ...seen, [key]: nowMs };
  const keys = Object.keys(next);
  if (keys.length <= SEEN_MAX) return next;
  const keep = keys.sort((a, b) => next[b]! - next[a]!).slice(0, SEEN_MAX);
  return Object.fromEntries(keep.map((k) => [k, next[k]!]));
}
