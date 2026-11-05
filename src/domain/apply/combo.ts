import { hash32 } from '../random';
import type { Topic } from '../content';

// „Wort + Regel“-Paare für die Übung „Eigener Satz“ im Reiter Anwenden (Plan Anwenden, Übung 2, Teil B). Rein und
// getestet. Wörter: die schwächsten bekannten Karten zuerst; Themen: zuerst die mit offenen Fehlersätzen, nur Themen mit
// Kurzregel. Je Runde unterschiedliche Wörter und Themen; fest je Tag und Zähler (kein Neuwürfeln beim Neuzeichnen, Kap. 15).

/** `key`: Pfad der Wortkarte (`vocab/…`), damit ein Beleg aus Anwenden (F3) die Karte findet; fehlt bei älteren Aufrufern. */
export type ComboPair = { word: string; topicId: string; key?: string };

export type ComboWord = { word: string; lapses: number; stage: number; key?: string };

export const COMBO_ROUNDS = 3;

/**
 * `todayTopics`: Grammatikthemen des heutigen Plans (`u.gt.topics`); sie kommen vor allen anderen (Prüfung learning-scientist 02.11.2026:
 * Anwenden verbindet die Wörter und das Thema von heute). Danach Themen mit offenen Fehlersätzen, dann der Rest fest je Tag gemischt.
 */
export function pickPairs(words: readonly ComboWord[], topics: readonly Topic[], errorTopics: readonly string[], seed: string, n: number = COMBO_ROUNDS, todayTopics: readonly string[] = []): ComboPair[] {
  const usable = topics.filter((t) => t.rule && t.rule.trim());
  if (!usable.length || !words.length) return [];
  const fromToday = todayTopics.map((id) => usable.find((t) => t.id === id)).filter((t): t is Topic => !!t);
  const first = new Set(fromToday.map((t) => t.id));
  const withErrors = usable.filter((t) => !first.has(t.id) && errorTopics.includes(t.id));
  const rest = usable.filter((t) => !first.has(t.id) && !errorTopics.includes(t.id)).sort((a, b) => hash32(`${seed}|${a.id}`) - hash32(`${seed}|${b.id}`));
  const topicOrder = [...fromToday, ...withErrors, ...rest];
  const wordOrder = [...words].sort((a, b) => b.lapses - a.lapses || a.stage - b.stage || (a.word < b.word ? -1 : 1));
  const out: ComboPair[] = [];
  const seenWords = new Set<string>();
  for (const w of wordOrder) {
    if (out.length >= n) break;
    const key = w.word.toLowerCase();
    if (seenWords.has(key)) continue;
    seenWords.add(key);
    const t = topicOrder[out.length % topicOrder.length];
    if (t) out.push(w.key ? { word: w.word, topicId: t.id, key: w.key } : { word: w.word, topicId: t.id });
  }
  return out;
}
