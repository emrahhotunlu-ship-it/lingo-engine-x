import type { Lang } from '../srs/types';
import type { GrammarTask } from '../learn/types';
import { patternById, patternOf, whyFor } from './patterns';

// „Erst ein Hinweis, dann die Lösung" für getippte Grammatik-Aufgaben (docs/lernberatung.md,
// Vorschlag 4). Reihenfolge (Lernplattform 2.0 §4.7): die Leitfrage (`nudge`) des Nachbarmusters, das zur falschen Antwort passt,
// sonst die des Aufgabenmusters, sonst der Hinweis der Aufgabe (wenn er nicht ohnehin schon zu sehen ist), sonst Name des
// Themas, sonst „Achte auf die Verbform". Lokal, ohne KI.

export type GrammarRetryHint =
  | { kind: 'nudge'; text: string; pat: string }
  | { kind: 'hint'; text: string }
  | { kind: 'topic'; name: string }
  | { kind: 'verb' };

/** Muster-Kontext für die Leitfrage: die ganze Aufgabe, die falsche Antwort und die Sprache. */
export type RetryContext = { task: GrammarTask; given?: string; picked?: string; tapped?: string; lang: Lang };

/**
 * @param hintVisible Steht `task.hint` schon vor dem Prüfen auf dem Bildschirm (als Stütze unter
 *   der Lücke oder im Satz)? Dann bringt er als Hinweis nichts Neues – es folgt das Thema.
 * @param ctx Mit Kontext (und bekanntem Muster) kommt zuerst die Leitfrage des Musters.
 */
export function grammarRetryHint(task: Pick<GrammarTask, 'hint'>, topicName: string | null, hintVisible: boolean, ctx?: RetryContext): GrammarRetryHint {
  if (ctx) {
    const t = ctx.task;
    const rule = whyFor(t, { given: ctx.given, picked: ctx.picked, tapped: ctx.tapped }).rule;
    const nb = rule?.pat ? patternById(rule.pat.includes(':') ? rule.pat : `${t.topic}:${rule.pat}`) : null;
    const own = patternOf(t);
    const p = nb ?? own;
    if (p) return { kind: 'nudge', text: ctx.lang === 'de' ? p.nudge.de : p.nudge.en, pat: p.id };
  }
  const hint = task.hint?.trim();
  if (hint && !hintVisible) return { kind: 'hint', text: hint };
  const name = topicName?.trim();
  if (name) return { kind: 'topic', name };
  return { kind: 'verb' };
}
