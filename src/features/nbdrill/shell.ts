import type { ExplainExample, ExplainLine } from '../../domain/explain/types';
import type { ShellFeedback } from '../../ui/exercise';
import { feedbackFromFixes } from '../../ui/feedback/toShell';
import type { Feedback } from '../../ui/feedback/types';

// Trainings (Kollokationen, Umformen, Einwände …) im Übungsgerüst (Lernplattform 2.0 §4.5, Paket P8): die gemeinsame
// Rückmeldung (`Feedback`) läuft über den Adapter `feedbackFromFixes`. Trainings haben keinen Kartenstand; damit die
// Begründung nie hinter „Mehr“ verschwindet, stehen Korrekturen als offene Zeilen („Richtig, weil …“), die Lösung als
// Musterzeile und die eigene Antwort als „Deine Antwort“.

export function drillFeedback(fb: Feedback, extra: Partial<Pick<ShellFeedback, 'menu' | 'nextIn' | 'auto' | 'comparison'>> = {}, examples: ExplainExample[] = []): ShellFeedback {
  const base = feedbackFromFixes(fb, { auto: false, ...extra });
  const rest: ExplainLine[] = (base.explanation?.lines ?? []).map((l): ExplainLine => {
    if (l.k !== 'mistake') return l;
    const arrow = l.bad ? `${l.bad} → ${l.good}` : l.good;
    return { k: 'why', text: l.cause ? `${arrow}: ${l.cause}` : arrow };
  });
  const lines: ExplainLine[] = [];
  // Mit Vergleich (Wort für Wort) stehen Lösung und eigene Antwort schon darin.
  if (fb.solution && !extra.comparison) lines.push({ k: 'pattern', name: fb.solution, formula: null });
  if (fb.mine && fb.verdict !== 'ok' && !extra.comparison) lines.push({ k: 'yours', given: fb.mine, text: '' });
  lines.push(...rest);
  return { ...base, explanation: lines.length || examples.length ? { lines, examples, mark: [], ai: false, source: 'fallback' } : null };
}
