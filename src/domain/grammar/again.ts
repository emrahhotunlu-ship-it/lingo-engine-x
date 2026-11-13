import type { GrammarTask } from '../learn/types';
import { hash32 } from '../random';
import { allSeedTasks } from './tasks';

// „Gleich nochmal“ der Fehler-Karte (Politur P3): nach einem Fehler derselbe Punkt in einem NEUEN Satz – aus dem geprüften Vorrat, nicht von
// Claude erzeugt. Ein Lückensatz desselben Musters (genau eine Lücke), bevorzugt ungesehen; nie die Aufgabe selbst und nie eine, die in
// dieser Runde noch kommt. Rein und für dieselbe Aufgabe stabil. Die kleine Übung zählt nicht und wird nicht gebucht.

export type AgainTask = { en: string; answer: string; accepted: readonly string[] };

const oneGap = (prompt: string): boolean => (prompt.match(/_{3,}/g)?.length ?? 0) === 1 && !prompt.includes('→');

export function againFromPool(task: Pick<GrammarTask, 'key' | 'topic' | 'pat' | 'prompt'>, o: { seen?: ReadonlySet<string>; avoid?: ReadonlySet<string> } = {}): AgainTask | null {
  if (!task.pat) return null;
  const cands = allSeedTasks().filter((t) => t.topic === task.topic && t.pat === task.pat && t.type === 'gap' && !t.c1 && t.key !== task.key && !o.avoid?.has(t.key) && oneGap(t.prompt) && t.prompt !== task.prompt);
  if (!cands.length) return null;
  const rank = (t: GrammarTask): number => (o.seen?.has(t.key) ? 1 : 0);
  const pick = [...cands].sort((a, b) => rank(a) - rank(b) || hash32(`${task.key}|${a.key}`) - hash32(`${task.key}|${b.key}`))[0];
  return pick ? { en: pick.prompt, answer: pick.answer, accepted: pick.accepted } : null;
}
