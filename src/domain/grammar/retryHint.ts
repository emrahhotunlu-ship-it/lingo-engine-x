import type { GrammarTask } from '../learn/types';

// „Erst ein Hinweis, dann die Lösung" für getippte Grammatik-Aufgaben (docs/lernberatung.md,
// Vorschlag 4). Reihenfolge: der Hinweis der Aufgabe (wenn er nicht ohnehin schon zu sehen ist),
// sonst Name des Themas, sonst „Achte auf die Verbform". Lokal, ohne KI.

export type GrammarRetryHint = { kind: 'hint'; text: string } | { kind: 'topic'; name: string } | { kind: 'verb' };

/**
 * @param hintVisible Steht `task.hint` schon vor dem Prüfen auf dem Bildschirm (als Stütze unter
 *   der Lücke oder im Satz)? Dann bringt er als Hinweis nichts Neues – es folgt das Thema.
 */
export function grammarRetryHint(task: Pick<GrammarTask, 'hint'>, topicName: string | null, hintVisible: boolean): GrammarRetryHint {
  const hint = task.hint?.trim();
  if (hint && !hintVisible) return { kind: 'hint', text: hint };
  const name = topicName?.trim();
  if (name) return { kind: 'topic', name };
  return { kind: 'verb' };
}
