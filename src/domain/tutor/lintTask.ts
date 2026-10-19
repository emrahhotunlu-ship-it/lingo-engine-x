import { splitWords } from '../answer/align';
import { legacyNorm } from '../grammar/key';
import { foreignSignalPattern, patternNearGap, patternOf, patternsOf } from '../grammar/patterns';
import { splitTransform } from '../grammar/tasks';
import type { GrammarTask } from '../learn/types';

// Prüfung der Aufgaben-Hülle (Tutor-Engine v3 §4.2). Rein. Bis zum Inhalts-Audit nur eine Warnliste (Test über den ganzen Bestand,
// `tests/tutor/lint.test.ts`); zur Sperre wird sie erst danach und vor jeder Annahme von Claude-Aufgaben (E5).
//
//   ambiguous      mehrere Lücken, doppelte Auswahl, `alt` und `accepted` überschneiden sich (eine Antwort wäre zugleich Ziel und „anderes Muster“)
//   no_goal        Fehler finden / Satz verbessern ohne Ziel-Satz (`goal`): Emrah weiß nicht, worauf die Aufgabe hinaus will
//   gap_whole      die Lücke deckt fast den ganzen Satz ab, oder die Lösung wiederholt ein Wort direkt neben der Lücke
//   no_verb        die Lösung braucht ein Verb, aber weder Klammer-Hinweis „(verb)“ noch Auswahl noch Ausgangssatz nennen es
//   no_source      Umformung ohne Ausgangssatz, Schlüsselwort-Aufgabe ohne Ausgangssatz, Satzkorrektur, deren Satz schon richtig ist, Fehler finden ohne richtigen Satz
//   foreign_signal der Satz trägt außerhalb der Lücke Signalwörter eines anderen Musters, und das Signal nahe der Lücke zeigt nicht auf das eigene

export type LintIssue = 'ambiguous' | 'no_goal' | 'gap_whole' | 'no_verb' | 'no_source' | 'foreign_signal';
export const LINT_ISSUES: readonly LintIssue[] = ['ambiguous', 'no_goal', 'gap_whole', 'no_verb', 'no_source', 'foreign_signal'];

const GAP_RE = /_{3,}/g;
const HINT_RE = /\(\s*[a-z][^)]*\)/i;
const VERBISH =
  /\b(am|is|are|was|were|be|been|being|have|has|had|will|would|shall|should|can|could|may|might|must|do|does|did|used|going)\b|\b[a-z]{3,}(ed|ing)\b|n't\b|'(ve|ll|d|re|s)\b/i;

const gapTarget = (t: GrammarTask): string => (t.type === 'transform' ? splitTransform(t.prompt).target : t.prompt);
const w = (s: string): string[] => splitWords(legacyNorm(s));

export function lintTask(task: GrammarTask): readonly LintIssue[] {
  const out = new Set<LintIssue>();
  const target = gapTarget(task);
  const gaps = (target.match(GAP_RE) ?? []).length;
  const gapType = task.type === 'gap' || task.type === 'transform' || task.type === 'kwt' || task.type === 'mc';

  // ambiguous
  if (gapType && gaps > 1) out.add('ambiguous');
  if (task.options) {
    const opts = task.options.map(legacyNorm);
    if (new Set(opts).size !== opts.length) out.add('ambiguous');
  }
  const acc = new Set([task.answer, ...task.accepted].map(legacyNorm));
  if ((task.alt ?? []).some((a) => acc.has(legacyNorm(a)))) out.add('ambiguous');

  // no_goal
  if ((task.type === 'find' || task.type === 'correct') && !task.goal) out.add('no_goal');

  // gap_whole
  if (gapType && gaps === 1 && task.answer.trim()) {
    const rest = w(target.replace(GAP_RE, ' ').replace(HINT_RE, ' '));
    const ans = w(task.answer);
    const [before = '', after = ''] = target.replace(HINT_RE, ' ').split(/_{3,}/);
    const prev = w(before).at(-1);
    const next = w(after)[0];
    if (rest.length < 2 || (prev !== undefined && prev === ans[0]) || (next !== undefined && next === ans.at(-1))) out.add('gap_whole');
  }

  // no_verb (nur Lücken ohne Ausgangssatz: Umformung und Schlüsselwort nennen das Verb im Ausgangssatz)
  // Ein Hinweis wie „(3 words)“ nennt kein Verb; „(send)“ oder „send“ schon.
  const hintNamesWord = !!task.hint && /[a-z]{2,}/i.test(task.hint) && !/\bwords?\b/i.test(task.hint);
  if (task.type === 'gap' && !task.options && !HINT_RE.test(task.prompt) && !hintNamesWord && VERBISH.test(task.answer)) out.add('no_verb');

  // no_source
  if (task.type === 'transform' && !splitTransform(task.prompt).from) out.add('no_source');
  if (task.type === 'kwt' && !(task.x?.kind === 'kwt' && task.x.from.trim())) out.add('no_source');
  if (task.type === 'correct' && legacyNorm(task.prompt) === legacyNorm(task.answer)) out.add('no_source');
  if (task.type === 'find' && task.x?.kind === 'find' && task.x.err && !task.x.fixed) out.add('no_source');

  // foreign_signal
  if ((task.type === 'gap' || task.type === 'transform' || task.type === 'kwt') && gaps === 1) {
    const tp = patternsOf(task.topic);
    const own = patternOf({ ...task, prompt: target });
    if (tp && own) {
      const outside = target.replace(GAP_RE, ' ');
      if (foreignSignalPattern(tp, own.id, outside) && patternNearGap(tp, target, task.answer)?.id !== own.id) out.add('foreign_signal');
    }
  }
  return LINT_ISSUES.filter((i) => out.has(i));
}
