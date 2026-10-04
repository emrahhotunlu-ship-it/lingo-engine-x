import { hash32 } from '../random';
import type { Topic } from '../content';

// „Wort + Regel“-Paare für die Übung „Eigener Satz“ im Reiter Anwenden (Plan Anwenden, Übung 2, Teil B). Rein und
// getestet. Wörter: die schwächsten bekannten Karten zuerst; Themen: zuerst die mit offenen Fehlersätzen, nur Themen mit
// Kurzregel. Je Runde unterschiedliche Wörter und Themen; fest je Tag und Zähler (kein Neuwürfeln beim Neuzeichnen, Kap. 15).

export type ComboPair = { word: string; topicId: string };

export type ComboWord = { word: string; lapses: number; stage: number };

export const COMBO_ROUNDS = 3;

export function pickPairs(words: readonly ComboWord[], topics: readonly Topic[], errorTopics: readonly string[], seed: string, n: number = COMBO_ROUNDS): ComboPair[] {
  const usable = topics.filter((t) => t.rule && t.rule.trim());
  if (!usable.length || !words.length) return [];
  const withErrors = usable.filter((t) => errorTopics.includes(t.id));
  const rest = usable.filter((t) => !errorTopics.includes(t.id)).sort((a, b) => hash32(`${seed}|${a.id}`) - hash32(`${seed}|${b.id}`));
  const topicOrder = [...withErrors, ...rest];
  const wordOrder = [...words].sort((a, b) => b.lapses - a.lapses || a.stage - b.stage || (a.word < b.word ? -1 : 1));
  const out: ComboPair[] = [];
  const seenWords = new Set<string>();
  for (const w of wordOrder) {
    if (out.length >= n) break;
    const key = w.word.toLowerCase();
    if (seenWords.has(key)) continue;
    seenWords.add(key);
    const t = topicOrder[out.length % topicOrder.length];
    if (t) out.push({ word: w.word, topicId: t.id });
  }
  return out;
}
